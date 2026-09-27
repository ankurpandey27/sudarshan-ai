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

  it('starts a fresh run once the previous one has finished', async () => {
    const unscored = jest.fn(() => []);
    const svc = make(unscored);
    await svc.scoreNew();
    await svc.scoreNew();
    expect(unscored).toHaveBeenCalledTimes(2);
  });
});
