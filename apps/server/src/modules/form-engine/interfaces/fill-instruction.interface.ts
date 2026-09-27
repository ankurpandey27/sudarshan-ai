// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { FieldKind } from '../enums/field-kind.enum';

export interface FillInstruction {
  id: string;
  kind: FieldKind;
  value: string;
  optionIndexes: number[];
  optionIds: string[];
}

export interface FillResult {
  id: string;
  ok: boolean;
  error?: string;
}
