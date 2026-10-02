// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

/** Daily backups kept, in the data folder and in your own backup folder. */
export const KEEP_BACKUPS = 7;

/** A daily backup's file name: agent-2026-10-02.db. */
export const DAILY_BACKUP = /^agent-\d{4}-\d{2}-\d{2}\.db$/;

/** A backup you uploaded to restore, applied at the next start, before the database opens. */
export const RESTORE_PENDING = 'restore-pending.db';

/** The largest backup file accepted for restoring. */
export const BACKUP_MAX_BYTES = 300 * 1024 * 1024;

/** Tables every Sudarshan database has - a file without them is not a backup. */
export const BACKUP_TABLES = ['settings', 'profile', 'jobs', 'answers'];

/** The table inside a backup that carries your resume file. */
export const BACKUP_FILES_TABLE = 'backup_files';
