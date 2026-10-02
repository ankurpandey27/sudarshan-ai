// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

// Runs in the page via page.evaluate: every function must be self-contained.

export function pickTypeaheadOptionInPage(value: string, strict = false): string | null {
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
  // No textual match: the first suggestion is what a user would pick - after typing a search, never in a plain list.
  const best = scored[0];
  if (strict && best.score === 0) return null;
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

/** Resolves once the page has not changed for `quietMs` (or after `maxMs` at the latest). */
export function pageQuietInPage(quietMs: number, maxMs: number): Promise<void> {
  return new Promise<void>((resolve) => {
    let timer: ReturnType<typeof setTimeout>;
    const finish = () => {
      observer.disconnect();
      clearTimeout(timer);
      clearTimeout(cap);
      resolve();
    };
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(finish, quietMs);
    });
    observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
    timer = setTimeout(finish, quietMs);
    const cap = setTimeout(finish, maxMs);
  });
}

/** The options of a dropdown that is open right now (its listbox), minus "No options" / "Loading...". */
export function visibleOptionsInPage(): string[] {
  const seen = new Set<string>();
  for (const el of Array.from(document.querySelectorAll('[role=option], [role=listbox] li, [class*="option"][id*="option"]'))) {
    const r = (el as HTMLElement).getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const t = ((el as HTMLElement).innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
    if (t && t.length <= 200 && !/^(no options|loading\.*|no results( found)?|type to search)$/i.test(t)) seen.add(t);
  }
  return [...seen].slice(0, 300);
}
