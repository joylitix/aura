/**
 * Aura daemon — NDJSON over stdin/stdout. Logs on stderr only.
 */
import { randomUUID } from 'node:crypto';
import readline from 'node:readline';
import { AskSession } from '@aura/agent-core';
import {
  SCHEMA_VERSION,
  type ClientRequest,
  type ServerEvent,
  type SessionStartParams,
  isClientRequest,
} from '@aura/protocol';

function out(ev: ServerEvent) {
  process.stdout.write(`${JSON.stringify(ev)}\n`);
}

function logErr(...args: unknown[]) {
  console.error('[aura-daemon]', ...args);
}

let session: AskSession | null = null;
let chain: Promise<void> = Promise.resolve();

function enqueue(fn: () => Promise<void>) {
  chain = chain
    .then(() => fn())
    .catch((e) => {
      out({
        type: 'error',
        payload: {
          code: 'internal',
          message: e instanceof Error ? e.message : String(e),
        },
      });
      logErr(e);
    });
}

const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

rl.on('line', (line) => {
  if (!line.trim()) return;
  let raw: unknown;
  try {
    raw = JSON.parse(line);
  } catch {
    logErr('invalid JSON');
    return;
  }
  if (!isClientRequest(raw)) {
    logErr('unsupported request shape');
    return;
  }
  const req = raw as ClientRequest;
  enqueue(() => dispatch(req));
});

async function dispatch(req: ClientRequest) {
  switch (req.type) {
    case 'session/start':
      await handleStart(req.id, req.params);
      return;
    case 'chat/appendUser':
      await handleChat(req.params.text);
      return;
    case 'session/cancel':
      handleCancel(req.params.sessionId);
      return;
    default: {
      const _exhaust: never = req;
      return _exhaust;
    }
  }
}

async function handleStart(id: string, params: SessionStartParams) {
  if (params.schemaVersion !== SCHEMA_VERSION) {
    out({
      type: 'session/ack',
      id,
      result: {
        sessionId: '',
        schemaVersion: SCHEMA_VERSION,
        capabilities: { tools: [] },
      },
    });
    out({
      type: 'error',
      payload: {
        code: 'schema_mismatch',
        message: `expected ${SCHEMA_VERSION}, got ${params.schemaVersion}`,
      },
    });
    return;
  }

  const sessionId = randomUUID();
  session = new AskSession({
    start: {
      ...params,
      openaiBaseUrl: params.openaiBaseUrl ?? process.env.AURA_OPENAI_BASE_URL,
      ollamaBaseUrl: params.ollamaBaseUrl ?? process.env.AURA_OLLAMA_BASE_URL,
    },
    sessionId,
    apiKey: process.env.AURA_OPENAI_API_KEY,
    onEvent: out,
  });

  const c = session.getCapabilities();
  out({
    type: 'session/ack',
    id,
    result: {
      sessionId,
      schemaVersion: c.schemaVersion,
      capabilities: c.capabilities,
    },
  });
}

async function handleChat(text: string) {
  if (!session) {
    out({
      type: 'error',
      payload: { code: 'no_session', message: 'send session/start first' },
    });
    return;
  }
  await session.runUserMessage(text);
}

function handleCancel(targetSessionId: string) {
  if (session && session.sessionId === targetSessionId) {
    session.cancel();
  }
  out({ type: 'session/cancelled', payload: { sessionId: targetSessionId } });
}

process.stdin.resume();
