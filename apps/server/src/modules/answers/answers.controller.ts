// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AnswersService } from './answers.service';
import { PendingQuestionsService } from './pending-questions.service';
import { AnswerSource } from './enums/answer-source.enum';
import { Answer } from './interfaces/answer.interface';
import { PendingQuestionGroup } from './interfaces/pending-question.interface';
import { AnswerQuestionDto } from './dto/answer-question.dto';
import { CreateAnswerDto } from './dto/create-answer.dto';
import { ListAnswersQueryDto } from './dto/list-answers-query.dto';
import { SkipQuestionDto } from './dto/skip-question.dto';
import { UpdateAnswerDto } from './dto/update-answer.dto';
import { TranslationService } from './translation.service';
import { looksNonEnglish } from './utils/language.util';

@Controller()
export class AnswersController {
  constructor(
    private readonly translation: TranslationService,
    private readonly answers: AnswersService,
    private readonly pending: PendingQuestionsService,
  ) {}

  @Get('answers')
  list(@Query() q: ListAnswersQueryDto): Answer[] {
    const list = this.answers.list(q.search);
    const questions = list.map((a) => a.question);
    const english = this.translation.known(questions);
    // Saved questions in other languages get their English in the background; the next look shows it.
    void this.translation.translate(questions);
    return list.map((a) => ({ ...a, questionEn: english.get(a.question) ?? null, foreign: looksNonEnglish(a.question) }));
  }

  /** Downloads your answer memory as a CSV file. */
  @Get('answers/export.csv')
  exportCsv(@Res() res: Response): void {
    res.setHeader('content-type', 'text/csv; charset=utf-8');
    res.setHeader('content-disposition', `attachment; filename="answer-memory-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(this.answers.exportCsv());
  }

  @Post('answers')
  create(@Body() dto: CreateAnswerDto): Answer | null {
    return this.answers.remember(dto.question, dto.answer, AnswerSource.USER, dto.fieldType ?? null);
  }

  @Patch('answers/:id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAnswerDto): Answer {
    return this.answers.update(id, dto.answer, dto.question);
  }

  @Delete('answers/:id')
  remove(@Param('id', ParseIntPipe) id: number): { deleted: true } {
    this.answers.remove(id);
    return { deleted: true };
  }

  @Get('questions')
  open(): PendingQuestionGroup[] {
    return this.pending.open();
  }

  @Post('questions/answer')
  @HttpCode(200)
  answer(@Body() dto: AnswerQuestionDto): { requeued: number } {
    return this.pending.answer(dto.key, dto.answer);
  }

  @Post('questions/skip')
  @HttpCode(200)
  skip(@Body() dto: SkipQuestionDto): { moved: number } {
    return this.pending.skip(dto.key);
  }
}
