// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { compressText } from '../../../common/utils/text.util';
import { AnswerContext } from '../interfaces/answer-context.interface';
import { FormField } from '../interfaces/form-field.interface';

export const ANSWER_SYSTEM_PROMPT = `You fill in job application forms on behalf of a candidate.
Answer every question truthfully from the candidate profile. Never invent employers, degrees, certifications, visas or numbers the profile does not support.
If a question needs a fact the profile does not contain and no safe default exists, return an empty value with "confident": false.`;

// Contact details are left out; the model does not need them.
function candidateBlock(ctx: AnswerContext): string {
  const p = ctx.profile;
  const skills = p.skills
    .slice(0, 60)
    .map((s) => (s.years !== null ? `${s.name} (${s.years}y)` : s.name))
    .join(', ');
  const exp = p.experience
    .slice(0, 4)
    .map((e) => `${e.title} at ${e.company} (${e.start || '?'} - ${e.current ? 'present' : e.end || '?'})`)
    .join('; ');
  const edu = p.education
    .slice(0, 2)
    .map((e) => `${e.degree} ${e.field} - ${e.institution} ${e.endYear ?? ''}`.trim())
    .join('; ');
  return [
    `Name: ${p.firstName} ${p.lastName}`,
    `Current: ${p.currentTitle || '-'} at ${p.currentCompany || '-'}; total experience ${p.totalYearsExperience} years`,
    `Location: ${[p.city, p.state, p.country].filter(Boolean).join(', ')}; willing to relocate: ${p.willingToRelocate ? 'yes' : 'no'}`,
    `Notice period: ${p.noticePeriodDays ?? 'unknown'} days; current CTC: ${p.currentCtc ?? 'unknown'} ${p.currency}/yr; expected CTC: ${p.expectedCtc ?? 'unknown'} ${p.currency}/yr`,
    `Needs visa sponsorship: ${p.needsSponsorship ? 'yes' : 'no'}; work authorization: ${p.workAuthorization || 'citizen of ' + (p.country || 'home country')}`,
    `Skills: ${skills || '-'}`,
    `Experience: ${exp || '-'}`,
    `Education: ${edu || '-'}`,
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

Return JSON: {"answers":[{"id":"<id>","value":"<answer>","confident":true|false,"reusable":true|false}]}`;
}
