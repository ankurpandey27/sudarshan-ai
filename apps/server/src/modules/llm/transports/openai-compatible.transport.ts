// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import axios from 'axios';
import { LlmProviderKind } from '../enums/llm-provider-kind.enum';
import { Completion, CompletionRequest } from '../interfaces/completion.interface';
import { LlmTransport } from '../interfaces/llm-transport.interface';
import { estimateTokens } from '../utils/json-extract.util';
import { RequestParams } from '../utils/request-params.util';

// Known reasoning families; anything else is learned from the model's own errors.
const isReasoningModel = (model: string): boolean => /^(o\d|gpt-5)/i.test(model.replace(/^openai\//, ''));
const REASONING_HEADROOM = 4000;

// OpenAI, Gemini (compat), Groq, OpenRouter, Ollama, LM Studio, vLLM... baseUrl includes /v1.
export class OpenAiCompatibleTransport implements LlmTransport {
  private readonly params: RequestParams;

  constructor(
    readonly kind: LlmProviderKind,
    readonly model: string,
    private readonly baseUrl: string,
    private readonly apiKey: string,
    readonly local: boolean,
  ) {
    const openai = kind === LlmProviderKind.OPENAI;
    this.params = new RequestParams(openai ? 'max_completion_tokens' : 'max_tokens');
    if (openai && isReasoningModel(model)) this.params.adapt('temperature');
    if (!openai) this.params.adapt('reasoning_effort');
  }

  async complete(req: CompletionRequest): Promise<Completion> {
    const first = await this.params.send(() => this.call(req, req.maxTokens));
    // A reasoning model can spend the whole budget thinking and return nothing.
    if (!first.text.trim() && first.truncated) return this.params.send(() => this.call(req, req.maxTokens + REASONING_HEADROOM * 2));
    return first;
  }

  async listModels(): Promise<string[]> {
    const { data } = await axios.get(`${this.baseUrl}/models`, { headers: this.headers(), timeout: 15_000 });
    const list: { id?: string; name?: string }[] = data?.data ?? data?.models ?? [];
    return list.map((m) => String(m.id ?? m.name ?? '').replace(/^models\//, '')).filter(Boolean);
  }

  private async call(req: CompletionRequest, maxTokens: number): Promise<Completion & { truncated: boolean }> {
    // Models that refuse temperature are reasoning models: give them room to think.
    const reasoning = !this.params.allows('temperature');
    const body: Record<string, unknown> = {
      model: this.model,
      messages: [...(req.system ? [{ role: 'system', content: req.system }] : []), { role: 'user', content: req.prompt }],
      [this.params.maxTokensField]: reasoning ? maxTokens + REASONING_HEADROOM : maxTokens,
    };
    if (this.params.allows('temperature')) body.temperature = 0;
    if (reasoning && this.params.allows('reasoning_effort')) body.reasoning_effort = 'low';
    if (req.json && this.params.allows('response_format')) body.response_format = { type: 'json_object' };

    const { data } = await axios.post(`${this.baseUrl}/chat/completions`, body, {
      headers: { 'content-type': 'application/json', ...this.headers() },
      // A cold local model can be slow on the first call.
      timeout: this.local ? 180_000 : 90_000,
    });
    const choice = data?.choices?.[0];
    const text = String(choice?.message?.content ?? '');
    return {
      text,
      truncated: choice?.finish_reason === 'length',
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
