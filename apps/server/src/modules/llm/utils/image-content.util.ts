// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { CompletionImage } from '../interfaces/completion.interface';

/** A user message for OpenAI-style chat APIs: plain text, or text plus images when there are any. */
export function openAiContent(prompt: string, images?: CompletionImage[]): string | { type: string; text?: string; image_url?: { url: string } }[] {
  if (!images?.length) return prompt;
  return [{ type: 'text', text: prompt }, ...images.map((i) => ({ type: 'image_url', image_url: { url: `data:${i.mediaType};base64,${i.data}` } }))];
}
