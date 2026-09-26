import axios from 'axios';
import { LlmProviderKind } from '../enums/llm-provider-kind.enum';
import { Completion, CompletionRequest } from '../interfaces/completion.interface';
import { LlmTransport } from '../interfaces/llm-transport.interface';
import { estimateTokens } from '../utils/json-extract.util';

// Reasoning models reject temperature and spend hidden tokens first.
const isReasoningModel = (model: string): boolean => /^(o\d|gpt-5)/i.test(model.replace(/^openai\//, ''));

// OpenAI, Gemini (compat), Groq, OpenRouter, Ollama, LM Studio, vLLM... baseUrl includes /v1.
export class OpenAiCompatibleTransport implements LlmTransport {
  // Dropped for the session once a server rejects it.
  private jsonModeSupported = true;

  constructor(
    readonly kind: LlmProviderKind,
    readonly model: string,
    private readonly baseUrl: string,
    private readonly apiKey: string,
    readonly local: boolean,
  ) {}

  async complete(req: CompletionRequest): Promise<Completion> {
    try {
      return await this.call(req, req.json === true && this.jsonModeSupported);
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      if (req.json && this.jsonModeSupported && (status === 400 || status === 422)) {
        this.jsonModeSupported = false;
        return this.call(req, false);
      }
      throw err;
    }
  }

  async listModels(): Promise<string[]> {
    const { data } = await axios.get(`${this.baseUrl}/models`, { headers: this.headers(), timeout: 15_000 });
    const list: { id?: string; name?: string }[] = data?.data ?? data?.models ?? [];
    return list.map((m) => String(m.id ?? m.name ?? '').replace(/^models\//, '')).filter(Boolean);
  }

  private async call(req: CompletionRequest, jsonMode: boolean): Promise<Completion> {
    const reasoning = this.kind === LlmProviderKind.OPENAI && isReasoningModel(this.model);
    const messages = [
      ...(req.system ? [{ role: 'system', content: req.system }] : []),
      { role: 'user', content: req.prompt },
    ];
    const body: Record<string, unknown> = { model: this.model, messages };
    if (this.kind === LlmProviderKind.OPENAI) {
      body.max_completion_tokens = reasoning ? req.maxTokens + 4000 : req.maxTokens;
      if (reasoning) body.reasoning_effort = 'low';
      else body.temperature = 0;
    } else {
      body.max_tokens = req.maxTokens;
      body.temperature = 0;
    }
    if (jsonMode) body.response_format = { type: 'json_object' };

    const { data } = await axios.post(`${this.baseUrl}/chat/completions`, body, {
      headers: { 'content-type': 'application/json', ...this.headers() },
      // A cold local model can be slow on the first call.
      timeout: this.local ? 180_000 : 90_000,
    });
    const text = String(data?.choices?.[0]?.message?.content ?? '');
    return {
      text,
      promptTokens: data?.usage?.prompt_tokens ?? estimateTokens(req.prompt),
      completionTokens: data?.usage?.completion_tokens ?? estimateTokens(text),
    };
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {};
    if (this.apiKey) h.authorization = `Bearer ${this.apiKey}`;
    if (this.kind === LlmProviderKind.OPENROUTER) {
      h['http-referer'] = 'https://github.com/ankurpandey27/sudarshan-ai';
      h['x-title'] = 'Sudarshan';
    }
    return h;
  }
}
