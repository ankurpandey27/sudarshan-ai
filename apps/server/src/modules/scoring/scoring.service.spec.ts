// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { EventsService } from '../../common/events/events.service';
import { JobsService } from '../jobs/jobs.service';
import { LlmService } from '../llm/llm.service';
import { ProfileService } from '../profile/profile.service';
import { SettingsService } from '../settings/settings.service';
import { KeywordFilterService } from './keyword-filter.service';
import { ScoringEngine } from './scoring-engine.service';
import { ScoringService } from './scoring.service';
import { DEFAULT_SETTINGS } from '../settings/constants/default-settings.constants';
import { EMPTY_PROFILE } from '../profile/constants/profile.constants';

describe('ScoringService.scoreNew', () => {
  const make = (unscored: jest.Mock) =>
    new ScoringService(
      { unscored } as unknown as JobsService,
      {} as ProfileService,
      {} as SettingsService,
      {} as LlmService,
      {} as ScoringEngine,
      {} as KeywordFilterService,
      new EventsService(),
    );

  it('shares one run between overlapping callers, so no job is scored (or paid for) twice', async () => {
    const unscored = jest.fn(() => []);
    const svc = make(unscored);
    const a = svc.scoreNew();
    const b = svc.scoreNew();
    expect(b).toBe(a);
    await a;
    expect(unscored).toHaveBeenCalledTimes(1);
  });

  it('reports how far scoring has got while the AI works, and clears it when done', async () => {
    const jobs = Array.from({ length: 20 }, (_, i) => ({
      id: i + 1,
      title: 'Backend',
      company: 'Acme',
      location: '',
      isRemote: true,
      skills: [],
      description: '',
      source: 'linkedin',
      easyApply: true,
    }));
    const settings = { ...DEFAULT_SETTINGS, agent: { ...DEFAULT_SETTINGS.agent, llmScoring: true } };
    const svc = new ScoringService(
      { unscored: () => jobs, setScore: jest.fn() } as unknown as JobsService,
      { get: () => EMPTY_PROFILE } as unknown as ProfileService,
      { get: () => settings } as unknown as SettingsService,
      { isAvailable: () => true } as unknown as LlmService,
      { score: () => ({ technicalScore: 50, salaryScore: 50, locationScore: 50, overallScore: 50 }) } as unknown as ScoringEngine,
      {} as KeywordFilterService,
      new EventsService(),
    );
    jest.spyOn(svc as unknown as { gate: () => null }, 'gate').mockReturnValue(null);
    // Each AI batch waits until the test lets it go, so progress can be read in between.
    const seen: string[] = [];
    jest.spyOn(svc as unknown as { llmScores: () => Promise<Map<number, unknown>> }, 'llmScores').mockImplementation(async () => {
      const p = svc.progress()!;
      seen.push(`${p.stage} ${p.done}/${p.total}`);
      return new Map();
    });

    await svc.scoreNew();
    expect(seen).toEqual(['ai 0/20', 'ai 8/20', 'ai 16/20']);
    expect(svc.progress()).toBeNull();
  });

  it('starts a fresh run once the previous one has finished', async () => {
    const unscored = jest.fn(() => []);
    const svc = make(unscored);
    await svc.scoreNew();
    await svc.scoreNew();
    expect(unscored).toHaveBeenCalledTimes(2);
  });
});
