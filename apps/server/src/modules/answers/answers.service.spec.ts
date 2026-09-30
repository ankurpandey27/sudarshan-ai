// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { StorageService } from '../../common/storage/storage.service';
import { AnswersService } from './answers.service';
import { AnswerSource } from './enums/answer-source.enum';

describe('AnswersService memory', () => {
  it('remembers a real question and finds it again', () => {
    const answers = new AnswersService(new StorageService(':memory:'));
    answers.remember('What is your notice period?', '30 days', AnswerSource.USER);
    expect(answers.lookup('What is your notice period?')?.answer).toBe('30 days');
  });

  it('never stores or reuses an answer for a placeholder like "Choose an option"', () => {
    const answers = new AnswersService(new StorageService(':memory:'));
    expect(answers.remember('Choose an option', 'Yes', AnswerSource.USER)).toBeNull();
    expect(answers.lookup('Choose an option')).toBeNull();
    expect(answers.lookup('Please select')).toBeNull();
  });
});

describe('AnswersService.exportCsv', () => {
  it('exports every answer with its source, most used first', () => {
    const answers = new AnswersService(new StorageService(':memory:'));
    answers.remember('Notice period, in days?', '30', AnswerSource.USER);
    const ai = answers.remember('Why this company?', 'I like "hard" problems', AnswerSource.LLM)!;
    answers.markUsed(ai.id);
    const lines = answers.exportCsv().replace('\uFEFF', '').trim().split('\r\n');
    expect(lines[0]).toBe('Question,Answer,Source,Field type,Times used,Added,Last changed');
    expect(lines[1]).toMatch(/^Why this company\?,"I like ""hard"" problems",From AI,,1,/);
    expect(lines[2]).toMatch(/^"Notice period, in days\?",30,Yours,,0,/);
  });
});
