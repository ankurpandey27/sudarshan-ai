// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../../common/storage/storage.service';
import { extractSkills } from '../discovery/utils/job-normalizer.util';
import { RESUME_MAX_BYTES } from '../profile/constants/profile.constants';
import { pdfToText } from '../profile/utils/pdf-text.util';
import { MAX_RESUMES, RESUMES_DIR } from './constants/resumes.constants';
import { ResumeMetaDto } from './dto/resume-meta.dto';
import { ChosenResume, Resume, ResumeRow } from './interfaces/resume.interface';
import { pickResume } from './utils/pick-resume.util';

/**
 * Extra resumes, one per kind of role (Frontend, Data...). Each application attaches the one made for that job,
 * by the words of the job's title and description; your main resume (on the Profile) when none fits.
 * Sudarshan only chooses the file - it never changes what a resume says.
 */
@Injectable()
export class ResumesService {
  private readonly dir: string;

  constructor(
    config: ConfigService,
    private readonly storage: StorageService,
  ) {
    this.dir = join(config.getOrThrow<string>('paths.uploads'), RESUMES_DIR);
  }

  list(): Resume[] {
    return this.storage.all<ResumeRow>('SELECT * FROM resumes ORDER BY id').map(toResume);
  }

  async add(file: { buffer: Buffer; originalname: string; size: number }, meta: ResumeMetaDto): Promise<Resume> {
    if (this.list().length >= MAX_RESUMES) throw new BadRequestException(`At most ${MAX_RESUMES} extra resumes - delete one first.`);
    if (file.size > RESUME_MAX_BYTES) throw new BadRequestException('Resume must be under 10 MB');
    if (extname(file.originalname).toLowerCase() !== '.pdf' || file.buffer.subarray(0, 5).toString() !== '%PDF-') {
      throw new BadRequestException('Please upload the resume as a PDF');
    }
    const label = meta.label?.trim();
    if (!label) throw new BadRequestException('Give this resume a name, like "Frontend"');
    let text: string;
    try {
      text = await pdfToText(file.buffer);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
    // The original file name is kept (recruiters see it), in a folder per resume so two can share a name.
    const name = file.originalname.replace(/[^\w.\- ]+/g, '_').slice(-120);
    const id = this.storage.run("INSERT INTO resumes (label, path, name, for_jobs, skills, created_at) VALUES (?, '', ?, ?, ?, ?)", [
      label,
      name,
      JSON.stringify(cleanWords(meta.forJobs?.length ? meta.forJobs : label.split(/[\s,/]+/))),
      JSON.stringify(extractSkills(text)),
      new Date().toISOString(),
    ]).lastInsertRowid;
    const folder = join(this.dir, String(id));
    mkdirSync(folder, { recursive: true });
    const path = join(folder, name);
    writeFileSync(path, file.buffer);
    this.storage.run('UPDATE resumes SET path = ? WHERE id = ?', [path, id]);
    return this.get(id);
  }

  update(id: number, meta: ResumeMetaDto): Resume {
    this.row(id);
    if (meta.label?.trim()) this.storage.run('UPDATE resumes SET label = ? WHERE id = ?', [meta.label.trim(), id]);
    if (meta.forJobs) this.storage.run('UPDATE resumes SET for_jobs = ? WHERE id = ?', [JSON.stringify(cleanWords(meta.forJobs)), id]);
    return this.get(id);
  }

  remove(id: number): void {
    this.row(id);
    this.storage.run('DELETE FROM resumes WHERE id = ?', [id]);
    rmSync(join(this.dir, String(id)), { recursive: true, force: true });
  }

  filePath(id: number): string {
    const row = this.row(id);
    if (!row.path || !existsSync(row.path)) throw new NotFoundException('The file of this resume is missing - upload it again');
    return row.path;
  }

  /** The extra resume made for this job, or null for your main one. */
  forJob(job: { title: string; description: string }): ChosenResume | null {
    const rows = this.storage.all<ResumeRow>('SELECT * FROM resumes').filter((r) => r.path && existsSync(r.path));
    if (!rows.length) return null;
    const id = pickResume(
      job,
      rows.map((r) => ({ id: r.id, forJobs: JSON.parse(r.for_jobs) as string[], skills: JSON.parse(r.skills) as string[] })),
    );
    const row = rows.find((r) => r.id === id);
    return row ? { path: row.path, label: row.label } : null;
  }

  /** Every extra resume's file, for backups. */
  files(): { id: number; path: string }[] {
    return this.storage.all<{ id: number; path: string }>("SELECT id, path FROM resumes WHERE path <> ''").filter((r) => existsSync(r.path));
  }

  private get(id: number): Resume {
    return toResume(this.row(id));
  }

  private row(id: number): ResumeRow {
    const row = this.storage.get<ResumeRow>('SELECT * FROM resumes WHERE id = ?', [id]);
    if (!row) throw new NotFoundException('Resume not found');
    return row;
  }
}

const cleanWords = (words: string[]) => [...new Set(words.map((w) => w.trim().toLowerCase()).filter((w) => w.length > 1))].slice(0, 20);

function toResume(r: ResumeRow): Resume {
  return {
    id: r.id,
    label: r.label,
    name: r.name,
    forJobs: JSON.parse(r.for_jobs) as string[],
    skills: JSON.parse(r.skills) as string[],
    createdAt: r.created_at,
  };
}
