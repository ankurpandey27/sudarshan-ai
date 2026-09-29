// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { StorageService } from '../../common/storage/storage.service';
import { EmbeddingsService } from '../../common/embeddings/embeddings.service';
import { AnswersService } from './answers.service';
import { AnswerSource } from './enums/answer-source.enum';
import { PastAnswersService } from './past-answers.service';

/**
 * A stand-in meaning model: questions about the same topic word get the same direction. No download,
 * so these tests run on any machine.
 */
const TOPICS = ['notice', 'ctc', 'phone', 'board'];
const vec = (text: string) => {
  const t = text.toLowerCase();
  const v = TOPICS.map((w) => (t.includes(w) || (w === 'notice' && /join|kündigung/.test(t)) ? 1 : 0));
  const n = Math.hypot(...v) || 1;
  return Float32Array.from(v.map((x) => x / n));
};
const fakeModel = (state: 'ready' | 'unavailable' = 'ready') => {
  const calls: string[][] = [];
  return {
    calls,
    service: { embed: async (texts: string[]) => (state === 'ready' ? (calls.push(texts), texts.map(vec)) : null) } as unknown as EmbeddingsService,
  };
};

const make = (state: 'ready' | 'unavailable' = 'ready') => {
  const storage = new StorageService(':memory:');
  const answers = new AnswersService(storage);
  const model = fakeModel(state);
  return { storage, answers, model, past: new PastAnswersService(storage, model.service) };
};

describe('PastAnswersService', () => {
  it('finds your answers to questions with the same meaning, in other words or languages', async () => {
    const { answers, past } = make();
    answers.remember('What is your notice period (days)?', '30', AnswerSource.USER);
    answers.remember('Current CTC (LPA)', '12', AnswerSource.USER);
    const [found] = await past.similar(['How soon can you join? (Kündigungsfrist)']);
    expect(found.map((p) => p.answer)).toEqual(['30']);
    expect(found[0].similarity).toBe(1);
  });

  it("never shows the AI's own past guesses - only yours and your spreadsheet's", async () => {
    const { answers, past } = make();
    answers.remember('Notice period?', '90', AnswerSource.LLM);
    answers.remember('What is your notice period?', '30', AnswerSource.EXCEL);
    const [found] = await past.similar(['How soon can you join?']);
    expect(found.map((p) => p.answer)).toEqual(['30']);
  });

  it('works out each saved question once and keeps it, not on every application', async () => {
    const { storage, answers, past, model } = make();
    answers.remember('What is your notice period?', '30', AnswerSource.USER);
    await past.similar(['How soon can you join?']);
    await past.similar(['When can you join?']);
    // First call: the saved question and the asked one; after that only the asked one.
    expect(model.calls).toEqual([['What is your notice period?'], ['How soon can you join?'], ['When can you join?']]);
    expect(storage.get<{ n: number }>('SELECT COUNT(*) n FROM answer_vectors')?.n).toBe(1);
  });

  it('carries on with nothing when the model cannot run (no download, too little memory)', async () => {
    const { answers, past } = make('unavailable');
    answers.remember('What is your notice period?', '30', AnswerSource.USER);
    expect(await past.similar(['How soon can you join?', 'Phone'])).toEqual([[], []]);
  });

  it('leaves out answers about something else entirely', async () => {
    const { answers, past } = make();
    answers.remember('Phone number', '9876543210', AnswerSource.USER);
    expect(await past.similar(['What is your notice period?'])).toEqual([[]]);
  });
});
