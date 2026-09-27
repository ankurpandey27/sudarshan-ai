// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

export enum FieldKind {
  TEXT = 'text',
  TEXTAREA = 'textarea',
  NUMBER = 'number',
  EMAIL = 'email',
  TEL = 'tel',
  URL = 'url',
  DATE = 'date',
  SELECT = 'select',
  RADIO = 'radio',
  CHECKBOX = 'checkbox',
  CHECKBOX_GROUP = 'checkbox-group',
  FILE = 'file',
  /** Autocomplete input: needs real keystrokes and an option pick. */
  COMBOBOX = 'combobox',
}
