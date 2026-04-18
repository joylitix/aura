/**
 * Aura wire protocol — NDJSON one JSON object per line on daemon stdin/stdout.
 * See planning/POC_PLAN.md. No vscode imports.
 */

export const SCHEMA_VERSION = '0.1.0' as const;

export type Mode = 'ask';

export type LlmProvider = 'openai' | 'ollama';

/** Declared capabilities returned after session/start. */
export interface ToolCapability {
  name: string;
  description: string;
}

export interface SessionStartParams {
  schemaVersion: string;
  workspaceRoot: string;
  workspaceId: string;
  threadId: string;
  mode: Mode;
  provider: LlmProvider;
  modelId?: string;
  /** OpenAI-compatible API base (no trailing slash). */
  openaiBaseUrl?: string;
  /** Ollama HTTP API base, e.g. http://127.0.0.1:11434 */
  ollamaBaseUrl?: string;
}

export interface SessionAckPayload {
  sessionId: string;
  schemaVersion: string;
  capabilities: {
    tools: ToolCapability[];
  };
}

export interface ChatAppendUserParams {
  text: string;
}

export interface SessionCancelParams {
  sessionId: string;
}

/**
 * Client → daemon (extension writes one line per message).
 * `id` correlates session/ack with the originating session/start.
 */
export type ClientRequest =
  | {
      type: 'session/start';
      id: string;
      params: SessionStartParams;
    }
  | {
      type: 'chat/appendUser';
      id: string;
      params: ChatAppendUserParams;
    }
  | {
      type: 'session/cancel';
      id: string;
      params: SessionCancelParams;
    };

export interface AssistantDeltaPayload {
  sessionId: string;
  text: string;
}

export interface ToolCallPayload {
  sessionId: string;
  toolCallId: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResultPayload {
  sessionId: string;
  toolCallId: string;
  /** Truncated / stringified tool output */
  content: string;
  isError?: boolean;
}

export interface AssistantDonePayload {
  sessionId: string;
  /** Reason tokens stopped */
  finishReason?: string;
}

export interface ErrorPayload {
  sessionId?: string;
  code: string;
  message: string;
  details?: unknown;
}

export interface SessionCancelledPayload {
  sessionId: string;
}

/**
 * daemon → client (one NDJSON line per event).
 * session/ack pairs with request `id` from session/start.
 */
export type ServerEvent =
  | {
      type: 'session/ack';
      /** Same id as the session/start request */
      id: string;
      result: SessionAckPayload;
    }
  | {
      type: 'assistant/delta';
      payload: AssistantDeltaPayload;
    }
  | {
      type: 'tool/call';
      payload: ToolCallPayload;
    }
  | {
      type: 'tool/result';
      payload: ToolResultPayload;
    }
  | {
      type: 'assistant/done';
      payload: AssistantDonePayload;
    }
  | {
      type: 'error';
      payload: ErrorPayload;
    }
  | {
      type: 'session/cancelled';
      payload: SessionCancelledPayload;
    };

export function isClientRequest(value: unknown): value is ClientRequest {
  if (!value || typeof value !== 'object') return false;
  const o = value as Record<string, unknown>;
  const t = o.type;
  if (t === 'session/start' || t === 'chat/appendUser' || t === 'session/cancel') {
    return typeof o.id === 'string' && o.params !== undefined && typeof o.params === 'object';
  }
  return false;
}
