// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { FormSnapshot } from '../interfaces/form-field.interface';

/**
 * Identifies the kind of step a form is on - the page address without ids plus the buttons it
 * offers - so what worked on it can be reused on the next job at the same site.
 */
export function stepSignature(snap: Pick<FormSnapshot, 'url' | 'actions'>): string {
  let path = '';
  try {
    path = new URL(snap.url).pathname.toLowerCase();
  } catch {
    path = '';
  }
  // Numbers and long ids differ per job; the shape of the address does not.
  path = path.replace(/\/[0-9a-f-]{8,}(?=\/|$)/g, '/#').replace(/\d+/g, '#');
  const buttons = [...new Set(snap.actions.filter((a) => a.kind !== 'dismiss').map((a) => a.text.trim().toLowerCase()))].filter(Boolean).sort().slice(0, 8);
  return `${path}|${buttons.join(',')}`;
}
