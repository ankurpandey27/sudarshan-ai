// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { plainToInstance } from 'class-transformer';
import { ValidationError, validateSync } from 'class-validator';

/**
 * Checks \`value\` against a DTO the way the API does, removes every field that fails,
 * and returns why - so data from outside the API (a spreadsheet) obeys the same limits.
 */
export function dropInvalid<T extends object>(dto: new () => T, value: T): string[] {
  const problems: string[] = [];
  const walk = (errors: ValidationError[], target: Record<string, unknown>, path: string) => {
    for (const e of errors) {
      const where = path ? `${path}.${e.property}` : e.property;
      if (e.constraints) {
        problems.push(`${where}: ${Object.values(e.constraints).join('; ')}`);
        delete target[e.property];
      } else if (e.children?.length && target[e.property] && typeof target[e.property] === 'object') {
        walk(e.children, target[e.property] as Record<string, unknown>, where);
      }
    }
  };
  walk(validateSync(plainToInstance(dto, value), { forbidUnknownValues: false }), value as Record<string, unknown>, '');
  return problems;
}
