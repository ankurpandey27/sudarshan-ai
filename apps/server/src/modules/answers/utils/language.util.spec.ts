// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { EventsService } from '../../../common/events/events.service';
import { StorageService } from '../../../common/storage/storage.service';
import { JobsService } from '../../jobs/jobs.service';
import { JobSource } from '../../jobs/enums/job-source.enum';
import { LlmService } from '../../llm/llm.service';
import { AnswersService } from '../answers.service';
import { PendingQuestionsService } from '../pending-questions.service';
import { looksNonEnglish } from './language.util';

describe('questions in another language (2026-09-30)', () => {
  it.each([
    'Hoe vaardig bent u in het Nederlands?',
    'Indique aspiracion renta liquida',
    'Você fala, lê e escreve inglês fluentemente?',
    'Wie viele Jahre Erfahrung haben Sie?',
    'आपका अनुभव कितने साल का है?',
  ])('knows "%s" is not English', (q) => expect(looksNonEnglish(q)).toBe(true));

  it.each(['How many years of Node.js experience do you have?', 'Notice period', 'URL', 'Phone Device Type', 'Expected CTC (LPA)'])(
    'knows "%s" is English',
    (q) => expect(looksNonEnglish(q)).toBe(false),
  );

  it('adds an English version of the question and its options, once', async () => {
    const storage = new StorageService(':memory:');
    const events = new EventsService();
    const jobs = new JobsService(storage, events);
    const [jobId] = jobs.saveDiscovered([
      {
        source: JobSource.WEB,
        externalId: 'x',
        url: 'https://example.nl/job',
        title: 'Dev',
        company: 'Acme',
        location: '',
        isRemote: false,
        easyApply: false,
        description: '',
      },
    ]);
    let calls = 0;
    const llm = {
      isAvailable: () => true,
      json: async () => {
        calls++;
        return { question: 'How proficient are you in Dutch?', options: ['None', 'Conversational', 'Professional', 'Native or bilingual'] };
      },
    } as unknown as LlmService;
    const svc = new PendingQuestionsService(storage, new AnswersService(storage), jobs, events, llm);
    svc.add({
      jobId,
      question: 'Hoe vaardig bent u in het Nederlands?',
      fieldType: 'radio',
      options: ['Niet', 'Conversatie', 'Beroepsmatig', 'Moedertaal of tweetalig'],
      suggestion: null,
    });
    await new Promise((r) => setTimeout(r, 20));
    const [q] = svc.open();
    expect(q.questionEn).toBe('How proficient are you in Dutch?');
    expect(q.optionsEn).toEqual(['None', 'Conversational', 'Professional', 'Native or bilingual']);
    // The options sent to the site stay as the site wrote them.
    expect(q.options[0]).toBe('Niet');
    svc.open();
    await new Promise((r) => setTimeout(r, 20));
    expect(calls).toBe(1);
  });
});
