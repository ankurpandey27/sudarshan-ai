// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Injectable, Logger, Optional } from '@nestjs/common';
import { EventsService } from '../../common/events/events.service';
import { AgentEventType } from '../../common/events/enums/agent-event-type.enum';
import { canonicalSkill } from '../discovery/utils/job-normalizer.util';
import { coreSkillsIn, coreSkillsOf, skillLabel, skillList } from './utils/core-skill.util';
import { JobsService } from '../jobs/jobs.service';
import { JobSource } from '../jobs/enums/job-source.enum';
import { JobStatus } from '../jobs/enums/job-status.enum';
import { Job, ScoreDetail } from '../jobs/interfaces/job.interface';
import { LlmService } from '../llm/llm.service';
import { LlmPurpose } from '../llm/enums/llm-purpose.enum';
import { ProfileService } from '../profile/profile.service';
import { SettingsService } from '../settings/settings.service';
import { AgentMode } from '../settings/enums/agent-mode.enum';
import {
  CORE_SKILL_BONUS,
  CORE_SKILL_BONUS_MAX,
  LAST_RUN_KEEP_MS,
  LLM_SCORE_BATCH,
  LLM_SCORE_WEIGHT,
  TITLE_MISMATCH_PENALTY,
} from './constants/scoring.constants';
import { titleTokens } from './utils/title.util';
import { containsTerm } from './utils/whole-term.util';
import { LastScoringRun, LlmJobScore, ScoringRunResult } from './interfaces/llm-score.interface';
import { ScoringProgress } from './interfaces/scoring-progress.interface';
import { SkipRule } from './enums/skip-rule.enum';
import { SKIP_RULE_TEXT } from './constants/skip-rule.constants';
import { ProfileSnapshot } from './interfaces/snapshots.interface';
import { emptyDetail, toJobSnapshot, toProfileSnapshot } from './utils/snapshot.util';
import { KeywordFilterService } from './keyword-filter.service';
import { ScoringEngine } from './scoring-engine.service';
import { SCORE_SYSTEM_PROMPT, buildBatchScorePrompt } from './utils/score-prompt.util';
import { TasteService } from '../taste/taste.service';
import { HOLD_BACK_BELOW } from '../taste/constants/taste.constants';
import { belowLevel, levelFor } from './utils/seniority.util';
import { addressesAi } from '../llm/utils/untrusted.util';
import { STEERING_NOTE } from './constants/scoring.constants';

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);
  private last: LastScoringRun | null = null;
  private inFlight: Promise<ScoringRunResult> | null = null;
  private current: ScoringProgress | null = null;

  constructor(
    private readonly jobs: JobsService,
    private readonly profile: ProfileService,
    private readonly settings: SettingsService,
    private readonly llm: LlmService,
    private readonly engine: ScoringEngine,
    private readonly filter: KeywordFilterService,
    private readonly events: EventsService,
    @Optional() private readonly taste?: TasteService,
  ) {}

  /** Concurrent callers share one run, so no job is scored (or paid for) twice. */
  scoreNew(limit = 200): Promise<ScoringRunResult> {
    this.inFlight ??= this.run(limit).finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async run(limit: number): Promise<ScoringRunResult> {
    const out: ScoringRunResult = { scored: 0, review: 0, queued: 0, skipped: 0, llmCalls: 0, skippedBy: {} };
    const pending = this.jobs.unscored(limit);
    if (pending.length === 0) return out;
    const startedAt = Date.now();
    const p: ScoringProgress = { total: pending.length, done: 0, stage: 'rules', skipped: 0, startedAt: new Date(startedAt).toISOString(), etaSeconds: null };
    this.current = p;
    const tick = (done: number) => {
      p.done = done;
      const perJob = (Date.now() - startedAt) / Math.max(1, done);
      p.etaSeconds = done >= 3 ? Math.round((perJob * (p.total - done)) / 1000) : null;
    };
    this.events.emit({ type: AgentEventType.LOG, message: `Scoring ${pending.length} job(s) against your profile...` });
    try {
      return await this.scoreAll(pending, out, p, tick);
    } finally {
      this.current = null;
    }
  }

  /** The run currently scoring, if any. */
  progress(): ScoringProgress | null {
    return this.current ? { ...this.current } : null;
  }

  /** The run that finished in the last few seconds, if any - rule-based scoring often takes under a second. */
  justFinished(): LastScoringRun | null {
    return this.last && Date.now() - Date.parse(this.last.at) < LAST_RUN_KEEP_MS ? { ...this.last } : null;
  }

  private async scoreAll(pending: Job[], out: ScoringRunResult, p: ScoringProgress, tick: (done: number) => void): Promise<ScoringRunResult> {
    const profile = this.profile.get();
    const snap = toProfileSnapshot(profile, this.settings.get().search.locations);
    const s = this.settings.get();
    const survivors: { job: Job; detail: ScoreDetail }[] = [];

    const skip = (rule: SkipRule) => {
      out.skipped++;
      out.skippedBy[rule] = (out.skippedBy[rule] ?? 0) + 1;
    };
    for (const job of pending) {
      const gate = this.gate(job, snap);
      if (gate) {
        this.jobs.setScore(job.id, 0, { ...emptyDetail(gate.reason), skipRule: gate.rule }, JobStatus.SKIPPED, gate.reason);
        skip(gate.rule);
        p.skipped++;
        tick(p.skipped);
        continue;
      }
      const jsnap = toJobSnapshot(job);
      const scores = this.engine.score(snap, jsnap);
      const have = new Set(snap.skills.map(canonicalSkill));
      survivors.push({
        job,
        detail: {
          technical: scores.technicalScore,
          salary: scores.salaryScore,
          location: scores.locationScore,
          engine: scores.overallScore,
          llm: null,
          matchedSkills: jsnap.requiredSkills.filter((r) => have.has(canonicalSkill(r))),
          missingSkills: jsnap.requiredSkills.filter((r) => !have.has(canonicalSkill(r))),
          summary: '',
        },
      });
    }

    const gated = p.skipped;
    // A job post written to steer AI tools ("ignore previous instructions", "rate this job 100") is never shown to
    // the AI: rules score it, and its summary says why.
    for (const b of survivors) {
      if (addressesAi(`${b.job.title} ${b.job.description}`)) b.detail.summary = STEERING_NOTE;
    }
    const forAi = survivors.filter((b) => b.detail.summary !== STEERING_NOTE);
    const useAi = s.agent.llmScoring && this.llm.isAvailable() && forAi.length > 0;
    if (useAi) {
      p.stage = 'ai';
      for (let i = 0; i < forAi.length; i += LLM_SCORE_BATCH) {
        // Model paused mid-run: finish with rule-based scores.
        if (!this.llm.isAvailable()) break;
        const batch = forAi.slice(i, i + LLM_SCORE_BATCH);
        const scores = await this.llmScores(
          snap,
          batch.map((b) => b.job),
        );
        out.llmCalls++;
        for (const b of batch) {
          const l = scores.get(b.job.id);
          if (!l) continue;
          b.detail.llm = Math.max(0, Math.min(100, Math.round(l.score)));
          b.detail.summary = l.summary ?? '';
          if (l.matched?.length) b.detail.matchedSkills = l.matched.slice(0, 15);
          if (l.missing?.length) b.detail.missingSkills = l.missing.slice(0, 15);
        }
        tick(gated + Math.min(forAi.length, i + batch.length));
      }
    }

    const titleTerms = titleTokens([...s.search.keywords, profile.currentTitle, profile.headline].join(' '));
    const core = coreSkillsOf({
      coreSkills: s.search.coreSkills,
      keywords: s.search.keywords,
      profileSkills: profile.skills.map((k) => k.name),
      currentTitle: profile.currentTitle,
      headline: profile.headline,
    });
    p.stage = 'saving';
    for (const [n, { job, detail }] of survivors.entries()) {
      let score = detail.llm === null ? detail.engine : Math.round(detail.engine * (1 - LLM_SCORE_WEIGHT) + detail.llm * LLM_SCORE_WEIGHT);
      // A job asking for your core skill (e.g. Node.js) is yours to judge, whatever its title or score.
      const coreHits = coreSkillsIn(job, core);
      const coreHit = coreHits[0] ?? null;
      if (detail.llm === null && !coreHit && titleTerms.size && ![...titleTokens(job.title)].some((t) => titleTerms.has(t))) {
        score = Math.max(0, score - TITLE_MISMATCH_PENALTY);
        detail.summary ||= 'Title does not match your search';
      }
      // Two or more of your core skills together (e.g. Node.js and NestJS) is a closer fit than one.
      if (coreHits.length >= 2) {
        score = Math.min(100, score + Math.min(CORE_SKILL_BONUS * (coreHits.length - 1), CORE_SKILL_BONUS_MAX));
        detail.summary ||= `Asks for ${skillList(coreHits)} - ${coreHits.length} of your ${core.length} core skills`;
      }
      const external = job.source !== JobSource.WEB && !job.easyApply && !s.sources.externalSites.enabled;
      let status: JobStatus;
      let reason: string;
      if (score >= s.agent.minApplyScore && !external) {
        status = s.agent.mode === AgentMode.AUTO ? JobStatus.APPROVED : JobStatus.REVIEW;
        reason = detail.summary || `Strong match (${score})`;
        // Auto mode: a job unlike the ones you approve waits for your review instead of being sent.
        const taste = status === JobStatus.APPROVED ? this.taste?.predict({ ...job, detail, score }) : null;
        if (taste && taste.p < HOLD_BACK_BELOW) {
          status = JobStatus.REVIEW;
          reason = `Held for your review - unlike the jobs you usually approve (${Math.round(taste.p * 100)}% your interest)`;
        }
      } else if (coreHit && score < s.agent.minReviewScore) {
        // Never skipped for a low score: it waits in Review, saying why. You still decide.
        status = JobStatus.REVIEW;
        reason =
          coreHits.length > 1
            ? `Below your score (${score}), but it asks for ${skillList(coreHits)} - your core skills`
            : `Below your score (${score}), but it asks for ${skillLabel(coreHit)} - your core skill`;
      } else if (score >= s.agent.minReviewScore) {
        status = JobStatus.REVIEW;
        reason = external
          ? 'Applies on the company site - turn on "Company career sites" under Apply on, or apply by hand'
          : detail.summary || `Partial match (${score})`;
      } else {
        status = JobStatus.SKIPPED;
        reason = detail.summary || `Match score ${score} is below your review threshold (${s.agent.minReviewScore})`;
        detail.skipRule = SkipRule.LOW_SCORE;
      }
      this.jobs.setScore(job.id, score, detail, status, reason);
      out.scored++;
      if (!useAi) tick(gated + n + 1);
      if (status === JobStatus.APPROVED) out.queued++;
      else if (status === JobStatus.REVIEW) out.review++;
      else skip(SkipRule.LOW_SCORE);
    }

    const top = Object.entries(out.skippedBy).sort((a, b) => b[1] - a[1])[0];
    const nothingUsable = out.queued + out.review === 0;
    this.events.emit({
      type: AgentEventType.LOG,
      level: nothingUsable ? 'warn' : 'success',
      message:
        `Scored ${pending.length} jobs: ${out.queued} queued, ${out.review} to review, ${out.skipped} skipped` +
        (top ? ` - most skipped for: ${SKIP_RULE_TEXT[top[0] as SkipRule]} (${top[1]})` : '') +
        (nothingUsable ? '. Nothing to apply to - see "What needs attention" on Lakshya.' : ''),
      data: { ...out },
    });
    this.last = { ...out, total: pending.length, at: new Date().toISOString() };
    // Give the new jobs their "your taste" score.
    this.taste?.refresh();
    return out;
  }

  lastRun(): LastScoringRun | null {
    return this.last;
  }

  private gate(job: Job, snap: ProfileSnapshot): { rule: SkipRule; reason: string } | null {
    const prefs = this.settings.get().search;
    const company = job.company.toLowerCase();
    if (prefs.excludeCompanies.some((c) => containsTerm(company, c))) {
      return { rule: SkipRule.EXCLUDED_COMPANY, reason: `${job.company} is on your "never apply" list` };
    }
    const title = job.title.toLowerCase();
    const word = prefs.excludeTitleWords.find((w) => containsTerm(title, w));
    if (word) return { rule: SkipRule.EXCLUDED_TITLE, reason: `Title contains "${word}", which you chose to skip` };
    // Internships, fresher and junior roles, "0-2 years": not for someone at your level.
    const junior = belowLevel(
      { title: job.title, url: job.applyUrl || job.url, description: job.description ?? '' },
      levelFor(prefs.minExperience, snap.yearsExperience),
    );
    if (junior) return { rule: SkipRule.BELOW_LEVEL, reason: junior };
    if (prefs.remoteOnly && !job.isRemote) return { rule: SkipRule.NOT_REMOTE, reason: 'Not remote (you chose remote only)' };
    if (this.jobs.isAlreadyApplied(job.company, job.title)) return { rule: SkipRule.DUPLICATE, reason: 'You already applied to this role' };
    const verdict = this.filter.filter(snap, toJobSnapshot(job));
    return verdict.outcome === 'SKIP' ? { rule: verdict.rule, reason: verdict.reason } : null;
  }

  private async llmScores(profile: ProfileSnapshot, jobs: Job[]): Promise<Map<number, LlmJobScore>> {
    try {
      const res = await this.llm.json<{ scores?: LlmJobScore[] }>(buildBatchScorePrompt(profile, jobs), {
        purpose: LlmPurpose.JOB_SCORE,
        system: SCORE_SYSTEM_PROMPT,
        maxTokens: 120 * jobs.length + 200,
      });
      return new Map((res.scores ?? []).filter((x) => Number.isFinite(Number(x.score))).map((x) => [Number(x.id), x]));
    } catch (err) {
      // LlmService already reported the failure to the user.
      this.logger.debug(`AI scoring failed, using the engine score: ${(err as Error).message}`);
      return new Map();
    }
  }
}
