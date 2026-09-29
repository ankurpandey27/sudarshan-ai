// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { EMBEDDING_MODEL, EMBEDDING_MODEL_FILE } from '../constants/embeddings.constants';
import { hasModel, pickModelDir } from './model-dir.util';

const place = (dir: string) => {
  const file = join(dir, EMBEDDING_MODEL, EMBEDDING_MODEL_FILE);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, 'model');
};

describe('where the model is read from', () => {
  let base: string;
  beforeEach(() => (base = mkdtempSync(join(tmpdir(), 'sudarshan-models-'))));
  afterEach(() => rmSync(base, { recursive: true, force: true }));

  it("uses the project's models folder, filled by npm install", () => {
    const project = join(base, 'project');
    place(project);
    expect(pickModelDir(project, join(base, 'data'))).toBe(project);
    expect(hasModel(project)).toBe(true);
  });

  it('uses the data folder when only it has the model', () => {
    const data = join(base, 'data');
    place(data);
    expect(pickModelDir(join(base, 'project'), data)).toBe(data);
  });

  it('downloads into the project folder when neither has it', () => {
    const project = join(base, 'project');
    expect(pickModelDir(project, join(base, 'data'))).toBe(project);
    expect(hasModel(project)).toBe(false);
  });

  it('names the same model as the npm install script', () => {
    const script = readFileSync(join(__dirname, '..', '..', '..', '..', '..', '..', 'scripts', 'fetch-model.mjs'), 'utf8');
    expect(script).toContain(`export const MODEL = '${EMBEDDING_MODEL}';`);
    expect(script).toContain(`export const MODEL_FILE = '${EMBEDDING_MODEL_FILE}';`);
  });
});
