// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { SkipRule } from '../enums/skip-rule.enum';

export const SKIP_RULE_TEXT: Record<SkipRule, string> = {
  [SkipRule.MISSING_SKILLS]: 'none of the job skills are in your profile',
  [SkipRule.SALARY]: 'salary below your expected CTC',
  [SkipRule.LOCATION]: 'on-site too far from your city',
  [SkipRule.NOT_REMOTE]: 'not remote',
  [SkipRule.EXCLUDED_COMPANY]: 'company on your never-apply list',
  [SkipRule.EXCLUDED_TITLE]: 'title has a word you skip',
  [SkipRule.DUPLICATE]: 'already applied',
  [SkipRule.LOW_SCORE]: 'low match score',
};

export const SKIP_RULE_FIX: Record<SkipRule, string> = {
  [SkipRule.MISSING_SKILLS]: 'Check the Skills section of your Profile (re-upload your resume if it is empty), or search for roles that match your skills.',
  [SkipRule.SALARY]: 'Lower your expected CTC in Profile if you would take these roles.',
  [SkipRule.LOCATION]: 'Add "Remote" or nearer cities to your search locations, or turn on "Willing to relocate".',
  [SkipRule.NOT_REMOTE]: 'Turn off "Remote only" in Settings to include on-site and hybrid jobs.',
  [SkipRule.EXCLUDED_COMPANY]: 'Edit "Never apply to these companies" in Settings.',
  [SkipRule.EXCLUDED_TITLE]: 'Edit "Skip titles containing" in Settings.',
  [SkipRule.DUPLICATE]: 'Nothing to do - the agent never applies twice.',
  [SkipRule.LOW_SCORE]: 'Lower the review score in Settings, add an AI model for smarter scoring, or adjust your search keywords.',
};
