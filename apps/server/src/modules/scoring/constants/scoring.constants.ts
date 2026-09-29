// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

export const SCORE_WEIGHTS = { technical: 0.5, salary: 0.25, location: 0.25 } as const;

/** Share of the final score given to the AI's verdict. */
export const LLM_SCORE_WEIGHT = 0.6;

export const LLM_SCORE_BATCH = 8;

export const LLM_DESCRIPTION_CHARS = 900;

/** Without AI scoring: penalty when the title shares no word with the search or current title. */
export const TITLE_MISMATCH_PENALTY = 15;

/** How long a finished scoring run stays in the status, so the screen can show its result. */
export const LAST_RUN_KEEP_MS = 15_000;

/** Points for each core skill a job asks for beyond the first ("Node.js and NestJS" fits closer than one). */
export const CORE_SKILL_BONUS = 5;
/** At most this many bonus points. */
export const CORE_SKILL_BONUS_MAX = 10;
