// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

export interface LlmUsagePeriod {
  calls: number;
  failedCalls: number;
  promptTokens: number;
  completionTokens: number;
  tokens: number;
}
