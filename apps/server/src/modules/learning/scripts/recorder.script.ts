// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import type { FormSnapshot } from '../../form-engine/interfaces/form-field.interface';

/**
 * Runs in the page (self-contained). Reports the user's own edits and clicks to
 * Node through the exposed __sudarshanLearn binding, each with a snapshot of the
 * form taken at that instant - a click on "Next" replaces the fields right after.
 * Only trusted (human) events count, and secret fields never trigger a report.
 */
export function learnRecorderInPage(): void {
  type Extract = (scope: string | null) => FormSnapshot;
  const w = window as unknown as {
    __sudarshanRecorder?: boolean;
    __sudarshanLearn?: (e: unknown) => void;
    __sudarshanExtract?: Extract;
    __sudarshanScope?: string | null;
  };
  if (w.__sudarshanRecorder) return;
  w.__sudarshanRecorder = true;

  const snap = (): FormSnapshot | null => {
    const extract = w.__sudarshanExtract;
    if (!extract) return null;
    const scoped = w.__sudarshanScope ? extract(w.__sudarshanScope) : null;
    return scoped?.scopeFound ? scoped : extract(null);
  };
  const send = (e: unknown) => {
    try {
      w.__sudarshanLearn?.(e);
    } catch {
      // The binding goes away when the page closes.
    }
  };
  const SECRET = /pass(word|code)|otp|one[- ]?time|verification|captcha|cvv|card ?number|security code|pin\b/i;
  const secret = (el: Element): boolean => {
    const i = el as HTMLInputElement;
    if (['password', 'file', 'hidden'].includes((i.type || '').toLowerCase())) return true;
    if (/password|one-time-code|cc-/.test(el.getAttribute('autocomplete') ?? '')) return true;
    return SECRET.test(`${i.name ?? ''} ${el.id} ${el.getAttribute('aria-label') ?? ''} ${i.placeholder ?? ''}`);
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  // Fields you changed yourself, so values the site fills in on its own are never learned as yours.
  // Elements are kept (not ids): a field on a newly shown step only gets its id when the form is next read.
  const touchedEls = new Set<Element>();
  const touch = (el: Element) => touchedEls.add(el);
  const touched = (): string[] => {
    const out = new Set<string>();
    for (const el of touchedEls) {
      for (let n: Element | null = el; n; n = n.parentElement) {
        const id = n.getAttribute('data-jaa-id');
        if (id) out.add(id);
      }
      const name = (el as HTMLInputElement).name;
      if (name) out.add(`name:${name}`);
    }
    return [...out];
  };
  // Read the form first (which tags its fields), then list which of them were touched.
  const report = (e: { type: 'edit' } | { type: 'click'; text: string }) => {
    const form = snap();
    send({ ...e, snap: form, touched: touched() });
  };
  const onEdit = (e: Event) => {
    const el = e.target;
    if (!e.isTrusted || !(el instanceof Element) || secret(el)) return;
    touch(el);
    clearTimeout(timer);
    timer = setTimeout(() => report({ type: 'edit' }), 500);
  };
  document.addEventListener('change', onEdit, true);
  document.addEventListener('input', onEdit, true);

  document.addEventListener(
    'click',
    (e) => {
      if (!e.isTrusted || !(e.target instanceof Element)) return;
      // Custom radios and checkboxes fire no input event - picking one is a click.
      const choice = e.target.closest('[role=radio], [role=checkbox], [role=option], [role=switch], label, input');
      if (choice && !secret(choice)) touch(choice);
      const b = e.target.closest('button, a, [role=button], input[type=submit]');
      if (!b) return;
      const text = ((b as HTMLElement).innerText || (b as HTMLInputElement).value || b.getAttribute('aria-label') || '').trim();
      clearTimeout(timer);
      // Capture phase: this runs before the page reacts to the click.
      if (text) report({ type: 'click', text: text.slice(0, 80) });
    },
    true,
  );
}
