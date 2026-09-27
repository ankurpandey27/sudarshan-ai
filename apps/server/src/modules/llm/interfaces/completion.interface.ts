// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

export interface CompletionRequest {
  system?: string;
  prompt: string;
  maxTokens: number;
  json?: boolean;
}

export interface Completion {
  text: string;
  promptTokens: number;
  completionTokens: number;
}
