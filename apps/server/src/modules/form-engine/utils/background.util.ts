// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { ABOUT_WORK, BACKGROUND_QUESTION, CLEAN_STATEMENT, CONSENT, NOTHING_TO_DECLARE } from '../constants/background.constants';
import { FieldKind } from '../enums/field-kind.enum';

/**
 * The answer a candidate with a clean record gives, worded the way the question asks it:
 * "Have you ever been convicted?" / "Any legal action against you?" -> No;
 * "I confirm I have no criminal record" / "Do you consent to a background check?" -> Yes;
 * "Give details of any convictions" -> "Not applicable ...". null when it is not such a question.
 */
export function cleanRecordAnswer(question: string, kind: FieldKind): string | null {
  const lower = question.toLowerCase();
  // Only a question about your record - never one about your work that mentions such a word ("fraud detection").
  if (!BACKGROUND_QUESTION.test(lower) || ABOUT_WORK.test(lower)) return null;
  if (kind === FieldKind.TEXT || kind === FieldKind.TEXTAREA) return NOTHING_TO_DECLARE;
  if (CONSENT.test(lower)) return 'Yes';
  // A statement to tick ("I have no pending cases") or a question that already says "no" ("Are you free of ...").
  if (kind === FieldKind.CHECKBOX || CLEAN_STATEMENT.test(lower)) return 'Yes';
  return 'No';
}
