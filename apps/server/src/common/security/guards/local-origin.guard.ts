// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { CLIENT_HEADER, LOCAL_HOSTS } from '../constants/security.constants';

/**
 * Only the local UI may drive the agent: the Host must be loopback (blocks DNS
 * rebinding) and writes need a custom header, which browsers cannot send
 * cross-origin without a CORS preflight - and no cross-origin request is allowed.
 */
@Injectable()
export class LocalOriginGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;
    const req = context.switchToHttp().getRequest<Request>();
    const host = (req.headers.host ?? '').replace(/:\d+$/, '').replace(/^\[|\]$/g, '').toLowerCase();
    if (!LOCAL_HOSTS.includes(host)) throw new ForbiddenException('Local access only');
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.headers[CLIENT_HEADER] !== '1') {
      throw new ForbiddenException('Missing client header');
    }
    return true;
  }
}
