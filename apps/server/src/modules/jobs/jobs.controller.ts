import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { Paginated } from '../../common/interfaces/paginated.interface';
import { AddLinksDto } from './dto/add-links.dto';
import { JobIdsDto } from './dto/job-ids.dto';
import { ListJobsQueryDto } from './dto/list-jobs-query.dto';
import { JobStatus } from './enums/job-status.enum';
import { Attempt } from './interfaces/attempt.interface';
import { Job } from './interfaces/job.interface';
import { JobStats } from './interfaces/job-stats.interface';
import { JobsService } from './jobs.service';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get()
  list(@Query() q: ListJobsQueryDto): Paginated<Job> {
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
      updated: this.jobs.setStatusMany(dto.ids, JobStatus.APPROVED, 'Approved by you', [
        JobStatus.REVIEW,
        JobStatus.SKIPPED,
        JobStatus.FAILED,
        JobStatus.MANUAL,
        JobStatus.DISMISSED,
        JobStatus.NEW,
      ]),
    };
  }

  @Post('dismiss')
  @HttpCode(200)
  dismiss(@Body() dto: JobIdsDto): { updated: number } {
    return {
      updated: this.jobs.setStatusMany(dto.ids, JobStatus.DISMISSED, 'Dismissed by you', [
        JobStatus.NEW,
        JobStatus.REVIEW,
        JobStatus.APPROVED,
        JobStatus.SKIPPED,
        JobStatus.NEEDS_INPUT,
        JobStatus.FAILED,
        JobStatus.MANUAL,
      ]),
    };
  }

  @Post(':id/mark-applied')
  @HttpCode(200)
  markApplied(@Param('id', ParseIntPipe) id: number): Job {
    return this.jobs.setStatus(id, JobStatus.APPLIED, 'Marked applied by you');
  }

  @Post('links')
  @HttpCode(200)
  addLinks(@Body() dto: AddLinksDto) {
    return this.jobs.addLinks(dto.links);
  }
}
