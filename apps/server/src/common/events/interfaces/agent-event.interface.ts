// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { AgentEventType } from '../enums/agent-event-type.enum';

export type AgentEventLevel = 'info' | 'success' | 'warn' | 'error';

export interface AgentEvent {
  id: number;
  at: string;
  type: AgentEventType;
  level: AgentEventLevel;
  message: string;
  jobId?: number;
  source?: string;
  data?: Record<string, unknown>;
}

export type AgentEventInput = Omit<AgentEvent, 'id' | 'at' | 'level'> & { level?: AgentEventLevel };
