// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { compressText } from '../../../common/utils/text.util';
import { FormAction } from '../interfaces/form-field.interface';

export const NAVIGATE_SYSTEM_PROMPT =
  'You operate a web browser to submit a job application. Pick the single control that moves the application forward.';

export function buildNavigatePrompt(goal: string, pageText: string, actions: FormAction[]): string {
  return `GOAL: ${goal}

PAGE TEXT (excerpt):
${compressText(pageText, 1500)}

CLICKABLE CONTROLS:
${JSON.stringify(actions.filter((a) => !a.disabled).map((a) => ({ id: a.id, text: a.text })))}

Choose the control that opens or advances the job application (never "cancel", "close", sign-up for alerts, or social links).
Return JSON: {"id":"<control id or empty>","reason":"<5 words>","applicationDone":true|false}
Set "applicationDone": true only if the page clearly says the application was already submitted.`;
}
