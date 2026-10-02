// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

export enum AgentEventType {
  LOG = 'log',
  AGENT_STATE = 'agent.state',
  JOB_UPDATED = 'job.updated',
  JOBS_DISCOVERED = 'jobs.discovered',
  QUESTION_PENDING = 'question.pending',
  APPLY_STEP = 'apply.step',
  BROWSER_STATE = 'browser.state',
  PROFILE_UPDATED = 'profile.updated',
  /** Something to tell you even when you are not watching: the daily summary, or applications that need you. */
  NOTIFY = 'notify',
}
