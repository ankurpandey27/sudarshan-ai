// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

// Run in the page via page.evaluate: self-contained, no outer references.

/**
 * What kind of widget each field is, in a few stable words: its tag, role, type and popup, plus class
 * words that name a widget ("select", "combo", "dropdown"...). The same widget on any site reads the same,
 * so what was learned operating it applies everywhere it appears.
 */
export function widgetSignaturesInPage(ids: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const id of ids) {
    const el = document.querySelector(`[data-jaa-id="${id}"]`);
    if (!el) continue;
    const words = (String((el as HTMLElement).className || '') + ' ' + String((el.parentElement as HTMLElement | null)?.className || ''))
      .toLowerCase()
      .match(/select|combo|dropdown|autocomplete|typeahead|chip|picker|listbox|radio|checkbox|toggle/g);
    out[id] = [
      el.tagName.toLowerCase(),
      el.getAttribute('role') ?? '',
      (el as HTMLInputElement).type ?? '',
      el.getAttribute('aria-haspopup') ?? '',
      el.getAttribute('aria-autocomplete') ?? '',
      [...new Set(words ?? [])].sort().join('+'),
    ].join('|');
  }
  return out;
}

/**
 * Clicks a choice by its own words, near the field: a custom radio, a chip, a checkbox list, an open
 * dropdown's option. Only inside the field's own box (never a button elsewhere on the page). True if clicked.
 */
export function clickChoiceNearFieldInPage(id: string, text: string): boolean {
  const el = document.querySelector(`[data-jaa-id="${id}"]`);
  if (!el) return false;
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const want = norm(text);
  if (!want) return false;
  const visible = (e: Element) => {
    const rect = (e as HTMLElement).getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };
  // The field's box: up to the nearest ancestor that holds other fields too.
  let box: Element = el;
  for (let n = el.parentElement, depth = 0; n && depth < 5; n = n.parentElement, depth++) {
    // Never into another field's area: a "Yes" there belongs to another question.
    if (Array.from(n.querySelectorAll('[data-jaa-id]')).some((x) => x !== el && !el.contains(x) && !x.contains(el))) break;
    box = n;
  }
  const scopes = [box, ...Array.from(document.querySelectorAll('[role=listbox]')).filter(visible)];
  for (const scope of scopes) {
    const candidates = Array.from(scope.querySelectorAll('label, [role=option], [role=radio], [role=checkbox], li, button, span, div')).filter(
      (c) => visible(c) && c.children.length <= 3,
    );
    const hit =
      candidates.find((c) => norm((c as HTMLElement).innerText || '') === want) ??
      candidates.find((c) => norm((c as HTMLElement).innerText || '').startsWith(want));
    if (hit) {
      (hit as HTMLElement).click();
      return true;
    }
  }
  return false;
}

/** The field's code, briefly, for the AI to see how it is built (values and long text left out). */
export function fieldHtmlInPage(id: string): string {
  const el = document.querySelector(`[data-jaa-id="${id}"]`);
  if (!el) return '';
  const box = el.parentElement?.parentElement ?? el.parentElement ?? el;
  const copy = box.cloneNode(true) as HTMLElement;
  copy.querySelectorAll('script, style, svg, img').forEach((n) => n.remove());
  copy.querySelectorAll('input').forEach((n) => n.removeAttribute('value'));
  return copy.outerHTML.replace(/\s+/g, ' ').slice(0, 1800);
}
