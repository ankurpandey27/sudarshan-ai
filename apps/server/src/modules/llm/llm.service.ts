// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Injectable, Logger } from '@nestjs/common';
import { StorageService } from '../../common/storage/storage.service';
import { EventsService } from '../../common/events/events.service';
import { AgentEventType } from '../../common/events/enums/agent-event-type.enum';
import { localDay, localDayStartIso, localMonthStartIso } from '../../common/utils/date.util';
import { SettingsService } from '../settings/settings.service';
import { AppSettings } from '../settings/interfaces/app-settings.interface';
import { LlmPurpose } from './enums/llm-purpose.enum';
import { LlmBudgetExceededError } from './errors/llm-budget-exceeded.error';
import { LlmUnavailableError } from './errors/llm-unavailable.error';
import { LlmCallOptions } from './interfaces/llm-call-options.interface';
import { LlmTransport } from './interfaces/llm-transport.interface';
import { LlmUsageSummary } from './interfaces/llm-usage-summary.interface';
import { LlmUsagePeriod } from './interfaces/llm-usage-period.interface';
import { extractJson } from './utils/json-extract.util';
import { describeLlmError, isAuthError, isQuotaError } from './utils/llm-error.util';
import { LlmFailure } from './interfaces/llm-failure.interface';
import { AUTH_BENCH_MS } from './constants/llm.constants';
import { createTransport } from './utils/transport-factory.util';

const DEFAULT_MAX_TOKENS = 1500;

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private chain: LlmTransport[] = [];
  private benchedUntil = new WeakMap<LlmTransport, number>();
  private budget = 0;
  private lastFailure: LlmFailure | null = null;

  constructor(
    private readonly storage: StorageService,
    private readonly events: EventsService,
    settings: SettingsService,
  ) {
    this.configure(settings.get());
    settings.onChange((s) => this.configure(s));
  }

  isConfigured(): boolean {
    return this.chain.length > 0;
  }

  // False while every model is paused after a key or credit error.
  isAvailable(): boolean {
    const now = Date.now();
    return this.chain.some((t) => (this.benchedUntil.get(t) ?? 0) <= now);
  }

  describe(): string | null {
    const t = this.chain[0];
    return t ? `${t.kind} / ${t.model}` : null;
  }

  complete(prompt: string, opts: LlmCallOptions): Promise<string> {
    return this.call(prompt, opts, false);
  }

  failure(): LlmFailure | null {
    return this.lastFailure;
  }

  // Small models sometimes wrap JSON in prose; retry once with a correction.
  async json<T>(prompt: string, opts: LlmCallOptions): Promise<T> {
    if (this.chain.length === 0) throw new LlmUnavailableError();
    const system = [opts.system, 'Reply with valid JSON only. No markdown, no commentary.'].filter(Boolean).join('\n');
    const first = await this.call(prompt, { ...opts, system }, true);
    try {
      return extractJson<T>(first);
    } catch (err) {
      this.logger.warn(`Unparseable JSON from model (${opts.purpose}), retrying once: ${(err as Error).message}`);
      const retry = await this.call(`${prompt}\n\nYour previous reply was not valid JSON. Return ONLY the JSON value.`, { ...opts, system }, true);
      return extractJson<T>(retry);
    }
  }

  async test(settings: AppSettings['llm']): Promise<{ ok: boolean; latencyMs: number; reply?: string; error?: string }> {
    const transport = createTransport(settings);
    if (!transport) return { ok: false, latencyMs: 0, error: 'Provider, model or API key missing' };
    const started = Date.now();
    try {
      const res = await transport.complete({
        prompt: 'Reply with the JSON {"ok":true} and nothing else.',
        maxTokens: 50,
        json: true,
      });
      this.record(transport, LlmPurpose.TEST, res.promptTokens, res.completionTokens, Date.now() - started, true);
      const ok = /"ok"\s*:\s*true/.test(res.text);
      return { ok, latencyMs: Date.now() - started, reply: res.text.slice(0, 200), error: ok ? undefined : 'Unexpected reply' };
    } catch (err) {
      return { ok: false, latencyMs: Date.now() - started, error: describeLlmError(err) };
    }
  }

  async listModels(settings: AppSettings['llm']): Promise<string[]> {
    const transport = createTransport(settings, false);
    if (!transport) return [];
    return (await transport.listModels()).sort();
  }

  /** Usage is kept forever: today, this month and all time. */
  usage(): LlmUsageSummary {
    const today = localDayStartIso();
    const byPurpose = (since: string | null) =>
      this.storage.all<{ purpose: string; calls: number; tokens: number }>(
        `SELECT purpose, COUNT(*) calls, COALESCE(SUM(prompt_tokens + completion_tokens),0) tokens FROM llm_usage
         ${since ? 'WHERE at >= ?' : ''} GROUP BY purpose ORDER BY tokens DESC`,
        since ? [since] : [],
      );
    const first = this.storage.get<{ at: string | null }>('SELECT MIN(at) at FROM llm_usage');
    return {
      day: localDay(),
      budget: this.budget,
      today: this.period(today),
      month: this.period(localMonthStartIso()),
      allTime: { ...this.period(null), since: first?.at ?? null },
      byPurpose: byPurpose(today),
      byPurposeAllTime: byPurpose(null),
      byModel: this.storage.all<{ model: string; calls: number; tokens: number }>(
        `SELECT provider || ' / ' || model model, COUNT(*) calls, COALESCE(SUM(prompt_tokens + completion_tokens),0) tokens
         FROM llm_usage GROUP BY provider, model ORDER BY tokens DESC`,
      ),
    };
  }

  private period(since: string | null): LlmUsagePeriod {
    const r = this.storage.get<{ calls: number; failed: number | null; p: number; c: number }>(
      `SELECT COUNT(*) calls, SUM(ok = 0) failed, COALESCE(SUM(prompt_tokens),0) p, COALESCE(SUM(completion_tokens),0) c
         FROM llm_usage ${since ? 'WHERE at >= ?' : ''}`,
      since ? [since] : [],
    ) ?? { calls: 0, failed: 0, p: 0, c: 0 };
    const p = Number(r.p);
    const c = Number(r.c);
    return { calls: Number(r.calls), failedCalls: Number(r.failed ?? 0), promptTokens: p, completionTokens: c, tokens: p + c };
  }

  private async call(prompt: string, opts: LlmCallOptions, json: boolean): Promise<string> {
    if (this.chain.length === 0) throw new LlmUnavailableError();
    const errors: string[] = [];
    let overBudget: LlmBudgetExceededError | null = null;
    for (const transport of this.chain) {
      const benched = this.benchedUntil.get(transport) ?? 0;
      if (benched > Date.now()) {
        errors.push(`${transport.kind}/${transport.model}: paused after "${this.lastFailure?.message ?? 'an error'}"`);
        continue;
      }
      // Over today's budget: skip paid models but still try a free local one further down the chain.
      if (!transport.local) {
        try {
          this.assertBudget();
        } catch (err) {
          if (!(err instanceof LlmBudgetExceededError)) throw err;
          overBudget = err;
          errors.push(`${transport.kind}/${transport.model}: ${err.message}`);
          continue;
        }
      }
      const started = Date.now();
      try {
        const res = await transport.complete({ system: opts.system, prompt, maxTokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS, json });
        this.record(transport, opts.purpose, res.promptTokens, res.completionTokens, Date.now() - started, true);
        this.lastFailure = null;
        return res.text;
      } catch (err) {
        this.record(transport, opts.purpose, 0, 0, Date.now() - started, false);
        const detail = describeLlmError(err);
        const msg = `${transport.kind}/${transport.model}: ${detail}`;
        errors.push(msg);
        const kind: LlmFailure['kind'] = isQuotaError(err) ? 'quota' : isAuthError(err) ? 'auth' : 'other';
        if (this.lastFailure?.message !== detail) {
          // Log each distinct problem once, not once per job.
          this.events.emit({
            type: AgentEventType.LOG,
            level: kind === 'other' ? 'warn' : 'error',
            message:
              kind === 'quota'
                ? `AI model (${transport.kind}) has no credits left - paused for 10 minutes, continuing without AI. Add credits or switch to a free model in Settings.`
                : kind === 'auth'
                  ? `AI model (${transport.kind}) rejected the API key - paused for 10 minutes, continuing without AI. Fix the key in Settings.`
                  : `AI model (${transport.kind}) failed: ${detail}`,
          });
        }
        this.lastFailure = { kind, provider: transport.kind, model: transport.model, message: detail, at: new Date().toISOString() };
        if (kind !== 'other') {
          // Retrying cannot help until the key or credits are fixed.
          this.benchedUntil.set(transport, Date.now() + AUTH_BENCH_MS);
          this.logger.debug(`${msg} - paused for 10 minutes`);
        } else {
          // Already shown once in the flight log; repeats go to the debug log only.
          this.logger.debug(`LLM call failed (${opts.purpose}) - ${msg}`);
        }
      }
    }
    // Only the budget stood in the way: say so, as before.
    if (overBudget && errors.length === 1) throw overBudget;
    throw new LlmUnavailableError(`All AI models failed: ${errors.join(' | ')}`);
  }

  private configure(s: AppSettings): void {
    this.chain = [createTransport(s.llm), createTransport(s.fallbackLlm)].filter((t): t is LlmTransport => t !== null);
    this.benchedUntil = new WeakMap();
    this.lastFailure = null;
    this.budget = s.agent.tokenBudgetPerDay;
  }

  private assertBudget(): void {
    if (this.budget <= 0) return;
    const used = this.storage.get<{ t: number }>(
      "SELECT COALESCE(SUM(prompt_tokens + completion_tokens), 0) t FROM llm_usage WHERE at >= ? AND provider NOT IN ('ollama', 'lmstudio')",
      [localDayStartIso()],
    )?.t;
    if (Number(used) >= this.budget) throw new LlmBudgetExceededError(Number(used), this.budget);
  }

  private record(t: LlmTransport, purpose: LlmPurpose, p: number, c: number, ms: number, ok: boolean): void {
    this.storage.run(
      'INSERT INTO llm_usage (at, provider, model, purpose, prompt_tokens, completion_tokens, duration_ms, ok) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [new Date().toISOString(), t.kind, t.model, purpose, p, c, ms, ok ? 1 : 0],
    );
  }
}
