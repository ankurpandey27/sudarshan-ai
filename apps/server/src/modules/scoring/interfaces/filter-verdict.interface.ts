import { SkipRule } from '../enums/skip-rule.enum';

export type FilterVerdict = { outcome: 'PASS' } | { outcome: 'SKIP'; reason: string; rule: SkipRule };
