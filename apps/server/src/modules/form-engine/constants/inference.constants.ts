// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

/**
 * Questions where a wrong answer costs you: money, dates you commit to, the right to work, legal
 * declarations, identity. The AI may answer these only from a fact it has - never from an inference -
 * so when your profile does not say, you are asked.
 */
/**
 * What you would or would not do - shifts, contract roles, working from home or the office, travel, weekends. Only
 * you know; the AI never guesses them (BambooHR, 2026-10-02: it guessed some on one try and gave them back as
 * questions on the next, so you were asked three times instead of once).
 */
export const PREFERENCE_QUESTION =
  /\b(open to|willing to|comfortable (with|working)|ok(ay)? (with|to)|fine with|happy to|prepared to|ready to|available (for|to work)|night shifts?|shifts?\b|rotational|weekends?|contract(ual)?\b|freelance|part[- ]time|work from (home|office)|wfh|wfo|on-?site|in[- ]office|hybrid|commute|travel)\b/i;

export const HIGH_STAKES_QUESTION =
  /\b(salary|ctc|compensation|pay\b|package|remuneration|stipend|(hourly|daily|day|pay) rate|rate per|lpa|per (hour|month|annum|year)|notice period|joining|join by|start date|earliest start|available (from|to start)|last working day|visa|sponsor\w*|work (permit|authori[sz]ation)|authori[sz]ed to work|right to work|citizen\w*|nationality|green card|relocat\w*|bond|non-compete|convict\w*|criminal|legal|court|lawsuit|declare|certify|attest|under oath|signature|aadh?aa?r|\bpan\b|passport|ssn|social security|bank|account number|date of birth|\bdob\b|age\b)\b/i;
