// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

/**
 * Questions where a wrong answer costs you: money, dates you commit to, the right to work, legal
 * declarations, identity. The AI may answer these only from a fact it has - never from an inference -
 * so when your profile does not say, you are asked.
 */
export const HIGH_STAKES_QUESTION =
  /\b(salary|ctc|compensation|pay\b|package|remuneration|stipend|(hourly|daily|day|pay) rate|rate per|lpa|per (hour|month|annum|year)|notice period|joining|join by|start date|earliest start|available (from|to start)|last working day|visa|sponsor\w*|work (permit|authori[sz]ation)|authori[sz]ed to work|right to work|citizen\w*|nationality|green card|relocat\w*|bond|non-compete|convict\w*|criminal|legal|court|lawsuit|declare|certify|attest|under oath|signature|aadh?aa?r|\bpan\b|passport|ssn|social security|bank|account number|date of birth|\bdob\b|age\b)\b/i;
