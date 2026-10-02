// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { extractSkills } from '../../discovery/utils/job-normalizer.util';
import { FieldKind } from '../enums/field-kind.enum';
import { AnswerContext, RuleAnswer } from '../interfaces/answer-context.interface';
import { FormField } from '../interfaces/form-field.interface';
import { ProfileRule } from '../interfaces/profile-rule.interface';
import { BACKGROUND_QUESTION } from '../constants/background.constants';
import { cleanRecordAnswer } from './background.util';
import { jobSourceAnswer } from './job-source.util';

const yes = (b: boolean): string => (b ? 'Yes' : 'No');
const fact = (value: string | number | null | undefined): RuleAnswer | null =>
  value === null || value === undefined || value === '' ? null : { value: String(value), confident: true };
const guess = (value: string): RuleAnswer => ({ value, confident: false });

/** The job's location names your country, state or city. */
/** "Are you authorized / eligible to work ...?" */
export const WORK_AUTH_QUESTION = /(legally\s*)?(authori[sz]ed|eligible|permitted)\s*to\s*work|work\s*authori[sz]ation|right to work/;

/** The question names a place: "...to work in the United States?" - not "...in this country?". Needs the original capitals. */
export function namesACountry(label: string): boolean {
  return /\b(?:in|for)\s+(?:the\s+)?(?!This\b|That\b|Your\b|Our\b|Any\b|A\b)[A-Z][A-Za-z.]+/.test(label);
}

/** Whether "authorized to work" can be answered for this job: stated in the profile, or the job is where you live. */
export function workAuthorizationKnown(c: AnswerContext): boolean {
  return !!c.profile.workAuthorization.trim() || jobInHomeCountry(c);
}

/**
 * A right-to-work or sponsorship question can be answered from your profile: the job is where you live
 * (or your profile states where you may work), and the question does not name another country.
 */
function rightToWorkKnown(c: AnswerContext, f: FormField, remoteToo = false): boolean {
  // Sponsorship for a remote job ("Remote", "Anywhere"): your usual answer - you work from where you live.
  const remote = remoteToo && /^\s*(remote|anywhere|worldwide|global|work from home|wfh)?\s*$/i.test(c.job.location);
  if (!remote && !workAuthorizationKnown(c)) return false;
  const label = f.label || f.placeholder;
  if (!namesACountry(label)) return true;
  const places = [c.profile.country, c.profile.state, c.profile.city, c.profile.workAuthorization].filter(Boolean).map((p) => p.toLowerCase());
  return places.some((p) => label.toLowerCase().includes(p));
}

function jobInHomeCountry(c: AnswerContext): boolean {
  const where = c.job.location.toLowerCase();
  return [c.profile.country, c.profile.state, c.profile.city].some((place) => !!place && where.includes(place.toLowerCase()));
}

// Forms want whole years: 4.9 is 5, 4.4 is 4.
const wholeYears = (y: number): number => Math.max(0, Math.round(y));

// "...experience with X / in X / using X / on X": about one subject. "In total", "overall", "in the industry",
// "in IT", "in software development" still mean your whole career.
/** A text box this short wants a number or a word, not a sentence. */
const SHORT_ANSWER_MAX = 30;

const ABOUT_A_SUBJECT =
  /\b(experience|worked|working)\b.*\b(with|in|using|on)\s+(?!(total|overall|all\b|years?|yrs|months?|numbers?|digits|the industry|industry|it\b|the it\b|software (development|engineering|industry)|tech(nology)? industry|your career|this (field|industry)|a professional)\b)[a-z0-9]/;

// "at least 5 years", "minimum of 3 yrs", "5+ years": the years a question requires.
const REQUIRED_YEARS =
  /(?:at\s*least|atleast|minimum(?:\s*of)?|min\.?|more than|over)\s*(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)|(\d+(?:\.\d+)?)\s*\+\s*(?:years?|yrs?)/;

// Profile CTC is annual in full units; convert to what the question asks for.
function money(amount: number | null, field: FormField): RuleAnswer | null {
  if (amount === null || amount <= 0) return null;
  const q = `${field.label} ${field.placeholder}`.toLowerCase();
  if (/\b(lakh|lakhs|lac|lacs|lpa|l\.p\.a)\b/.test(q)) return fact(round(amount / 1e5, 2));
  if (/\b(per month|monthly|\/month|pm)\b/.test(q)) return fact(Math.round(amount / 12));
  if (/\bcrore|cr\b/.test(q)) return fact(round(amount / 1e7, 2));
  if (/\b(in k|thousands|'000)\b/.test(q)) return fact(Math.round(amount / 1000));
  return fact(Math.round(amount));
}

const round = (n: number, dp: number): number => Math.round(n * 10 ** dp) / 10 ** dp;

function noticePeriod(days: number | null, field: FormField): RuleAnswer | null {
  if (days === null) return null;
  const q = field.label.toLowerCase();
  // A short box (LinkedIn's "0/20") takes the number of days: "30 days" was "Invalid input" there (Somo Media, 2026-10-02).
  const shortBox = field.maxLength !== null && field.maxLength <= SHORT_ANSWER_MAX && !field.options.length;
  if (field.kind === FieldKind.NUMBER || shortBox || /\(in (days|months|weeks)\)|in (days|months|weeks)\b/.test(q)) {
    if (/month/.test(q)) return fact(Math.ceil(days / 30));
    if (/week/.test(q)) return fact(Math.ceil(days / 7));
    return fact(days);
  }
  if (field.options.length) {
    if (days <= 0) return fact('Immediate');
    if (days <= 15) return fact('15 days');
    return fact(days % 30 === 0 ? `${days / 30} month${days === 30 ? '' : 's'}` : `${days} days`);
  }
  return fact(days <= 0 ? 'Immediate' : `${days} days`);
}

// Your own details in the world's major languages. Only labels that mean one thing everywhere: Spanish
// "Nombre", Portuguese "Nome" and French "Nom" can be a first or a full name - the AI reads those.
// One-word labels in scripts without word breaks must be the whole label ("名", "성"), with an optional "*" or ":".
const FIRST_NAME_WORLD =
  // "\b" fails after accented letters ("imię"): a lookahead ends the word instead.
  /\b(voornaam|vorname|pr[ée]nom|nombre de pila|primeiro nome|imi[eę]|f[öo]rnamn|fornavn|nama depan)(?![a-zà-ÿąćęłńóśźżı])|^(имя|الاسم الأول|पहला नाम|名)\s*[*:]?\s*$/;
const LAST_NAME_WORLD =
  /\b(achternaam|nachname|familienname|nom de famille|apellidos?|sobrenome|apelido|cognome|nazwisko|efternamn|etternavn|efternavn|soyad[ıi]?|nama belakang)\b|^(фамилия|họ|اسم العائلة|उपनाम|姓|성)\s*[*:]?\s*$/;
const FULL_NAME_WORLD =
  /\b(volledige naam|vollst[äa]ndiger name|nom complet|nombre completo|nome completo|imi[eę] i nazwisko|ad soyad|nama lengkap)\b|^(naam|name|nombre y apellidos?|полное имя|фио|ф\.и\.о\.|họ và tên|họ tên|الاسم الكامل|الاسم|पूरा नाम|नाम|姓名|氏名|이름|성명)\s*[*:]?\s*$/;
const PHONE_WORLD =
  /\b(telefoon(nummer)?|mobiel(e nummer)?|telefon(nummer)?|handy(nummer)?|mobilnummer|t[ée]l[ée]phone|tel[ée]fono|celular|m[óo]vil|telefone|telem[óo]vel|cellulare|numero di telefono|nomor (telepon|hp|ponsel))\b|телефон|số điện thoại|رقم (الهاتف|الجوال)|फ़ोन|फोन|मोबाइल|电话|手机|電話番号|携帯|전화번호|휴대폰/;
const CITY_WORLD =
  /\b(woonplaats|wohnort|stadt|ville|ciudad|cidade|citt[àa]|miasto|kota)(?![a-zà-ÿąćęłńóśźżı])|город|şehir|thành phố|المدينة|शहर|城市|市区町村|도시/;

// Order matters: specific patterns first ("expected ctc" before "ctc").
const RULES: ProfileRule[] = [
  // Your record, as you declared it in Profile; never assumed.
  { test: BACKGROUND_QUESTION, answer: (c, f) => (c.profile.cleanRecord ? fact(cleanRecordAnswer(f.label || f.placeholder, f.kind)) : null) },
  // Full name first: Turkish "Ad Soyad" (name + surname) contains "Soyad" (surname).
  { key: 'fullName', test: FULL_NAME_WORLD, answer: (c) => fact(`${c.profile.firstName} ${c.profile.lastName}`.trim()) },
  { key: 'firstName', test: FIRST_NAME_WORLD, answer: (c) => fact(c.profile.firstName) },
  { key: 'lastName', test: LAST_NAME_WORLD, answer: (c) => fact(c.profile.lastName) },
  { key: 'phone', test: PHONE_WORLD, not: /country\s*code|code/, answer: (c) => fact(c.profile.phone) },
  { key: 'city', test: CITY_WORLD, answer: (c) => fact(c.profile.city) },
  { key: 'firstName', test: /\bfirst\s*name\b|\bgiven\s*name\b|\bforename\b/, answer: (c) => fact(c.profile.firstName) },
  { key: 'lastName', test: /\blast\s*name\b|\bsurname\b|\bfamily\s*name\b/, answer: (c) => fact(c.profile.lastName) },
  { test: /\bmiddle\s*name\b/, answer: () => guess('') },
  {
    key: 'fullName',
    test: /^(your\s+)?(full\s+)?name$|\bfull\s*name\b|\bcandidate('s)?\s*name\b|^name\b/,
    // "Do you know anyone working here? Mention the full name" asks about someone else.
    not: /company|employer|school|university|college|reference|referr|refer\b|father|mother|spouse|manager|recruiter|anyone|someone|know|friend|relative|employee|working (at|in|with)|contact person/,
    answer: (c) => fact(`${c.profile.firstName} ${c.profile.lastName}`.trim()),
  },
  // One address per email box: a profile listing several ("a@x.com, b@y.com") sends the first.
  {
    key: 'email',
    test: /e-?mail/,
    not: /manager|reference|referr/,
    answer: (c) => fact(c.profile.email.split(/[\s,;]+/).find((e) => e.includes('@')) ?? c.profile.email),
  },
  {
    key: 'phoneCode',
    test: /country\s*code|phone.*\bcode\b|dial(ing)?\s*code|\bcountry\b.*\bphone\b/,
    answer: (c) => fact(c.profile.phoneCountryCode),
  },
  {
    key: 'phone',
    test: /\b(phone|mobile|contact number|cell|whatsapp|telephone)\b/,
    not: /country\s*code|type|extension/,
    answer: (c) => fact(c.profile.phone),
  },
  // "LinkedIn", and the misspellings people type: "LinkdeIn", "Linkdin".
  {
    key: 'linkedin',
    test: /\blink(?:ed|de|d)\s*in\b/,
    // "Do you have a LinkedIn profile?" is a yes/no question: "Yes", with the link where there is room for it.
    answer: (c, f) =>
      /^(do|does|have|has|are)\b/.test(f.label.toLowerCase().trim()) && c.profile.linkedinUrl
        ? fact([FieldKind.RADIO, FieldKind.SELECT, FieldKind.CHECKBOX].includes(f.kind) ? 'Yes' : `Yes - ${c.profile.linkedinUrl}`)
        : fact(c.profile.linkedinUrl),
  },
  { key: 'github', test: /git\s*hub/, answer: (c) => fact(c.profile.githubUrl) },
  {
    key: 'portfolio',
    test: /portfolio|personal\s*(web)?site|^website$|blog/,
    answer: (c) => fact(c.profile.portfolioUrl || c.profile.githubUrl || c.profile.linkedinUrl),
  },
  { key: 'postalCode', test: /\b(pin\s*code|pincode|zip|postal\s*code)\b/, answer: (c) => fact(c.profile.postalCode) },
  { key: 'state', test: /\bstate\b|\bprovince\b/, not: /statement|united states/, answer: (c) => fact(c.profile.state) },
  { key: 'country', test: /\bcountry\b/, not: /code|authori|citizen|visa/, answer: (c) => fact(c.profile.country) },
  {
    key: 'city',
    test: /\b(current\s*)?city\b|current\s*location|location\s*\(city\)|where are you (currently )?(based|located)|^location$|your location/,
    not: /preferred|willing|relocat/,
    answer: (c) => fact(c.profile.city),
  },
  {
    key: 'address',
    test: /\baddress\b/,
    not: /e-?mail|web/,
    answer: (c) => fact([c.profile.city, c.profile.state, c.profile.country].filter(Boolean).join(', ')),
  },
  {
    key: 'currentCompany',
    test: /current\s*(company|employer|organi[sz]ation)|present\s*(company|employer)|company name/,
    not: /previous|last/,
    answer: (c) => fact(c.profile.currentCompany),
  },
  {
    key: 'currentTitle',
    test: /current\s*(job\s*)?(title|designation|role|position)|^designation$|job title/,
    answer: (c) => fact(c.profile.currentTitle),
  },
  { key: 'headline', test: /headline/, answer: (c) => fact(c.profile.headline || c.profile.currentTitle) },
  {
    key: 'noticePeriod',
    test: /notice\s*period/,
    // "Are you serving your notice? When is your LWD?" asks for a yes and a date, not the notice length.
    not: /currently serving|serving (your |the )?notice|\blwd\b|last working/,
    answer: (c, f) => noticePeriod(c.profile.noticePeriodDays, f),
  },
  {
    test: /(join|start)\s*(immediately|within)|immediate\s*joiner|earliest (start|joining)/,
    kinds: [FieldKind.RADIO, FieldKind.SELECT, FieldKind.CHECKBOX],
    answer: (c) => (c.profile.noticePeriodDays === null ? null : fact(yes(c.profile.noticePeriodDays <= 15))),
  },
  {
    key: 'expectedCtc',
    test: /expected\s*(ctc|salary|compensation|package|pay)|salary\s*expectation|desired\s*(salary|compensation)|expected annual/,
    answer: (c, f) => money(c.profile.expectedCtc, f),
  },
  {
    key: 'currentCtc',
    test: /current\s*(ctc|salary|compensation|package|pay)|present\s*(ctc|salary)|\bctc\b|annual\s*(salary|compensation)/,
    not: /expected|desired/,
    answer: (c, f) => money(c.profile.currentCtc, f),
  },
  {
    key: 'currency',
    test: /currency/,
    kinds: [FieldKind.SELECT, FieldKind.RADIO, FieldKind.TEXT, FieldKind.COMBOBOX],
    answer: (c) => fact(c.profile.currency),
  },
  { key: 'relocate', test: /relocat/, answer: (c) => fact(yes(c.profile.willingToRelocate)) },
  {
    key: 'sponsorship',
    test: /sponsor/,
    // Your answer holds where you live (or where your profile says you may work) - for a job abroad you are asked
    // (Almedia, 2026-09-30: "No" for India was sent as "No, I am legally entitled to work in Germany").
    answer: (c, f) => (rightToWorkKnown(c, f, true) ? fact(yes(c.profile.needsSponsorship)) : null),
  },
  {
    test: WORK_AUTH_QUESTION,
    // Only claimed when the profile states it, or the job is where you live; otherwise you are asked once.
    answer: (c, f) => (rightToWorkKnown(c, f) ? fact(yes(!c.profile.needsSponsorship)) : null),
  },
  {
    test: /\b(comfortable|okay|ok|willing|able)\b.*\b(office|onsite|on-site|hybrid|in person|commute|work from office|wfo|remote)\b/,
    kinds: [FieldKind.RADIO, FieldKind.SELECT, FieldKind.CHECKBOX],
    answer: () => guess('Yes'),
  },
  {
    test: /\bgender\b|\bsex\b/,
    answer: (c) => (c.profile.gender ? fact(c.profile.gender) : guess('Prefer not to say')),
  },
  { test: /disabilit|veteran|ethnic|race\b|hispanic|latino|sexual orientation|transgender/, answer: () => guess('Prefer not to say') },
  { key: 'dateOfBirth', test: /date\s*of\s*birth|\bdob\b|birth\s*date/, answer: (c) => fact(c.profile.dateOfBirth) },
  {
    key: 'highestQualification',
    test: /highest\s*(level\s*of\s*)?(education|qualification|degree)|education\s*level|qualification/,
    answer: (c) => fact(c.profile.education[0]?.degree),
  },
  {
    key: 'degree',
    test: /^(course|degree)$|\bcourse\s*name\b|\bdegree\s*(name|title)?$|name of (the )?(course|degree)/,
    not: /start|end|year|duration|date|percent|grade/,
    answer: (c) => fact(c.profile.education[0]?.degree),
  },
  {
    key: 'fieldOfStudy',
    test: /branch|speciali[sz]ation|\bmajor\b|field\s*of\s*study|\bstream\b|discipline/,
    not: /year|date|percent|grade/,
    answer: (c) => fact(c.profile.education[0]?.field),
  },
  {
    key: 'institution',
    test: /\b(university|college|institution|school)\b/,
    not: /year|gpa|grade|degree|percent/,
    answer: (c) => fact(c.profile.education[0]?.institution),
  },
  {
    key: 'graduationYear',
    test: /graduat(ion|ed)\s*year|year\s*of\s*(passing|graduation)|passing\s*year|batch/,
    answer: (c) => fact(c.profile.education[0]?.endYear),
  },
  { key: 'grade', test: /\b(cgpa|gpa|percentage|grade)\b/, answer: (c) => fact(c.profile.education[0]?.grade) },
  {
    test: /how did you (hear|find|learn)|source of (application|hire)|where did you (hear|find)/,
    // Where this job was really found, fitted to the form's own choices (a fact, not a guess, once it fits).
    answer: (c, f) => {
      const pick = jobSourceAnswer(c.job.foundOn, f.options);
      return pick === null ? null : f.options.length ? fact(pick) : guess(pick);
    },
  },
  {
    key: 'languages',
    test: /language/,
    not: /programming|coding/,
    kinds: [FieldKind.TEXT, FieldKind.TEXTAREA],
    answer: (c) => fact(c.profile.languages.join(', ')),
  },
];

// Tick consent boxes; leave marketing and "follow company" boxes alone.
function checkboxRule(field: FormField): RuleAnswer | null {
  const q = field.label.toLowerCase();
  if (/follow|newsletter|marketing|promotional|subscribe|updates? (about|from)|job alerts?|sms/.test(q)) return guess(field.value || 'false');
  if (/agree|consent|terms|privacy|acknowledge|certify|confirm|declare|accurate|true and correct|authori[sz]e/.test(q)) return guess('true');
  return null;
}

function skillYearsRule(ctx: AnswerContext, field: FormField): RuleAnswer | null {
  const q = field.label.toLowerCase();
  // "Experience working with databases (PostgreSQL, MySQL...)?" in a short box (LinkedIn's 20 characters, or a
  // number box) asks for years too - "5" was accepted where words were "Invalid input" (AppGreat, 2026-10-01).
  const shortBox = field.kind === FieldKind.NUMBER || (field.maxLength !== null && field.maxLength <= SHORT_ANSWER_MAX);
  const asksYears =
    (/\byears?\b|\byrs?\b|how (long|many)/.test(q) && /experien|worked|work(ing)? with|using|hands[- ]on/.test(q)) ||
    (shortBox && /^(experience|exp\.?)\b|\bexperience (working |developing |building )?(with|in|of)\b/.test(q));
  const asksYesNo =
    [FieldKind.RADIO, FieldKind.SELECT, FieldKind.CHECKBOX].includes(field.kind) &&
    /^(do|have|are|did) you\b|\b(experience|familiar|worked|knowledge|proficien)/.test(q);
  const skills = extractSkills(field.label);
  // "Do you have at least 5 years of Node.js?": yes if your years reach it (4.9 counts as 5).
  const required = REQUIRED_YEARS.exec(q);
  // Only for a yes/no question: "How many years (minimum 3)?" still wants the number.
  if (required && !/how many|how long|number of|no\.? of/.test(q) && /^(do|have|are|did|is)\b|\?\s*$/.test(q)) {
    const need = Number(required[1] ?? required[2]);
    const years = skills.length ? Math.max(...skills.map((s) => ctx.skillYears(s) ?? 0)) : ctx.profile.totalYearsExperience;
    return fact(yes(wholeYears(years) >= need));
  }
  if (!asksYears && !asksYesNo) return null;

  if (asksYears) {
    if (skills.length === 0) {
      // "...work experience with Aruba Wireless?" asks about Aruba, not your whole career (HCLTech, 2026-09-29):
      // a subject that is not a known skill is left to your answers or the AI, which reads your resume.
      if (ABOUT_A_SUBJECT.test(q)) return null;
      if (/total|overall|professional|relevant|work experience|industry/.test(q) || /^how many years of experience/.test(q)) {
        return fact(wholeYears(ctx.profile.totalYearsExperience));
      }
      return null;
    }
    const years = skills.map((s) => ctx.skillYears(s)).filter((y): y is number => y !== null);
    // A skill not in the profile is answered as 0.
    return fact(years.length ? wholeYears(Math.max(...years)) : 0);
  }
  if (skills.length === 0) return null;
  const has = skills.some((s) => ctx.skillYears(s) !== null);
  return fact(yes(has));
}

export function answerFromProfile(ctx: AnswerContext, field: FormField): RuleAnswer | null {
  if (field.kind === FieldKind.CHECKBOX) {
    const skill = skillYearsRule(ctx, field);
    if (skill) return { ...skill, value: skill.value === 'Yes' ? 'true' : 'false' };
    // "Currently working here" next to the current-company fields.
    if (/currently\s*(work|employ)|presently\s*(work|employ)|i\s*(still\s*)?work\s*here|current\s*(job|employer|company)/i.test(field.label)) {
      const current = ctx.profile.experience[0]?.current ?? !!ctx.profile.currentCompany;
      return fact(current ? 'true' : 'false');
    }
    return checkboxRule(field);
  }
  const skill = skillYearsRule(ctx, field);
  if (skill) return skill;
  const q = `${field.label}`.toLowerCase().trim();
  for (const rule of RULES) {
    if (!rule.test.test(q)) continue;
    if (rule.not?.test(q)) continue;
    if (rule.kinds && !rule.kinds.includes(field.kind)) continue;
    const a = rule.answer(ctx, field);
    if (a && a.value !== '') return rule.key ? { ...a, key: rule.key } : a;
    // The matching rule has no data: let memory or the user answer instead of a weaker rule.
    return null;
  }
  return null;
}

/** Which of your details a question asks for, by the rules alone ("Mobile number" -> phone); null if none. */
export function ruleKeyFor(label: string): string | null {
  const q = label.toLowerCase().trim();
  for (const rule of RULES) {
    if (!rule.test.test(q) || rule.not?.test(q)) continue;
    return rule.key ?? null;
  }
  return null;
}

/** The answer for this field as the named detail ("phone"), with its units and format - a learned field uses it. */
export function answerForKey(ctx: AnswerContext, field: FormField, key: string): RuleAnswer | null {
  const rule = RULES.find((r) => r.key === key);
  const a = rule?.answer(ctx, field) ?? null;
  return a && a.value !== '' && a.confident ? { ...a, key } : null;
}

/** Every named detail the rules know. */
export const RULE_KEYS: string[] = [...new Set(RULES.map((r) => r.key).filter((k): k is string => !!k))];
