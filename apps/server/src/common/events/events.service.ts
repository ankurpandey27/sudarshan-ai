import { Injectable, Logger } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { AgentEvent, AgentEventInput } from './interfaces/agent-event.interface';

const HISTORY = 500;

/** In-process event bus behind the SSE stream; keeps a short history for newly opened tabs. */
@Injectable()
export class EventsService {
  private readonly logger = new Logger('Agent');
  private readonly subject = new Subject<AgentEvent>();
  private readonly history: AgentEvent[] = [];
  private seq = 0;

  emit(input: AgentEventInput): AgentEvent {
    const event: AgentEvent = { ...input, level: input.level ?? 'info', id: ++this.seq, at: new Date().toISOString() };
    this.history.push(event);
    if (this.history.length > HISTORY) this.history.shift();
    this.subject.next(event);
    if (event.type === 'log') {
      const line = event.source ? `[${event.source}] ${event.message}` : event.message;
      if (event.level === 'error') this.logger.error(line);
      else if (event.level === 'warn') this.logger.warn(line);
      else this.logger.log(line);
    }
    return event;
  }

  stream(): Observable<AgentEvent> {
    return this.subject.asObservable();
  }

  recent(limit = 200): AgentEvent[] {
    return this.history.slice(-limit);
  }
}
