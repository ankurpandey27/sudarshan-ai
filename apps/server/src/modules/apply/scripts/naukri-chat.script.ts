// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

// Runs in the page via page.evaluate: every function must be self-contained.

export function naukriLastQuestionInPage(drawerSelector: string): string {
  const drawer = Array.from(document.querySelectorAll(drawerSelector)).pop();
  if (!drawer) return '';
  const bubbles = Array.from(drawer.querySelectorAll('.botMsg, [class*="botMsg"], .chatbot_ListItem .botItem, [class*="bot-msg"]')) as HTMLElement[];
  // The last bubble with words: the "typing..." dots have none.
  const texts = bubbles.map((b) => (b.innerText ?? '').replace(/\s+/g, ' ').trim()).filter((t) => /[a-z0-9]/i.test(t));
  return texts.pop() ?? '';
}

/** Naukri is not "typing": its newest bubble has words, not the three dots. */
export function naukriDoneTypingInPage(drawerSelector: string): boolean {
  const drawer = Array.from(document.querySelectorAll(drawerSelector)).pop();
  if (!drawer) return true;
  const bubbles = Array.from(drawer.querySelectorAll('.botMsg, [class*="botMsg"], .chatbot_ListItem .botItem, [class*="bot-msg"]')) as HTMLElement[];
  const last = bubbles.pop();
  return !last || /[a-z0-9]/i.test(last.innerText ?? '');
}

export function naukriSendInPage(drawerSelector: string): boolean {
  const drawer = Array.from(document.querySelectorAll(drawerSelector)).pop();
  if (!drawer) return false;
  const candidates = Array.from(drawer.querySelectorAll('.sendMsg, [class*="sendMsg"], [class*="send-btn"], button, [role=button]')) as HTMLElement[];
  // The button itself, not a wrapper: Naukri wraps "Save" in "sendMsgbtn_container", which also
  // matches "sendMsg" but does nothing when clicked.
  const innermost = (els: HTMLElement[]) => els.filter((el) => !els.some((o) => o !== el && el.contains(o)));
  const send =
    innermost(candidates.filter((el) => el.classList.contains('sendMsg') || el.classList.contains('send-btn')))[0] ??
    innermost(candidates.filter((el) => /^(save|submit|send|next|done)$/i.test((el.innerText || el.getAttribute('aria-label') || '').trim())))[0] ??
    innermost(candidates.filter((el) => /sendMsg|send-btn/.test(el.className)))[0];
  if (!send) return false;
  send.click();
  return true;
}

/** The chat's Save is enabled (Naukri greys it out until an answer is typed or picked). */
export function naukriSendReadyInPage(drawerSelector: string): boolean {
  const drawer = Array.from(document.querySelectorAll(drawerSelector)).pop();
  if (!drawer) return true;
  const btn = drawer.querySelector('.sendMsg');
  const wrapper = btn?.closest('.send, [class*="send"]');
  return !btn || !(wrapper?.classList.contains('disabled') || btn.classList.contains('disabled') || btn.getAttribute('aria-disabled') === 'true');
}
