// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../../common/storage/storage.service';
import { MIGRATIONS } from '../../common/storage/constants/migrations.constants';
import { ProfileService } from '../profile/profile.service';
import { SettingsService } from '../settings/settings.service';
import { BackupService } from './backup.service';
import { ResumesService } from '../resumes/resumes.service';
import { RESTORE_PENDING } from './constants/backup.constants';
import { applyPendingRestore, checkBackup } from './utils/backup-file.util';

describe('backing up your data', () => {
  let dir: string;
  beforeEach(() => (dir = mkdtempSync(join(tmpdir(), 'sudarshan-backup-'))));
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const setup = (folder = '') => {
    const paths = { dataDir: dir, database: join(dir, 'agent.db'), uploads: join(dir, 'uploads'), backups: join(dir, 'backups') };
    const storage = new StorageService(paths.database);
    storage.run("INSERT INTO answers (key, question, answer, source, created_at, updated_at) VALUES ('k', 'Notice period', '30 days', 'user', 'x', 'x')");
    mkdirSync(paths.uploads, { recursive: true });
    const resume = join(paths.uploads, 'my-resume.pdf');
    writeFileSync(resume, '%PDF-1.4 my resume');
    storage.run("INSERT INTO profile (id, data, resume_path, updated_at) VALUES (1, '{}', ?, 'x')", [resume]);
    const config = { getOrThrow: (k: string) => (k === 'paths.backups' ? paths.backups : k === 'paths.dataDir' ? dir : paths) } as unknown as ConfigService;
    const profile = { resumePath: () => resume } as unknown as ProfileService;
    const settings = { get: () => ({ agent: { backupFolder: folder } }) } as unknown as SettingsService;
    return { paths, storage, svc: new BackupService(config, storage, profile, settings) };
  };

  it('copies the whole database once a day, readable on its own, and keeps the last 7', () => {
    const { storage, svc } = setup();
    const file = svc.backUp('2026-10-01');
    expect(file).toBeTruthy();
    // Once a day: a second run that day does nothing.
    expect(svc.backUp('2026-10-01')).toBeNull();
    const copy = new DatabaseSync(file!, { readOnly: true });
    expect(copy.prepare('SELECT answer FROM answers').get()).toEqual(expect.objectContaining({ answer: '30 days' }));
    copy.close();

    for (let d = 2; d <= 10; d++) svc.backUp(`2026-10-${String(d).padStart(2, '0')}`);
    expect(readdirSync(join(dir, 'backups')).sort()).toEqual(['04', '05', '06', '07', '08', '09', '10'].map((d) => `agent-2026-10-${d}.db`));
    storage.onApplicationShutdown();
  });

  it('also keeps the last 7 in your own folder (OneDrive, a USB disk), leaving your other files alone', () => {
    const folder = join(dir, 'OneDrive', 'Sudarshan AI');
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, 'notes.txt'), 'mine');
    const { storage, svc } = setup(folder);
    for (let d = 1; d <= 9; d++) svc.backUp(`2026-10-0${d}`);
    expect(readdirSync(folder).sort()).toEqual([...['03', '04', '05', '06', '07', '08', '09'].map((d) => `agent-2026-10-${d}.db`), 'notes.txt']);
    expect(svc.status()).toMatchObject({ folder, folderError: null, count: 7 });
    storage.onApplicationShutdown();
  });

  it('says why a copy to your folder failed, and still backs up locally', () => {
    const { storage, svc } = setup('relative/folder');
    expect(svc.backUp('2026-10-01')).toBeTruthy();
    expect(svc.status().folderError).toMatch(/full path/);
    storage.onApplicationShutdown();
  });

  it('restores a backup on any computer: data and resume, keeping the data it replaced', () => {
    const { storage, svc, paths } = setup();
    const file = svc.exportFile();
    expect(checkBackup(file, MIGRATIONS.length)).toEqual({ jobs: 0, answers: 1, resume: true });

    // A new computer: empty data folder.
    storage.run("UPDATE answers SET answer = 'changed later'");
    storage.onApplicationShutdown();
    const other = mkdtempSync(join(tmpdir(), 'sudarshan-restore-'));
    try {
      const to = { dataDir: other, database: join(other, 'agent.db'), uploads: join(other, 'uploads'), backups: join(other, 'backups') };
      new StorageService(to.database).onApplicationShutdown();
      writeFileSync(join(other, RESTORE_PENDING), readFileSync(file));
      expect(applyPendingRestore(to)).toBe(true);
      expect(existsSync(join(other, RESTORE_PENDING))).toBe(false);
      expect(readdirSync(to.backups).some((f) => f.startsWith('before-restore-'))).toBe(true);

      const restored = new StorageService(to.database);
      expect(restored.get<{ answer: string }>('SELECT answer FROM answers')?.answer).toBe('30 days');
      const resume = restored.get<{ resume_path: string }>('SELECT resume_path FROM profile WHERE id = 1')!.resume_path;
      expect(resume.startsWith(to.uploads)).toBe(true);
      expect(readFileSync(resume, 'utf8')).toBe('%PDF-1.4 my resume');
      expect(restored.get("SELECT 1 FROM sqlite_master WHERE name = 'backup_files'")).toBeUndefined();
      restored.onApplicationShutdown();
      expect(applyPendingRestore(to)).toBe(false);
    } finally {
      rmSync(other, { recursive: true, force: true });
    }
    void paths;
  });

  it('carries your extra resumes too', () => {
    const { storage, paths } = setup();
    const extra = join(paths.uploads, 'resumes', '1', 'frontend.pdf');
    mkdirSync(join(paths.uploads, 'resumes', '1'), { recursive: true });
    writeFileSync(extra, '%PDF-1.4 frontend');
    storage.run("INSERT INTO resumes (id, label, path, name, created_at) VALUES (1, 'Frontend', ?, 'frontend.pdf', 'x')", [extra]);
    const config = { getOrThrow: (k: string) => (k === 'paths.backups' ? paths.backups : dir) } as unknown as ConfigService;
    const resumes = { files: () => [{ id: 1, path: extra }] } as unknown as ResumesService;
    const file = new BackupService(config, storage, { resumePath: () => null } as unknown as ProfileService, undefined, resumes).exportFile();
    storage.onApplicationShutdown();

    const other = mkdtempSync(join(tmpdir(), 'sudarshan-restore-'));
    try {
      const to = { dataDir: other, database: join(other, 'agent.db'), uploads: join(other, 'uploads'), backups: join(other, 'backups') };
      writeFileSync(join(other, RESTORE_PENDING), readFileSync(file));
      applyPendingRestore(to);
      const restored = new StorageService(to.database);
      const path = restored.get<{ path: string }>('SELECT path FROM resumes WHERE id = 1')!.path;
      expect(path).toBe(join(to.uploads, 'resumes', '1', 'frontend.pdf'));
      expect(readFileSync(path, 'utf8')).toBe('%PDF-1.4 frontend');
      restored.onApplicationShutdown();
    } finally {
      rmSync(other, { recursive: true, force: true });
    }
  });

  it('refuses a file that is not a backup, or one from a newer Sudarshan AI', () => {
    const { storage, svc } = setup();
    const junk = join(dir, 'junk.db');
    writeFileSync(junk, 'not a database at all');
    expect(() => checkBackup(junk, MIGRATIONS.length)).toThrow(/not a Sudarshan AI backup/);
    const file = svc.exportFile();
    expect(() => checkBackup(file, 3)).toThrow(/newer Sudarshan AI/);
    storage.onApplicationShutdown();
  });
});
