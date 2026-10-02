// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

// Runs in the page via page.evaluate: self-contained, no outer references.

/**
 * Closes a cookie banner the way a careful person would: "necessary only" or "reject" when offered, then
 * "allow selection" / "save my choices" (only what is preselected), else "accept". Only a button inside a
 * visible box that talks about cookies or consent is pressed - never a button of the application itself.
 * Looks inside shadow roots too (Usercentrics). Returns the button's text, or null when there is no banner.
 */
export function dismissCookieBannerInPage(): string | null {
  const visible = (el: Element) => {
    const r = (el as HTMLElement).getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0';
  };
  // The document and every open shadow root in it.
  const roots: (Document | ShadowRoot)[] = [document];
  for (let i = 0; i < roots.length && roots.length < 60; i++) {
    for (const el of Array.from(roots[i].querySelectorAll('*'))) if (el.shadowRoot) roots.push(el.shadowRoot);
  }
  const all = (sel: string) => roots.flatMap((r) => Array.from(r.querySelectorAll(sel)));
  const label = (el: Element) =>
    ((el as HTMLElement).innerText || (el as HTMLInputElement).value || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
  const press = (el: Element) => {
    (el as HTMLElement).click();
    return label(el) || 'cookie banner';
  };

  // Well-known consent tools, most private choice first: OneTrust, Cookiebot, Usercentrics, Didomi, Osano, CookieYes, Workday.
  const known = [
    '#onetrust-reject-all-handler',
    '#CybotCookiebotDialogBodyButtonDecline',
    '[data-testid="uc-deny-all-button"]',
    '#didomi-notice-disagree-button',
    '.osano-cm-denyAll',
    '.cky-btn-reject',
    '[data-automation-id="legalNoticeDeclineButton"]',
    '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowallSelection',
    '[data-testid="uc-save-button"]',
    '#onetrust-accept-btn-handler',
    '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
    '#CybotCookiebotDialogBodyButtonAccept',
    '[data-testid="uc-accept-all-button"]',
    '#didomi-notice-agree-button',
    '.cky-btn-accept',
    '[data-automation-id="legalNoticeAcceptButton"]',
  ];
  for (const sel of known) {
    const el = all(sel).find(visible);
    if (el) return press(el);
  }

  // Only a box about cookies (in the languages sites use) - never an application's own "Do you consent to us processing your data?".
  const COOKIE = /cookie|galletas|biscuits|kekse|koekjes|biscotti/i;
  const PREFER = [
    /necessary (cookies )?only|only (strictly )?necessary|use (only )?necessary|essential (cookies )?only|only essential|required only/i,
    /^(reject|decline|deny|refuse)( all)?( cookies)?$|reject (all|non-essential|optional)|ablehnen|rechazar|refuser|weigeren/i,
    /allow selection|save (my )?(choices|preferences|settings|selection)|confirm (my )?(choices|selection)|accept selected/i,
    /^(accept|allow|agree)( all)?( cookies)?$|accept all|allow all|i (agree|accept|understand)|got it|^ok(ay)?$|akzeptieren|aceptar|accepter|accetta|accepteren/i,
  ];
  const buttons = all('button, [role=button], a[role=button], a[href="#"], input[type=button], input[type=submit]').filter(visible);
  // The button's own box - the banner - must be about cookies, small enough not to be the whole page,
  // and hold nothing of an application (no file upload, no text box).
  const inBanner = (b: Element) => {
    let node: Element | null = b.parentElement ?? (b.getRootNode() as ShadowRoot).host ?? null;
    for (let depth = 0; node && depth < 8; depth++) {
      const text = (node as HTMLElement).innerText ?? '';
      if (text.length > 5000) return false;
      if (COOKIE.test(text)) return !node.querySelector('input[type=file], textarea, input[type=email], input[type=tel]');
      node = node.parentElement ?? ((node.getRootNode() as ShadowRoot).host as Element | undefined) ?? null;
    }
    return false;
  };
  for (const want of PREFER) {
    const b = buttons.find((x) => want.test(label(x)) && inBanner(x));
    if (b) return press(b);
  }
  return null;
}

/** An open dialog that holds the application's form - text boxes, choices, an upload - and is not a cookie banner. */
export function applicationDialogInPage(selector: string): boolean {
  const COOKIE = /cookie|galletas|kekse|koekjes|biscotti/i;
  return Array.from(document.querySelectorAll(selector)).some((d) => {
    const r = (d as HTMLElement).getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const hasForm = !!d.querySelector('input:not([type=hidden]):not([type=checkbox]), select, textarea');
    // A cookie banner's switches and "Allow" buttons are not a form.
    const cookieBanner = COOKIE.test((d as HTMLElement).innerText ?? '') && !d.querySelector('input[type=file], textarea');
    return hasForm && !cookieBanner;
  });
}
