// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

/** Questions whose answer identifies you or reaches you. */
export const SENSITIVE_QUESTION =
  /\b(phone|mobile|contact (no|number)|whatsapp|telephone|e-?mail|address|pin ?code|zip|postal|date of birth|\bdob\b|birth ?date|aadh?aa?r|\bpan\b|passport|\buan\b|pf (number|account)|bank|account number|ifsc|social security|\bssn\b|national id|voter|driving licen[cs]e|password|otp)\b/;

/** Answers that look like an identifier, whatever the question said. */
export const SENSITIVE_VALUE: RegExp[] = [
  // PAN: five letters, four digits, a letter.
  /\b[A-Z]{5}\d{4}[A-Z]\b/,
  // Aadhaar: 12 digits, maybe in groups of four.
  /\b\d{4}\s?\d{4}\s?\d{4}\b/,
  /[^\s@]+@[^\s@]+\.[a-z]{2,}/i,
  // A phone number: 10 or more digits, maybe with a country code, spaces or dashes - not a year range ("2018 - 2022").
  /\+?(?:\d[\s-]?){9,}\d/,
  // A full date (of birth, for instance): 15/03/1995, 1995-03-15, 15 Mar 1995.
  /\b\d{1,2}[/.-]\d{1,2}[/.-](\d{2}|\d{4})\b|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4}\b/i,
];
