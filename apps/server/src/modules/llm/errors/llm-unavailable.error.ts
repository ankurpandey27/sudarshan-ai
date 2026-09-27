// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

export class LlmUnavailableError extends Error {
  constructor(message = 'No AI model configured - add one in Settings') {
    super(message);
    this.name = 'LlmUnavailableError';
  }
}
