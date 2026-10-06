// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import Anthropic from '@anthropic-ai/sdk';
import { LlmProviderKind } from '../enums/llm-provider-kind.enum';
import { Completion, CompletionRequest } from '../interfaces/completion.interface';
import { LlmTransport } from '../interfaces/llm-transport.interface';
import { estimateTokens } from '../utils/json-extract.util';
import { RequestParams } from '../utils/request-params.util';

const THINKING_HEADROOM = 4000;

// Low effort: these are extraction-style calls. Models that refuse `effort` (e.g. Haiku) are learned from their errors.
export class AnthropicTransport implements LlmTransport {
  readonly kind = LlmProviderKind.ANTHROPIC;
  readonly local = false;
  private readonly client: Anthropic;
  private readonly params = new RequestParams();

  constructor(
    readonly model: string,
    apiKey: string,
    baseUrl?: string,
  ) {
    this.client = new Anthropic({ apiKey, baseURL: baseUrl || undefined, timeout: 90_000, maxRetries: 2 });
    if (/haiku/i.test(model)) this.params.adapt('effort');
  }

  async complete(req: CompletionRequest): Promise<Completion> {
    return this.params.send(() => this.call(req));
  }

  private async call(req: CompletionRequest): Promise<Completion> {
    const supportsEffort = this.params.allows('effort');
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: req.maxTokens + (supportsEffort ? THINKING_HEADROOM : 0),
      ...(req.system ? { system: req.system } : {}),
      ...(supportsEffort ? { output_config: { effort: 'low' as const } } : {}),
      messages: [
        {
          role: 'user',
          content: req.images?.length
            ? [
                ...req.images.map((i) => ({ type: 'image' as const, source: { type: 'base64' as const, media_type: i.mediaType, data: i.data } })),
                { type: 'text' as const, text: req.prompt },
              ]
            : req.prompt,
        },
      ],
    });
    if (response.stop_reason === 'refusal') {
      throw new Error('Model declined this request');
    }
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    return {
      text,
      promptTokens: response.usage.input_tokens ?? estimateTokens(req.prompt),
      completionTokens: response.usage.output_tokens ?? estimateTokens(text),
    };
  }

  async listModels(): Promise<string[]> {
    const ids: string[] = [];
    for await (const model of this.client.models.list()) ids.push(model.id);
    return ids;
  }
}
