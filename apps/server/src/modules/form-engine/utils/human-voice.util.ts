// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { AI_PHRASES, AI_WORDS, EM_DASH_PER_100_WORDS, FILLER_WORDS, MIN_WRITTEN_ANSWER } from '../constants/human-voice.constants';

const WORD_LIST = new RegExp(`\\b(${Object.keys(AI_WORDS).join('|')})\\b`, 'gi');
// Three adjectives or nouns in a row: "fast, reliable, and scalable".
const TRIAD = /\b\w+, \w+,? and \w+\b/g;

/** A written answer worth checking: a sentence or more, not a number or a name. */
export function isWrittenAnswer(text: string): boolean {
  return (text ?? '').trim().length >= MIN_WRITTEN_ANSWER && /\s\S+\s/.test(text);
}

/** What makes an answer read as written by AI, one entry per tell. */
export function aiTells(text: string): string[] {
  const tells: string[] = [];
  for (const word of text.match(WORD_LIST) ?? []) tells.push(`word "${word}"`);
  for (const phrase of AI_PHRASES) if (phrase.test(text)) tells.push(`phrase ${phrase.source.slice(0, 30)}`);
  const words = text.split(/\s+/).filter(Boolean).length;
  const dashes = (text.match(/—|–| -- /g) ?? []).length;
  if (dashes > Math.max(1, Math.ceil((words / 100) * EM_DASH_PER_100_WORDS))) tells.push(`${dashes} dashes`);
  if ((text.match(TRIAD) ?? []).length >= 2) tells.push('stacked lists of three');
  return tells;
}

/**
 * The plain-words pass, done without AI: AI-ish words become the word a person uses, filler words go,
 * and dashes beyond the first become commas. Meaning and facts are untouched.
 */
export function plainWords(text: string): string {
  let out = text.replace(WORD_LIST, (w) => matchCase(AI_WORDS[w.toLowerCase()] ?? w, w)).replace(FILLER_WORDS, '');
  let seen = 0;
  out = out.replace(/\s*(—|–| -- )\s*/g, (m) => (++seen === 1 ? m : ', '));
  // A sentence that began with a dropped filler word starts with a capital again.
  return out.replace(/(^|[.!?]\s+)([a-z])/g, (_m, a: string, b: string) => a + b.toUpperCase());
}

function matchCase(word: string, like: string): string {
  return like[0] === like[0].toUpperCase() ? word[0].toUpperCase() + word.slice(1) : word;
}
