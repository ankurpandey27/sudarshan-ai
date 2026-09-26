import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
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

@Controller()
export class AnswersController {
  constructor(
    private readonly answers: AnswersService,
    private readonly pending: PendingQuestionsService,
  ) {}

  @Get('answers')
  list(@Query() q: ListAnswersQueryDto): Answer[] {
    return this.answers.list(q.search);
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
