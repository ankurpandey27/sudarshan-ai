// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

/** A site's error that says the answer's format is wrong, not that it is missing ("Invalid input", "Enter a number"). */
export const FORMAT_ERROR = /\binvalid\b|\bformat\b|\bnumeric\b|\bnumber\b|\bdigits?\b|\bdecimal\b|\binteger\b/i;

/**
 * The number in an answer that also has words ("30 days" -> "30", "12 LPA" -> "12", "5+ years" -> "5"), for a box that
 * takes numbers only. Null when there is no number, or the answer is a number already (nothing different to try).
 */
export function bareNumber(answer: string): string | null {
  const m = /^\s*(\d+(?:\.\d+)?)\s*\+?\s*[a-z]/i.exec(answer);
  return m ? m[1] : null;
}
