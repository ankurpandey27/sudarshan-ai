// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';
import { applyPendingRestore } from '../../modules/backup/utils/backup-file.util';

@Global()
@Module({
  providers: [
    {
      provide: StorageService,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const paths = config.getOrThrow<{ dataDir: string; database: string; uploads: string; backups: string }>('paths');
        // A backup you chose to restore takes the database's place before it opens.
        if (applyPendingRestore(paths)) new Logger('StorageService').warn('Restored your backup (your previous data is kept in backups as before-restore-...)');
        return new StorageService(paths.database);
      },
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}
