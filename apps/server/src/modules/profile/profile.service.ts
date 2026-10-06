// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { BadRequestException, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { JobsService } from '../jobs/jobs.service';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../../common/storage/storage.service';
import { EventsService } from '../../common/events/events.service';
import { AgentEventType } from '../../common/events/enums/agent-event-type.enum';
import { localDay } from '../../common/utils/date.util';
import { LlmService } from '../llm/llm.service';
import { LlmPurpose } from '../llm/enums/llm-purpose.enum';
import { canonicalSkill } from '../discovery/utils/job-normalizer.util';
import { EMPTY_PROFILE, ESSENTIAL_FIELDS, RESUME_MAX_BYTES, USER_OWNED_FIELDS } from './constants/profile.constants';
import { CandidateProfile } from './interfaces/candidate-profile.interface';
import { isEmpty, mergeExtracted, sanitizeAi } from './utils/profile-merge.util';
import { ProfileState } from './interfaces/profile-state.interface';
import { ProfileRow } from './interfaces/profile-row.interface';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { pdfToText } from './utils/pdf-text.util';
import { parseResumeHeuristically } from './utils/resume-heuristics.util';
import { RESUME_SYSTEM_PROMPT, buildResumePrompt } from './utils/resume-prompt.util';
import { SKILL_FAMILIES } from './constants/skill-families.constants';

@Injectable()
export class ProfileService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ProfileService.name);
  private readonly uploadsDir: string;
  private parsedWith: ProfileState['parsedWith'] = null;

  constructor(
    private readonly storage: StorageService,
    private readonly llm: LlmService,
    private readonly events: EventsService,
    private readonly jobs: JobsService,
    config: ConfigService,
  ) {
    this.uploadsDir = config.getOrThrow<string>('paths.uploads');
  }

  get(): CandidateProfile {
    const row = this.row();
    return row ? { ...structuredClone(EMPTY_PROFILE), ...(JSON.parse(row.data) as Partial<CandidateProfile>) } : structuredClone(EMPTY_PROFILE);
  }

  state(): ProfileState {
    const row = this.row();
    const profile = this.get();
    return {
      profile,
      resume: row?.resume_name ? { name: row.resume_name, uploadedAt: row.updated_at } : null,
      missing: ESSENTIAL_FIELDS.filter((f) => isEmpty(profile[f])),
      parsedWith: this.parsedWith,
    };
  }

  resumePath(): string | null {
    const path = this.row()?.resume_path;
    return path && existsSync(path) ? path : null;
  }

  resumeText(): string {
    return this.row()?.resume_text ?? '';
  }

  update(patch: UpdateProfileDto): ProfileState {
    // Undefined fields must not erase stored data.
    const changes = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) as Partial<CandidateProfile>;
    const before = this.get();
    this.save({ ...before, ...changes });
    if ('skills' in changes || 'totalYearsExperience' in changes || 'expectedCtc' in changes || 'city' in changes) {
      this.rescoreAfterProfileChange();
    }
    return this.state();
  }

  // Rebuild a profile that lost its data from the stored resume text.
  onApplicationBootstrap(): void {
    const row = this.row();
    const profile = this.get();
    if (!row?.resume_text || profile.skills.length > 0 || profile.firstName) return;
    const restored = parseResumeHeuristically(row.resume_text);
    const next: CandidateProfile = { ...profile };
    for (const [key, value] of Object.entries(restored) as [keyof CandidateProfile, unknown][]) {
      if (isEmpty(next[key]) && !isEmpty(value)) (next as unknown as Record<string, unknown>)[key] = value;
    }
    this.save(next);
    this.rescoreAfterProfileChange();
    this.logger.warn(`Profile was missing its resume data - rebuilt it from ${row.resume_name ?? 'your resume'} (${next.skills.length} skills)`);
  }

  private rescoreAfterProfileChange(): void {
    const n = this.jobs.resetForRescore();
    if (n > 0) {
      this.events.emit({ type: AgentEventType.LOG, message: `Profile changed - scoring ${n} job(s) again` });
      this.events.emit({ type: AgentEventType.PROFILE_UPDATED, message: 'profile updated', data: { rescored: n } });
    }
  }

  async importResume(file: { buffer: Buffer; originalname: string; size: number }): Promise<ProfileState> {
    if (file.size > RESUME_MAX_BYTES) throw new BadRequestException('Resume must be under 10 MB');
    if (extname(file.originalname).toLowerCase() !== '.pdf' || file.buffer.subarray(0, 5).toString() !== '%PDF-') {
      throw new BadRequestException('Please upload your resume as a PDF');
    }
    let text: string;
    try {
      text = await pdfToText(file.buffer);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }

    mkdirSync(this.uploadsDir, { recursive: true });
    // Keep the original filename; recruiters see it.
    const safeName = file.originalname.replace(/[^\w.\- ]+/g, '_').slice(-120);
    const path = join(this.uploadsDir, safeName);
    writeFileSync(path, file.buffer);

    const basic = parseResumeHeuristically(text);
    let extracted: Partial<CandidateProfile> = basic;
    this.parsedWith = 'basic';
    if (this.llm.isAvailable()) {
      try {
        const ai = await this.llm.json<Partial<CandidateProfile>>(buildResumePrompt(text, localDay()), {
          purpose: LlmPurpose.RESUME_PARSE,
          system: RESUME_SYSTEM_PROMPT,
          maxTokens: 4000,
        });
        extracted = mergeExtracted(basic, sanitizeAi(ai));
        this.parsedWith = 'ai';
      } catch (err) {
        this.logger.warn(`AI resume parsing failed, using basic parsing: ${(err as Error).message}`);
      }
    }

    const current = this.get();
    const next: CandidateProfile = { ...current };
    for (const [key, value] of Object.entries(extracted) as [keyof CandidateProfile, unknown][]) {
      if (USER_OWNED_FIELDS.includes(key) || isEmpty(value)) continue;
      (next as unknown as Record<string, unknown>)[key] = value;
    }
    this.storage.run(
      `INSERT INTO profile (id, data, resume_path, resume_name, resume_text, updated_at) VALUES (1, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET data = excluded.data, resume_path = excluded.resume_path,
         resume_name = excluded.resume_name, resume_text = excluded.resume_text, updated_at = excluded.updated_at`,
      [JSON.stringify(next), path, file.originalname, text, new Date().toISOString()],
    );
    this.rescoreAfterProfileChange();
    this.events.emit({
      type: AgentEventType.LOG,
      level: 'success',
      message: `Resume imported (${this.parsedWith === 'ai' ? 'AI' : 'basic'} parsing): ${next.skills.length} skills, ${next.totalYearsExperience} yrs`,
    });
    return this.state();
  }

  /**
   * Your years with a skill, from your profile: the skill itself or a related one it covers ("SQL"
   * counts MySQL and PostgreSQL) - the highest. A skill listed without years counts as your whole career.
   */
  skillYears(skill: string): number | null {
    const profile = this.get();
    const target = canonicalSkill(skill);
    const family = new Set([target, ...(SKILL_FAMILIES[target] ?? []).map(canonicalSkill)]);
    const hits = profile.skills.filter((s) => family.has(canonicalSkill(s.name)));
    if (hits.length === 0) return null;
    return Math.max(...hits.map((h) => h.years ?? profile.totalYearsExperience));
  }

  /**
   * Only the years your profile states for a skill (or a related one); null when it lists the skill
   * without years or not at all. A number you gave yourself beats a skill listed without years.
   */
  statedSkillYears(skill: string): number | null {
    const profile = this.get();
    const target = canonicalSkill(skill);
    const family = new Set([target, ...(SKILL_FAMILIES[target] ?? []).map(canonicalSkill)]);
    const stated = profile.skills.filter((s) => family.has(canonicalSkill(s.name)) && s.years !== null && s.years !== undefined).map((s) => s.years as number);
    return stated.length ? Math.max(...stated) : null;
  }

  private save(profile: CandidateProfile): void {
    this.storage.run(
      `INSERT INTO profile (id, data, updated_at) VALUES (1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
      [JSON.stringify(profile), new Date().toISOString()],
    );
  }

  private row(): ProfileRow | undefined {
    return this.storage.get<ProfileRow>('SELECT data, resume_path, resume_name, resume_text, updated_at FROM profile WHERE id = 1');
  }
}
