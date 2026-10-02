// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { FillMethod } from '../../form-engine/enums/fill-method.enum';
import { FillOp } from '../enums/fill-op.enum';

/**
 * The way you operated a field, from what you did to it in order: opened it and clicked an option, typed and
 * picked a suggestion, typed and pressed Enter, clicked a choice's words, or just typed. Null: nothing to learn.
 */
export function fillWayFromOps(ops: FillOp[]): FillMethod | null {
  const option = ops.lastIndexOf(FillOp.OPTION);
  if (option >= 0) return ops.slice(0, option).includes(FillOp.TYPE) ? FillMethod.TYPE_PICK : FillMethod.OPEN_PICK;
  if (ops.includes(FillOp.TYPE) && ops.includes(FillOp.ENTER)) return FillMethod.TYPE_ENTER;
  if (ops.includes(FillOp.CHOICE)) return FillMethod.LABEL_CLICK;
  if (ops.includes(FillOp.TYPE)) return FillMethod.KEYS;
  return null;
}

/**
 * A widget a site built itself (a button that opens a list, a searchable dropdown, chips) - the kind the usual
 * filling can miss. A plain text box, select, or group of real radios or checkboxes works the usual way; there is nothing to learn.
 */
export function isCustomWidget(signature: string): boolean {
  const [tag = '', role = '', , popup = '', autocomplete = '', words = ''] = signature.split('|');
  return !!(role || popup || autocomplete || words) || !['input', 'select', 'textarea', 'fieldset', ''].includes(tag);
}

/** The field shows an answer - not empty, not still asking you to pick one. */
export const showsAnswer = (value: string): boolean => {
  const v = value.trim();
  return v !== '' && !/^(select|choose|pick|--|please select)\b/i.test(v);
};
