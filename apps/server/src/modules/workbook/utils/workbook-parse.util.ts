// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import ExcelJS from 'exceljs';
import { ParsedWorkbook } from '../interfaces/workbook-import.interface';

export function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    const cell = value as unknown as Record<string, unknown>;
    if (Array.isArray(cell.richText)) return (cell.richText as { text: string }[]).map((r) => r.text).join('').trim();
    if (typeof cell.hyperlink === 'string') return String(cell.hyperlink).trim();
    if (typeof cell.text === 'string') return cell.text.trim();
    if ('result' in cell) return String(cell.result ?? '').trim();
    return '';
  }
  return String(value).trim();
}

type Kind = 'answers' | 'links' | 'preferences' | null;

function sheetKind(name: string, headers: string[]): Kind {
  const n = name.toLowerCase();
  const header = headers.join(' ').toLowerCase();
  if (/link|url|jobs?\b/.test(n) || /\b(url|link)\b/.test(header)) return 'links';
  if (/pref|setting|search|config/.test(n) || /\b(setting|preference)\b/.test(header)) return 'preferences';
  if (/answer|q ?& ?a|question|screening/.test(n) || (/question/.test(header) && /answer/.test(header))) return 'answers';
  return null;
}

// Sheets are recognised by name or by their header row, so users can bring their own layout.
export function parseWorkbook(wb: ExcelJS.Workbook): ParsedWorkbook {
  const out: ParsedWorkbook = { answers: [], links: [], preferences: [], warnings: [] };
  wb.eachSheet((sheet) => {
    const rows: string[][] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const values = (row.values as ExcelJS.CellValue[]).slice(1).map(cellText);
      if (values.some(Boolean)) rows.push(values);
    });
    if (rows.length === 0) return;
    const headers = rows[0].map((h) => h.toLowerCase());
    let kind = sheetKind(sheet.name, headers);
    // A one-sheet CSV with URLs in it is a links list.
    if (!kind && rows.some((r) => r.some((c) => /^https?:\/\//i.test(c)))) kind = 'links';
    if (!kind) {
      out.warnings.push(`Sheet "${sheet.name}" was not recognised - name it Answers, Job Links or Preferences`);
      return;
    }
    const hasHeader = headers.some((h) => /question|answer|url|link|title|company|setting|value|notes?/.test(h));
    const body = hasHeader ? rows.slice(1) : rows;
    const col = (re: RegExp, fallback: number) => {
      const i = headers.findIndex((h) => re.test(h));
      return hasHeader && i >= 0 ? i : fallback;
    };
    if (kind === 'answers') {
      const questionCol = col(/question/, 0);
      const answerCol = col(/answer|value|response/, 1);
      for (const answerRow of body) if (answerRow[questionCol] && answerRow[answerCol]) out.answers.push({ question: answerRow[questionCol], answer: answerRow[answerCol] });
    } else if (kind === 'links') {
      const urlCol = headers.findIndex((h) => /url|link/.test(h));
      const titleCol = col(/title|role|position/, -1);
      const companyCol = col(/company|employer/, -1);
      const n = col(/note/, -1);
      for (const linkRow of body) {
        const url = (urlCol >= 0 && hasHeader ? linkRow[urlCol] : linkRow.find((x) => /^https?:\/\//i.test(x))) ?? '';
        if (!url) continue;
        out.links.push({ url, title: titleCol >= 0 ? linkRow[titleCol] : undefined, company: companyCol >= 0 ? linkRow[companyCol] : undefined, notes: n >= 0 ? linkRow[n] : undefined });
      }
    } else {
      const k = col(/setting|preference|key|name/, 0);
      const valueCol = col(/value/, 1);
      for (const preferenceRow of body) if (preferenceRow[k]) out.preferences.push({ key: preferenceRow[k], value: preferenceRow[valueCol] ?? '' });
    }
  });
  return out;
}
