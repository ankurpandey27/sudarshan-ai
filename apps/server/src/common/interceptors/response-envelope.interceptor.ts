// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable, map } from 'rxjs';
import type { Request, Response } from 'express';
import type { ApiEnvelope } from '../interfaces/api-envelope.interface';

// Returned raw: health probe, SSE stream and file downloads.
const SKIP_WRAP_PREFIXES = ['/health', '/events/stream', '/profile/resume/file', '/workbook/template/file', '/workbook/export/file'];

const DEFAULT_MESSAGES: Record<number, string> = {
  [HttpStatus.OK]: 'OK',
  [HttpStatus.CREATED]: 'Created',
  [HttpStatus.ACCEPTED]: 'Accepted',
  [HttpStatus.NO_CONTENT]: 'No Content',
  [HttpStatus.MOVED_PERMANENTLY]: 'Moved Permanently',
  [HttpStatus.BAD_REQUEST]: 'Bad Request',
  [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
  [HttpStatus.FORBIDDEN]: 'Forbidden',
  [HttpStatus.NOT_FOUND]: 'Not Found',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Too Many Requests',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'Service Unavailable',
};

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  private readonly apiPrefix: string;

  constructor(config: ConfigService) {
    this.apiPrefix = config.get<string>('server.apiPrefix', 'api');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const rawPath = request.originalUrl ?? request.url ?? '';
    if (
      SKIP_WRAP_PREFIXES.some((p) => this.stripPrefix(rawPath).startsWith(p))
    ) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data) => {
        const status = response.statusCode || HttpStatus.OK;
        const requestId = (request.headers['x-request-id'] as string) ?? '';

        const envelope: ApiEnvelope = {
          timestamp: new Date().toISOString(),
          path: rawPath,
          requestId,
          success: status < 400,
          message: this.messageFor(status),
          messageCode: status,
          data: status < 400 ? (data ?? null) : null,
          error:
            status >= 400
              ? {
                  code: DEFAULT_MESSAGES[status] ?? `HTTP_${status}`,
                  message: this.messageFor(status),
                }
              : null,
        };
        return envelope;
      }),
    );
  }

  private stripPrefix(path: string): string {
    let prefix = this.apiPrefix;
    if (prefix && !prefix.startsWith('/')) {
      prefix = `/${prefix}`;
    }
    if (prefix && path.startsWith(prefix)) {
      return path.slice(prefix.length) || '/';
    }
    return path;
  }

  private messageFor(status: number): string {
    return DEFAULT_MESSAGES[status] ?? 'Unknown';
  }
}