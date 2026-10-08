// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import { TelegramTokenDto } from './dto/telegram-token.dto';
import { DaySummary, TelegramStatus } from './interfaces/notification.interface';
import { NotificationsService } from './notifications.service';
import { TelegramService } from './telegram.service';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly telegram: TelegramService,
  ) {}

  /** Today so far, as the daily summary would say it. */
  @Get('summary')
  summary(): DaySummary {
    return this.notifications.summary();
  }

  /** Sends today's summary now, to the app and to Telegram. */
  @Post('summary/send')
  async sendSummary(): Promise<{ sent: boolean }> {
    return { sent: await this.notifications.summaryIfDue(new Date(), true) };
  }

  @Post('test')
  test(): Promise<{ telegram: boolean }> {
    return this.notifications.notify('test', 'Sudarshan AI test notification', 'Notifications work. You will get the daily summary and a message when an application needs you.');
  }

  @Get('telegram')
  telegramStatus(): TelegramStatus {
    return this.telegram.status();
  }

  @Post('telegram/token')
  saveToken(@Body() dto: TelegramTokenDto): Promise<TelegramStatus> {
    return this.telegram.saveToken(dto.token);
  }

  @Post('telegram/connect')
  connect(): Promise<TelegramStatus> {
    return this.telegram.connect();
  }

  @Delete('telegram')
  disconnect(): TelegramStatus {
    return this.telegram.disconnect();
  }
}
