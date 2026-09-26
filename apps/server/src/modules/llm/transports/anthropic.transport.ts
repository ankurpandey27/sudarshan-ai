import Anthropic from '@anthropic-ai/sdk';
import { LlmProviderKind } from '../enums/llm-provider-kind.enum';
import { Completion, CompletionRequest } from '../interfaces/completion.interface';
import { LlmTransport } from '../interfaces/llm-transport.interface';
import { estimateTokens } from '../utils/json-extract.util';

const THINKING_HEADROOM = 4000;

// Low effort: these are extraction-style calls. Haiku does not accept `effort`.
export class AnthropicTransport implements LlmTransport {
  readonly kind = LlmProviderKind.ANTHROPIC;
  readonly local = false;
  private readonly client: Anthropic;

  constructor(
    readonly model: string,
    apiKey: string,
    baseUrl?: string,
  ) {
    this.client = new Anthropic({ apiKey, baseURL: baseUrl || undefined, timeout: 90_000, maxRetries: 2 });
  }

  async complete(req: CompletionRequest): Promise<Completion> {
    const supportsEffort = !/haiku/i.test(this.model);
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: req.maxTokens + (supportsEffort ? THINKING_HEADROOM : 0),
      ...(req.system ? { system: req.system } : {}),
      ...(supportsEffort ? { output_config: { effort: 'low' as const } } : {}),
      messages: [{ role: 'user', content: req.prompt }],
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
    for await (const m of this.client.models.list()) ids.push(m.id);
    return ids;
  }
}
