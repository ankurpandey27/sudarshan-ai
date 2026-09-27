// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { FieldKind } from '../enums/field-kind.enum';

export interface FormField {
  /** For radio and checkbox groups, the id of the group container. */
  id: string;
  kind: FieldKind;
  label: string;
  name: string;
  placeholder: string;
  required: boolean;
  /** For groups, the checked option labels joined with " | ". */
  value: string;
  options: string[];
  /** Parallel to `options`. */
  optionIds: string[];
  error: string;
  maxLength: number | null;
  min: string | null;
  max: string | null;
  accept: string | null;
}

export interface FormAction {
  id: string;
  text: string;
  kind: 'submit' | 'review' | 'next' | 'apply' | 'dismiss' | 'other';
  disabled: boolean;
}

export interface FormSnapshot {
  url: string;
  scopeFound: boolean;
  fields: FormField[];
  actions: FormAction[];
  text: string;
  errors: string[];
  captcha: boolean;
}
