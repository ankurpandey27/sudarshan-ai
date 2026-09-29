// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

export interface EmbeddingStatus {
  /** off: switched off in Settings. loading: downloading or starting. ready. unavailable: could not start (see reason). */
  state: 'off' | 'loading' | 'ready' | 'unavailable';
  model: string;
  reason: string | null;
}
