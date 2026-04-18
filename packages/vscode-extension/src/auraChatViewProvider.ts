import * as crypto from 'node:crypto';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { SCHEMA_VERSION, type ClientRequest } from '@aura/protocol';
import { StdioNdjsonAuraTransport } from './auraTransport';
import { createTurnWaiter, waitForSessionAck } from './auraSessionWire';

type UiMsg =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string }
  | { role: 'tool'; text: string };

interface ThreadState {
  threadId: string;
  title: string;
  messages: UiMsg[];
}

export class AuraChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'aura.chatView';

  private _view?: vscode.WebviewView;
  private readonly _ctx: vscode.ExtensionContext;
  private readonly _protocolChannel: vscode.OutputChannel;
  private readonly _daemonLogChannel: vscode.OutputChannel;
  private _threads: ThreadState[] = [];
  private _activeThreadId = '';
  private _transport?: StdioNdjsonAuraTransport;
  private _sessionId?: string;
  private _turnSink: ((line: string) => void) | null = null;
  private _busy = false;
  private _statusText = '';

  constructor(
    extensionContext: vscode.ExtensionContext,
    protocolChannel: vscode.OutputChannel,
    daemonLogChannel: vscode.OutputChannel
  ) {
    this._ctx = extensionContext;
    this._protocolChannel = protocolChannel;
    this._daemonLogChannel = daemonLogChannel;
    const first = this._newThread('Chat 1');
    this._threads = [first];
    this._activeThreadId = first.threadId;
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this._ctx.extensionUri, 'media')],
    };
    webviewView.webview.html = this._htmlForWebview(webviewView.webview);
    webviewView.webview.onDidReceiveMessage((m) => void this._onMessage(m as WebviewMessage));
    this._postSnapshot();
  }

  /** Command: open sidebar, boot daemon + session/start when needed. */
  async startSessionFlow(): Promise<void> {
    await vscode.commands.executeCommand('workbench.view.extension.aura-sidebar');
    try {
      await vscode.commands.executeCommand(`${AuraChatViewProvider.viewType}.focus`);
    } catch {
      /* focus command may be unavailable in some hosts */
    }
    const err = await this._ensureWorkspaceReady();
    if (err) {
      void vscode.window.showErrorMessage(err);
      this._statusText = err;
      this._postSnapshot();
      return;
    }
    await this._ensureDaemonBooted();
  }

  dispose(): void {
    this._disposeTransport();
  }

  private _newThread(title: string): ThreadState {
    return {
      threadId: crypto.randomUUID(),
      title,
      messages: [],
    };
  }

  private _activeThread(): ThreadState | undefined {
    return this._threads.find((t) => t.threadId === this._activeThreadId);
  }

  private _htmlForWebview(webview: vscode.Webview): string {
    const script = webview.asWebviewUri(vscode.Uri.joinPath(this._ctx.extensionUri, 'media', 'chat.js'));
    const style = webview.asWebviewUri(vscode.Uri.joinPath(this._ctx.extensionUri, 'media', 'chat.css'));
    const csp = [
      `default-src 'none'`,
      `style-src ${webview.cspSource}`,
      `font-src ${webview.cspSource}`,
      `script-src ${webview.cspSource}`,
    ].join('; ');
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<link href="${style}" rel="stylesheet" />
<title>Aura</title>
</head>
<body>
  <div class="toolbar" role="toolbar" aria-label="Aura chat toolbar">
    <label for="threadSelect">Thread</label>
    <select id="threadSelect" aria-label="Active thread"></select>
    <button type="button" class="secondary" id="newChatBtn" title="Start a new thread">New chat</button>
    <div class="status" id="status" aria-live="polite"></div>
  </div>
  <div class="messages" id="messages" role="log" aria-label="Conversation"></div>
  <div class="hint">Enter sends; Shift+Enter newline. Ask mode is read-only.</div>
  <div class="composer">
    <textarea id="input" aria-label="Message composer" placeholder="Ask about the codebase…"></textarea>
    <div class="row">
      <button type="button" class="secondary" id="stopBtn" disabled>Stop</button>
      <button type="button" id="sendBtn">Send</button>
    </div>
  </div>
  <script src="${script}"></script>
</body>
</html>`;
  }

  private _postSnapshot(): void {
    const v = this._view;
    if (!v) {
      return;
    }
    const active = this._activeThread();
    const snapshot = {
      threads: this._threads.map((t) => ({ threadId: t.threadId, title: t.title })),
      activeThreadId: this._activeThreadId,
      messages: active?.messages ?? [],
      statusText: this._statusText,
      busy: this._busy,
    };
    void v.webview.postMessage({ type: 'snapshot', snapshot });
  }

  private _appendProtocolLine(line: string): void {
    const on = vscode.workspace.getConfiguration('aura').get<boolean>('developer.showProtocolLog');
    if (on) {
      this._protocolChannel.appendLine(line);
    }
  }

  private _attachTransportHandlers(t: StdioNdjsonAuraTransport): void {
    t.onStdoutLine((line) => {
      this._appendProtocolLine(line);
      this._turnSink?.(line);
      this._routeUiLine(line);
    });
    t.onStderrLine((line) => {
      this._daemonLogChannel.appendLine(line);
    });
  }

  private _routeUiLine(line: string): void {
    const th = this._activeThread();
    if (!th) {
      return;
    }
    let ev: { type?: string; payload?: Record<string, unknown> };
    try {
      ev = JSON.parse(line) as { type?: string; payload?: Record<string, unknown> };
    } catch {
      return;
    }
    const sid = (ev.payload as { sessionId?: string } | undefined)?.sessionId;
    if (sid && this._sessionId && sid !== this._sessionId) {
      return;
    }
    switch (ev.type) {
      case 'assistant/delta': {
        const text = String((ev.payload as { text?: string })?.text ?? '');
        const last = th.messages[th.messages.length - 1];
        if (last && last.role === 'assistant') {
          last.text += text;
        } else {
          th.messages.push({ role: 'assistant', text });
        }
        break;
      }
      case 'tool/call': {
        const name = String((ev.payload as { name?: string })?.name ?? 'tool');
        const args = (ev.payload as { arguments?: Record<string, unknown> })?.arguments ?? {};
        const preview = JSON.stringify(args).slice(0, 400);
        this._statusText = `Calling ${name}…`;
        th.messages.push({ role: 'tool', text: `Tool: ${name}\n${preview}` });
        break;
      }
      case 'tool/result': {
        const content = String((ev.payload as { content?: string })?.content ?? '');
        this._statusText = 'Processing tool result…';
        const tail = th.messages[th.messages.length - 1];
        if (tail && tail.role === 'tool') {
          tail.text += `\n→ ${content.slice(0, 4000)}`;
        } else {
          th.messages.push({ role: 'tool', text: `Result:\n${content.slice(0, 4000)}` });
        }
        break;
      }
      case 'assistant/done':
        this._statusText = '';
        this._busy = false;
        break;
      case 'error': {
        const msg = String((ev.payload as { message?: string })?.message ?? 'error');
        this._statusText = '';
        this._busy = false;
        th.messages.push({ role: 'assistant', text: `[error] ${msg}` });
        break;
      }
      case 'session/cancelled':
        this._statusText = '';
        this._busy = false;
        break;
      default:
        break;
    }
    this._postSnapshot();
  }

  private _disposeTransport(): void {
    this._transport?.dispose();
    this._transport = undefined;
    this._sessionId = undefined;
    this._turnSink = null;
  }

  private _ensureWorkspaceReady(): string | undefined {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) {
      return 'Aura needs a folder workspace. Use File → Open Folder… first.';
    }
    if (folders.length > 1) {
      void vscode.window.showWarningMessage(
        'Aura uses only the first workspace folder for tooling until multi-root support lands (issue #16).'
      );
    }
    return undefined;
  }

  private async _ensureDaemonBooted(): Promise<void> {
    if (this._transport && this._sessionId) {
      this._statusText = 'Ready.';
      this._postSnapshot();
      return;
    }
    this._statusText = 'Starting daemon…';
    this._postSnapshot();
    const err = await this._ensureDaemonSession();
    if (err) {
      this._statusText = err;
      void vscode.window.showErrorMessage(err);
    } else {
      this._statusText = 'Ready.';
    }
    this._postSnapshot();
  }

  /** (Re)start child daemon + session/start when none is active. */
  private async _ensureDaemonSession(): Promise<string | undefined> {
    if (this._transport && this._sessionId) {
      return undefined;
    }
    return this._bootDaemonFresh();
  }

  private async _bootDaemonFresh(): Promise<string | undefined> {
    this._disposeTransport();
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) {
      return 'No workspace folder.';
    }
    const workspaceRoot = folders[0].uri.fsPath;
    const active = this._activeThread();
    if (!active) {
      return 'No active thread.';
    }

    const cfg = vscode.workspace.getConfiguration('aura');
    const llmProvider = cfg.get<string>('provider') ?? 'openai';
    const model = cfg.get<string>('model') ?? 'gpt-4o-mini';
    const openaiBaseUrl = cfg.get<string>('openaiBaseUrl');
    const ollamaBaseUrl = cfg.get<string>('ollamaBaseUrl');

    if (llmProvider === 'openai') {
      const existing = await this._ctx.secrets.get('aura.openaiApiKey');
      if (!existing) {
        const key = await vscode.window.showInputBox({
          title: 'OpenAI API key',
          password: true,
          ignoreFocusOut: true,
          placeHolder: 'Stored in VS Code secret storage (aura.openaiApiKey)',
        });
        if (key) {
          await this._ctx.secrets.store('aura.openaiApiKey', key);
        } else {
          return 'An API key is required for the OpenAI provider.';
        }
      }
    }

    const resolvedKey = (await this._ctx.secrets.get('aura.openaiApiKey')) ?? '';

    const daemonPath = path.join(__dirname, '..', 'bundled', 'daemon.mjs');
    if (!fs.existsSync(daemonPath)) {
      return `Missing bundled daemon at ${daemonPath}. Run: npm run compile --workspace=aura-vscode (from repo root).`;
    }

    const workspaceId = crypto.createHash('sha256').update(workspaceRoot).digest('hex').slice(0, 24);
    const env: NodeJS.ProcessEnv = { ...process.env };
    if (llmProvider === 'openai' && resolvedKey) {
      env.AURA_OPENAI_API_KEY = resolvedKey;
    }

    const proc = spawn(process.execPath, [daemonPath], {
      cwd: workspaceRoot,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    }) as ChildProcessWithoutNullStreams;

    const transport = new StdioNdjsonAuraTransport(proc);
    this._transport = transport;
    this._attachTransportHandlers(transport);

    const startReqId = crypto.randomUUID();
    const startPayload: ClientRequest = {
      type: 'session/start',
      id: startReqId,
      params: {
        schemaVersion: SCHEMA_VERSION,
        workspaceRoot,
        workspaceId,
        threadId: active.threadId,
        mode: 'ask',
        provider: llmProvider === 'ollama' ? 'ollama' : 'openai',
        modelId: model,
        openaiBaseUrl: openaiBaseUrl || undefined,
        ollamaBaseUrl: ollamaBaseUrl || undefined,
      },
    };

    const ackPromise = waitForSessionAck(transport, startReqId, 30_000);
    transport.writeRequest(startPayload);

    try {
      this._sessionId = await ackPromise;
    } catch (e) {
      this._disposeTransport();
      return e instanceof Error ? e.message : String(e);
    }

    return undefined;
  }

  private async _onMessage(msg: WebviewMessage): Promise<void> {
    switch (msg.type) {
      case 'send':
        await this._handleSend(msg.text);
        return;
      case 'stop':
        await this._handleStop();
        return;
      case 'newChat':
        this._handleNewChat();
        return;
      case 'selectThread':
        this._handleSelectThread(msg.threadId);
        return;
      default:
        return;
    }
  }

  private _handleNewChat(): void {
    this._disposeTransport();
    const n = this._threads.length + 1;
    const t = this._newThread(`Chat ${n}`);
    this._threads.push(t);
    this._activeThreadId = t.threadId;
    this._busy = false;
    this._statusText = 'New thread. Send a message to start the daemon.';
    this._postSnapshot();
  }

  private _handleSelectThread(threadId: string): void {
    if (threadId === this._activeThreadId) {
      return;
    }
    this._disposeTransport();
    this._activeThreadId = threadId;
    this._busy = false;
    this._statusText = '';
    this._postSnapshot();
  }

  private async _handleStop(): Promise<void> {
    const transport = this._transport;
    const sessionId = this._sessionId;
    if (!transport || !sessionId) {
      return;
    }
    transport.writeRequest({
      type: 'session/cancel',
      id: crypto.randomUUID(),
      params: { sessionId },
    });
    this._busy = false;
    this._statusText = 'Stopping…';
    this._postSnapshot();
  }

  private async _handleSend(text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    const wsErr = this._ensureWorkspaceReady();
    if (wsErr) {
      void vscode.window.showErrorMessage(wsErr);
      return;
    }
    const th = this._activeThread();
    if (!th) {
      return;
    }
    const hadMessages = th.messages.length > 0;
    th.messages.push({ role: 'user', text: trimmed });
    if (!hadMessages || /^Chat \d+$/.test(th.title)) {
      th.title = trimmed.slice(0, 48) + (trimmed.length > 48 ? '…' : '');
    }
    this._busy = true;
    this._statusText = 'Waiting for assistant…';
    this._postSnapshot();

    const bootErr = await this._ensureDaemonSession();
    if (bootErr) {
      this._busy = false;
      this._statusText = bootErr;
      void vscode.window.showErrorMessage(bootErr);
      this._postSnapshot();
      return;
    }

    const transport = this._transport;
    const sessionId = this._sessionId;
    if (!transport || !sessionId) {
      this._busy = false;
      this._postSnapshot();
      return;
    }

    const turn = createTurnWaiter(sessionId);
    this._turnSink = turn.onLine;

    transport.writeRequest({
      type: 'chat/appendUser',
      id: crypto.randomUUID(),
      params: { text: trimmed },
    });

    try {
      await turn.waitForTurnEnd(180_000);
    } catch (e) {
      th.messages.push({
        role: 'assistant',
        text: `[turn] ${e instanceof Error ? e.message : String(e)}`,
      });
    } finally {
      this._turnSink = null;
      turn.dispose();
      this._busy = false;
      this._statusText = '';
      this._postSnapshot();
    }
  }
}

type WebviewMessage =
  | { type: 'send'; text: string }
  | { type: 'stop' }
  | { type: 'newChat' }
  | { type: 'selectThread'; threadId: string };
