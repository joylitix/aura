import type { LlmProvider, ServerEvent, SessionStartParams, ToolCapability } from '@aura/protocol';
import { SCHEMA_VERSION } from '@aura/protocol';
import { createChatClient } from './llm/chat.js';
import { appendTranscript } from './transcript.js';
import { invokeTool, TOOL_DEFINITIONS, type ToolContext } from './tools.js';

const CAPABILITIES: { tools: ToolCapability[] } = {
  tools: TOOL_DEFINITIONS.map((d) => ({
    name: d.name,
    description: d.description,
  })),
};

const OPENAI_TOOLS = TOOL_DEFINITIONS.map((d) => ({
  type: 'function' as const,
  function: {
    name: d.name,
    description: d.description,
    parameters: d.parameters,
  },
}));

export class AskSession {
  readonly sessionId: string;
  private readonly start: SessionStartParams;
  private readonly onEvent: (e: ServerEvent) => void;
  private messages: Array<Record<string, unknown>> = [];
  private controller: AbortController | null = null;
  private model: string;
  private provider: LlmProvider;
  private maxSteps = 8;
  private toolContext: ToolContext;
  private readonly apiKey: string | undefined;

  constructor(params: {
    start: SessionStartParams;
    sessionId: string;
    onEvent: (e: ServerEvent) => void;
    /** API key for OpenAI-compatible providers; prefer over env in tests */
    apiKey?: string;
  }) {
    this.sessionId = params.sessionId;
    this.start = params.start;
    this.onEvent = params.onEvent;
    this.apiKey = params.apiKey ?? process.env.AURA_OPENAI_API_KEY;
    this.provider = params.start.provider;
    this.model =
      params.start.modelId ?? (this.provider === 'ollama' ? 'llama3.2' : 'gpt-4o-mini');
    this.toolContext = {
      workspaceRoot: params.start.workspaceRoot,
      maxReadBytes: 32_000,
      maxGlobFiles: 200,
      maxGrepFileBytes: 200_000,
    };

    this.messages = [
      {
        role: 'system',
        content: `You are Aura (Ask mode). You may only use the provided read-only file tools. Workspace root: ${params.start.workspaceRoot}. Be concise.`,
      },
    ];
  }

  getCapabilities(): {
    schemaVersion: string;
    capabilities: { tools: ToolCapability[] };
  } {
    return { schemaVersion: SCHEMA_VERSION, capabilities: CAPABILITIES };
  }

  cancel() {
    this.controller?.abort();
  }

  async runUserMessage(text: string) {
    this.controller = new AbortController();
    const signal = this.controller.signal;
    const client = createChatClient(this.provider, {
      openaiBaseUrl: this.start.openaiBaseUrl,
      ollamaBaseUrl: this.start.ollamaBaseUrl,
      apiKey: this.apiKey,
    });

    this.messages.push({ role: 'user', content: text });
    await this.appendTrans('user', { text });

    for (let step = 0; step < this.maxSteps; step++) {
      if (signal.aborted) {
        this.emit({ type: 'error', payload: { sessionId: this.sessionId, code: 'aborted', message: 'aborted' } });
        return;
      }

      const { message, finishReason } = await client.complete({
        model: this.model,
        messages: this.messages,
        tools: OPENAI_TOOLS,
        signal,
      });

      if (message.tool_calls?.length) {
        this.messages.push({
          role: 'assistant',
          content: message.content,
          tool_calls: message.tool_calls,
        } as unknown as Record<string, unknown>);

        for (const tc of message.tool_calls) {
          this.emit({
            type: 'tool/call',
            payload: {
              sessionId: this.sessionId,
              toolCallId: tc.id,
              name: tc.function.name,
              arguments: asRecord(safeJsonParse(tc.function.arguments)),
            },
          });

          const args = asRecord(safeJsonParse(tc.function.arguments));
          let out: string;
          try {
            out = await invokeTool(this.toolContext, tc.function.name, args);
          } catch (e) {
            out = e instanceof Error ? e.message : String(e);
            this.emit({
              type: 'tool/result',
              payload: {
                sessionId: this.sessionId,
                toolCallId: tc.id,
                content: out,
                isError: true,
              },
            });
            this.messages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: out,
            } as unknown as Record<string, unknown>);
            continue;
          }

          this.emit({
            type: 'tool/result',
            payload: {
              sessionId: this.sessionId,
              toolCallId: tc.id,
              content: out,
            },
          });
          this.messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: out,
          } as unknown as Record<string, unknown>);
          await this.appendTrans('tool', { name: tc.function.name, out: out.slice(0, 500) });
        }
        continue;
      }

      const finalText = message.content ?? '';
      for (const chunk of chunkString(finalText, 120)) {
        this.emit({ type: 'assistant/delta', payload: { sessionId: this.sessionId, text: chunk } });
      }
      this.emit({
        type: 'assistant/done',
        payload: { sessionId: this.sessionId, finishReason: finishReason },
      });
      this.messages.push({ role: 'assistant', content: finalText } as unknown as Record<string, unknown>);
      await this.appendTrans('assistant', { text: finalText });
      return;
    }

    this.emit({
      type: 'error',
      payload: { sessionId: this.sessionId, code: 'max_steps', message: 'max tool steps exceeded' },
    });
  }

  private emit(e: ServerEvent) {
    this.onEvent(e);
  }

  private async appendTrans(kind: string, data: unknown) {
    await appendTranscript(this.start.workspaceId, this.start.threadId, {
      t: new Date().toISOString(),
      kind,
      data,
    });
  }
}

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s) as unknown;
  } catch {
    return {} as unknown;
  }
}

function asRecord(v: unknown): Record<string, unknown> {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return {};
}

function chunkString(s: string, n: number): string[] {
  if (s.length <= n) return s ? [s] : [];
  const parts: string[] = [];
  for (let i = 0; i < s.length; i += n) {
    parts.push(s.slice(i, i + n));
  }
  return parts;
}
