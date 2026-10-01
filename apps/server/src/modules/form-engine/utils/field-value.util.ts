// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { FieldKind } from '../enums/field-kind.enum';
import { FillInstruction } from '../interfaces/fill-instruction.interface';
import { FormField } from '../interfaces/form-field.interface';
import { matchOption } from './option-match.util';

// null when the answer does not fit the field (e.g. no option matches).
export function toInstruction(field: FormField, raw: string): FillInstruction | null {
  const value = (raw ?? '').trim();
  const base = { id: field.id, kind: field.kind, value, optionIndexes: [] as number[], optionIds: [] as string[] };
  switch (field.kind) {
    case FieldKind.SELECT: {
      const i = matchOption(value, field.options);
      return i >= 0 ? { ...base, optionIndexes: [i] } : null;
    }
    case FieldKind.RADIO: {
      const i = matchOption(value, field.options);
      return i >= 0 && field.optionIds[i] ? { ...base, optionIndexes: [i], optionIds: [field.optionIds[i]] } : null;
    }
    case FieldKind.CHECKBOX_GROUP: {
      const picks = value
        .split(/\s*[|;]\s*|\s*,\s*(?=[A-Z])/)
        .map((v) => matchOption(v, field.options))
        .filter((i) => i >= 0);
      const unique = [...new Set(picks)];
      return unique.length ? { ...base, optionIndexes: unique, optionIds: unique.map((i) => field.optionIds[i]).filter(Boolean) } : null;
    }
    case FieldKind.CHECKBOX: {
      const on = /^(true|yes|y|1|checked|agree)$/i.test(value);
      return { ...base, value: on ? 'true' : 'false' };
    }
    case FieldKind.NUMBER: {
      const n = /-?\d+(?:\.\d+)?/.exec(value.replace(/,/g, ''))?.[0];
      if (n === undefined) return null;
      const num = Number(n);
      const clamped = Math.min(field.max !== null ? Number(field.max) : Infinity, Math.max(field.min !== null ? Number(field.min) : -Infinity, num));
      return { ...base, value: String(clamped) };
    }
    case FieldKind.TEL: {
      const digits = value.replace(/[^\d+]/g, '');
      return digits ? { ...base, value: digits } : null;
    }
    case FieldKind.FILE:
      return value ? base : null;
    case FieldKind.COMBOBOX: {
      if (!value) return null;
      // Options known (read by opening it): one of them, word for word, or nothing - text that is no option fills nothing.
      if (field.options.length) {
        const i = matchOption(value, field.options);
        return i >= 0 ? { ...base, value: field.options[i] } : null;
      }
      return base;
    }
    default: {
      if (!value) return null;
      const text = field.maxLength ? value.slice(0, field.maxLength) : value;
      return { ...base, value: text };
    }
  }
}

export function needsAnswer(field: FormField): boolean {
  if (field.error) return true;
  if (field.kind === FieldKind.CHECKBOX) return field.required && field.value !== 'true';
  return field.value.trim() === '';
}
