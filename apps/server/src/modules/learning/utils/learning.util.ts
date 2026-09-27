// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { FormSnapshot } from '../../form-engine/interfaces/form-field.interface';
import { LearningSession } from '../interfaces/learning-session.interface';

/** Which questions are on screen: changes when a form moves to its next step. */
export const formFingerprint = (s: FormSnapshot | null): string => (s ? `${s.url}|${s.fields.map((f) => f.label).join('|')}` : '');

export const learnedSummary = (s: LearningSession): string =>
  `${s.answers} answer${s.answers === 1 ? '' : 's'} and ${s.steps} step${s.steps === 1 ? '' : 's'}`;
