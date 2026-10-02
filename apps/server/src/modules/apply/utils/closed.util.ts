// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { FormSnapshot } from '../../form-engine/interfaces/form-field.interface';
import { CLOSED_TEXT } from '../constants/apply.constants';

/** "Apply to similar jobs" and the like is not this job's Apply. */
const ELSEWHERE = /similar|other jobs|more jobs|related jobs|jobs like/i;

/**
 * Whether a job page says the job is closed. Words alone are not enough: a page that still offers its own Apply
 * button is open - Himalayas shows a "Job expired?" link (to report one) above a working "Apply now" (Nagarro,
 * 2026-10-03), and help texts and footers mention expired jobs too. Closed pages show no Apply, or a greyed-out one.
 */
export function looksClosed(text: string, snap: Pick<FormSnapshot, 'actions'>, extra?: RegExp): boolean {
  if (!CLOSED_TEXT.test(text) && !extra?.test(text)) return false;
  return !snap.actions.some((a) => !a.disabled && (a.kind === 'apply' || a.kind === 'submit') && !ELSEWHERE.test(a.text));
}
