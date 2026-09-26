import axios from 'axios';
import { LlmProviderKind } from '../enums/llm-provider-kind.enum';
import { Completion, CompletionRequest } from '../interfaces/completion.interface';
import { LlmTransport } from '../interfaces/llm-transport.interface';
import { GeminiResponse, OpencodeProtocol } from '../interfaces/opencode.interface';
import { estimateTokens } from '../utils/json-extract.util';
import { isProtocolMismatch } from '../utils/llm-error.util';

const TIMEOUT_MS = 90_000;
const ALL_PROTOCOLS: OpencodeProtocol[] = ['chat', 'messages', 'responses', 'gemini'];

// Zen serves each model family on its own wire format.
function inferProtocol(model: string): OpencodeProtocol {
  const m = model.toLowerCase();
  if (m.startsWith('claude-')) return 'messages';
  if (m.startsWith('gpt-')) return 'responses';
  if (m.startsWith('gemini-')) return 'gemini';
  return 'chat';
}

// On a "wrong endpoint" answer, try the other protocols once and remember the one that works.
export class OpencodeTransport implements LlmTransport {
  readonly kind = LlmProviderKind.OPENCODE;
  readonly local = false;
  private resolved: OpencodeProtocol | null = null;

  constructor(
    readonly model: string,
    private readonly baseUrl: string,
    private readonly apiKey: string,
  ) {}

  async complete(req: CompletionRequest): Promise<Completion> {
    const first = this.resolved ?? inferProtocol(this.model);
    const candidates = this.resolved ? [first] : [first, ...ALL_PROTOCOLS.filter((p) => p !== first && p !== 'gemini')];
    let lastErr: unknown;
    for (const protocol of candidates) {
      try {
        const res = await this.call(protocol, req);
        this.resolved = protocol;
        return res;
      } catch (err) {
        lastErr = err;
        if (!isProtocolMismatch(err)) break;
      }
    }
    throw lastErr;
  }

  async listModels(): Promise<string[]> {
    const { data } = await axios.get(`${this.baseUrl}/models`, { headers: this.headers(), timeout: 15_000 });
    return ((data?.data ?? []) as { id: string }[]).map((m) => m.id);
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json', 'user-agent': 'sudarshan/2.0', ...extra };
  }

  private async call(protocol: OpencodeProtocol, req: CompletionRequest): Promise<Completion> {
    const prompt = req.system ? `${req.system}\n\n${req.prompt}` : req.prompt;
    const maxTokens = Math.max(req.maxTokens, 1024);
    const base = this.baseUrl;
    let text = '';
    let usage: { in?: number; out?: number } = {};
    switch (protocol) {
      case 'chat': {
        const { data } = await axios.post(
          `${base}/chat/completions`,
          { model: this.model, messages: [{ role: 'user', content: prompt }], temperature: 0, max_tokens: maxTokens },
          { headers: this.headers(), timeout: TIMEOUT_MS },
        );
        text = String(data.choices?.[0]?.message?.content ?? '');
        usage = { in: data.usage?.prompt_tokens, out: data.usage?.completion_tokens };
        break;
      }
      case 'messages': {
        const { data } = await axios.post(
          `${base}/messages`,
          { model: this.model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] },
          { headers: this.headers({ 'anthropic-version': '2023-06-01' }), timeout: TIMEOUT_MS },
        );
        const blocks: { type?: string; text?: string }[] = Array.isArray(data.content) ? data.content : [];
        text = blocks.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
        usage = { in: data.usage?.input_tokens, out: data.usage?.output_tokens };
        break;
      }
      case 'responses': {
        const { data } = await axios.post(
          `${base}/responses`,
          { model: this.model, input: prompt, max_output_tokens: maxTokens },
          { headers: this.headers(), timeout: TIMEOUT_MS },
        );
        text =
          typeof data.output_text === 'string' && data.output_text
            ? data.output_text
            : ((data.output ?? []) as { type?: string; content?: { type?: string; text?: string }[] }[])
                .filter((o) => o.type === 'message')
                .flatMap((o) => o.content ?? [])
                .map((c) => c.text ?? '')
                .join('');
        usage = { in: data.usage?.input_tokens, out: data.usage?.output_tokens };
        break;
      }
      case 'gemini': {
        const { data } = await axios.post<GeminiResponse>(
          `${base}/models/${encodeURIComponent(this.model)}:generateContent`,
          {
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0, maxOutputTokens: maxTokens },
          },
          { headers: this.headers(), timeout: TIMEOUT_MS },
        );
        text = (data.candidates?.[0]?.content?.parts ?? [])
          .filter((p) => !p.thought)
          .map((p) => p.text ?? '')
          .join('');
        usage = { in: data.usageMetadata?.promptTokenCount, out: data.usageMetadata?.candidatesTokenCount };
        break;
      }
    }
    return {
      text,
      promptTokens: usage.in ?? estimateTokens(prompt),
      completionTokens: usage.out ?? estimateTokens(text),
    };
  }
}
