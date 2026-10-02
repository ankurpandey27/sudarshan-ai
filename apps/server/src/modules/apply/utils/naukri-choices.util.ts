// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { FieldKind } from '../../form-engine/enums/field-kind.enum';
import { FillInstruction } from '../../form-engine/interfaces/fill-instruction.interface';
import { FormField } from '../../form-engine/interfaces/form-field.interface';
import { NONE_CHOICE } from '../constants/naukri-choices.constants';

/**
 * Naukri's chat asks some questions with a checkbox per choice ("React JS", "Angular", "Vue JS", "NO").
 * Each box alone is no question: they are one multi-select question with those choices.
 */
export function asChoiceQuestion(boxes: FormField[], question: string): FormField {
  return {
    ...boxes[0],
    kind: FieldKind.CHECKBOX_GROUP,
    label: question,
    options: boxes.map((b) => b.label),
    optionIds: boxes.map((b) => b.id),
    required: true,
    value: '',
  };
}

/**
 * The boxes to tick for a chosen answer: "NO" / "None" is never ticked together with real choices
 * (2026-10-01: "React JS, Angular, Vue JS, NO" and "Yes, NO" were sent).
 */
export function boxesToTick(group: FillInstruction, boxes: FormField[]): FillInstruction[] {
  const picked = [...new Set(group.optionIndexes)].filter((i) => boxes[i]);
  const real = picked.filter((i) => !NONE_CHOICE.test(boxes[i].label.trim()));
  const keep = real.length ? real : picked.slice(0, 1);
  return keep.map((i) => ({ id: boxes[i].id, kind: FieldKind.CHECKBOX, value: 'true', optionIndexes: [], optionIds: [] }));
}
