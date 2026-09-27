// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

// Runs in the page via page.evaluate: every function must be self-contained.

export function naukriLastQuestionInPage(drawerSelector: string): string {
  const drawer = Array.from(document.querySelectorAll(drawerSelector)).pop();
  if (!drawer) return '';
  const bubbles = Array.from(drawer.querySelectorAll('.botMsg, [class*="botMsg"], .chatbot_ListItem .botItem, [class*="bot-msg"]'));
  const last = bubbles.pop() as HTMLElement | undefined;
  return (last?.innerText ?? '').replace(/\s+/g, ' ').trim();
}

export function naukriSendInPage(drawerSelector: string): boolean {
  const drawer = Array.from(document.querySelectorAll(drawerSelector)).pop();
  if (!drawer) return false;
  const candidates = Array.from(
    drawer.querySelectorAll('.sendMsg, [class*="sendMsg"], [class*="send-btn"], button, [role=button]'),
  ) as HTMLElement[];
  const send =
    candidates.find((el) => /sendMsg|send-btn/.test(el.className)) ??
    candidates.find((el) => /^(save|submit|send|next|done)$/i.test((el.innerText || el.getAttribute('aria-label') || '').trim()));
  if (!send) return false;
  send.click();
  return true;
}
