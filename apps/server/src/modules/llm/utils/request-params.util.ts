// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { AxiosError } from 'axios';
import Anthropic from '@anthropic-ai/sdk';

// Optional request parameters that some models refuse. Required ones (model, messages) never appear here.
const OPTIONAL_PARAMS = [
  'max_completion_tokens',
  'max_tokens',
  'max_output_tokens',
  'reasoning_effort',
  'response_format',
  'temperature',
  'top_p',
  'effort',
  'thinking',
  'seed',
] as const;
export type OptionalParam = (typeof OPTIONAL_PARAMS)[number];

const REJECTION = /unsupported|not supported|does not support|not allowed|not permitted|extra inputs|unrecognized|unknown (parameter|field|name)|invalid|deprecated|only the default/i;

function errorBody(err: unknown): { status?: number; text: string; param?: string } {
  if (err instanceof Anthropic.APIError) {
    return { status: err.status, text: `${err.message} ${JSON.stringify(err.error ?? '')}` };
  }
  if (err instanceof AxiosError && err.response) {
    const raw = err.response.data as unknown;
    const data = (Array.isArray(raw) ? raw[0] : raw) as { error?: { param?: string } } | undefined;
    return { status: err.response.status, text: JSON.stringify(raw ?? ''), param: data?.error?.param ?? undefined };
  }
  return { text: '' };
}

/** The optional parameter a 400/422 says the model rejects, or null. */
export function rejectedParam(err: unknown): OptionalParam | null {
  const { status, text, param } = errorBody(err);
  if (status !== 400 && status !== 422) return null;
  const named = param?.split('.').pop();
  if (named && (OPTIONAL_PARAMS as readonly string[]).includes(named)) return named as OptionalParam;
  if (!REJECTION.test(text)) return null;
  // Longest names first, so "max_completion_tokens" is not read as "max_tokens".
  const hit = OPTIONAL_PARAMS.find((p) => new RegExp(`\\b${p}\\b`, 'i').test(text));
  if (hit) return hit;
  if (/json[ _-]?(mode|object)/i.test(text)) return 'response_format';
  return null;
}

/**
 * Which optional parameters one model accepts, learned from its own errors.
 * Lives as long as the transport, so each adjustment costs one failed call.
 */
export class RequestParams {
  private readonly dropped = new Set<OptionalParam>();
  private tokenFieldSwitched = false;

  constructor(private tokenField: 'max_tokens' | 'max_completion_tokens' = 'max_tokens') {}

  get maxTokensField(): 'max_tokens' | 'max_completion_tokens' {
    return this.tokenField;
  }

  allows(param: OptionalParam): boolean {
    return !this.dropped.has(param);
  }

  /** Adjusts for a rejected parameter; false when there is nothing left to try. */
  adapt(param: OptionalParam): boolean {
    if (param === 'max_tokens' || param === 'max_completion_tokens') {
      if (param !== this.tokenField || this.tokenFieldSwitched) return false;
      // Some servers want the other name; the limit itself is never optional.
      this.tokenField = param === 'max_tokens' ? 'max_completion_tokens' : 'max_tokens';
      this.tokenFieldSwitched = true;
      return true;
    }
    if (this.dropped.has(param)) return false;
    this.dropped.add(param);
    return true;
  }

  /** Runs `send`, retrying after each rejected optional parameter. */
  async send<T>(send: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await send();
      } catch (err) {
        const param = rejectedParam(err);
        if (!param || attempt >= OPTIONAL_PARAMS.length || !this.adapt(param)) throw err;
      }
    }
  }
}
