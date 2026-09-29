// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

// Your own details on forms in the world's major languages (2026-09-29), and English forms unchanged.

import { EMPTY_PROFILE } from '../../profile/constants/profile.constants';
import { FieldKind } from '../enums/field-kind.enum';
import { AnswerContext } from '../interfaces/answer-context.interface';
import { FormField } from '../interfaces/form-field.interface';
import { answerFromProfile } from './profile-rules.util';

const ctx: AnswerContext = {
  profile: { ...EMPTY_PROFILE, firstName: 'Priya', lastName: 'Sharma', phone: '9876543210', city: 'Noida', country: 'India' },
  job: { id: 1, title: 'Backend', company: 'Acme', location: 'Noida', description: '' },
  resumePath: null,
  skillYears: () => null,
};
const field = (label: string): FormField => ({
  id: 'f',
  kind: FieldKind.TEXT,
  label,
  name: '',
  placeholder: '',
  required: true,
  value: '',
  options: [],
  optionIds: [],
  error: '',
  maxLength: null,
  min: null,
  max: null,
  accept: null,
});
const answer = (label: string) => answerFromProfile(ctx, field(label))?.value;

describe('profile rules in the major languages', () => {
  it.each(['Voornaam *', 'Vorname', 'Prénom', 'Imię', 'Förnamn', 'Имя', 'Nama depan', 'الاسم الأول', 'पहला नाम', '名'])('first name: %s', (label) =>
    expect(answer(label)).toBe('Priya'),
  );

  it.each(['Achternaam', 'Nachname', 'Nom de famille', 'Apellidos', 'Cognome', 'Nazwisko', 'Фамилия', 'Soyadı', '姓', '성'])('last name: %s', (label) =>
    expect(answer(label)).toBe('Sharma'),
  );

  it.each(['Volledige naam', 'Nombre completo', 'Nome completo', 'Ad Soyad', 'Nama lengkap', 'Họ và tên', 'पूरा नाम', '姓名', '氏名', '이름'])(
    'full name: %s',
    (label) => expect(answer(label)).toBe('Priya Sharma'),
  );

  it.each([
    'Telefoonnummer',
    'Handynummer',
    'Téléphone',
    'Teléfono',
    'Celular',
    'Телефон',
    'Số điện thoại',
    'رقم الهاتف',
    'मोबाइल',
    '手机',
    '電話番号',
    '전화번호',
  ])('phone: %s', (label) => expect(answer(label)).toBe('9876543210'));

  it.each(['Woonplaats', 'Wohnort', 'Ville', 'Ciudad', 'Città', 'Город', 'शहर', '城市'])('city: %s', (label) => expect(answer(label)).toBe('Noida'));

  it('leaves English forms exactly as before', () => {
    expect(answer('First Name')).toBe('Priya');
    expect(answer('Last name')).toBe('Sharma');
    expect(answer('Full name')).toBe('Priya Sharma');
    expect(answer('Mobile number')).toBe('9876543210');
    expect(answer('Current city')).toBe('Noida');
    // Other people's names and similar-looking words are not your details.
    expect(answer('Name of your current company')).not.toBe('Priya Sharma');
    expect(answer('Nashville office?')).not.toBe('Noida');
    expect(answer('Is the role portable to other offices?')).not.toBe('9876543210');
  });
});
