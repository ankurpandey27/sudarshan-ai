// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

/** Questions about your record: convictions, legal cases, dismissals, bans, disciplinary action. */
export const BACKGROUND_QUESTION =
  /\b(criminal|convict(ed|ion)s?|offen[cs]es?|arrest(ed)?|charged|prosecut\w*|court (case|proceedings?)|legal (action|case|proceedings?|dispute)s?|lawsuit|litigation|pending (case|charges?)|police (case|record|verification)|fir\b|felon(y|ies)|misdemeanou?r|disciplinary|misconduct|dismissed|terminated|fired|debarred|blacklisted|barred|sanction(ed)?|fraud|bankrupt\w*|background (check|verification|screening)|character (certificate|verification)|moral turpitude)\b/i;

/** Wording that means "I am clean" is the statement being agreed to ("I have no ...", "free of ..."). */
export const CLEAN_STATEMENT = /\b(no|not|never|free (of|from)|clean|without any|none)\b/i;

/** Asking for your consent or willingness: yes whatever else it says. */
export const CONSENT = /\b(consent|agree|authori[sz]e|willing|ready|undergo|comfortable|allow|permission|okay|ok with)\b/i;

/** What goes in a text box asking to explain any such history. */
export const NOTHING_TO_DECLARE = 'Not applicable - I have no criminal record, pending legal action or disciplinary history.';

/** File fields that want something other than your resume. */
export const NOT_A_RESUME =
  /cover\s*letter|motivation letter|photo|picture|image|headshot|avatar|selfie|transcript|certificate|mark ?sheet|degree|diploma|id proof|identity|aadh?aa?r|\bpan\b|passport|portfolio|work sample|signature|pay ?slip|salary slip|offer letter|relieving|experience letter/i;

/** An upload offered instead of a resume the site already holds ("Upload a different file"). */
export const REPLACES_RESUME = /\b(different|another|replace|change|new)\b/i;

/** A question about your work - "experience in fraud detection", "sanctions screening skills" - not about your record. */
export const ABOUT_WORK =
  /\b(experience|experienced|skills?|knowledge|familiar|worked (on|with|in)|domain|projects?|tools?|systems?|detection|prevention|compliance (tools|software)|years of)\b/i;
