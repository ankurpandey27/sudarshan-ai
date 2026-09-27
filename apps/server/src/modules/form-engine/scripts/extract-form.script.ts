// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import type { FormSnapshot } from '../interfaces/form-field.interface';
import type { FieldKind } from '../enums/field-kind.enum';

/**
 * Runs in the page via page.evaluate, so it must stay self-contained (no imports
 * or outer-scope references). Controls get data-jaa-* ids for the filler.
 */
export function extractFormInPage(scopeSelector: string | null): FormSnapshot {
  const w = window as unknown as { __jaaSeq?: number };
  const nextId = (prefix: string) => `${prefix}${(w.__jaaSeq = (w.__jaaSeq ?? 0) + 1)}`;
  const tag = (el: Element, attr: string, prefix: string): string => {
    let id = el.getAttribute(attr);
    if (!id) {
      id = nextId(prefix);
      el.setAttribute(attr, id);
    }
    return id;
  };
  const clean = (s: string | null | undefined): string =>
    (s ?? '')
      .replace(/\s+/g, ' ')
      .replace(/\s*\*\s*$/, '')
      .replace(/\(?\s*(required|optional)\s*\)?\s*$/i, '')
      .trim();
  const visible = (el: Element | null): boolean => {
    if (!el) return false;
    const h = el as HTMLElement;
    const shown =
      (typeof h.checkVisibility !== 'function' || h.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true })) &&
      (() => {
        const r = h.getBoundingClientRect();
        return r.width > 0 || r.height > 0;
      })();
    if (shown) return true;
    // Custom radios/checkboxes hide the native input (display:none, or 0x0); what the user sees is a label or a wrapper.
    const t = (el as HTMLInputElement).type;
    if (!(el.tagName === 'INPUT' && (t === 'radio' || t === 'checkbox' || t === 'file'))) return false;
    const stand = [
      ...Array.from((el as HTMLInputElement).labels ?? []),
      el.closest('[role=radio], [role=checkbox], [role=option]'),
      el.parentElement,
      el.parentElement?.parentElement,
    ];
    return stand.some((s) => !!s && s !== el && visible(s));
  };
  const textOf = (el: Element | null): string => clean((el as HTMLElement | null)?.innerText ?? el?.textContent ?? '');

  // Topmost visible match wins when dialogs are stacked.
  let scope: Element = document.body;
  let scopeFound = scopeSelector === null;
  if (scopeSelector) {
    const matches = Array.from(document.querySelectorAll(scopeSelector)).filter(visible);
    if (matches.length) {
      scope = matches[matches.length - 1];
      scopeFound = true;
    }
  }

  const byIdText = (ids: string | null): string =>
    (ids ?? '')
      .split(/\s+/)
      .map((id) => (id ? textOf(document.getElementById(id)) : ''))
      .filter(Boolean)
      .join(' ');

  const controlCount = (el: Element): number =>
    el.querySelectorAll('input:not([type=hidden]), select, textarea, [role=combobox], [contenteditable=true]').length;

  // The question is the text of the nearest ancestor that contains only this control.
  const containerText = (el: Element, ownCount: number, exclude: string[]): string => {
    let node: Element | null = el.parentElement;
    for (let depth = 0; node && depth < 6 && node !== scope.parentElement; depth++, node = node.parentElement) {
      if (controlCount(node) > ownCount) break;
      let t = textOf(node);
      for (const x of exclude) if (x) t = t.split(x).join(' ');
      t = clean(t);
      if (t.length >= 2) return t.slice(0, 300);
    }
    return '';
  };

  const labelFor = (el: Element, exclude: string[] = [], ownCount = 1): string => {
    const input = el as HTMLInputElement;
    const labelled = byIdText(el.getAttribute('aria-labelledby'));
    if (labelled) return labelled;
    const labels = input.labels ? Array.from(input.labels).map(textOf).filter(Boolean) : [];
    if (labels.length) return labels.join(' ');
    const aria = clean(el.getAttribute('aria-label'));
    if (aria) return aria;
    const fromContainer = containerText(el, ownCount, exclude);
    if (fromContainer) return fromContainer;
    return clean(input.placeholder || input.name || input.id || '').replace(/[_-]+/g, ' ');
  };

  const errorFor = (el: Element): string => {
    const described = el.getAttribute('aria-invalid') === 'true' ? byIdText(el.getAttribute('aria-describedby')) : '';
    if (described) return described;
    // Some sites point aria-describedby at the error text without setting aria-invalid.
    const hint = (el.getAttribute('aria-describedby') ?? '')
      .split(/\s+/)
      .map((id) => (id ? document.getElementById(id) : null))
      .filter((n): n is HTMLElement => !!n && visible(n))
      .map(textOf)
      .find((t) => /required|invalid|please|must|enter|select/i.test(t));
    if (hint) return hint;
    let node: Element | null = el.parentElement;
    for (let depth = 0; node && depth < 4; depth++, node = node.parentElement) {
      if (controlCount(node) > 1) break;
      const err = Array.from(node.querySelectorAll('[role=alert], [class*=error], [class*=invalid], [class*=Error]'))
        .filter(visible)
        .map(textOf)
        .find((t) => t.length > 1 && t.length < 200);
      if (err) return err;
    }
    return el.getAttribute('aria-invalid') === 'true' ? 'invalid' : '';
  };

  // A question written just before its control, e.g. <p>Question*</p><fieldset>…</fieldset>.
  const precedingText = (el: Element): string => {
    for (let node: Element | null = el, up = 0; node && up < 2; node = node.parentElement, up++) {
      let sib = node.previousElementSibling;
      for (let hops = 0; sib && hops < 2; sib = sib.previousElementSibling, hops++) {
        if (controlCount(sib) > 0) break;
        const raw = ((sib as HTMLElement).innerText ?? '').replace(/\s+/g, ' ').trim();
        if (raw.length >= 2 && raw.length <= 300) return raw;
      }
    }
    return '';
  };

  const isRequired = (el: Element, label: string): boolean =>
    (el as HTMLInputElement).required === true ||
    el.getAttribute('aria-required') === 'true' ||
    /\*\s*$/.test((el as HTMLInputElement).labels?.[0]?.textContent?.trim() ?? '') ||
    /\brequired\b/i.test(label);

  const fields: FormSnapshot['fields'] = [];
  const seenGroups = new Set<string>();
  const CAPTCHA_FIELD = /captcha|security code|enter the (characters|code|text|letters)( shown| above| in the image)?/i;
  let textCaptchaPending = false;

  const controls = Array.from(scope.querySelectorAll('input, select, textarea, [role=combobox]:not(input), [role=radiogroup], [contenteditable=true]'));
  for (const el of controls) {
    const tagName = el.tagName;
    const input = el as HTMLInputElement;
    const type = (input.type || '').toLowerCase();
    if (tagName === 'INPUT' && ['hidden', 'submit', 'button', 'image', 'reset', 'password', 'search'].includes(type)) continue;
    if ((input.disabled || input.readOnly) && type !== 'file') continue;
    if (!visible(el)) continue;

    // Text captchas are for the human: never a question, never answered.
    if (tagName === 'INPUT' && CAPTCHA_FIELD.test(`${input.name} ${el.id} ${input.placeholder} ${el.getAttribute('aria-label') ?? ''} ${labelFor(el)}`)) {
      if (!input.value.trim()) textCaptchaPending = true;
      continue;
    }

    if (tagName === 'INPUT' && type === 'radio') {
      const container = el.closest('fieldset, [role=radiogroup]') ?? el.parentElement?.parentElement ?? scope;
      const groupKey = input.name ? `name:${input.name}` : `c:${tag(container, 'data-jaa-id', 'g')}`;
      if (seenGroups.has(groupKey)) continue;
      seenGroups.add(groupKey);
      const radios = (
        input.name
          ? Array.from(scope.querySelectorAll(`input[type=radio][name="${CSS.escape(input.name)}"]`))
          : Array.from(container.querySelectorAll('input[type=radio]'))
      ) as HTMLInputElement[];
      const optionIds = radios.map((r) => tag(r, 'data-jaa-opt', 'o'));
      const options = radios.map((r) => labelFor(r) || r.value);
      const groupEl = el.closest('fieldset, [role=radiogroup]') ?? container;
      const legend = groupEl.querySelector('legend');
      // Some sites put the question in every option's aria-label (LinkedIn, 2026).
      const optionAria = Array.from(new Set(radios.map((r) => clean(r.closest('[role=radio]')?.getAttribute('aria-label')))));
      const sharedAria = optionAria.length === 1 && optionAria[0] && !options.includes(optionAria[0]) ? optionAria[0] : '';
      const before = precedingText(groupEl);
      const label =
        textOf(legend) ||
        byIdText(groupEl.getAttribute('aria-labelledby')) ||
        clean(groupEl.getAttribute('aria-label')) ||
        sharedAria ||
        clean(before) ||
        containerText(groupEl, radios.length, options) ||
        input.name;
      const checked = radios.filter((r) => r.checked).map((r) => labelFor(r) || r.value);
      fields.push({
        id: tag(groupEl, 'data-jaa-id', 'f'),
        kind: 'radio' as FieldKind,
        label,
        name: input.name,
        placeholder: '',
        required:
          radios.some((r) => r.required) || /\*/.test((legend as HTMLElement | null)?.innerText ?? '') || /\*\s*$/.test(before) || isRequired(groupEl, label),
        value: checked.join(' | '),
        options,
        optionIds,
        error: errorFor(groupEl),
        maxLength: null,
        min: null,
        max: null,
        accept: null,
      });
      continue;
    }

    if (el.getAttribute('role') === 'radiogroup') {
      const opts = Array.from(el.querySelectorAll('[role=radio]')).filter(visible);
      if (opts.length === 0 || el.querySelector('input[type=radio]')) continue;
      const optionIds = opts.map((o) => tag(o, 'data-jaa-opt', 'o'));
      const options = opts.map((o) => textOf(o) || clean(o.getAttribute('aria-label')));
      const label = labelFor(el, options, 0) || precedingText(el) || 'Choose an option';
      fields.push({
        id: tag(el, 'data-jaa-id', 'f'),
        kind: 'radio' as FieldKind,
        label,
        name: '',
        placeholder: '',
        required: el.getAttribute('aria-required') === 'true',
        value: opts
          .filter((o) => o.getAttribute('aria-checked') === 'true')
          .map(textOf)
          .join(' | '),
        options,
        optionIds,
        error: errorFor(el),
        maxLength: null,
        min: null,
        max: null,
        accept: null,
      });
      continue;
    }

    if (tagName === 'INPUT' && type === 'checkbox') {
      const fieldset = el.closest('fieldset');
      const peers = (
        input.name
          ? Array.from(scope.querySelectorAll(`input[type=checkbox][name="${CSS.escape(input.name)}"]`))
          : fieldset
            ? Array.from(fieldset.querySelectorAll('input[type=checkbox]'))
            : [el]
      ) as HTMLInputElement[];
      if (peers.length > 1) {
        const groupEl = fieldset ?? el.parentElement?.parentElement ?? scope;
        const key = `cb:${tag(groupEl, 'data-jaa-id', 'f')}`;
        if (seenGroups.has(key)) continue;
        seenGroups.add(key);
        const optionIds = peers.map((p) => tag(p, 'data-jaa-opt', 'o'));
        const options = peers.map((p) => labelFor(p) || p.value);
        const label = textOf(groupEl.querySelector('legend')) || containerText(groupEl, peers.length, options) || input.name;
        fields.push({
          id: groupEl.getAttribute('data-jaa-id')!,
          kind: 'checkbox-group' as FieldKind,
          label,
          name: input.name,
          placeholder: '',
          required: peers.some((p) => p.required) || /\*/.test(label),
          value: peers
            .filter((p) => p.checked)
            .map((p) => labelFor(p) || p.value)
            .join(' | '),
          options,
          optionIds,
          error: errorFor(groupEl),
          maxLength: null,
          min: null,
          max: null,
          accept: null,
        });
        continue;
      }
      const label = labelFor(el);
      fields.push({
        id: tag(el, 'data-jaa-id', 'f'),
        kind: 'checkbox' as FieldKind,
        label,
        name: input.name,
        placeholder: '',
        required: isRequired(el, label),
        value: input.checked ? 'true' : 'false',
        options: [],
        optionIds: [],
        error: errorFor(el),
        maxLength: null,
        min: null,
        max: null,
        accept: null,
      });
      continue;
    }

    const label = labelFor(el);
    let kind: string;
    let options: string[] = [];
    let value = '';
    if (tagName === 'SELECT') {
      const sel = el as HTMLSelectElement;
      kind = 'select';
      options = Array.from(sel.options).map((o) => clean(o.textContent));
      const chosen = sel.selectedOptions[0];
      // "Select an option" placeholders count as empty.
      value = chosen && chosen.value !== '' && !/^(select|choose|--|please)/i.test(clean(chosen.textContent)) ? clean(chosen.textContent) : '';
    } else if (tagName === 'TEXTAREA') {
      kind = 'textarea';
      value = (el as HTMLTextAreaElement).value;
    } else if (el.getAttribute('contenteditable') === 'true') {
      kind = 'textarea';
      value = textOf(el);
    } else if (type === 'file') {
      kind = 'file';
      value = input.files && input.files.length ? input.files[0].name : '';
    } else if (el.getAttribute('role') === 'combobox' || el.getAttribute('aria-autocomplete') === 'list' || input.getAttribute('list') !== null) {
      kind = 'combobox';
      value = input.value ?? textOf(el);
    } else {
      kind = ['number', 'email', 'tel', 'url', 'date'].includes(type) ? type : 'text';
      value = input.value;
    }
    fields.push({
      id: tag(el, 'data-jaa-id', 'f'),
      kind: kind as FieldKind,
      label,
      name: input.name ?? '',
      placeholder: clean(input.placeholder),
      required: isRequired(el, label),
      value: (value ?? '').trim(),
      options,
      optionIds: [],
      error: errorFor(el),
      maxLength: input.maxLength && input.maxLength > 0 ? input.maxLength : null,
      min: input.min || null,
      max: input.max || null,
      accept: type === 'file' ? input.accept || null : null,
    });
  }

  const actions: FormSnapshot['actions'] = [];
  const clickables = Array.from(scope.querySelectorAll('button, [role=button], input[type=submit], input[type=button], a[href]')).filter(visible);
  for (const el of clickables) {
    const text = clean((el as HTMLElement).innerText || el.getAttribute('aria-label') || (el as HTMLInputElement).value || el.getAttribute('title')).slice(
      0,
      80,
    );
    if (!text) continue;
    const isLink = el.tagName === 'A';
    const lower = text.toLowerCase();
    let kind: FormSnapshot['actions'][number]['kind'] = 'other';
    if (
      /^(submit|submit application|send application|send|finish|complete application|submit & apply|confirm and apply)$/i.test(lower) ||
      // "Submit your application" (Indeed); not "Submit resume" (an upload step) or "Send me jobs like this" (Naukri).
      /^submit( now)?!?$|(submit|send) (your |my |the )?application/.test(lower)
    )
      kind = 'submit';
    else if (/^review\b|review (your )?application/.test(lower)) kind = 'review';
    else if (/^(next|continue|proceed|save and continue|save & continue|save & next|next step)\b/.test(lower)) kind = 'next';
    else if (/^(easy apply|apply|apply now|apply for this job|apply to this job|i'?m interested|quick apply)\b/.test(lower)) kind = 'apply';
    else if (/^(dismiss|close|cancel|discard|not now|done|back)\b/.test(lower)) kind = 'dismiss';
    if (isLink && kind === 'other') continue;
    const b = el as HTMLButtonElement;
    actions.push({
      id: tag(el, 'data-jaa-act', 'a'),
      text,
      kind,
      disabled: b.disabled === true || el.getAttribute('aria-disabled') === 'true',
    });
  }

  const errors = Array.from(scope.querySelectorAll('[role=alert], [aria-live=assertive]'))
    .filter(visible)
    .map(textOf)
    .filter((t) => t.length > 2 && t.length < 300)
    .slice(0, 5);

  // A widget counts until its response token is filled in (the iframe stays after solving).
  const widget = !!document.querySelector(
    'iframe[src*="recaptcha"]:not([src*="invisible"]), iframe[src*="hcaptcha"], iframe[title*="challenge" i], #captcha-internal, iframe[src*="arkoselabs"], iframe[src*="funcaptcha"], iframe[src*="turnstile"]',
  );
  const token = Array.from(
    document.querySelectorAll('textarea[name="g-recaptcha-response"], textarea[name="h-captcha-response"], input[name="cf-turnstile-response"]'),
  ).some((t) => ((t as HTMLTextAreaElement).value ?? '').length > 10);
  const captcha = (widget && !token) || textCaptchaPending || /\/checkpoint\/challenge/.test(location.href);

  return {
    url: location.href,
    scopeFound,
    fields,
    actions,
    text: textOf(scope).slice(0, 3000),
    errors,
    captcha,
  };
}
