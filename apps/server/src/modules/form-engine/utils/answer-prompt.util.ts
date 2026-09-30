// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { compressText } from '../../../common/utils/text.util';
import { AnswerContext } from '../interfaces/answer-context.interface';
import { FormField } from '../interfaces/form-field.interface';

export const ANSWER_SYSTEM_PROMPT = `You fill in job application forms on behalf of a candidate.
Answer every question truthfully from the candidate profile. Never invent employers, degrees, certifications, visas or numbers the profile does not support.
Answer like the candidate would: a person who knows their own history does not need every question worded like their resume. When the profile does not state it but clearly implies it, answer and mark it "inferred"; only when it cannot be worked out, return an empty value with "basis": "unknown".
Forms may be in any language: understand the question in its own language, and write free-text answers in the language the question is asked in (options are always copied exactly as given).`;

// Contact details are left out; the model does not need them.
function candidateBlock(ctx: AnswerContext): string {
  const p = ctx.profile;
  // The same years the rules use: the highest known, rounded (4.9 -> 5).
  const skills = p.skills
    .slice(0, 60)
    .map((s) => {
      const y = ctx.skillYears(s.name);
      return y !== null ? `${s.name} (${Math.round(y)}y)` : s.name;
    })
    .join(', ');
  // Every employer: "Have you ever worked for X?" is answered from this list.
  const exp = p.experience
    .slice(0, 12)
    .map((e) => `${e.title} at ${e.company} (${e.start || '?'} - ${e.current ? 'present' : e.end || '?'})`)
    .join('; ');
  const edu = p.education
    .slice(0, 2)
    .map((e) => `${e.degree} ${e.field} - ${e.institution} ${e.endYear ?? ''}`.trim())
    .join('; ');
  return [
    `Name: ${p.firstName} ${p.lastName}`,
    `Current: ${p.currentTitle || '-'} at ${p.currentCompany || '-'}; total experience ${Math.round(p.totalYearsExperience)} years`,
    `Location: ${[p.city, p.state, p.country].filter(Boolean).join(', ')}; willing to relocate: ${p.willingToRelocate ? 'yes' : 'no'}`,
    `Notice period: ${p.noticePeriodDays ?? 'unknown'} days; current CTC: ${p.currentCtc ?? 'unknown'} ${p.currency}/yr; expected CTC: ${p.expectedCtc ?? 'unknown'} ${p.currency}/yr`,
    `Needs visa sponsorship: ${p.needsSponsorship ? 'yes' : 'no'}; work authorization: ${p.workAuthorization || (p.country ? `not stated - lives in ${p.country}; never claim the right to work in any other country` : 'not stated - never claim any')}`,
    `Skills: ${skills || '-'}`,
    `Experience: ${exp || '-'}`,
    `Education: ${edu || '-'}`,
    `Languages: ${p.languages?.length ? p.languages.join(', ') : 'not listed (the resume and profile are in English)'}`,
    p.summary ? `Summary: ${compressText(p.summary, 400)}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildAnswerPrompt(ctx: AnswerContext, fields: FormField[], hints: Map<string, string>): string {
  const questions = fields.map((f) => ({
    id: f.id,
    question: f.label || f.placeholder || f.name,
    type: f.kind,
    ...(f.options.length ? { options: f.options.filter((o) => o.trim()).slice(0, 40) } : {}),
    required: f.required,
    ...(f.maxLength ? { maxLength: f.maxLength } : {}),
    ...(f.error ? { previousError: f.error } : {}),
    ...(hints.get(f.id) ? { hint: hints.get(f.id) } : {}),
  }));
  return `CANDIDATE
${candidateBlock(ctx)}

JOB
${ctx.job.title} at ${ctx.job.company} (${ctx.job.location || 'location n/a'})
${compressText(ctx.job.description, 700)}

QUESTIONS
${JSON.stringify(questions)}

RULES
- For questions with "options", "value" must be copied exactly from the options list. For type "checkbox-group" return the chosen options joined with " | ".
- For type "number" return digits only. Years of experience are whole numbers.
- For type "checkbox" return "true" or "false".
- Yes/No about a skill or tool: "Yes" only if the profile lists it (or a clear equivalent).
- Motivation / cover letter / "about you" questions: 2-4 specific sentences in first person using real facts from the profile and the job. Mark these "reusable": false.
- "reusable": true when the answer would be the same for any job (salary, notice, skills, relocation...).
- If "previousError" is present, fix the value so it satisfies that error.
- "hint" may list the candidate's own answers to similar questions, found by meaning. Use one only when it answers THIS exact question - the same thing, the same person, the same time: "current" is not "expected" (CTC, salary, location), 10th is not 12th, one skill's years are not another's, a permanent address is not a local one. Convert units and formats as the question asks (12 LPA = 1200000 per year; 30 days = 1 month). When none truly answers it, ignore them all.
- "basis": "fact" when the profile states it; "inferred" when it follows from the profile with little room for doubt; "unknown" (value "") when it cannot be worked out.
- Low-stakes questions may be inferred. Examples:
  - "Have you worked for <this company> / its group / as its employee or at its customer site before?": "No" unless the employers above include it.
  - "Relatives working here?", "Health concerns?", "Graduate of <company's own program>?", "Government employee in the past 5 years?": "No" unless the profile says otherwise.
  - "Willing to take a drug test / background check?", "Open to negotiation?", "Comfortable with hybrid/onsite in <a place the candidate lives or will relocate to>?": "Yes".
  - "Phone type": "Mobile".
  - English level: professional/fluent (the candidate works in English) - the highest level short of native. A language not listed: the lowest option ("None", "Niet", "Não", "Basic").
  - Years with a tool or skill not listed: the years of the closest listed one it is part of (AWS Lambda -> AWS; Micro Frontends -> React), else 0. Never more than total experience.
  - Written questions about the candidate's work ("describe a workflow you automated", "largest team you changed"): 3-5 honest first-person sentences built only from the profile's real roles, skills and summary - no invented numbers, names or employers. Mark "reusable": false.
- High-stakes questions are never inferred - salary or pay, notice period, joining or start dates, relocation, visa, work permit or citizenship, legal or signed declarations, ID or bank numbers, date of birth. Answer them only from a stated fact, else "basis": "unknown".
- Referrer names, other offers and personal data not listed: never made up - "basis": "unknown".
- "required": false questions: answered the same way; one that stays "unknown" is left blank.

Return JSON: {"answers":[{"id":"<id>","value":"<answer>","basis":"fact"|"inferred"|"unknown","reusable":true|false}]}`;
}
