// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

export interface TasteFeaturesInput {
  title: string;
  platform: string;
  isRemote: boolean;
  easyApply: boolean;
  score: number | null;
  detail: {
    technical?: number;
    salary?: number;
    location?: number;
    engine?: number;
    llm?: number | null;
    matchedSkills?: string[];
    missingSkills?: string[];
  } | null;
}

/** What the jobs you kept have in common, and what you turn down. Keys look like "skill: node.js". */
export interface InterestProfile {
  /** Jobs you applied to or approved. */
  kept: number;
  /** 0-1: how common each skill, title word or platform is in them (1 = as common as your top ones). */
  affinity: Record<string, number>;
  /** How often you turned it down, for what you turn down at least half the time. */
  avoided: Record<string, number>;
}

export interface TastePrediction {
  /** Your interest in this job, 0-1: how much it looks like the jobs you apply to. */
  p: number;
  /** Plain-language reasons, strongest first, e.g. "+ skill: node.js", "- title: manager". */
  reasons: string[];
}

export interface TasteState {
  status: 'learning' | 'ready';
  decisions: number;
  wanted: number;
  unwanted: number;
  /** More jobs to apply to or approve before your interest is shown; 0 when ready. */
  needed: number;
  /** Share of held-out decisions it predicted right; null with too little data. */
  accuracy: number | null;
  likes: string[];
  dislikes: string[];
  trainedAt: string | null;
}
