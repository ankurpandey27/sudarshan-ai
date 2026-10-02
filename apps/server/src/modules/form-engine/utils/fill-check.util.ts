// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { FieldKind } from '../enums/field-kind.enum';
import { FillInstruction } from '../interfaces/fill-instruction.interface';
import { FormField } from '../interfaces/form-field.interface';
import { isPlaceholderOption } from './option-match.util';

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/** The words an instruction meant to put in the field: the chosen option's text, or the value. */
export function intendedText(ins: FillInstruction, field: FormField): string {
  if (ins.optionIndexes.length && field.options.length) {
    return ins.optionIndexes
      .map((i) => field.options[i])
      .filter(Boolean)
      .join(' | ');
  }
  return ins.value;
}

/**
 * Whether the field, read again after filling, holds what was meant: a value that is not empty, not a
 * placeholder ("Select an option"), with no error on it - and for choices, the choice meant.
 */
export function heldAnswer(field: FormField, ins: FillInstruction): boolean {
  if (ins.kind === FieldKind.FILE) return true;
  if (field.error) return false;
  const value = norm(field.value);
  if (ins.kind === FieldKind.CHECKBOX) return value === norm(ins.value);
  if (!value || isPlaceholderOption(field.value)) return false;
  const meant = norm(intendedText(ins, field));
  if (!meant) return true;
  if ([FieldKind.SELECT, FieldKind.RADIO, FieldKind.COMBOBOX].includes(ins.kind)) {
    // Sites reword a pick ("Noida" shows as "Noida, Uttar Pradesh, India").
    return value.includes(meant) || meant.includes(value);
  }
  if (ins.kind === FieldKind.CHECKBOX_GROUP) return meant.split(' | ').every((m) => value.includes(m));
  return true;
}
