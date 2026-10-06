// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Response } from 'express';

/**
 * Sends a file from the data folder. The data folder is a dot-folder (~/.sudarshan, ~/.job-apply-agent), and Express
 * refuses any path with a dot-folder in it unless told otherwise - every step picture and resume download failed for
 * real users while working in tests that used another folder (2026-10-06). Callers pass only paths they built
 * themselves inside the data folder.
 */
export function sendDataFile(res: Response, path: string, cacheSeconds?: number): void {
  if (cacheSeconds) res.setHeader('cache-control', `private, max-age=${cacheSeconds}`);
  res.sendFile(path, { dotfiles: 'allow' });
}
