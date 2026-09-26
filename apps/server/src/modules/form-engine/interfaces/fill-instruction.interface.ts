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
