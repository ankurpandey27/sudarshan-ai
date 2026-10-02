// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { STORY_PROMPT_CHARS } from '../constants/interview.constants';
import { Story } from '../interfaces/story.interface';

/**
 * A soft answer a written application cannot use: no number, no date, no named thing. The interview asks
 * once more for a specific ("by how much? which month? which tool?"), then accepts what it gets.
 */
export function needsSpecifics(text: string): boolean {
  const t = (text ?? '').trim();
  if (t.length < 20) return true;
  const hasNumber = /\d/.test(t);
  // A name in mid-sentence: "at Acme", "in NestJS", "with Kafka".
  const hasName = /\s[A-Z][A-Za-z0-9.+#-]{1,}/.test(t.slice(1));
  return !hasNumber && !hasName;
}

/** A title from the story's first words, when none was given. */
export function titleOf(text: string): string {
  const first = text.trim().split(/(?<=[.!?])\s/)[0];
  return first.length <= 70 ? first.replace(/[.!?]$/, '') : `${first.slice(0, 67).replace(/\s\S*$/, '')}...`;
}

/**
 * The stories that fit this job best: the most skills in common with its post first, then the newest.
 * Stories with no skill named still fit motivation and behaviour questions, so they fill the rest.
 */
export function relevantStories(stories: Story[], jobText: string, count: number): Story[] {
  const text = jobText.toLowerCase();
  return stories
    .map((s) => ({ s, hits: s.skills.filter((k) => text.includes(k.toLowerCase())).length }))
    .sort((a, b) => b.hits - a.hits || b.s.updatedAt.localeCompare(a.s.updatedAt))
    .slice(0, count)
    .map((x) => x.s);
}

/** One story as the AI sees it: short, in the candidate's own words. */
export function storyLine(s: Story): string {
  const text = s.text.replace(/\s+/g, ' ').trim();
  return `- ${s.title}: ${text.length > STORY_PROMPT_CHARS ? `${text.slice(0, STORY_PROMPT_CHARS)}...` : text}`;
}
