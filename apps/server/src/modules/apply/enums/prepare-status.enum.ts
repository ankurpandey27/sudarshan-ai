// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

export enum PrepareStatus {
  READY = 'ready',
  /** One-click apply: the site confirmed the application right after "Apply". */
  APPLIED = 'applied',
  ALREADY_APPLIED = 'already_applied',
  EXTERNAL = 'external',
  CLOSED = 'closed',
  LOGIN_REQUIRED = 'login_required',
  CAPTCHA = 'captcha',
  NO_APPLY_BUTTON = 'no_apply_button',
  /** The site refused the application for now ("please try again later") - too many too fast. */
  REFUSED = 'refused',
}
