// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { CreateStoryDto } from './dto/create-story.dto';
import { UpdateStoryDto } from './dto/update-story.dto';
import { InterviewQuestion } from './interfaces/interview-question.interface';
import { Story } from './interfaces/story.interface';
import { StoriesService } from './stories.service';
import { needsSpecifics } from './utils/story.util';

@Controller('stories')
export class StoriesController {
  constructor(private readonly stories: StoriesService) {}

  @Get()
  list(): Story[] {
    return this.stories.list();
  }

  @Get('interview')
  interview(): (InterviewQuestion & { answered: boolean })[] {
    return this.stories.interview();
  }

  /** Whether an answer is specific enough, before it is saved (the interview asks once more if not). */
  @Post('check')
  check(@Body() dto: CreateStoryDto): { specific: boolean } {
    return { specific: !needsSpecifics(dto.text) };
  }

  @Post()
  create(@Body() dto: CreateStoryDto): Story {
    return this.stories.create(dto.text, dto.promptId, dto.title);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateStoryDto): Story {
    return this.stories.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number): { deleted: true } {
    this.stories.remove(id);
    return { deleted: true };
  }
}
