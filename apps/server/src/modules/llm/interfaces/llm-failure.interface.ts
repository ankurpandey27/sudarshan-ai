// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

export interface LlmFailure {
  kind: 'auth' | 'quota' | 'other';
  provider: string;
  model: string;
  message: string;
  at: string;
}
