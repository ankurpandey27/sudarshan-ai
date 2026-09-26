import { Controller, Get, MessageEvent, Query, Sse } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { EventsService } from './events.service';
import { AgentEvent } from './interfaces/agent-event.interface';

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
}
