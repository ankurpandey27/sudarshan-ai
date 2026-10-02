// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import { ConnectInboxDto } from './dto/connect-inbox.dto';
import { InboxStatus, JobReply } from './interfaces/inbox.interface';
import { InboxService } from './inbox.service';

@Controller('inbox')
export class InboxController {
  constructor(private readonly inbox: InboxService) {}

  @Get()
  status(): InboxStatus {
    return this.inbox.status();
  }

  /** Employers' replies matched to your applications, newest first. */
  @Get('replies')
  replies(): JobReply[] {
    return this.inbox.replies();
  }

  @Post('connect')
  connect(@Body() dto: ConnectInboxDto): Promise<InboxStatus> {
    return this.inbox.connect(dto);
  }

  @Post('check')
  async check(): Promise<InboxStatus & { added: number }> {
    const added = await this.inbox.check();
    return { ...this.inbox.status(), added };
  }

  @Delete()
  disconnect(): InboxStatus {
    return this.inbox.disconnect();
  }
}
