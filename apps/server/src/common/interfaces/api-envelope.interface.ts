// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

export interface ApiErrorDetail {
  code: string;
  message: string | string[];
  details?: unknown;
}

export interface ApiEnvelope {
  success: boolean;
  message: string;
  messageCode: number;
  data: unknown;
  error: ApiErrorDetail | null;
  path: string;
  requestId: string;
  timestamp: string;
}
