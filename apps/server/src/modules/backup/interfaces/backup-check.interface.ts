// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

/** What a backup file holds, read before it is restored. */
export interface BackupCheck {
  jobs: number;
  answers: number;
  resume: boolean;
}
