import { Injectable, Logger } from '@nestjs/common';
import { EventsService } from '../../common/events/events.service';
import { AgentEventType } from '../../common/events/enums/agent-event-type.enum';
import { canonicalSkill } from '../discovery/utils/job-normalizer.util';
import { JobsService } from '../jobs/jobs.service';
import { JobSource } from '../jobs/enums/job-source.enum';
import { JobStatus } from '../jobs/enums/job-status.enum';
import { Job, ScoreDetail } from '../jobs/interfaces/job.interface';
import { LlmService } from '../llm/llm.service';
import { LlmPurpose } from '../llm/enums/llm-purpose.enum';
import { ProfileService } from '../profile/profile.service';
import { SettingsService } from '../settings/settings.service';
import { AgentMode } from '../settings/enums/agent-mode.enum';
import { LLM_SCORE_BATCH, LLM_SCORE_WEIGHT, TITLE_MISMATCH_PENALTY } from './constants/scoring.constants';
import { titleTokens } from './utils/title.util';
import { LastScoringRun, LlmJobScore, ScoringRunResult } from './interfaces/llm-score.interface';
import { SkipRule } from './enums/skip-rule.enum';
import { SKIP_RULE_TEXT } from './constants/skip-rule.constants';
import { ProfileSnapshot } from './interfaces/snapshots.interface';
import { emptyDetail, toJobSnapshot, toProfileSnapshot } from './utils/snapshot.util';
import { KeywordFilterService } from './keyword-filter.service';
import { ScoringEngine } from './scoring-engine.service';
import { SCORE_SYSTEM_PROMPT, buildBatchScorePrompt } from './utils/score-prompt.util';

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);
  private last: LastScoringRun | null = null;

  constructor(
    private readonly jobs: JobsService,
    private readonly profile: ProfileService,
    private readonly settings: SettingsService,
    private readonly llm: LlmService,
    private readonly engine: ScoringEngine,
    private readonly filter: KeywordFilterService,
    private readonly events: EventsService,
  ) {}

  async scoreNew(limit = 200): Promise<ScoringRunResult> {
    const out: ScoringRunResult = { scored: 0, review: 0, queued: 0, skipped: 0, llmCalls: 0, skippedBy: {} };
    const pending = this.jobs.unscored(limit);
    if (pending.length === 0) return out;
    const profile = this.profile.get();
    const snap = toProfileSnapshot(profile);
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

    if (s.agent.llmScoring && this.llm.isAvailable() && survivors.length) {
      for (let i = 0; i < survivors.length; i += LLM_SCORE_BATCH) {
        // Model paused mid-run: finish with rule-based scores.
        if (!this.llm.isAvailable()) break;
        const batch = survivors.slice(i, i + LLM_SCORE_BATCH);
        const scores = await this.llmScores(snap, batch.map((b) => b.job));
        out.llmCalls++;
        for (const b of batch) {
          const l = scores.get(b.job.id);
          if (!l) continue;
          b.detail.llm = Math.max(0, Math.min(100, Math.round(l.score)));
          b.detail.summary = l.summary ?? '';
          if (l.matched?.length) b.detail.matchedSkills = l.matched.slice(0, 15);
          if (l.missing?.length) b.detail.missingSkills = l.missing.slice(0, 15);
        }
      }
    }

    const titleTerms = titleTokens([...s.search.keywords, profile.currentTitle, profile.headline].join(' '));
    for (const { job, detail } of survivors) {
      let score =
        detail.llm === null ? detail.engine : Math.round(detail.engine * (1 - LLM_SCORE_WEIGHT) + detail.llm * LLM_SCORE_WEIGHT);
      if (detail.llm === null && titleTerms.size && ![...titleTokens(job.title)].some((t) => titleTerms.has(t))) {
        score = Math.max(0, score - TITLE_MISMATCH_PENALTY);
        detail.summary ||= 'Title does not match your search';
      }
      const external = job.source !== JobSource.WEB && !job.easyApply && !s.sources.externalSites.enabled;
      let status: JobStatus;
      let reason: string;
      if (score >= s.agent.minApplyScore && !external) {
        status = s.agent.mode === AgentMode.AUTO ? JobStatus.APPROVED : JobStatus.REVIEW;
        reason = detail.summary || `Strong match (${score})`;
      } else if (score >= s.agent.minReviewScore) {
        status = JobStatus.REVIEW;
        reason = external ? 'Applies on the company site - enable external sites or apply by hand' : detail.summary || `Partial match (${score})`;
      } else {
        status = JobStatus.SKIPPED;
        reason = detail.summary || `Match score ${score} is below your review threshold (${s.agent.minReviewScore})`;
        detail.skipRule = SkipRule.LOW_SCORE;
      }
      this.jobs.setScore(job.id, score, detail, status, reason);
      out.scored++;
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
        (nothingUsable ? '. Nothing to apply to - see "What needs attention" on Mission control.' : ''),
      data: { ...out },
    });
    this.last = { ...out, total: pending.length, at: new Date().toISOString() };
    return out;
  }

  lastRun(): LastScoringRun | null {
    return this.last;
  }

  private gate(job: Job, snap: ProfileSnapshot): { rule: SkipRule; reason: string } | null {
    const prefs = this.settings.get().search;
    const company = job.company.toLowerCase();
    if (prefs.excludeCompanies.some((c) => c.trim() && company.includes(c.trim().toLowerCase()))) {
      return { rule: SkipRule.EXCLUDED_COMPANY, reason: `${job.company} is on your "never apply" list` };
    }
    const title = job.title.toLowerCase();
    const word = prefs.excludeTitleWords.find((w) => w.trim() && new RegExp(`\\b${w.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(title));
    if (word) return { rule: SkipRule.EXCLUDED_TITLE, reason: `Title contains "${word}", which you chose to skip` };
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
      this.logger.warn(`AI scoring failed, using the engine score: ${(err as Error).message}`);
      return new Map();
    }
  }
}
