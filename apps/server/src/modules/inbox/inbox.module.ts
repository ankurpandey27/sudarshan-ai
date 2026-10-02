// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { InboxController } from './inbox.controller';
import { InboxService } from './inbox.service';

@Module({
  imports: [NotificationsModule],
  controllers: [InboxController],
  providers: [InboxService],
  exports: [InboxService],
})
export class InboxModule {}
