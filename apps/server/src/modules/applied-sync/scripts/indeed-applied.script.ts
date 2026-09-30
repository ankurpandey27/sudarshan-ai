// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

// Runs in the page via page.evaluate: self-contained, no outer references.

/**
 * Indeed's job keys (the 16-character "jk") of the applications listed on My jobs -> Applied. A key
 * counts only if its own card says "Applied ... on Indeed": recommended or saved jobs on the same
 * page are never taken for applications.
 */
export function indeedAppliedKeysInPage(): { keys: string[]; cards: number } {
  const APPLIED = /\bapplied\b[^\n]{0,60}\bon indeed\b/i;
  const keyOf = (el: Element): string | null => {
    const attr = el.getAttribute('data-jk') ?? el.getAttribute('data-jobkey');
    if (attr && /^[a-f0-9]{16}$/i.test(attr)) return attr.toLowerCase();
    const href = el instanceof HTMLAnchorElement ? el.href : '';
    const m = /[?&](?:jk|vjk)=([a-f0-9]{16})\b/i.exec(href);
    return m ? m[1].toLowerCase() : null;
  };
  const carriers = Array.from(document.querySelectorAll('a[href], [data-jk], [data-jobkey]')).filter((el) => keyOf(el));
  const keys = new Set<string>();
  let cards = 0;
  for (const el of carriers) {
    const key = keyOf(el)!;
    // The smallest box around this link (or the card itself, when it carries the key) that holds no other job: its card.
    let box: Element | null = el;
    for (let depth = 0; box && depth < 9; depth++, box = box.parentElement) {
      const others = Array.from(box.querySelectorAll('a[href], [data-jk], [data-jobkey]')).some((o) => keyOf(o) && keyOf(o) !== key);
      if (others) break;
      if (APPLIED.test((box as HTMLElement).innerText ?? '')) {
        if (!keys.has(key)) cards++;
        keys.add(key);
        break;
      }
    }
  }
  return { keys: [...keys], cards };
}

/**
 * Where the My jobs page is: its list (or its empty list), Indeed's sign-in form actually on screen, or
 * still on the way. Opening My jobs passes through Indeed's sign-in address even when you are logged in
 * (that is how it checks your session), and its pages carry hidden login forms - neither means "signed out".
 */
export function indeedPageStateInPage(): 'list' | 'signin' | 'loading' {
  const text = document.body?.innerText ?? '';
  if (/\bapplied\b[^\n]{0,60}\bon indeed\b/i.test(text) || /no (applications|jobs) (yet|found)|you haven.t applied/i.test(text)) return 'list';
  const shown = (el: Element) => {
    const r = (el as HTMLElement).getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  };
  // A password box on screen, or an email box on Indeed's sign-in address. Hidden login forms do not count.
  const password = Array.from(document.querySelectorAll('input[type=password]')).some(shown);
  const email = Array.from(document.querySelectorAll('input[type=email], input[name*="email" i]')).some(shown);
  return password || (email && /secure\.indeed\.com|\/(auth|account|login)/i.test(location.href)) ? 'signin' : 'loading';
}
