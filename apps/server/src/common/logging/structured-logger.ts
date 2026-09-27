// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import {
  LoggerService,
  Injectable,
  Logger,
} from '@nestjs/common';
import { createLogger, Logger as WinstonLogger, format, transports } from 'winston';
import { TraceContext } from './trace-context';

import { LogContext, MetricsPayload, LogRecord } from './interfaces/log-record.interface';
import { DailyJsonTransport } from './transports/daily-json.transport';

@Injectable()
export class StructuredLogger implements LoggerService {
  private readonly logger: WinstonLogger;

  constructor(level: string, logDir: string) {
    this.logger = createLogger({
      level,
      format: format.combine(
        format.timestamp(),
        format.errors({ stack: true }),
        format.json(),
      ),
      transports: [
        // Plain console output; structured JSON goes to the log files.
        new transports.Console({
          format: format.printf((info) => {
            const r = info as unknown as LogRecord;
            const time = r.timestamp?.slice(11, 19) ?? '';
            const source = (r.context as { source?: string } | undefined)?.source;
            return `${time} ${String(r.level).toUpperCase().padEnd(5)} ${source ? '[' + source + '] ' : ''}${r.message}`;
          }),
        }),
        new DailyJsonTransport(logDir),
      ],
    });
  }

  // Nest passes the class name as the last param; keep it as `source` so `context` is always an object.
  private split(params: unknown[]): { source?: string; ctx?: LogContext; text?: string } {
    const rest = [...params];
    let source: string | undefined;
    if (rest.length > 0 && typeof rest[rest.length - 1] === 'string') {
      source = rest.pop() as string;
    }
    const first = rest[0];
    if (first && typeof first === 'object') return { source, ctx: first as LogContext };
    if (typeof first === 'string') return { source, text: first };
    return { source };
  }

  private base(level: string, message: unknown, params: unknown[]): void {
    const { source, ctx: raw, text } = this.split(params);
    const { metrics, error, ...ctx } = (raw ?? {}) as LogContext & { metrics?: MetricsPayload; error?: unknown };
    const record: LogRecord = {
      timestamp: new Date().toISOString(),
      level,
      message: typeof message === 'string' ? message : this.toMessage(message),
      context: { ...(source ? { source } : {}), ...ctx },
      tracing: {
        traceId: TraceContext.requestId(),
        requestId: TraceContext.requestId(),
      },
      metrics: metrics ?? null,
      // error(msg, stack) convention: a bare string after the message is a stack.
      error: error ?? (level === 'error' && text ? { message: String(message), stack: text } : null),
    };
    this.logger.log(record);
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.base('info', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.base('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.base('warn', message, optionalParams);
  }

  debug?(message: unknown, ...optionalParams: unknown[]): void {
    this.base('debug', message, optionalParams);
  }

  verbose?(message: unknown, ...optionalParams: unknown[]): void {
    this.base('verbose', message, optionalParams);
  }

  fatal?(message: unknown, ...optionalParams: unknown[]): void {
    this.base('error', message, optionalParams);
  }

  private toMessage(value: unknown): string {
    if (value instanceof Error) {
      return value.message;
    }
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }
    return String(value);
  }
}

export const createStructuredLogger = (level: string, logDir: string) =>
  new StructuredLogger(level, logDir);

export { Logger };