import type { LlmProvider } from '@aura/protocol';

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ChatChoiceMessage {
  role: 'assistant';
  content: string | null;
  tool_calls?: ToolCall[];
}

export interface ChatCompletionResult {
  message: ChatChoiceMessage;
  /** Raw finish reason from provider */
  finishReason?: string;
}

export interface ChatClient {
  complete(options: {
    model: string;
    messages: Array<Record<string, unknown>>;
    tools: unknown[];
    signal?: AbortSignal;
  }): Promise<ChatCompletionResult>;
}

function baseForProvider(
  provider: LlmProvider,
  openaiBaseUrl: string | undefined,
  ollamaBaseUrl: string | undefined
): string {
  if (provider === 'ollama') {
    return (ollamaBaseUrl ?? 'http://127.0.0.1:11434').replace(/\/$/, '');
  }
  return (openaiBaseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '');
}

export function createChatClient(
  provider: LlmProvider,
  options: { openaiBaseUrl?: string; ollamaBaseUrl?: string; apiKey?: string }
): ChatClient {
  const base = baseForProvider(provider, options.openaiBaseUrl, options.ollamaBaseUrl);
  if (provider === 'ollama') {
    return new OllamaClient(base);
  }
  return new OpenAiCompatClient(base, options.apiKey);
}

class OpenAiCompatClient implements ChatClient {
  constructor(
    private readonly base: string,
    private readonly apiKey: string | undefined
  ) {}

  async complete(options: {
    model: string;
    messages: Array<Record<string, unknown>>;
    tools: unknown[];
    signal?: AbortSignal;
  }): Promise<ChatCompletionResult> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }
    const res = await fetch(`${this.base}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: options.model,
        messages: options.messages,
        tools: options.tools.length > 0 ? options.tools : undefined,
        tool_choice: options.tools.length > 0 ? 'auto' : undefined,
        temperature: 0.2,
      }),
      signal: options.signal,
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`openai error ${res.status}: ${t}`);
    }
    const data = (await res.json()) as {
      choices?: Array<{
        message: ChatChoiceMessage;
        finish_reason?: string;
      }>;
    };
    const message = data.choices?.[0]?.message;
    if (!message) {
      throw new Error('no message in response');
    }
    return {
      message,
      finishReason: data.choices?.[0]?.finish_reason,
    };
  }
}

/**
 * Ollama /v1/chat/completions compatible API (OpenAI format).
 * See https://github.com/ollama/ollama/blob/main/docs/api.md#generate-a-chat-completion
 */
class OllamaClient implements ChatClient {
  constructor(private readonly base: string) {}

  async complete(options: {
    model: string;
    messages: Array<Record<string, unknown>>;
    tools: unknown[];
    signal?: AbortSignal;
  }): Promise<ChatCompletionResult> {
    const res = await fetch(`${this.base}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: options.model,
        messages: options.messages,
        tools: options.tools.length > 0 ? options.tools : undefined,
        stream: false,
        temperature: 0.2,
      }),
      signal: options.signal,
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`ollama error ${res.status}: ${t}`);
    }
    const data = (await res.json()) as {
      choices?: Array<{
        message: ChatChoiceMessage;
        finish_reason?: string;
      }>;
    };
    const message = data.choices?.[0]?.message;
    if (!message) {
      throw new Error('no message in ollama response');
    }
    return {
      message,
      finishReason: data.choices?.[0]?.finish_reason,
    };
  }
}
