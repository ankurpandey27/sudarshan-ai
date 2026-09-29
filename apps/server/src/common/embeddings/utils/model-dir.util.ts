// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { accessSync, constants, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { EMBEDDING_MODEL, EMBEDDING_MODEL_FILE } from '../constants/embeddings.constants';

/** The model is complete in this folder. */
export const hasModel = (dir: string): boolean => existsSync(join(dir, EMBEDDING_MODEL, EMBEDDING_MODEL_FILE));

/**
 * Where the model is read from, or downloaded to: the project's models folder (filled by npm install),
 * else the data folder when the model is only there, or when the project folder cannot be written to
 * (installed read-only, or by another user).
 */
export function pickModelDir(project: string, fallback: string): string {
  if (hasModel(project)) return project;
  if (hasModel(fallback)) return fallback;
  try {
    mkdirSync(project, { recursive: true });
    accessSync(project, constants.W_OK);
    return project;
  } catch {
    mkdirSync(fallback, { recursive: true });
    return fallback;
  }
}
