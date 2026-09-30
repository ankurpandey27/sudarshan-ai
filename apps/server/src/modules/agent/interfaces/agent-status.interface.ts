// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { ScoringProgress } from '../../scoring/interfaces/scoring-progress.interface';
import { LastScoringRun } from '../../scoring/interfaces/llm-score.interface';
import { AgentPhase } from '../enums/agent-phase.enum';
import { PlatformHealth } from '../../platform-health/interfaces/platform-health.interface';
import { EmbeddingStatus } from '../../../common/embeddings/interfaces/embedding-status.interface';
import { RescueStatus } from '../../form-engine/interfaces/rescue-status.interface';

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
  /** The scoring run that just finished, for a few seconds. */
  lastScoring: LastScoringRun | null;
  /** Platforms that are paused (pages seem to have changed) or in careful mode; healthy ones are left out. */
  platformHealth: PlatformHealth[];
  /** The local meaning model that finds your answers to similar questions. */
  meaningModel: EmbeddingStatus;
  /** How the rescue agent does with the AI model in use. */
  rescue: RescueStatus;
}
