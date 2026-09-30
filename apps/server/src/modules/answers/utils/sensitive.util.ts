// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { PERSONAL_DETAILS } from '../constants/answers.constants';
import { SENSITIVE_QUESTION, SENSITIVE_VALUE } from '../constants/sensitive.constants';

/**
 * Something that identifies you - asked for by the question (PAN, Aadhaar, date of birth, phone,
 * email, address...) or looking like it (a PAN-style code, a 12-digit number, an email address, a
 * phone number, a date). Never shown to the AI: such answers come from your profile and your own
 * saved answers only.
 */
export function isSensitive(question: string, answer = ''): boolean {
  const q = question.toLowerCase();
  if (PERSONAL_DETAILS.some((d) => d.test.test(q)) || SENSITIVE_QUESTION.test(q)) return true;
  return SENSITIVE_VALUE.some((re) => re.test(answer.trim()));
}

/** Page text for the AI with anything that identifies you blanked out ("[hidden]"). */
export function redactSensitive(text: string): string {
  return SENSITIVE_VALUE.reduce((t, re) => t.replace(new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`), '[hidden]'), text);
}
