// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { SUBJECT_FILLER } from '../constants/form-runner.constants';

/** What a question is about, without its filler: "How many years of DevOps engineering?" -> devops, engineering. */
export function subjectWords(question: string): Set<string> {
  return new Set(
    question
      .toLowerCase()
      .replace(/\b([a-z]+)[\s.-]?js\b/g, '$1js')
      .split(/[^a-z0-9+#\u00c0-\uffff]+/)
      .filter((w) => w.length > 1 && !SUBJECT_FILLER.has(w)),
  );
}

/**
 * Both questions are about the same thing: every subject word of the question asked is in the other
 * ("React experience (years)" and "React / Next.js experience (years)"), and one about nothing in
 * particular only matches another about nothing in particular.
 */
export function sameSubject(asked: string, other: string): boolean {
  const askedWords = subjectWords(asked);
  const otherWords = subjectWords(other);
  if (askedWords.size === 0) return otherWords.size === 0;
  return [...askedWords].every((w) => otherWords.has(w));
}
