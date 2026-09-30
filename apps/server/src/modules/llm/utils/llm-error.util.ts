// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { AxiosError } from 'axios';
import Anthropic from '@anthropic-ai/sdk';

export function describeLlmError(err: unknown): string {
  if (err instanceof Anthropic.APIError) return `HTTP ${err.status ?? 'n/a'}: ${err.message}`;
  if (err instanceof AxiosError) {
    const raw = err.response?.data as unknown;
    const data = (Array.isArray(raw) ? raw[0] : raw) as { error?: { message?: string } | string; message?: string } | undefined;
    const msg = (typeof data?.error === 'string' ? data.error : data?.error?.message) ?? data?.message ?? err.message;
    return err.response ? `HTTP ${err.response.status}: ${msg}` : `${err.code ?? 'network'}: ${msg}`;
  }
  return err instanceof Error ? err.message : String(err);
}

export function isAuthError(err: unknown): boolean {
  const status = err instanceof Anthropic.APIError ? err.status : err instanceof AxiosError ? err.response?.status : undefined;
  if (status === 401 || status === 403) return true;
  return status === 400 && /api[ _-]?key|unauthori[sz]ed|authentication/i.test(describeLlmError(err));
}

export function isQuotaError(err: unknown): boolean {
  const status = err instanceof Anthropic.APIError ? err.status : err instanceof AxiosError ? err.response?.status : undefined;
  return (status === 429 || status === 402 || status === 400) && /credit|quota|billing|insufficient|balance|payment/i.test(describeLlmError(err));
}

// "Wrong endpoint for this model": worth trying another protocol.
export function isProtocolMismatch(err: unknown): boolean {
  if (!(err instanceof AxiosError) || !err.response) return false;
  const status = err.response.status;
  const body = JSON.stringify(err.response.data ?? '').toLowerCase();
  if (status === 404 || status === 405) return true;
  return (status === 400 || status === 422) && /(not supported|unsupported|endpoint|use the .*api|invalid model|model not found|does not support)/.test(body);
}

/** The provider said the prompt is too long for this model; a shorter one may work. */
export function isContextTooLong(err: unknown): boolean {
  const m = err instanceof Error ? err.message : String(err);
  return /context (length|window)|maximum context|too many tokens|prompt is too long|too long|reduce the length|token limit|exceeds? the (maximum|limit)/i.test(
    m,
  );
}
