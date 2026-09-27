// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

export interface ActivityRow {
  id: number;
  at: string;
  type: string;
  level: string;
  message: string;
  job_id: number | null;
  source: string | null;
}
