// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { EMPTY_PROFILE } from '../../profile/constants/profile.constants';
import { FieldKind } from '../enums/field-kind.enum';
import { AnswerContext } from '../interfaces/answer-context.interface';
import { FormField } from '../interfaces/form-field.interface';
import { answerFromProfile } from './profile-rules.util';

const field = (label: string, kind = FieldKind.TEXT, options: string[] = []): FormField => ({
  id: 'f1',
  kind,
  label,
  name: '',
  placeholder: '',
  required: true,
  value: '',
  options,
  optionIds: options.map((_, i) => `o${i}`),
  error: '',
  maxLength: null,
  min: null,
  max: null,
  accept: null,
});

const ctx: AnswerContext = {
  profile: {
    ...EMPTY_PROFILE,
    firstName: 'Priya',
    lastName: 'Sharma',
    totalYearsExperience: 5.4,
    noticePeriodDays: 30,
    currentCtc: 1_200_000,
    expectedCtc: 1_800_000,
    needsSponsorship: false,
    skills: [{ name: 'Node.js', years: 5 }],
  },
  job: { id: 1, title: 't', company: 'c', location: 'l', description: '' },
  resumePath: null,
  skillYears: (s) => (s.startsWith('node') ? 5 : null),
};

const ask = (label: string, kind?: FieldKind, options?: string[]) => answerFromProfile(ctx, field(label, kind, options))?.value;

describe('answerFromProfile', () => {
  it('answers identity questions', () => {
    expect(ask('First name')).toBe('Priya');
    expect(ask('Full name')).toBe('Priya Sharma');
    expect(ask('Company name')).toBeUndefined(); // profile has no company: memory / user decide
  });

  it('gives CTC in the unit the question asks for', () => {
    expect(ask('Expected CTC (in lakhs)')).toBe('18');
    expect(ask('Current CTC (LPA)')).toBe('12');
    expect(ask('Current annual salary')).toBe('1200000');
    expect(ask('Expected salary per month')).toBe('150000');
  });

  it('answers years per skill honestly', () => {
    expect(ask('How many years of experience do you have with Node.js?', FieldKind.NUMBER)).toBe('5');
    expect(ask('How many years of work experience do you have with Rust?', FieldKind.NUMBER)).toBe('0');
    expect(ask('Total years of experience', FieldKind.NUMBER)).toBe('5');
    expect(ask('Do you have experience with Rust?', FieldKind.RADIO, ['Yes', 'No'])).toBe('No');
  });

  it('answers notice period for text, number and option fields', () => {
    expect(ask('Notice period (in days)', FieldKind.NUMBER)).toBe('30');
    expect(ask('Notice period in months', FieldKind.NUMBER)).toBe('1');
    expect(ask('What is your notice period?', FieldKind.SELECT, ['Immediate', '1 month', '2 months'])).toBe('1 month');
  });

  it('answers work authorization and sponsorship', () => {
    expect(ask('Are you legally authorized to work in India?', FieldKind.RADIO)).toBe('Yes');
    expect(ask('Will you now or in the future require sponsorship?', FieldKind.RADIO)).toBe('No');
  });

  it('never answers a question about someone else with your own name', () => {
    expect(ask('Full Name')).toBe('Priya Sharma');
    expect(ask('Do you know anyone currently working at ConveGenius? If yes, please mention the full name.')).toBeUndefined();
    expect(ask('Referrer full name')).toBeUndefined();
  });

  it('fills education and "currently working here" from the profile', () => {
    const withHistory: AnswerContext = {
      ...ctx,
      profile: {
        ...ctx.profile,
        currentCompany: 'Acme',
        education: [{ degree: 'B.Tech', field: 'Computer Science', institution: 'IIT Delhi', startYear: 2014, endYear: 2018, grade: '' }],
      },
    };
    const on = (label: string, kind = FieldKind.TEXT) => answerFromProfile(withHistory, field(label, kind))?.value;
    expect(on('Course')).toBe('B.Tech');
    expect(on('Branch/ Specialization')).toBe('Computer Science');
    expect(on('University/ College')).toBe('IIT Delhi');
    expect(on('Start of Course')).toBeUndefined();
    expect(on('Currently working here', FieldKind.CHECKBOX)).toBe('true');
    expect(ask('Currently working here', FieldKind.CHECKBOX)).toBe('false');
  });

  it('ticks consent boxes but leaves marketing ones alone', () => {
    expect(answerFromProfile(ctx, { ...field('I agree to the privacy policy', FieldKind.CHECKBOX), value: 'false' })?.value).toBe('true');
    expect(answerFromProfile(ctx, { ...field('Follow Acme to stay up to date', FieldKind.CHECKBOX), value: 'true' })?.value).toBe('true');
  });
});
