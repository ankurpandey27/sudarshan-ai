// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

const YES = /^\s*(yes|y|yeah|yep|sure|true|ok(ay)?|absolutely|definitely)\b/i;
const NO = /^\s*(no|n|nope|false|not really)\b/i;
const ABOUT_NOTICE = /\bnotice\b|\b(start|join|joining|available|availability)\b.*\b(immediately|days?|weeks?|soon|date)\b|\bhow soon\b/i;

/**
 * A yes/no answer turned into the number a numbers-only box wants, from the question - never a guess.
 *
 * LinkedIn asked "Can you start immediately within 30 days' notice?" in a box that takes only a number: "Yes" was
 * the right decision but "Invalid input", twice, and the AI asked again said "Yes" again (Book An Artist,
 * 2026-10-06). Here:
 * - about notice or starting: your notice period in days (from your profile);
 * - "Yes" to a question that names one number ("within 30 days"): that number;
 * - otherwise Yes is 1 and No is 0, the way numeric yes/no boxes count.
 * Null when the answer was not a yes or a no.
 */
export function yesNoAsNumber(question: string, answer: string, noticePeriodDays: number | null): string | null {
  const yes = YES.test(answer);
  const no = !yes && NO.test(answer);
  if (!yes && !no) return null;
  if (ABOUT_NOTICE.test(question) && noticePeriodDays !== null && noticePeriodDays >= 0) return String(noticePeriodDays);
  const named = [...question.matchAll(/\b(\d{1,3})\b/g)].map((match) => match[1]);
  if (yes && named.length === 1) return named[0];
  return yes ? '1' : '0';
}
