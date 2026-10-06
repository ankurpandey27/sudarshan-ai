// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

// Runs in the page via page.evaluate: every function must be self-contained.

/**
 * The suggestion that matches `value`, picked. With `markOnly` it is only marked (data-jaa-pick) for a real mouse
 * click: Lever ignores a script's click on its location list (HighLevel, 2026-10-05).
 */
export function pickTypeaheadOptionInPage(value: string, strict = false, markOnly = false): string | null {
  for (const old of Array.from(document.querySelectorAll('[data-jaa-pick]'))) old.removeAttribute('data-jaa-pick');
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const want = norm(value);
  const opts = Array.from(
    // Lever's location list is plain divs: .dropdown-results > .dropdown-location (HighLevel, 2026-10-05).
    document.querySelectorAll(
      '[role=option], [role=listbox] li, .basic-typeahead__selectable, .autocomplete-item, .pac-item, ul[class*=suggest] li, .dropdown-results > div, .dropdown-location, [class*="suggestion-item"], [class*="autocomplete"] li',
    ),
  ).filter((el) => {
    const rect = (el as HTMLElement).getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }) as HTMLElement[];
  if (opts.length === 0) return null;
  const scored = opts
    .map((el) => {
      const text = norm(el.innerText || el.textContent || '');
      const score = text === want ? 3 : text.startsWith(want) ? 2 : text.includes(want) ? 1 : want.includes(text) && text.length > 2 ? 0.5 : 0;
      return { el, t: text, score };
    })
    .sort((a, b) => b.score - a.score);
  // No textual match: the first suggestion, only where the caller allows it (strict: never - it was a wrong school).
  const best = scored[0];
  if (strict && best.score === 0) return null;
  best.el.scrollIntoView({ block: 'nearest' });
  if (markOnly) best.el.setAttribute('data-jaa-pick', '1');
  else best.el.click();
  return best.t;
}

export function documentTextInPage(): string {
  return (document.body?.innerText ?? '').replace(/\s+/g, ' ').slice(0, 6000);
}

/** A password box is showing: the site wants you to sign in or create an account. */
export function visiblePasswordInPage(): boolean {
  return Array.from(document.querySelectorAll('input[type=password]')).some((el) => {
    const rect = (el as HTMLElement).getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && getComputedStyle(el).visibility !== 'hidden';
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
  for (const el of Array.from(document.querySelectorAll('[role=option], [role=listbox] li, [class*="option"][id*="option"], .dropdown-results > div, .dropdown-location'))) {
    const rect = (el as HTMLElement).getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    const text = ((el as HTMLElement).innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
    if (text && text.length <= 200 && !/^(no options|loading\.*|no results( found)?|type to search)$/i.test(text)) seen.add(text);
  }
  return [...seen].slice(0, 300);
}
