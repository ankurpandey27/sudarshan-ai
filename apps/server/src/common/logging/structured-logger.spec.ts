// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import * as os from 'os';
import * as path from 'path';
import { Logger } from '@nestjs/common';
import { StructuredLogger } from './structured-logger';

describe('StructuredLogger (Nest context handling)', () => {
  const records: Record<string, unknown>[] = [];
  let structured: StructuredLogger;

  beforeAll(() => {
    structured = new StructuredLogger('debug', path.join(os.tmpdir(), 'jaa-logger-test'));
    const winston = (structured as unknown as { logger: { log: (r: Record<string, unknown>) => void } }).logger;
    winston.log = (r) => void records.push(r);
    Logger.overrideLogger(structured);
  });
  afterAll(() => Logger.overrideLogger(false));
  beforeEach(() => (records.length = 0));

  const log = new Logger('QueueService');

  it('context is ALWAYS an object carrying the Nest class name as source', () => {
    log.log('plain');
    log.warn('with ctx', { jobId: 'j1', platform: 'linkedin' });
    expect(records[0].context).toEqual({ source: 'QueueService' });
    expect(records[1].context).toEqual({ source: 'QueueService', jobId: 'j1', platform: 'linkedin' });
  });

  it('lifts metrics/error out of the context', () => {
    log.log('scored', { jobId: 'j2', metrics: { overallScore: 90 } });
    expect(records[0]).toMatchObject({ context: { source: 'QueueService', jobId: 'j2' }, metrics: { overallScore: 90 } });
  });

  it('error(msg, stack) keeps the stack and does not mistake the class name for one', () => {
    log.error('boom');
    log.error('boom2', 'Error: boom2\n    at x.ts:1');
    expect(records[0].error).toBeNull();
    expect(records[1].error).toEqual({ message: 'boom2', stack: 'Error: boom2\n    at x.ts:1' });
    expect(records[1].context).toEqual({ source: 'QueueService' });
  });
});
