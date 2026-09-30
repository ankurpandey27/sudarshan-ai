// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Body, Controller, Get, HttpCode, Param, ParseEnumPipe, Patch, Post } from '@nestjs/common';
import { SetLearnerEnabledDto } from './dto/set-learner-enabled.dto';
import { LearnerName } from './enums/learner-name.enum';
import { LearnerStatus } from './interfaces/learner-status.interface';
import { LearnersTrainerService } from './learners-trainer.service';
import { LearnersService } from './learners.service';

@Controller('learners')
export class LearnersController {
  constructor(
    private readonly learners: LearnersService,
    private readonly trainer: LearnersTrainerService,
  ) {}

  @Get()
  list(): LearnerStatus[] {
    return this.learners.status();
  }

  /** Switch one learner off (or back on); it retrains straight away. */
  @Patch(':name')
  async setEnabled(@Param('name', new ParseEnumPipe(LearnerName)) name: LearnerName, @Body() dto: SetLearnerEnabledDto): Promise<LearnerStatus[]> {
    this.learners.setEnabled(name, dto.enabled);
    await this.trainer.trainAll();
    return this.learners.status();
  }

  /** Retrain every learner now, from everything so far. */
  @Post('train')
  @HttpCode(200)
  async train(): Promise<LearnerStatus[]> {
    await this.trainer.trainAll();
    return this.learners.status();
  }
}
