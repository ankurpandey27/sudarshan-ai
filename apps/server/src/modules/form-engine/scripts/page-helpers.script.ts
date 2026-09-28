// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

// Runs in the page via page.evaluate: every function must be self-contained.

export function pickTypeaheadOptionInPage(value: string): string | null {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const want = norm(value);
  const opts = Array.from(
    document.querySelectorAll('[role=option], [role=listbox] li, .basic-typeahead__selectable, .autocomplete-item, .pac-item, ul[class*=suggest] li'),
  ).filter((el) => {
    const r = (el as HTMLElement).getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }) as HTMLElement[];
  if (opts.length === 0) return null;
  const scored = opts
    .map((el) => {
      const t = norm(el.innerText || el.textContent || '');
      const score = t === want ? 3 : t.startsWith(want) ? 2 : t.includes(want) ? 1 : want.includes(t) && t.length > 2 ? 0.5 : 0;
      return { el, t, score };
    })
    .sort((a, b) => b.score - a.score);
  // No textual match: the first suggestion is what a user would pick.
  const best = scored[0];
  best.el.scrollIntoView({ block: 'nearest' });
  best.el.click();
  return best.t;
}

export function documentTextInPage(): string {
  return (document.body?.innerText ?? '').replace(/\s+/g, ' ').slice(0, 6000);
}

/** A password box is showing: the site wants you to sign in or create an account. */
export function visiblePasswordInPage(): boolean {
  return Array.from(document.querySelectorAll('input[type=password]')).some((el) => {
    const r = (el as HTMLElement).getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  });
}
