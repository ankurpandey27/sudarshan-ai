// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { FieldKind } from '../enums/field-kind.enum';
import { AnswerContext, RuleAnswer } from './answer-context.interface';
import { FormField } from './form-field.interface';

export interface ProfileRule {
  test: RegExp;
  not?: RegExp;
  kinds?: FieldKind[];
  answer: (ctx: AnswerContext, field: FormField) => RuleAnswer | null;
}
