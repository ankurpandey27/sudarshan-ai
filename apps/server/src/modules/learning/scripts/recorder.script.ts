// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import type { FormSnapshot } from '../../form-engine/interfaces/form-field.interface';

/**
 * Runs in the page (self-contained). Reports the user's own edits and clicks to
 * Node through the exposed __sudarshanLearn binding, each with a snapshot of the
 * form taken at that instant - a click on "Next" replaces the fields right after.
 * Only trusted (human) events count, and secret fields never trigger a report.
 * It also notes how you operate each field (opened it and clicked an option, typed and pressed Enter...),
 * so a field Sudarshan AI could not fill is done your way next time.
 */
export function learnRecorderInPage(): void {
  type Extract = (scope: string | null) => FormSnapshot;
  const win = window as unknown as {
    __sudarshanRecorder?: boolean;
    __sudarshanLearn?: (e: unknown) => void;
    __sudarshanExtract?: Extract;
    __sudarshanScope?: string | null;
    __sudarshanWidget?: (ids: string[]) => Record<string, string>;
    __sudarshanForget?: () => void;
  };
  if (win.__sudarshanRecorder) return;
  win.__sudarshanRecorder = true;

  const snap = (): FormSnapshot | null => {
    const extract = win.__sudarshanExtract;
    if (!extract) return null;
    const scoped = win.__sudarshanScope ? extract(win.__sudarshanScope) : null;
    return scoped?.scopeFound ? scoped : extract(null);
  };
  const send = (e: unknown) => {
    try {
      win.__sudarshanLearn?.(e);
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
  // What you did to each field, in order ("click", "type", "enter", "option", "choice" - see FillOp).
  const ops = new Map<string, string[]>();
  // The field you are working on: an option in a list drawn elsewhere on the page belongs to it.
  let current: { id: string; at: number } | null = null;
  const fieldId = (el: Element): string | null => {
    const own = el.closest('[data-jaa-id]');
    if (own) return own.getAttribute('data-jaa-id');
    const control = (el.closest('label') as HTMLLabelElement | null)?.control;
    return control?.getAttribute('data-jaa-id') ?? null;
  };
  const note = (id: string, op: string) => {
    ops.set(id, [...(ops.get(id) ?? []), op].slice(-12));
    current = { id, at: Date.now() };
  };
  const ways = (): Record<string, { widget: string; ops: string[] }> => {
    const ids = [...ops.keys()];
    const widgets = ids.length && win.__sudarshanWidget ? win.__sudarshanWidget(ids) : {};
    const out: Record<string, { widget: string; ops: string[] }> = {};
    for (const id of ids) if (widgets[id]) out[id] = { widget: widgets[id], ops: ops.get(id)! };
    return out;
  };
  // Read the form first (which tags its fields), then list which of them were touched.
  const report = (e: { type: 'edit' } | { type: 'click'; text: string }) => {
    const form = snap();
    send({ ...e, snap: form, touched: touched(), ways: ways() });
  };
  const onEdit = (e: Event) => {
    const el = e.target;
    if (!e.isTrusted || !(el instanceof Element) || secret(el)) return;
    touch(el);
    const id = fieldId(el);
    if (id && e.type === 'input') note(id, 'type');
    clearTimeout(timer);
    timer = setTimeout(() => report({ type: 'edit' }), 500);
  };
  // Sudarshan AI worked in this tab (its clicks are trusted too): what it touched is not yours (Valerie Group,
  // 2026-10-05: the AI's tick on "I have built this myself" was saved as your answer when the tab closed).
  win.__sudarshanForget = () => {
    touchedEls.clear();
    ops.clear();
    clearTimeout(timer);
    timer = undefined;
    current = null;
  };
  document.addEventListener('change', onEdit, true);
  document.addEventListener('input', onEdit, true);
  // Leaving or closing the page right after typing: send what is still waiting, not lose it.
  const flush = () => {
    if (timer === undefined) return;
    clearTimeout(timer);
    timer = undefined;
    report({ type: 'edit' });
  };
  window.addEventListener('pagehide', flush, true);
  document.addEventListener(
    'keydown',
    (e) => {
      if (!e.isTrusted || e.key !== 'Enter' || !(e.target instanceof Element) || secret(e.target)) return;
      const id = fieldId(e.target);
      if (id) note(id, 'enter');
    },
    true,
  );
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush(), true);

  document.addEventListener(
    'click',
    (e) => {
      if (!e.isTrusted || !(e.target instanceof Element)) return;
      // Custom radios and checkboxes fire no input event - picking one is a click.
      const choice = e.target.closest('[role=radio], [role=checkbox], [role=option], [role=switch], label, input');
      if (choice && !secret(choice)) touch(choice);
      // How you operate the field: an option of the list it opened (often drawn outside it), one of its choices, or the field itself.
      const id = fieldId(e.target);
      const option = e.target.closest('[role=option], [role=menuitem], [role=menuitemradio], [role=listbox] li');
      if (option && current && Date.now() - current.at < 15_000 && (!id || id === current.id)) note(current.id, 'option');
      else if (id && !secret(e.target)) note(id, e.target.closest('label, [role=radio], [role=checkbox], [role=switch]') ? 'choice' : 'click');
      const button = e.target.closest('button, a, [role=button], input[type=submit]');
      if (!button) return;
      const text = ((button as HTMLElement).innerText || (button as HTMLInputElement).value || button.getAttribute('aria-label') || '').trim();
      clearTimeout(timer);
      // Capture phase: this runs before the page reacts to the click.
      if (text) report({ type: 'click', text: text.slice(0, 80) });
    },
    true,
  );
}
