// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { compressText } from '../../../common/utils/text.util';
import { isSensitive, redactSensitive } from '../../answers/utils/sensitive.util';
import { FieldKind } from '../enums/field-kind.enum';
import { FormSnapshot } from '../interfaces/form-field.interface';

export const RESCUE_SYSTEM_PROMPT =
  'You operate a web browser to finish a job application on a site that ordinary automation could not handle. The page may be in any language: judge controls by meaning. You can only press controls and choose options; typed answers are handled elsewhere.';

/**
 * The page as the AI sees it: numbered controls and fields (no values that identify the candidate), a
 * short excerpt of its text with identifiers blanked, and what was tried before - in as few words as
 * the model's limit allows.
 */
export function buildRescuePrompt(snap: FormSnapshot, goal: string, history: string[], size: { items: number; text: number }): string {
  const items: string[] = [];
  for (const f of snap.fields) {
    if (f.kind === FieldKind.FILE) continue;
    const label = (f.label || f.placeholder || f.name || 'unlabelled').slice(0, 80);
    const value = f.value ? (isSensitive(label, f.value) ? ' value=[hidden]' : ` value="${f.value.slice(0, 40)}"`) : ' empty';
    const opts = f.options.length ? ` options=${JSON.stringify(f.options.filter((o) => o.trim()).slice(0, 12))}` : '';
    items.push(`[${f.id}] ${f.kind} "${label}"${f.required ? ' (required)' : ''}${value}${opts}${f.error ? ` error="${f.error.slice(0, 80)}"` : ''}`);
  }
  for (const a of snap.actions) items.push(`[${a.id}] ${a.kind === 'other' ? 'button' : a.kind} "${a.text.slice(0, 60)}"${a.disabled ? ' (disabled)' : ''}`);
  for (const l of snap.links ?? []) items.push(`[${l.id}] link "${l.text.slice(0, 60)}"`);
  return `GOAL: ${goal}
ADDRESS: ${snap.url.split('?')[0]}

PAGE TEXT (excerpt):
${compressText(redactSensitive(snap.text), size.text)}
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
- Choose options only for questions about the application itself (terms, consent, how you heard about the job, yes/no about availability) - never guess personal details.
- If the page already says the application was sent or received, return "done": true. If nothing here can move it forward, return "stuck": true.

Return JSON: {"actions":[...],"done":false,"stuck":false,"why":"<12 words>"}`;
}
