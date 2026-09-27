// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Controller, Get, MessageEvent, Query, Sse } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { EventsService } from './events.service';
import { AgentEvent } from './interfaces/agent-event.interface';
import { ActivityPage } from './interfaces/activity-page.interface';
import { ActivityQueryDto } from './dto/activity-query.dto';

@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Sse('stream')
  stream(): Observable<MessageEvent> {
    return this.events.stream().pipe(map((e) => ({ id: String(e.id), data: e })));
  }

  @Get('recent')
  recent(@Query('limit') limit?: string): AgentEvent[] {
    return this.events.recent(Math.min(Number(limit) || 200, 500));
  }

  /** The saved flight log (last 7 days), filterable. */
  @Get('history')
  history(@Query() q: ActivityQueryDto): ActivityPage {
    return this.events.activity(q);
  }
}
