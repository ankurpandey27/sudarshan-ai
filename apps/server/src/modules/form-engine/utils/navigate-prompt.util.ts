// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { compressText } from '../../../common/utils/text.util';
import { redactSensitive } from '../../answers/utils/sensitive.util';
import { FormAction } from '../interfaces/form-field.interface';

export const NAVIGATE_SYSTEM_PROMPT =
  'You operate a web browser to submit a job application. Pick the single control that moves the application forward. The page may be in any language (Dutch "Solliciteren", German "Bewerben", Japanese "応募する" all mean Apply): judge by meaning, never by English words alone. Never pick navigation to other jobs, login, or language switches.';

export function buildNavigatePrompt(goal: string, pageText: string, actions: FormAction[]): string {
  return `GOAL: ${goal}

PAGE TEXT (excerpt):
${compressText(redactSensitive(pageText), 1500)}

CLICKABLE CONTROLS:
${JSON.stringify(actions.filter((a) => !a.disabled).map((a) => ({ id: a.id, text: a.text })))}

Choose the control that opens or advances the job application (never "cancel", "close", sign-up for alerts, or social links).
Return JSON: {"id":"<control id or empty>","reason":"<5 words>","applicationDone":true|false}
Set "applicationDone": true only if the page clearly says the application was already submitted.`;
}

export const CONFIRM_SYSTEM_PROMPT =
  'You check a web page right after a job application form was submitted. The page may be in any language. Answer only from what the page says.';

/** Asks whether the page (in any language) confirms that the application was sent. */
export function buildConfirmPrompt(pageText: string): string {
  return `PAGE TEXT (excerpt):
${compressText(redactSensitive(pageText), 1500)}

Does this page confirm that the job application was submitted or received (e.g. "thank you for your application", in any language)?
An error, a missing-field message, a login page or the same form again is not a confirmation.
Return JSON: {"confirmed":true|false}`;
}
