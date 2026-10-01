// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { EventsService } from '../../../common/events/events.service';
import { StorageService } from '../../../common/storage/storage.service';
import { JobsService } from '../../jobs/jobs.service';
import { JobSource } from '../../jobs/enums/job-source.enum';
import { LlmService } from '../../llm/llm.service';
import { AnswersService } from '../answers.service';
import { PendingQuestionsService } from '../pending-questions.service';
import { TranslationService } from '../translation.service';
import { looksNonEnglish } from './language.util';

describe('questions in another language (2026-09-30)', () => {
  it.each([
    'Hoe vaardig bent u in het Nederlands?',
    'Indique aspiracion renta liquida',
    'Você fala, lê e escreve inglês fluentemente?',
    'Wie viele Jahre Erfahrung haben Sie?',
    'आपका अनुभव कितने साल का है?',
  ])('knows "%s" is not English', (q) => expect(looksNonEnglish(q)).toBe(true));

  it.each(['How many years of Node.js experience do you have?', 'Notice period', 'URL', 'Phone Device Type', 'Expected CTC (LPA)', 'Email address(es)'])(
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
      json: async (prompt: string) => {
        calls++;
        const dutch: Record<string, string> = {
          'Hoe vaardig bent u in het Nederlands?': 'How proficient are you in Dutch?',
          Niet: 'None',
          Conversatie: 'Conversational',
          Beroepsmatig: 'Professional',
          'Moedertaal of tweetalig': 'Native or bilingual',
        };
        return { english: (JSON.parse(prompt.slice(prompt.lastIndexOf('['))) as string[]).map((t) => dutch[t]) };
      },
    } as unknown as LlmService;
    const svc = new PendingQuestionsService(storage, new AnswersService(storage), jobs, events, new TranslationService(storage, llm));
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

  it('translates each text once, ever, and never English ones', async () => {
    const storage = new StorageService(':memory:');
    const seen: string[][] = [];
    const llm = {
      isAvailable: () => true,
      json: async (prompt: string) => {
        const batch = JSON.parse(prompt.slice(prompt.lastIndexOf('['))) as string[];
        seen.push(batch);
        return { english: batch.map((t) => `EN(${t})`) };
      },
    } as unknown as LlmService;
    const tr = new TranslationService(storage, llm);
    const texts = ['Você fala inglês?', 'Notice period', 'Teléfono móvil'];
    const first = await tr.translate(texts);
    expect(first.get('Você fala inglês?')).toBe('EN(Você fala inglês?)');
    expect(first.has('Notice period')).toBe(false);
    await tr.translate(texts);
    expect(seen).toEqual([['Você fala inglês?', 'Teléfono móvil']]);
  });

  it('does not ask the AI again and again for a text it could not translate', async () => {
    let calls = 0;
    const llm = { isAvailable: () => true, json: async () => (calls++, { english: [] }) } as unknown as LlmService;
    const tr = new TranslationService(new StorageService(':memory:'), llm);
    await tr.translate(['Onde você mora atualmente?']);
    await tr.translate(['Onde você mora atualmente?']);
    await tr.translate(['Onde você mora atualmente?']);
    expect(calls).toBe(1);
  });
});
