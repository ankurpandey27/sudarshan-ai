// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { LlmPurpose } from '../enums/llm-purpose.enum';
import { CompletionImage } from './completion.interface';

export interface LlmCallOptions {
  purpose: LlmPurpose;
  system?: string;
  maxTokens?: number;
  /** Screenshots to show, when the model accepts images (found out by trying, remembered per model). */
  images?: CompletionImage[];
}
