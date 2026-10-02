// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { AgentEventType } from '../enums/agent-event-type.enum';

/** Events kept in memory for tabs that open later. */
export const EVENT_HISTORY = 500;
/** The flight log is kept on disk for this many days. */
export const ACTIVITY_KEEP_DAYS = 7;
/** Safety cap in case something floods the log. */
export const ACTIVITY_MAX_ROWS = 50_000;
/** How often old lines are cleared out. */
export const ACTIVITY_PRUNE_EVERY_MS = 60 * 60_000;
/** Event types that appear in the flight log, and so are saved. */
export const LOGGED_EVENT_TYPES: readonly AgentEventType[] = [AgentEventType.LOG, AgentEventType.APPLY_STEP, AgentEventType.QUESTION_PENDING, AgentEventType.NOTIFY];
