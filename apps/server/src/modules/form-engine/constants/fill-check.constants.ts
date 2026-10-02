// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { FieldKind } from '../enums/field-kind.enum';
import { FillMethod } from '../enums/fill-method.enum';

/** The ways tried, in order, when a field of this kind did not take its answer. */
export const METHODS_BY_KIND: Partial<Record<FieldKind, FillMethod[]>> = {
  [FieldKind.COMBOBOX]: [FillMethod.OPEN_PICK, FillMethod.TYPE_PICK, FillMethod.TYPE_ENTER, FillMethod.LABEL_CLICK],
  [FieldKind.SELECT]: [FillMethod.OPEN_PICK, FillMethod.LABEL_CLICK, FillMethod.TYPE_PICK],
  [FieldKind.RADIO]: [FillMethod.LABEL_CLICK, FillMethod.OPEN_PICK],
  [FieldKind.CHECKBOX_GROUP]: [FillMethod.LABEL_CLICK],
  [FieldKind.CHECKBOX]: [FillMethod.LABEL_CLICK],
};

/** For text-like fields. */
export const TEXT_METHODS = [FillMethod.KEYS, FillMethod.TYPE_PICK, FillMethod.TYPE_ENTER];

/** Fields per step given the recovery ladder, at most (the rest are reported). */
export const MAX_RECOVERED_FIELDS = 8;

/** A method learned on other sites is trusted for a new one once it worked this many times more than it failed. */
export const GLOBAL_RECIPE_MARGIN = 2;
