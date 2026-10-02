// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

export interface BackupStatus {
  /** The newest daily backup in the data folder, if any. */
  last: { file: string; at: string } | null;
  /** Daily backups kept in the data folder. */
  count: number;
  /** Where backups are kept in the data folder. */
  dir: string;
  /** Your own backup folder ('' when not set). */
  folder: string;
  /** Why the last copy to your folder failed, if it did. */
  folderError: string | null;
}
