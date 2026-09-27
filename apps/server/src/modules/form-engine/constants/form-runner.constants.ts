// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

/** How long to wait for someone to solve a captcha when the agent is not pausing before Submit. */
export const CAPTCHA_WAIT_MS = 180_000;

/** A resume file already attached on the page, e.g. "AnkurResume.pdf" on Indeed's resume step. */
export const RESUME_ON_PAGE = /\b[\w .()-]{2,80}\.(pdf|docx?|rtf)\b/i;

/** Buttons that end or undo an application; never tried as "another way forward". */
export const UNSAFE_ACTION = /save (and|&) (close|exit)|save for later|withdraw|delete|remove|sign ?out|log ?out|unsubscribe/i;
/** Different buttons tried on one step before handing the form over as stuck. */
export const MAX_OTHER_MOVES = 3;
