// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../../common/storage/storage.service';
import { ResumesService } from './resumes.service';

const PDF = readFileSync(join(__dirname, '..', '..', '..', 'test', 'fixtures', 'sample-resume.pdf'));

describe('extra resumes', () => {
  let dir: string;
  let storage: StorageService;
  let svc: ResumesService;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'sudarshan-resumes-'));
    storage = new StorageService(':memory:');
    svc = new ResumesService({ getOrThrow: () => join(dir, 'uploads') } as unknown as ConfigService, storage);
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const add = (label: string, forJobs?: string[], name = 'Ankur Frontend.pdf') =>
    svc.add({ buffer: PDF, originalname: name, size: PDF.length }, { label, forJobs });

  it('keeps each resume under its own name, and attaches it to jobs of its kind', async () => {
    const front = await add('Frontend', ['frontend', 'react']);
    expect(front).toMatchObject({ label: 'Frontend', name: 'Ankur Frontend.pdf', forJobs: ['frontend', 'react'] });
    const chosen = svc.forJob({ title: 'Senior React Developer', description: '' });
    expect(chosen?.label).toBe('Frontend');
    expect(existsSync(chosen!.path)).toBe(true);
    expect(svc.forJob({ title: 'Backend Engineer', description: 'Node.js' })).toBeNull();
  });

  it('uses the name as the kind of job when none is given', async () => {
    expect((await add('Data Engineer')).forJobs).toEqual(['data', 'engineer']);
  });

  it('refuses a file that is not a PDF, or no name', async () => {
    await expect(svc.add({ buffer: Buffer.from('hello'), originalname: 'cv.docx', size: 5 }, { label: 'X' })).rejects.toThrow(/PDF/);
    await expect(svc.add({ buffer: PDF, originalname: 'cv.pdf', size: PDF.length }, {})).rejects.toThrow(/name/);
  });

  it('changes what a resume is for, and deletes it with its file', async () => {
    const r = await add('Frontend');
    expect(svc.update(r.id, { forJobs: ['UI', 'Angular'] }).forJobs).toEqual(['ui', 'angular']);
    const path = svc.filePath(r.id);
    svc.remove(r.id);
    expect(existsSync(path)).toBe(false);
    expect(svc.list()).toEqual([]);
  });
});
