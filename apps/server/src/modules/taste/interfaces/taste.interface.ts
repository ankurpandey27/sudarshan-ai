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

export interface TasteModel {
  weights: Record<string, number>;
  bias: number;
}

export interface TastePrediction {
  /** Chance you would approve this job, 0-1. */
  p: number;
  /** Plain-language reasons, strongest first, e.g. "title: backend". */
  reasons: string[];
}

export interface TasteState {
  status: 'learning' | 'ready';
  decisions: number;
  wanted: number;
  unwanted: number;
  /** More decisions needed before the model is used; 0 when ready. */
  needed: number;
  /** Share of held-out decisions it predicted right; null with too little data. */
  accuracy: number | null;
  likes: string[];
  dislikes: string[];
  trainedAt: string | null;
}
