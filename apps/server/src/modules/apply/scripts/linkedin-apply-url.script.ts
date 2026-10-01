// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

// Runs in the page via page.evaluate: self-contained, no outer references.

/**
 * The company's own apply address, as LinkedIn keeps it in the job page ("companyApplyUrl" in its data,
 * or the Apply link's href) - for when pressing Apply opens nothing Sudarshan can catch. Null when absent.
 */
export function linkedinCompanyApplyUrlInPage(): string | null {
  const unescape = (s: string) =>
    s
      .replace(/\\u002F/gi, '/')
      .replace(/\\u0026/gi, '&')
      .replace(/\\\//g, '/')
      .replace(/&amp;/g, '&');
  const html = document.documentElement.innerHTML;
  const data = /"companyApplyUrl"\s*:\s*"([^"]+)"/.exec(html) ?? /companyApplyUrl&quot;:&quot;(.+?)&quot;/.exec(html);
  if (data) return unescape(data[1]);
  const link = Array.from(document.querySelectorAll('a[href]')).find(
    (a) => /^apply\b/i.test((a as HTMLElement).innerText.trim()) && !/linkedin\.com\/(jobs\/view\/\d+\/?$|login|signup)/.test((a as HTMLAnchorElement).href),
  ) as HTMLAnchorElement | undefined;
  return link?.href ?? null;
}

/** LinkedIn's own pop-up between Apply and the company site ("Continue", "Continue to apply"): its button, clicked. */
export function continueLinkedinInterstitialInPage(): string | null {
  const dialogs = Array.from(document.querySelectorAll('[role=dialog], .artdeco-modal')).filter((d) => (d as HTMLElement).offsetParent !== null);
  for (const d of dialogs) {
    const b = Array.from(d.querySelectorAll('button, a')).find((x) =>
      /^(continue|continue to apply|apply|go to (site|website)|proceed)\b/i.test((x as HTMLElement).innerText.trim()),
    );
    if (b) {
      (b as HTMLElement).click();
      return (b as HTMLElement).innerText.trim();
    }
  }
  return null;
}
