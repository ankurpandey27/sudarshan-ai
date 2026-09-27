// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { LlmProviderKind } from '../enums/llm-provider-kind.enum';
import { Completion, CompletionRequest } from './completion.interface';

export interface LlmTransport {
  readonly kind: LlmProviderKind;
  readonly model: string;
  /** Local models are exempt from the token budget. */
  readonly local: boolean;
  complete(request: CompletionRequest): Promise<Completion>;
  listModels(): Promise<string[]>;
}
