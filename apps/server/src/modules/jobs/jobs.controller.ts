// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
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
  constructor(private readonly jobs: JobsService) {}

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

  /** Out of the queue and back to review; a job being applied to right now is not touched. */
  @Post('unqueue')
  @HttpCode(200)
  unqueue(@Body() dto: JobIdsDto): { updated: number } {
    return { updated: this.jobs.setStatusMany(dto.ids, JobStatus.REVIEW, 'Moved back to review by you', [JobStatus.APPROVED, JobStatus.SKIPPED], true) };
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
