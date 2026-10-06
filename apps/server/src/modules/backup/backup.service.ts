// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { BadRequestException, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../../common/storage/storage.service';
import { MIGRATIONS } from '../../common/storage/constants/migrations.constants';
import { localDay } from '../../common/utils/date.util';
import { requestRestart } from '../../common/utils/restart.util';
import { ProfileService } from '../profile/profile.service';
import { SettingsService } from '../settings/settings.service';
import { ResumesService } from '../resumes/resumes.service';
import { DAILY_BACKUP, KEEP_BACKUPS, RESTORE_PENDING } from './constants/backup.constants';
import { BackupCheck } from './interfaces/backup-check.interface';
import { BackupStatus } from './interfaces/backup-status.interface';
import { checkBackup, copyToFolder, writeBackup } from './utils/backup-file.util';

/**
 * Your data, safe from one bad disk: a full backup once a day in the data folder (the last 7 kept), copied to
 * a folder you choose - OneDrive, Google Drive, a USB disk - so it survives losing this computer too. A backup
 * can be downloaded any time and restored on any computer.
 */
@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private folderError: string | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly storage: StorageService,
    private readonly profile: ProfileService,
    // Optional so the daily backup works in tests without settings.
    @Optional() private readonly settings?: SettingsService,
    @Optional() private readonly resumes?: ResumesService,
  ) {}

  private write(file: string): void {
    writeBackup((sql, params) => this.storage.run(sql, params), file, this.profile.resumePath(), this.resumes?.files() ?? []);
  }

  private get dir(): string {
    const dir = this.config.getOrThrow<string>('paths.backups');
    mkdirSync(dir, { recursive: true });
    return dir;
  }

  private folder(): string {
    return this.settings?.get().agent.backupFolder?.trim() ?? '';
  }

  /** Today's backup (once a day unless `force`), copied to your folder. Returns the new file, or null if there already was one. */
  backUp(today = localDay(), force = false): string | null {
    const file = join(this.dir, `agent-${today}.db`);
    const fresh = force || !existsSync(file);
    if (fresh) {
      this.write(file);
      prune(this.dir);
      this.logger.log(`Backed up your data to ${file}`);
    }
    this.copyOut(file, fresh);
    return fresh ? file : null;
  }

  status(): BackupStatus {
    const files = existsSync(this.dir) ? readdirSync(this.dir).filter((f) => DAILY_BACKUP.test(f)).sort() : [];
    const newest = files.at(-1);
    return {
      last: newest ? { file: join(this.dir, newest), at: statSync(join(this.dir, newest)).mtime.toISOString() } : null,
      count: files.length,
      dir: this.dir,
      folder: this.folder(),
      folderError: this.folderError,
    };
  }

  /** A backup made now, for downloading; the caller deletes it once sent. */
  exportFile(): string {
    const file = join(this.dir, `export-${Date.now()}.db`);
    this.write(file);
    return file;
  }

  /**
   * Checks an uploaded backup and sets it to be restored; Sudarshan then restarts by itself to apply it
   * (your current data is kept in backups first, as before-restore-...).
   */
  stageRestore(data: Buffer): BackupCheck {
    const dataDir = this.config.getOrThrow<string>('paths.dataDir');
    const upload = join(dataDir, 'restore-upload.db');
    writeFileSync(upload, data);
    let check: BackupCheck;
    try {
      check = checkBackup(upload, MIGRATIONS.length);
    } catch (err) {
      rmSync(upload, { force: true });
      throw new BadRequestException((err as Error).message);
    }
    renameSync(upload, join(dataDir, RESTORE_PENDING));
    this.logger.warn(`Restoring a backup (${check.jobs} jobs, ${check.answers} answers) - restarting to apply it`);
    setTimeout(requestRestart, 800).unref();
    return check;
  }

  /** Copies the backup to your folder (when set): every new backup, or once if the folder is missing it. */
  private copyOut(file: string, fresh: boolean): void {
    const folder = this.folder();
    if (!folder) {
      this.folderError = null;
      return;
    }
    try {
      if (!isAbsolute(folder)) throw new Error('the backup folder must be a full path, like C:\\Users\\you\\OneDrive\\Sudarshan');
      if (!fresh && existsSync(join(folder, file.split(/[\\/]/).pop()!))) return;
      copyToFolder(file, folder);
      prune(folder);
      this.folderError = null;
    } catch (err) {
      this.folderError = (err as Error).message;
      this.logger.warn(`Could not copy the backup to ${folder}: ${this.folderError}`);
    }
  }
}

/** Keeps the newest daily backups in a folder; other files there are never touched. */
function prune(dir: string): void {
  const old = readdirSync(dir)
    .filter((f) => DAILY_BACKUP.test(f))
    .sort()
    .slice(0, -KEEP_BACKUPS);
  for (const file of old) rmSync(join(dir, file), { force: true });
}
