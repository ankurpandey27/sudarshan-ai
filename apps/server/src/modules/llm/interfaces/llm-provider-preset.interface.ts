// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

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
