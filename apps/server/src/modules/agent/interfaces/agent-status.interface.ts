// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { ScoringProgress } from '../../scoring/interfaces/scoring-progress.interface';
import { AgentPhase } from '../enums/agent-phase.enum';

export interface AgentStatus {
  running: boolean;
  phase: AgentPhase;
  currentJob: { id: number; title: string; company: string } | null;
  nextDiscoveryAt: string | null;
  nextApplyAt: string | null;
  lastDiscoveryAt: string | null;
  blockedSources: { source: string; reason: string }[];
  queue: number;
  awaitingReview: number;
  openQuestions: number;
  llm: string | null;
  appliedToday: number;
  /** Set while jobs are being scored. */
  scoring: ScoringProgress | null;
}
