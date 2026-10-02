// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

/**
 * Words recruiters now read as "written by AI", with the plain word a person would use. Adapted from
 * the linkedin-humanizer skill (github.com/sergebulaev/linkedin-skills, MIT), which scores them by density.
 */
export const AI_WORDS: Record<string, string> = {
  leverage: 'use',
  leveraged: 'used',
  leveraging: 'using',
  utilize: 'use',
  utilized: 'used',
  utilizing: 'using',
  facilitate: 'help',
  facilitated: 'helped',
  streamline: 'simplify',
  streamlined: 'simplified',
  robust: 'reliable',
  seamless: 'smooth',
  seamlessly: 'smoothly',
  delve: 'look',
  harness: 'use',
  foster: 'build',
  fostered: 'built',
  cultivate: 'build',
  spearheaded: 'led',
  spearhead: 'lead',
  elevate: 'improve',
  elevated: 'improved',
  showcase: 'show',
  showcased: 'showed',
  synergy: 'teamwork',
  pivotal: 'key',
  meticulous: 'careful',
  meticulously: 'carefully',
  comprehensive: 'full',
  myriad: 'many',
  plethora: 'many',
  realm: 'area',
  landscape: 'field',
  tapestry: 'mix',
};

/** Filler words that add nothing; dropped. */
export const FILLER_WORDS = /\b(fundamentally|essentially|ultimately|crucially|notably|truly|deeply|genuinely),?\s+/gi;

/** Phrases that read as AI on their own. */
export const AI_PHRASES = [
  /\bit'?s not just\b[^.]{1,80}\bit'?s\b/i,
  /\bin today'?s (fast[- ]paced|ever[- ]changing|dynamic|digital)\b/i,
  /\b(game[- ]changer|deep dive|at the end of the day|thrive in|passionate about leveraging)\b/i,
  /\bi am (thrilled|excited|delighted) to (apply|submit|express)\b/i,
  /\b(let me be honest|to be honest|i must say)\b/i,
  /\bnot only\b[^.]{1,60}\bbut also\b/i,
  /\b(embark|journey|navigate the|unlock (the|new)|ever-evolving)\b/i,
];

/** Em dashes allowed per 100 words; more read as AI. */
export const EM_DASH_PER_100_WORDS = 1;

/** Tells in one answer at which it is rewritten (one tell is not a verdict; three are). */
export const REWRITE_AT_TELLS = 3;

/** Answers shorter than this are not checked (a city, a number, a short phrase). */
export const MIN_WRITTEN_ANSWER = 80;

/** The writing rules the AI follows for every written answer. */
export const HUMAN_VOICE_RULES = `- Written answers sound like the candidate wrote them, not an AI: plain words (use, help, built, led - never leverage, utilize, robust, seamless, spearheaded, delve, foster, landscape, journey), no "It's not just X, it's Y", no "In today's fast-paced world", no "I am thrilled to apply", no stacked lists of three adjectives, at most one dash per answer. One concrete fact from the profile (a named project, tool, team size or number the profile states) beats three general claims. Never invent the fact.`;
