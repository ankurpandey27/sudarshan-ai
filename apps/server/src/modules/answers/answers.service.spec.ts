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
