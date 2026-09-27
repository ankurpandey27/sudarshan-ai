// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { TraceContext } from '../logging/trace-context';

export function requestContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const headerId = req.headers['x-request-id'] as string | undefined;
  const requestId = headerId && headerId.trim() !== '' ? headerId : randomUUID();
  req.headers['x-request-id'] = requestId;
  res.setHeader('x-request-id', requestId);
  TraceContext.run({ requestId, path: req.originalUrl ?? req.url }, () =>
    next(),
  );
}