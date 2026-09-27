// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import ExcelJS from 'exceljs';
import { ParsedWorkbook } from '../interfaces/workbook-import.interface';

export function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    const v = value as unknown as Record<string, unknown>;
    if (Array.isArray(v.richText)) return (v.richText as { text: string }[]).map((r) => r.text).join('').trim();
    if (typeof v.hyperlink === 'string') return String(v.hyperlink).trim();
    if (typeof v.text === 'string') return v.text.trim();
    if ('result' in v) return String(v.result ?? '').trim();
    return '';
  }
  return String(value).trim();
}

type Kind = 'answers' | 'links' | 'preferences' | null;

function sheetKind(name: string, headers: string[]): Kind {
  const n = name.toLowerCase();
  const h = headers.join(' ').toLowerCase();
  if (/link|url|jobs?\b/.test(n) || /\b(url|link)\b/.test(h)) return 'links';
  if (/pref|setting|search|config/.test(n) || /\b(setting|preference)\b/.test(h)) return 'preferences';
  if (/answer|q ?& ?a|question|screening/.test(n) || (/question/.test(h) && /answer/.test(h))) return 'answers';
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
      const q = col(/question/, 0);
      const a = col(/answer|value|response/, 1);
      for (const r of body) if (r[q] && r[a]) out.answers.push({ question: r[q], answer: r[a] });
    } else if (kind === 'links') {
      const u = headers.findIndex((h) => /url|link/.test(h));
      const t = col(/title|role|position/, -1);
      const c = col(/company|employer/, -1);
      const n = col(/note/, -1);
      for (const r of body) {
        const url = (u >= 0 && hasHeader ? r[u] : r.find((x) => /^https?:\/\//i.test(x))) ?? '';
        if (!url) continue;
        out.links.push({ url, title: t >= 0 ? r[t] : undefined, company: c >= 0 ? r[c] : undefined, notes: n >= 0 ? r[n] : undefined });
      }
    } else {
      const k = col(/setting|preference|key|name/, 0);
      const v = col(/value/, 1);
      for (const r of body) if (r[k]) out.preferences.push({ key: r[k], value: r[v] ?? '' });
    }
  });
  return out;
}
