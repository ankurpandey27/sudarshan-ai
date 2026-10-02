// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

/** What you did to a field, as the recorder sees it. */
export enum FillOp {
  /** Clicked the field itself (opening it). */
  CLICK = 'click',
  /** Typed into it. */
  TYPE = 'type',
  /** Pressed Enter in it. */
  ENTER = 'enter',
  /** Clicked an option in the list it opened. */
  OPTION = 'option',
  /** Clicked one of its choices by its words (a custom radio, a chip). */
  CHOICE = 'choice',
}
