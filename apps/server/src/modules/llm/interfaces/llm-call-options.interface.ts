// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { LlmPurpose } from '../enums/llm-purpose.enum';

export interface LlmCallOptions {
  purpose: LlmPurpose;
  system?: string;
  maxTokens?: number;
}
