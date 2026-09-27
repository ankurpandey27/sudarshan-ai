// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

export interface WorkbookImportResult {
  answers: number;
  links: { added: number; duplicates: number; invalid: string[] };
  preferences: string[];
  warnings: string[];
}

export interface ParsedWorkbook {
  answers: { question: string; answer: string }[];
  links: { url: string; title?: string; company?: string; notes?: string }[];
  preferences: { key: string; value: string }[];
  warnings: string[];
}
