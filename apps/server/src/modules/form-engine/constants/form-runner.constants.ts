// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

/** How long to wait for someone to solve a captcha when the agent is not pausing before Submit. */
export const CAPTCHA_WAIT_MS = 180_000;

/** A resume file already attached on the page, e.g. "AnkurResume.pdf" on Indeed's resume step. */
// A real file name - letters or digits right before the extension - not hint text like "(.pdf, .docx)".
export const RESUME_ON_PAGE = /\b[A-Za-z0-9][\w()-]*[A-Za-z0-9]\.(pdf|docx?|rtf)\b/i;

/** Buttons that end or undo an application; never tried as "another way forward". */
export const UNSAFE_ACTION = /save (and|&) (close|exit)|save for later|withdraw|delete|remove|sign ?out|log ?out|unsubscribe/i;

/**
 * Buttons that never move an application forward: leaving or pausing it (Save and close, Save
 * job), site chrome (Indeed's "1 new update", Report, Skip to main content), previews, going back,
 * and captcha controls. Never chosen, never learned - not even from what you click by hand.
 * "Save and continue" still counts.
 */
export const NEVER_ADVANCE = new RegExp(
  [
    UNSAFE_ACTION.source,
    /^(save|don'?t save|do not save|save job|go back|back|previous|cancel|close|discard|help|verify|skip)$/.source,
    /\bpreview\b|\bnew (update|message|notification)s?\b|\bnotifications?\b|\breport\b|feedback|skip to|not interested/.source,
    /\b(search|find) jobs?\b|view (full )?job description|cv options|challenge|captcha|\bedit\b/.source,
  ].join('|'),
  'i',
);

/** A learned "apply" button must say so; anything else (a job title, a search box) is noise. */
export const APPLY_WORDING = /\bapply\b|i'?m interested|continue|start/i;
/** Different buttons tried on one step before handing the form over as stuck. */
export const MAX_OTHER_MOVES = 3;
