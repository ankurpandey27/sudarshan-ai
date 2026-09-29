// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

/**
 * A button pressed on the way through an application. Held until the application ends: kept as a
 * good move only if the site confirms the application, blamed if it led into a dead end.
 */
export interface LearnedMove {
  /** The site it was pressed on, e.g. "smartapply.indeed.com". */
  domain: string;
  /** "apply" opens the application form; "advance" moves a form to its next step. */
  kind: 'apply' | 'advance';
  /** The kind of step it was pressed on (see stepSignature); null while opening the form. */
  signature: string | null;
  text: string;
  /** Who chose it: the built-in rules, the AI navigator, or you finishing the form by hand. */
  by: 'rules' | 'ai' | 'you';
}
