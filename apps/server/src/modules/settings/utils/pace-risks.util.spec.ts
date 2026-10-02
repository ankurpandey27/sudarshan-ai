// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { DEFAULT_SETTINGS } from '../constants/default-settings.constants';
import { AppSettings } from '../interfaces/app-settings.interface';
import { paceRisks } from './pace-risks.util';

describe('paceRisks', () => {
  const settings = (patch: (s: AppSettings) => void): AppSettings => {
    const s = structuredClone(DEFAULT_SETTINGS);
    patch(s);
    return s;
  };

  it('finds nothing wrong with the defaults', () => expect(paceRisks(DEFAULT_SETTINGS)).toEqual([]));

  it('names every setting faster than a person', () => {
    const risks = paceRisks(
      settings((s) => {
        s.sources.linkedin.dailyLimit = 100;
        s.agent.minDelaySeconds = 10;
        s.agent.maxDelaySeconds = 20;
        s.agent.activeHoursStart = 0;
        s.agent.activeHoursEnd = 24;
      }),
    );
    expect(risks).toEqual(['LinkedIn 100 a day (safe: up to 30)', '10 s between applications (safe: at least 30 s)', 'active 24 hours a day']);
  });

  it('ignores the limit of a site that is switched off', () => {
    expect(paceRisks(settings((s) => ((s.sources.indeed.enabled = false), (s.sources.indeed.dailyLimit = 200))))).toEqual([]);
  });

  it('counts hours across midnight', () => {
    expect(paceRisks(settings((s) => ((s.agent.activeHoursStart = 22), (s.agent.activeHoursEnd = 6))))).toEqual([]);
  });
});
