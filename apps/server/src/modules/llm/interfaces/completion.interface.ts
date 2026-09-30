// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

export interface CompletionRequest {
  system?: string;
  prompt: string;
  maxTokens: number;
  json?: boolean;
  /** Screenshots for models that accept images; a model that does not is told so by its provider's error. */
  images?: CompletionImage[];
}

export interface CompletionImage {
  mediaType: 'image/jpeg' | 'image/png';
  /** The image, base64-encoded. */
  data: string;
}

export interface Completion {
  text: string;
  promptTokens: number;
  completionTokens: number;
}
