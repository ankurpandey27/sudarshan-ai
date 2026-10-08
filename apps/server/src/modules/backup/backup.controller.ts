// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { rmSync } from 'node:fs';
import { BadRequestException, Controller, Get, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { localDay } from '../../common/utils/date.util';
import { BackupService } from './backup.service';
import { BACKUP_MAX_BYTES } from './constants/backup.constants';
import { BackupCheck } from './interfaces/backup-check.interface';
import { BackupStatus } from './interfaces/backup-status.interface';

@Controller('backup')
export class BackupController {
  constructor(private readonly backup: BackupService) {}

  @Get()
  status(): BackupStatus {
    return this.backup.status();
  }

  /** Backs up now (replacing today's backup) and copies it to your folder. */
  @Post('now')
  now(): BackupStatus {
    this.backup.backUp(localDay(), true);
    return this.backup.status();
  }

  @Get('export/file')
  export(@Res() res: Response): void {
    const file = this.backup.exportFile();
    res.download(file, `sudarshan-backup-${localDay()}.db`, () => rmSync(file, { force: true }));
  }

  /** Restores an uploaded backup; Sudarshan AI restarts by itself to apply it. */
  @Post('restore')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: BACKUP_MAX_BYTES } }))
  restore(@UploadedFile() file?: Express.Multer.File): BackupCheck {
    if (!file) throw new BadRequestException('Attach the backup file as "file"');
    return this.backup.stageRestore(file.buffer);
  }
}
