// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

/** The browser is in the middle of an application or search and cannot be restarted now. */
export class BrowserBusyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BrowserBusyError';
  }
}
