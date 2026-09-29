// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { AnswerSource } from '../enums/answer-source.enum';

export const ANSWER_SOURCE_TRUST: Record<AnswerSource, number> = {
  [AnswerSource.USER]: 3,
  [AnswerSource.EXCEL]: 3,
  [AnswerSource.LLM]: 1,
};

/** How each source is named in exports, as on the Answer memory page. */
export const ANSWER_SOURCE_LABEL: Record<AnswerSource, string> = {
  [AnswerSource.USER]: 'Yours',
  [AnswerSource.EXCEL]: 'From Excel',
  [AnswerSource.LLM]: 'From AI',
};

export const FUZZY_MATCH_THRESHOLD = 0.75;

/**
 * Personal details asked in many wordings ("What is my PAN number?", "PAN Number (Mandatory for TCS)"):
 * a saved answer about the same detail is reused, however the question is worded.
 */
export const PERSONAL_DETAILS: { name: string; test: RegExp }[] = [
  { name: 'PAN', test: /\bpan\b(?![\s-]*india)|permanent account number/i },
  { name: 'Aadhaar', test: /\baadh?aa?r\b/i },
  { name: 'UAN', test: /\buan\b|universal account number/i },
  { name: 'passport number', test: /passport\s*(no\b|number|num\b|#)/i },
  { name: 'date of birth', test: /date\s*of\s*birth|\bd\.?o\.?b\b|birth\s*date/i },
];

/** "How old are you?" - answered from your date of birth. */
export const AGE_QUESTION = /how old are you|\byour (current )?age\b|^age\b|\bcurrent age\b|\bage \((in )?years\)/i;

/** A question asking for a number of years. */
export const YEARS_QUESTION =
  /\b(how many|no\.? of|number of)\b.*\b(years?|yrs?)\b|\b(years?|yrs?)\s*(of\s*)?(experience|exp)\b|\bexperience\s*\(?\s*(in\s*)?(years?|yrs?)/i;

/** Your total career length, as opposed to one skill's. */
export const TOTAL_EXPERIENCE =
  /\btotal\b|\boverall\b|\bwork experience\b|\bprofessional experience\b|^\s*experience\s*(\(|$)|^how many years of experience\b/i;

/** No one has more years of anything than this; a bigger number is a typo or a year ("2024"). */
export const MAX_PLAUSIBLE_YEARS = 50;

/** Stand-in labels for fields with no real question; answers to them are never remembered or reused. */
export const GENERIC_QUESTION = /^(choose an option|select( an?)?( option| one)?|please select|choose|pick one|option|answer|-+)$/i;

/** Past answers shown to the AI for a question: the closest few... */
export const PAST_ANSWERS_SHOWN = 5;
/** ...that are at least this similar in meaning (0-1). Below it, they are about something else. */
export const PAST_ANSWER_MIN_SIMILARITY = 0.5;
