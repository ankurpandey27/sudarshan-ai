// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { SkipRule } from '../enums/skip-rule.enum';

export type FilterVerdict = { outcome: 'PASS' } | { outcome: 'SKIP'; reason: string; rule: SkipRule };
