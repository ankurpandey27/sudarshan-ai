export const SCORE_WEIGHTS = { technical: 0.5, salary: 0.25, location: 0.25 } as const;

/** Share of the final score given to the AI's verdict. */
export const LLM_SCORE_WEIGHT = 0.6;

export const LLM_SCORE_BATCH = 8;

export const LLM_DESCRIPTION_CHARS = 900;

/** Without AI scoring: penalty when the title shares no word with the search or current title. */
export const TITLE_MISMATCH_PENALTY = 15;
