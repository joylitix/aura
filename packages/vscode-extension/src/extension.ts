import * as readline from 'node:readline';
import * as crypto from 'node:crypto';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { SCHEMA_VERSION } from '@aura/protocol';

let child: ChildProcessWithoutNullStreams | undefined;
let lineReader: readline.Interface | undefined;

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('aura.startSession', () =>
    startSession(context)
  );
  context.subscriptions.push(disposable);
  context.subscriptions.push(
    new vscode.Disposable(() => {
      killChild();
    })
  );
}

export function deactivate() {
  killChild();
}

function killChild() {
  lineReader?.close();
  lineReader = undefined;
  if (child && !child.killed) {
    child.kill('SIGTERM');
  }
  child = undefined;
}

/** NDJSON lines from daemon → output channel; resolve a turn when model finishes or errors. */
function createTurnCoordinator(channel: vscode.OutputChannel, sessionId: string) {
  let pending: { resolve: () => void; reject: (e: Error) => void } | null = null;
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const onLine = (line: string) => {
    channel.appendLine(line);
    if (!pending) {
      return;
    }
    try {
      const ev = JSON.parse(line) as {
        type?: string;
        payload?: { sessionId?: string };
      };
      const sid = ev.payload?.sessionId;
      const sameSession = sid === undefined || sid === sessionId;
      if (!sameSession) {
        return;
      }
      if (
        ev.type === 'assistant/done' ||
        ev.type === 'error' ||
        ev.type === 'session/cancelled'
      ) {
        clearTimeout(timeout);
        timeout = undefined;
        const p = pending;
        pending = null;
        p.resolve();
      }
    } catch {
      /* non-json */
    }
  };

  const waitForTurnEnd = (ms: number): Promise<void> =>
    new Promise((resolve, reject) => {
      if (pending) {
        reject(new Error('internal: turn wait already active'));
        return;
      }
      pending = { resolve, reject };
      timeout = setTimeout(() => {
        if (pending) {
          const p = pending;
          pending = null;
          p.reject(new Error(`No assistant/done or error within ${Math.round(ms / 1000)}s`));
        }
      }, ms);
    });

  const dispose = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = undefined;
    }
    pending = null;
  };

  return { onLine, waitForTurnEnd, dispose };
}

async function startSession(context: vscode.ExtensionContext) {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) {
    const pick = await vscode.window.showErrorMessage(
      'Aura needs a folder workspace (single root). The Extension Development Host often opens empty—use File → Open Folder… first.',
      'Open Folder…'
    );
    if (pick === 'Open Folder…') {
      await vscode.commands.executeCommand('workbench.action.files.openFolder');
    }
    return;
  }
  if (folders.length > 1) {
    void vscode.window.showWarningMessage(
      'Aura POC uses only the first workspace folder for tooling.'
    );
  }

  const workspaceRoot = folders[0].uri.fsPath;
  const cfg = vscode.workspace.getConfiguration('aura');
  const provider = cfg.get<string>('provider') ?? 'openai';
  const model = cfg.get<string>('model') ?? 'gpt-4o-mini';
  const openaiBaseUrl = cfg.get<string>('openaiBaseUrl');
  const ollamaBaseUrl = cfg.get<string>('ollamaBaseUrl');

  if (provider === 'openai') {
    const existing = await context.secrets.get('aura.openaiApiKey');
    if (!existing) {
      const key = await vscode.window.showInputBox({
        title: 'OpenAI API key',
        password: true,
        ignoreFocusOut: true,
        placeHolder: 'Stored in VS Code secret storage (aura.openaiApiKey)',
      });
      if (key) {
        await context.secrets.store('aura.openaiApiKey', key);
      } else {
        void vscode.window.showErrorMessage('An API key is required for the OpenAI provider.');
        return;
      }
    }
  }

  const resolvedKey = (await context.secrets.get('aura.openaiApiKey')) ?? '';

  killChild();

  const channel = vscode.window.createOutputChannel('Aura');
  channel.clear();
  channel.show(true);

  const daemonPath = path.join(__dirname, '..', 'bundled', 'daemon.mjs');
  if (!fs.existsSync(daemonPath)) {
    void vscode.window.showErrorMessage(
      `Missing bundled daemon at ${daemonPath}. Run: npm run compile --workspace=aura-vscode (from repo root).`
    );
    return;
  }

  const workspaceId = crypto.createHash('sha256').update(workspaceRoot).digest('hex').slice(0, 24);
  const threadId = crypto.randomUUID();
  const startReqId = crypto.randomUUID();

  const env: NodeJS.ProcessEnv = { ...process.env };
  if (provider === 'openai' && resolvedKey) {
    env.AURA_OPENAI_API_KEY = resolvedKey;
  }

  const proc = spawn(process.execPath, [daemonPath], {
    cwd: workspaceRoot,
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  child = proc;

  proc.stderr?.on('data', (d: Buffer) => {
    const s = String(d);
    s.split('\n')
      .filter((l) => l.length)
      .forEach((l) => channel.appendLine(l));
  });

  proc.on('error', (e) => {
    channel.appendLine(`[spawn error] ${e.message}`);
  });

  proc.on('close', (code) => {
    channel.appendLine(`[daemon exited ${code ?? 'unknown'}]`);
  });

  lineReader = readline.createInterface({ input: proc.stdout });

  const startPayload = {
    type: 'session/start' as const,
    id: startReqId,
    params: {
      schemaVersion: SCHEMA_VERSION,
      workspaceRoot,
      workspaceId,
      threadId,
      mode: 'ask' as const,
      provider: provider === 'ollama' ? ('ollama' as const) : ('openai' as const),
      modelId: model,
      openaiBaseUrl: openaiBaseUrl || undefined,
      ollamaBaseUrl: ollamaBaseUrl || undefined,
    },
  };

  if (!proc.stdin) {
    void vscode.window.showErrorMessage('Failed to open daemon stdin.');
    return;
  }
  proc.stdin.write(`${JSON.stringify(startPayload)}\n`);

  let sessionId: string | undefined;
  try {
    sessionId = await waitForSessionAck(lineReader, channel, startReqId, 30_000);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    void vscode.window.showErrorMessage(`Aura: ${msg}`);
    killChild();
    return;
  }

  const turn = createTurnCoordinator(channel, sessionId);
  lineReader.on('line', turn.onLine);

  channel.appendLine('');
  channel.appendLine(
    '--- Aura session (Ask / POC): read-only tools (read_file, glob, grep). Files cannot be edited or created in this mode; that is intentional for the POC. ---'
  );
  channel.appendLine(
    '--- Send multiple messages: use the input box each turn; leave empty or press Esc to end. ---'
  );
  channel.appendLine('');

  try {
    let turnIndex = 0;
    while (true) {
      const text = await vscode.window.showInputBox({
        title: `Aura — message ${turnIndex + 1}`,
        prompt: 'Conversation with the same session (history kept server-side). Empty or Esc to end.',
        placeHolder: 'Ask about the codebase (read-only)',
        ignoreFocusOut: true,
      });

      if (text === undefined || !text.trim()) {
        channel.appendLine('[session ended by user]');
        break;
      }

      const turnPromise = turn.waitForTurnEnd(180_000);
      proc.stdin.write(
        `${JSON.stringify({
          type: 'chat/appendUser' as const,
          id: crypto.randomUUID(),
          params: { text: text.trim() },
        })}\n`
      );

      try {
        await turnPromise;
      } catch (e) {
        channel.appendLine(`[turn wait] ${e instanceof Error ? e.message : String(e)}`);
        break;
      }
      turnIndex += 1;
    }
  } finally {
    turn.dispose();
    lineReader?.off('line', turn.onLine);
    if (sessionId && proc.stdin && !proc.killed) {
      proc.stdin.write(
        `${JSON.stringify({
          type: 'session/cancel' as const,
          id: crypto.randomUUID(),
          params: { sessionId },
        })}\n`
      );
    }
    killChild();
  }
}

function waitForSessionAck(
  rl: readline.Interface,
  channel: vscode.OutputChannel,
  startReqId: string,
  timeoutMs: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      rl.off('line', onLine);
      reject(new Error('Timed out waiting for session/ack'));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(t);
      rl.off('line', onLine);
    };

    function onLine(line: string) {
      channel.appendLine(line);
      try {
        const ev = JSON.parse(line) as {
          type?: string;
          id?: string;
          result?: { sessionId?: string };
          payload?: { message?: string };
        };
        if (ev.type === 'session/ack' && ev.id === startReqId) {
          if (!ev.result?.sessionId) {
            cleanup();
            reject(new Error('Session was rejected (check schema version)'));
            return;
          }
          cleanup();
          resolve(ev.result.sessionId);
        } else if (ev.type === 'error') {
          cleanup();
          reject(
            new Error(
              (ev as { payload?: { message?: string } }).payload?.message ?? 'Daemon error'
            )
          );
        }
      } catch {
        /* non-json */
      }
    }

    rl.on('line', onLine);
  });
}
