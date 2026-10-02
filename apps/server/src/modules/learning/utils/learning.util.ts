// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { FormSnapshot } from '../../form-engine/interfaces/form-field.interface';
import { LearningSession } from '../interfaces/learning-session.interface';

/** Which questions are on screen: changes when a form moves to its next step. */
export const formFingerprint = (s: FormSnapshot | null): string => (s ? `${s.url}|${s.fields.map((f) => f.label).join('|')}` : '');

export const learnedSummary = (s: LearningSession): string => {
  const parts = [`${s.answers} answer${s.answers === 1 ? '' : 's'}`, `${s.steps} step${s.steps === 1 ? '' : 's'}`];
  const ways = s.ways?.size ?? 0;
  if (ways) parts.push(`how to fill ${ways} kind${ways === 1 ? '' : 's'} of field`);
  return parts.length === 2 ? parts.join(' and ') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
};
