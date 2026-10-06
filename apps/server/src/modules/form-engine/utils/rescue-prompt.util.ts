// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { compressText } from '../../../common/utils/text.util';
import { isSensitive, redactSensitive } from '../../answers/utils/sensitive.util';
import { FieldKind } from '../enums/field-kind.enum';
import { FormSnapshot } from '../interfaces/form-field.interface';
import { UNTRUSTED_RULE, untrusted } from '../../llm/utils/untrusted.util';

export const RESCUE_SYSTEM_PROMPT =
  'You operate a web browser to finish a job application on a site that ordinary automation could not handle. The page may be in any language: judge controls by meaning. You can only press controls and choose options; typed answers are handled elsewhere. ' +
  UNTRUSTED_RULE;

/**
 * The page as the AI sees it: numbered controls and fields (no values that identify the candidate), a
 * short excerpt of its text with identifiers blanked, and what was tried before - in as few words as
 * the model's limit allows.
 */
export function buildRescuePrompt(snap: FormSnapshot, goal: string, history: string[], size: { items: number; text: number }): string {
  const items: string[] = [];
  for (const field of snap.fields) {
    if (field.kind === FieldKind.FILE) {
      // Upload fields: whether a file is there, never its name.
      items.push(
        `[${field.id}] file "${(field.label || field.name || 'upload').slice(0, 80)}"${field.required ? ' (required)' : ''}${field.value ? ' has a file' : ' empty'}${field.error ? ` error="${field.error.slice(0, 80)}"` : ''}`,
      );
      continue;
    }
    const label = (field.label || field.placeholder || field.name || 'unlabelled').slice(0, 80);
    const value = field.value ? (isSensitive(label, field.value) ? ' value=[hidden]' : ` value="${field.value.slice(0, 40)}"`) : ' empty';
    const opts = field.options.length ? ` options=${JSON.stringify(field.options.filter((o) => o.trim()).slice(0, 12))}` : '';
    items.push(`[${field.id}] ${field.kind} "${label}"${field.required ? ' (required)' : ''}${value}${opts}${field.error ? ` error="${field.error.slice(0, 80)}"` : ''}`);
  }
  for (const action of snap.actions) items.push(`[${action.id}] ${action.kind === 'other' ? 'button' : action.kind} "${action.text.slice(0, 60)}"${action.disabled ? ' (disabled)' : ''}`);
  for (const link of snap.links ?? []) items.push(`[${link.id}] link "${link.text.slice(0, 60)}"`);
  return `GOAL: ${goal}
ADDRESS: ${snap.url.split('?')[0]}

PAGE TEXT (excerpt):
${untrusted('page text', compressText(redactSensitive(snap.text), size.text))}
${snap.errors.length ? `\nERRORS SHOWN: ${snap.errors.slice(0, 3).join(' | ')}\n` : ''}
CONTROLS AND FIELDS:
${items.slice(0, size.items).join('\n')}

TRIED SO FAR:
${history.length ? history.slice(-6).join('\n') : '(nothing yet)'}

RULES
- Up to 5 actions, done in order. {"click":"<id>"} presses a control or link; add "submits":true when that press sends the application. {"choose":"<field id>","option":"<one of its options, copied exactly>"} picks an option.
- Move the application forward: open the application form, go to the next step, accept required terms, then submit.
- Never press anything that cancels, withdraws, deletes, logs out, saves for later, or leaves the application; never social links or other jobs.
- Never touch password, one-time code or captcha controls. If a captcha or a login stands in the way, return "stuck".
- {"upload":"<file field id>"} attaches the candidate's resume to a file field that asks for a resume/CV.
- Choose options only for questions about the application itself (terms, consent, how you heard about the job) - never personal details, and never visa, work permit, sponsorship, citizenship, salary, notice period, start date or relocation: leave those alone.
- If the page already says the application was sent or received, return "done": true. If nothing here can move it forward, return "stuck": true.

Return JSON: {"actions":[...],"done":false,"stuck":false,"why":"<12 words>"}`;
}
