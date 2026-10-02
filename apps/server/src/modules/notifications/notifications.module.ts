// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { TelegramService } from './telegram.service';

@Module({
  imports: [SettingsModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, TelegramService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
