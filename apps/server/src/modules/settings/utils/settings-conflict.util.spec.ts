// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { DEFAULT_SETTINGS } from '../constants/default-settings.constants';
import { settingsConflict } from './settings-conflict.util';

describe('settingsConflict', () => {
  const withAgent = (agent: Partial<typeof DEFAULT_SETTINGS.agent>) => ({ ...DEFAULT_SETTINGS, agent: { ...DEFAULT_SETTINGS.agent, ...agent } });

  it('accepts the defaults and sensible changes', () => {
    expect(settingsConflict(DEFAULT_SETTINGS)).toBeNull();
    expect(settingsConflict(withAgent({ minReviewScore: 50, minApplyScore: 50 }))).toBeNull();
  });

  it('explains a review score above the apply score, and a minimum wait above the maximum', () => {
    expect(settingsConflict(withAgent({ minReviewScore: 80, minApplyScore: 70 }))).toMatch(/review score \(80\).*apply score \(70\)/);
    expect(settingsConflict(withAgent({ minDelaySeconds: 300, maxDelaySeconds: 60 }))).toMatch(/300s.*60s/);
  });
});
