// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { Body, Controller, Get, HttpCode, NotFoundException, Param, ParseIntPipe, Post, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { JobList } from './interfaces/job-list.interface';
import { AddLinksDto } from './dto/add-links.dto';
import { JobIdsDto } from './dto/job-ids.dto';
import { ListJobsQueryDto } from './dto/list-jobs-query.dto';
import { JobStatus } from './enums/job-status.enum';
import { Attempt } from './interfaces/attempt.interface';
import { Job } from './interfaces/job.interface';
import { JobStats } from './interfaces/job-stats.interface';
import { JobsService } from './jobs.service';
import { ApproveStrongDto } from './dto/approve-strong.dto';

@Controller('jobs')
export class JobsController {
  constructor(
    private readonly jobs: JobsService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  list(@Query() q: ListJobsQueryDto): JobList {
    return this.jobs.list(q);
  }

  @Get('stats')
  stats(): JobStats {
    return this.jobs.stats();
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number): { job: Job; attempts: Attempt[] } {
    return { job: this.jobs.get(id), attempts: this.jobs.attempts(id) };
  }

  /** A step picture from an attempt's replay - only a file listed for that attempt, nothing else. */
  @Get(':id/attempts/:attemptId/shots/:file')
  shot(@Param('id', ParseIntPipe) id: number, @Param('attemptId', ParseIntPipe) attemptId: number, @Param('file') file: string, @Res() res: Response): void {
    const attempt = this.jobs.attempts(id).find((a) => a.id === attemptId);
    const name = basename(file);
    const listed = !!attempt && name === file && attempt.shots.some((s) => s.file === name);
    const path = join(this.config.getOrThrow<string>('paths.screenshots'), name);
    if (!listed || !existsSync(path)) throw new NotFoundException('No such picture (old pictures are cleared after 30 days)');
    res.setHeader('cache-control', 'private, max-age=86400');
    res.sendFile(path);
  }

  @Post('approve')
  @HttpCode(200)
  approve(@Body() dto: JobIdsDto): { updated: number } {
    return {
      updated: this.jobs.setStatusMany(
        dto.ids,
        JobStatus.APPROVED,
        'Approved by you',
        [JobStatus.REVIEW, JobStatus.SKIPPED, JobStatus.FAILED, JobStatus.MANUAL, JobStatus.DISMISSED, JobStatus.NEW],
        true,
      ),
    };
  }

  /** "Approve all scoring N+": every page, on the server. */
  @Post('approve-strong')
  @HttpCode(200)
  approveStrong(@Body() dto: ApproveStrongDto): { updated: number } {
    return { updated: this.jobs.approveStrong(dto.minScore, dto.platform) };
  }

  /** Back to review - out of the queue, or from "needs attention"; a job being applied to right now is not touched. */
  @Post('unqueue')
  @HttpCode(200)
  unqueue(@Body() dto: JobIdsDto): { updated: number } {
    return {
      updated: this.jobs.setStatusMany(
        dto.ids,
        JobStatus.REVIEW,
        'Moved back to review by you',
        [JobStatus.APPROVED, JobStatus.SKIPPED, JobStatus.MANUAL, JobStatus.FAILED, JobStatus.NEEDS_INPUT],
        true,
      ),
    };
  }

  @Post('skip')
  @HttpCode(200)
  skip(@Body() dto: JobIdsDto): { updated: number } {
    return { updated: this.jobs.setStatusMany(dto.ids, JobStatus.SKIPPED, 'Skipped by you', [JobStatus.NEW, JobStatus.REVIEW, JobStatus.APPROVED], true) };
  }

  @Post('dismiss')
  @HttpCode(200)
  dismiss(@Body() dto: JobIdsDto): { updated: number } {
    return {
      updated: this.jobs.setStatusMany(
        dto.ids,
        JobStatus.DISMISSED,
        'Dismissed by you',
        [JobStatus.NEW, JobStatus.REVIEW, JobStatus.APPROVED, JobStatus.SKIPPED, JobStatus.NEEDS_INPUT, JobStatus.FAILED, JobStatus.MANUAL],
        true,
      ),
    };
  }

  @Post(':id/mark-applied')
  @HttpCode(200)
  markApplied(@Param('id', ParseIntPipe) id: number): Job {
    return this.jobs.markAppliedByYou(id);
  }

  @Post('links')
  @HttpCode(200)
  addLinks(@Body() dto: AddLinksDto) {
    return this.jobs.addLinks(dto.links);
  }
}
