// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { BACKUP_FILES_TABLE, BACKUP_TABLES, RESTORE_PENDING } from '../constants/backup.constants';
import { BackupCheck } from '../interfaces/backup-check.interface';

type Run = (sql: string, params: string[]) => unknown;

/**
 * One file holding everything needed to start again on any computer: the whole database (a consistent copy,
 * taken while the app runs) with your resume inside it. secret.key is never in it, so a saved AI key
 * cannot be read from a backup - after restoring, you enter the key again.
 */
export function writeBackup(run: Run, file: string, resumePath: string | null, extraResumes: { id: number; path: string }[] = []): void {
  rmSync(file, { force: true });
  run('VACUUM INTO ?', [file]);
  const db = new DatabaseSync(file);
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS ${BACKUP_FILES_TABLE} (name TEXT PRIMARY KEY, data BLOB NOT NULL)`);
    if (resumePath && existsSync(resumePath)) {
      db.prepare(`INSERT OR REPLACE INTO ${BACKUP_FILES_TABLE} (name, data) VALUES ('resume', ?)`).run(readFileSync(resumePath));
      db.prepare(`INSERT OR REPLACE INTO ${BACKUP_FILES_TABLE} (name, data) VALUES ('resume_name', ?)`).run(Buffer.from(basename(resumePath)));
    }
    // Your extra resumes (one per kind of role) travel with it.
    for (const r of extraResumes) {
      if (existsSync(r.path)) db.prepare(`INSERT OR REPLACE INTO ${BACKUP_FILES_TABLE} (name, data) VALUES (?, ?)`).run(`resumes:${r.id}`, readFileSync(r.path));
    }
  } finally {
    db.close();
  }
}

/** Whether a file is a Sudarshan backup this version can restore; throws, in plain words, when it is not. */
export function checkBackup(file: string, knownVersion: number): BackupCheck {
  let db: DatabaseSync;
  try {
    db = new DatabaseSync(file, { readOnly: true });
  } catch {
    throw new Error('This file is not a Sudarshan backup (it is not a database).');
  }
  try {
    const version = Number((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version);
    const tables = new Set((db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map((t) => t.name));
    if (!BACKUP_TABLES.every((t) => tables.has(t))) throw new Error('This file is not a Sudarshan backup.');
    if (version > knownVersion) throw new Error('This backup is from a newer Sudarshan. Update Sudarshan (git pull, then npm start) and restore it again.');
    const count = (t: string) => Number((db.prepare(`SELECT COUNT(*) n FROM ${t}`).get() as { n: number }).n);
    const resume = tables.has(BACKUP_FILES_TABLE) && !!db.prepare(`SELECT 1 FROM ${BACKUP_FILES_TABLE} WHERE name = 'resume'`).get();
    return { jobs: count('jobs'), answers: count('answers'), resume };
  } catch (err) {
    throw new Error((err as Error).message.startsWith('This') ? (err as Error).message : 'This file is not a Sudarshan backup.');
  } finally {
    db.close();
  }
}

/**
 * Applies a restore waiting in the data folder, before the database is opened: the current database is first
 * saved in backups (before-restore-...), then the backup takes its place and its resume goes back into uploads.
 * Returns true when a restore was applied.
 */
export function applyPendingRestore(paths: { dataDir: string; database: string; uploads: string; backups: string }): boolean {
  const pending = join(paths.dataDir, RESTORE_PENDING);
  if (!existsSync(pending)) return false;
  mkdirSync(paths.backups, { recursive: true });
  if (existsSync(paths.database)) {
    const current = new DatabaseSync(paths.database);
    try {
      current.prepare('VACUUM INTO ?').run(join(paths.backups, `before-restore-${new Date().toISOString().replace(/[:.]/g, '-')}.db`));
    } finally {
      current.close();
    }
    for (const f of [paths.database, `${paths.database}-wal`, `${paths.database}-shm`]) rmSync(f, { force: true });
  }
  renameSync(pending, paths.database);

  const db = new DatabaseSync(paths.database);
  try {
    const hasFiles = !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(BACKUP_FILES_TABLE);
    if (hasFiles) {
      const get = (name: string) => (db.prepare(`SELECT data FROM ${BACKUP_FILES_TABLE} WHERE name = ?`).get(name) as { data: Uint8Array } | undefined)?.data;
      const resume = get('resume');
      if (resume) {
        mkdirSync(paths.uploads, { recursive: true });
        const name = Buffer.from(get('resume_name') ?? Buffer.from('resume.pdf')).toString().replace(/[^\w.\- ]/g, '_') || 'resume.pdf';
        const target = join(paths.uploads, `restored-${Date.now()}-${name}`);
        writeFileSync(target, resume);
        db.prepare('UPDATE profile SET resume_path = ? WHERE id = 1').run(target);
      }
      const extras = db.prepare(`SELECT name, data FROM ${BACKUP_FILES_TABLE} WHERE name LIKE 'resumes:%'`).all() as { name: string; data: Uint8Array }[];
      for (const r of extras) {
        const id = Number(r.name.slice('resumes:'.length));
        const row = db.prepare('SELECT name FROM resumes WHERE id = ?').get(id) as { name: string } | undefined;
        if (!row) continue;
        const folder = join(paths.uploads, 'resumes', String(id));
        mkdirSync(folder, { recursive: true });
        const target = join(folder, row.name.replace(/[^\w.\- ]/g, '_') || 'resume.pdf');
        writeFileSync(target, r.data);
        db.prepare('UPDATE resumes SET path = ? WHERE id = ?').run(target, id);
      }
      db.exec(`DROP TABLE ${BACKUP_FILES_TABLE}`);
    }
  } finally {
    db.close();
  }
  return true;
}

/** Copies a backup into your own folder (OneDrive, Google Drive, a USB disk) under the same name. */
export function copyToFolder(file: string, folder: string): string {
  mkdirSync(folder, { recursive: true });
  const target = join(folder, basename(file));
  copyFileSync(file, target);
  return target;
}
