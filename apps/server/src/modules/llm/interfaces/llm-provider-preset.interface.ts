import { LlmProviderKind } from '../enums/llm-provider-kind.enum';

export interface LlmProviderPreset {
  kind: LlmProviderKind;
  label: string;
  baseUrl: string;
  needsKey: boolean;
  local: boolean;
  keyUrl?: string;
  suggestedModels: string[];
  note?: string;
}
