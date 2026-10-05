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
  // A label that means nothing on its own ("Start date year", "Month", "From") gets the heading of its section in front
  // ("Education - Start date year"): Greenhouse asks the same words under Education and under Employment (Capco,
  // 2026-10-03), and an answer saved for one must never fill the other.
  const vagueLabel = (l: string): boolean => {
    const words = l.replace(/[*:]/g, ' ').trim().toLowerCase().split(/\s+/).filter(Boolean);
    return words.length > 0 && words.length <= 4 && words.every((w) => /^(start|end|date|month|year|from|to|day|current|present)$/.test(w));
  };
  const sectionOf = (el: Element): string => {
    for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
      // Greenhouse's "Education" is a plain bold line, not a heading (Capco, 2026-10-03): title-like elements count too.
      // A field group's own title (the "Phone" legend) is only for the fields inside that group.
      const heads = Array.from(
        n.querySelectorAll('h1, h2, h3, h4, h5, h6, legend, [role=heading], [class*="title" i], [class*="heading" i], [class*="section-header" i]'),
      ).filter((h) => {
        if (h.contains(el) || (h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) === 0) return false;
        if (h.querySelector('input, select, textarea, button') || h.closest('label')) return false;
        const group = h.closest('fieldset, [role=group], [role=radiogroup]');
        if (group && !group.contains(el)) return false;
        const t = textOf(h);
        return !!t && t.length <= 60 && t.split(/\s+/).length <= 6;
      });
      if (heads.length) return textOf(heads[heads.length - 1]).slice(0, 60);
    }
    return '';
  };
  const withSection = (label: string, el: Element): string => {
    if (!vagueLabel(label)) return label;
    const section = sectionOf(el);
    return section ? `${section} - ${label}` : label;
  };

  // Topmost visible match wins when dialogs are stacked.
  // No body yet while a page is navigating away.
  let scope: Element = document.body ?? document.documentElement;
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

  // Placeholder words a dropdown shows before a choice ("-- Year --", "Select an option"): never the question.
  const PICK_PROMPT =
    /^(--.*--|select( an?)?( option| one)?\.*|choose( an?)?( option| one)?\.*|please (select|choose)\.*|seleccione|selecione|kies|w[äa]hlen|choisir)$/i;
  // The text around a control, split into what comes before it and after it. The control's own text
  // (a dropdown's options), other controls and hidden text are left out.
  const textAround = (node: Element, el: Element, exclude: string[]): { before: string; after: string } => {
    const before: string[] = [];
    const after: string[] = [];
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      const parent = t.parentElement;
      if (!parent || el.contains(t) || parent.closest('option, select, script, style, template, [hidden], [aria-hidden="true"]')) continue;
      const s = clean(t.textContent);
      if (!s || exclude.includes(s) || PICK_PROMPT.test(s) || !visible(parent)) continue;
      (el.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_PRECEDING ? before : after).push(s);
    }
    return { before: clean(before.join(' ')), after: clean(after.join(' ')) };
  };

  // The question is the text of the nearest ancestor that contains only this control - what is written
  // before it first. Text only after it ("Enter a number between 0 and 1000", "e.g. 5") is a hint or an
  // example, used only when there is nothing else.
  const containerParts = (el: Element, ownCount: number, exclude: string[]): { before: string; hint: string } => {
    let node: Element | null = el.parentElement;
    let hint = '';
    for (let depth = 0; node && depth < 6 && node !== scope.parentElement; depth++, node = node.parentElement) {
      if (controlCount(node) > ownCount) break;
      const { before, after } = textAround(node, el, exclude);
      if (before.length >= 2) return { before: before.slice(0, 300), hint };
      if (!hint && after.length >= 2) hint = after.slice(0, 300);
    }
    return { before: '', hint };
  };
  const containerText = (el: Element, ownCount: number, exclude: string[]): string => {
    const { before, hint } = containerParts(el, ownCount, exclude);
    return before || hint;
  };

  /**
   * A group's question written inside the smallest box that holds all its options, before the first
   * one - only when that box holds nothing but this group (never an earlier question of the form).
   */
  const questionInside = (members: Element[], options: string[]): string => {
    let box: Element | null = members[0].parentElement;
    while (box && box !== scope && !members.every((m) => box!.contains(m))) box = box.parentElement;
    if (!box || controlCount(box) > members.length) return '';
    const text = textAround(box, members[0], options).before;
    return text.length >= 2 ? text.slice(0, 300) : '';
  };

  // A limit shown only as a counter under the field ("14/20", "64 / 20 characters" - LinkedIn, 2026-10-01).
  const counterLimit = (el: Element): number | null => {
    let node: Element | null = el.parentElement;
    for (let depth = 0; node && depth < 3; depth++, node = node.parentElement) {
      if (controlCount(node) > 1) break;
      for (const t of Array.from(node.querySelectorAll('span, div, p, small'))) {
        if (t.children.length) continue;
        const m = /^\s*\d+\s*\/\s*(\d{1,5})(\s*(characters|chars))?\s*$/i.exec((t as HTMLElement).innerText || t.textContent || '');
        if (m) return Number(m[1]);
      }
    }
    return null;
  };

  const labelFor = (el: Element, exclude: string[] = [], ownCount = 1): string => {
    const input = el as HTMLInputElement;
    const labelled = byIdText(el.getAttribute('aria-labelledby'));
    if (labelled) return labelled;
    const labels = input.labels ? Array.from(input.labels).map(textOf).filter(Boolean) : [];
    if (labels.length) return labels.join(' ');
    const aria = clean(el.getAttribute('aria-label'));
    if (aria) return aria;
    const { before, hint } = containerParts(el, ownCount, exclude);
    // A radio button or checkbox is labelled by the words after it ("Yes", "I agree ..."); the question
    // above its group belongs to the group, never to each option (CRUXO, Capgemini, 2026-09-30).
    const t = (input.type || '').toLowerCase();
    if (el.tagName === 'INPUT' && (t === 'radio' || t === 'checkbox')) {
      return hint || before || clean(input.value && input.value !== 'on' ? input.value : input.name || input.id || '').replace(/[_-]+/g, ' ');
    }
    if (before) return before;
    // A question written just above the control, in its own block (<p>Question*</p><div><input></div>).
    const above = precedingText(el);
    if (above) return above;
    // Only a hint or example below it, or nothing: better than the field's name.
    return hint || clean(input.placeholder || input.name || input.id || '').replace(/[_-]+/g, ' ');
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
      let options = radios.map((r) => labelFor(r) || r.value);
      // Options that all read the same cannot be told apart (or answered): each one's own value instead.
      if (options.length > 1 && new Set(options).size < options.length) {
        const values = radios.map((r) => clean(r.value) || clean(r.getAttribute('aria-label')));
        if (new Set(values).size === values.length && values.every(Boolean)) options = values;
      }
      const groupEl = el.closest('fieldset, [role=radiogroup]') ?? container;
      const legend = groupEl.querySelector('legend');
      // Some sites put the question in every option's aria-label (LinkedIn, 2026).
      const optionAria = Array.from(new Set(radios.map((r) => clean(r.closest('[role=radio]')?.getAttribute('aria-label')))));
      const sharedAria = optionAria.length === 1 && optionAria[0] && !options.includes(optionAria[0]) ? optionAria[0] : '';
      const before = precedingText(groupEl);
      const inside = questionInside(radios, options);
      const label =
        textOf(legend) ||
        byIdText(groupEl.getAttribute('aria-labelledby')) ||
        clean(groupEl.getAttribute('aria-label')) ||
        sharedAria ||
        inside ||
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
      const byName = input.name ? (Array.from(scope.querySelectorAll(`input[type=checkbox][name="${CSS.escape(input.name)}"]`)) as HTMLInputElement[]) : [];
      // Ashby names each box after its own label ("TypeScript", "React"): the fieldset holding them is the question
      // (Valerie Group, 2026-10-05 - each was read alone, without its question, and none was ticked).
      const peers = (
        byName.length > 1 ? byName : fieldset ? Array.from(fieldset.querySelectorAll('input[type=checkbox]')) : [el]
      ) as HTMLInputElement[];
      if (peers.length > 1) {
        const groupEl = fieldset ?? el.parentElement?.parentElement ?? scope;
        const key = `cb:${tag(groupEl, 'data-jaa-id', 'f')}`;
        if (seenGroups.has(key)) continue;
        seenGroups.add(key);
        const optionIds = peers.map((p) => tag(p, 'data-jaa-opt', 'o'));
        const options = peers.map((p) => labelFor(p) || p.value);
        // The question: the group's legend, or (Ashby) the label just above a fieldset that has none.
        const above = fieldset?.parentElement
          ? Array.from(fieldset.parentElement.querySelectorAll('label, [class*="title" i], [class*="question" i]')).find(
              (q) => !fieldset.contains(q) && (q.compareDocumentPosition(fieldset) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0 && textOf(q),
            )
          : undefined;
        const label =
          textOf(groupEl.querySelector('legend')) ||
          (above ? textOf(above) : '') ||
          questionInside(peers, options) ||
          containerText(groupEl, peers.length, options) ||
          input.name;
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

    const label = withSection(labelFor(el), el);
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
      // A dropdown drawn as a button (Indeed) shows "Select an option" until something is picked: that is no answer.
      const shown = tagName === 'INPUT' ? input.value : textOf(el);
      value = /^(select|choose|pick|please (select|choose)|--)/i.test(clean(shown)) || clean(shown) === clean(el.getAttribute('aria-placeholder')) ? '' : shown;
      // react-select (Greenhouse): after a pick the box is emptied and the choice is drawn beside it - that is the
      // answer. Reading only the box made every picked dropdown look empty, and each was tried 5 more ways (2026-10-03).
      if (!value.trim()) {
        for (let n: Element | null = el.parentElement, i = 0; n && i < 4 && !value; n = n.parentElement, i++) {
          const chosen = n.querySelector('[class*="singleValue"], [class*="single-value"], [class*="multiValue__label"], [class*="multi-value__label"]');
          if (chosen) value = textOf(chosen);
        }
      }
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
      maxLength: input.maxLength && input.maxLength > 0 ? input.maxLength : counterLimit(el),
      min: input.min || null,
      max: input.max || null,
      accept: type === 'file' ? input.accept || null : null,
    });
  }

  // A question answered with toggle buttons ("Yes" / "No", aria-pressed) is a choice, like radios: Ashby draws its
  // yes/no questions so, and left unanswered they kept Submit greyed out (Valerie Group, 2026-10-05).
  const toggleGroups = new Map<Element, HTMLElement[]>();
  // Pills too: Hirist's notice period is button.pill-option in div.pill-answer-options (Babcom, 2026-10-05).
  for (const b of Array.from(
    scope.querySelectorAll('button[aria-pressed], [role=button][aria-pressed], button[class*="pill" i], button[class*="chip" i], button[class*="option" i]'),
  ) as HTMLElement[]) {
    if (!visible(b) || !b.parentElement) continue;
    const peers = toggleGroups.get(b.parentElement) ?? [];
    peers.push(b);
    toggleGroups.set(b.parentElement, peers);
  }
  for (const [group, buttons] of toggleGroups) {
    const options = buttons.map((b) => clean(b.innerText || b.getAttribute('aria-label')));
    if (buttons.length < 2 || buttons.length > 8 || options.some((o) => !o || o.length > 40)) continue;
    // Only a group that is the whole of its box: a toolbar of "option" buttons beside other things is not a question.
    // (A hidden input storing the answer beside them does not count - Ashby keeps one there.)
    if (Array.from(group.children).filter((c) => c.tagName !== 'INPUT' && visible(c)).length !== buttons.length) continue;
    // The question: the nearest text above the buttons that is not one of them - a label, or the line just above.
    let label = '';
    const above = clean((group.previousElementSibling as HTMLElement | null)?.innerText);
    if (above && above.length <= 300 && !options.includes(above)) label = above.replace(/^\d+[.)]\s*/, '');
    for (let n: Element | null = group; n && n !== scope.parentElement && !label; n = n.parentElement) {
      const own = n.querySelector('label, legend, [class*="title" i], [class*="question" i]');
      const text = own && !group.contains(own) ? textOf(own) : '';
      if (text && !options.includes(text)) label = text.slice(0, 300);
    }
    if (!label) continue;
    const box = group.parentElement ?? group;
    // The hidden tick-box that stores the answer behind the buttons is not a question of its own.
    const hidden = new Set(Array.from(box.querySelectorAll('input[type=checkbox], input[type=radio]')).map((i) => i.getAttribute('data-jaa-id')));
    for (let i = fields.length - 1; i >= 0; i--) if (hidden.has(fields[i].id)) fields.splice(i, 1);
    const chosen = buttons.find((b) => b.getAttribute('aria-pressed') === 'true' || /\b(selected|active|checked|is-selected|is-active)\b/i.test(b.className));
    fields.push({
      id: tag(group, 'data-jaa-id', 'f'),
      kind: 'radio' as FieldKind,
      label: label.replace(/\s*\*\s*$/, ''),
      name: '',
      placeholder: '',
      required: /\*\s*$/.test(label) || isRequired(box, label),
      value: chosen ? clean(chosen.innerText || chosen.getAttribute('aria-label')) : '',
      options,
      optionIds: buttons.map((b) => tag(b, 'data-jaa-opt', 'o')),
      error: errorFor(box),
      maxLength: null,
      min: null,
      max: null,
      accept: null,
    });
  }

  const actions: FormSnapshot['actions'] = [];

  const links: FormSnapshot['links'] = [];
  // Links without an address that a script turns into buttons count too: <a data-toggle="modal">Apply Now</a>
  // opens the application pop-up on many career sites (Bootstrap), <a onclick> or <a class="btn"> does the same.
  const clickables = Array.from(
    scope.querySelectorAll(
      'button, [role=button], input[type=submit], input[type=button], a[href], a[data-toggle], a[data-bs-toggle], a[onclick], a[class~=btn], a[class*="btn-"], a[class*="button"]',
    ),
  ).filter(visible);
  // Ads are never pressed: "APPLY NOW" banners for loans and other job sites (Himalayas, 2026-10-03). Google's own
  // ads come in frames, which are never read; these catch ads drawn into the page itself - an ad slot, a box
  // labelled as an ad, or a link through an ad network. Not "sponsored": a job page itself can be a sponsored job.
  const AD_BOX =
    'ins.adsbygoogle, .adsbygoogle, [id^="google_ads"], [id^="div-gpt-ad"], [data-ad-slot], [data-ad-client], [data-google-query-id], [data-ad], [data-ads], [aria-label="Advertisement" i], [aria-label^="Ad " i], .advertisement, [class~="ad-slot"], [class~="ad-container"], [class~="ad-banner"]';
  const AD_LINK = /(^|\.)(doubleclick\.net|googleadservices\.com|googlesyndication\.com|adservice\.google\.[a-z.]+|taboola\.com|outbrain\.com|adnxs\.com|criteo\.com|amazon-adsystem\.com|mgid\.com|revcontent\.com)$/i;
  const isAd = (el: Element): boolean => {
    if (el.closest(AD_BOX)) return true;
    const href = (el as HTMLAnchorElement).href;
    if (!href) return false;
    try {
      return AD_LINK.test(new URL(href).hostname);
    } catch {
      return false;
    }
  };
  for (const el of clickables) {
    if (isAd(el)) continue;
    // A question's answer button (see toggle groups above) is not a way forward.
    if (el.hasAttribute('data-jaa-opt')) continue;
    const text = clean((el as HTMLElement).innerText || el.getAttribute('aria-label') || (el as HTMLInputElement).value || el.getAttribute('title')).slice(
      0,
      80,
    );
    if (!text) continue;
    const isLink = el.tagName === 'A';
    const lower = text.toLowerCase();
    let kind: FormSnapshot['actions'][number]['kind'] = 'other';
    // Career sites in other languages too (Aethon, Dutch, 2026-09-29): Dutch, German, French, Spanish,
    // Portuguese, Italian, Polish, Swedish, Danish/Norwegian. Whole words only - accented letters break \b.
    const word = (words: string) => new RegExp(`^(${words})(?=$|[\\s!.:,>»→-])`, 'i');
    if (
      /^(submit|submit application|send application|send|finish|complete application|submit & apply|confirm and apply)$/i.test(lower) ||
      // "Submit your application" (Indeed); not "Submit resume" (an upload step) or "Send me jobs like this" (Naukri).
      /^submit( now)?!?$|(submit|send) (your |my |the )?application/.test(lower) ||
      /^(verzenden|versturen|verstuur|indienen|sollicitatie (versturen|verzenden|indienen)|absenden|senden|bewerbung (absenden|senden|abschicken)|jetzt absenden|envoyer|soumettre|envoyer (ma|la) candidature|enviar|enviar (solicitud|candidatura|postulación)|invia|invia candidatura|wyślij|wyślij aplikację|skicka|skicka ansökan|send ansøgning|send søknad)!?$/i.test(
        lower,
      ) ||
      // Russian, Turkish, Indonesian, Vietnamese, Arabic, Hindi, Chinese, Japanese, Korean.
      /^(отправить|отправить отклик|отправить заявку|gönder|başvuruyu gönder|kirim|kirim lamaran|gửi|gửi hồ sơ|nộp hồ sơ|إرسال|أرسل|إرسال الطلب|भेजें|सबमिट करें|आवेदन भेजें|提交|提交申请|发送|送信|応募する|送信する|제출|지원서 제출|보내기)!?$/i.test(
        lower,
      )
    )
      kind = 'submit';
    else if (/^review\b|review (your )?application/.test(lower)) kind = 'review';
    // "Next.js" is a technology tag, not a way forward (Crewfare on Himalayas, 2026-10-05).
    else if (/^(next|continue|proceed|save and continue|save & continue|save & next|next step)\b(?![.-]?js\b)/.test(lower)) kind = 'next';
    else if (
      word(
        'volgende|verder|ga verder|weiter|nächste|fortfahren|suivant|continuer|siguiente|continuar|próximo|avanti|successivo|continua|dalej|nästa|fortsätt|næste|neste|videre',
      ).test(lower) ||
      /^(далее|продолжить|ileri|devam|devam et|lanjut|berikutnya|tiếp tục|tiếp theo|التالي|متابعة|आगे|अगला|जारी रखें|下一步|继续|次へ|続ける|다음|계속)!?$/i.test(
        lower,
      )
    )
      kind = 'next';
    // "Apply with Indeed / LinkedIn / Google" is another site's sign-in, not the application: SmartRecruiters shows it
    // above its own form and it led to an Indeed login (Nagarro, 2026-10-05).
    else if (/^(apply|sign in|log ?in|continue|sign up) (with|using|via|through) (indeed|linkedin|google|seek|xing|glassdoor|facebook|apple|github|microsoft)\b/.test(lower))
      kind = 'other';
    else if (
      /^(easy apply|apply|apply now|apply for this job|apply to this job|i['’]?m interested|quick apply)\b/.test(lower) ||
      // A job board's step before the employer's form (Himalayas: "I'm ready to apply", A5 Labs 2026-10-03).
      /^(i['’]?m ready to apply|ready to apply|(continue|proceed|go) to (apply|the application|application)|apply on (the )?(company|employer)['’]?s? (site|website)|apply externally)\b/.test(
        lower,
      )
    )
      kind = 'apply';
    else if (
      word(
        'solliciteer|solliciteren|nu solliciteren|direct solliciteren|solliciteer nu|solliciteer direct|reageer|reageren|reageer direct|bewerben|jetzt bewerben|bewerbung starten|hier bewerben|postuler|postulez|candidater|je postule|postular|postúlate|postulate|aplicar|inscribirse|candidatar-se|candidatura|candidati|candidati ora|invia la tua candidatura|aplikuj|aplikuj teraz|ansök|sök jobbet|ansøg|søk',
      ).test(lower) ||
      /^(откликнуться|подать заявку|başvur|hemen başvur|başvuru yap|lamar|lamar sekarang|ứng tuyển|ứng tuyển ngay|قدّم الآن|قدم الآن|تقدم الآن|التقديم|تقدم|आवेदन करें|अभी आवेदन करें|申请|立即申请|申请职位|投递简历|応募|今すぐ応募|この求人に応募する|지원하기|지원|바로 지원)!?$/i.test(
        lower,
      )
    )
      kind = 'apply';
    else if (/^(dismiss|close|cancel|discard|not now|done|back)\b/.test(lower)) kind = 'dismiss';
    else if (
      word(
        'annuleren|sluiten|terug|abbrechen|schließen|zurück|annuler|fermer|retour|cancelar|cerrar|volver|annulla|chiudi|indietro|anuluj|zamknij|avbryt|stäng|luk|lukk',
      ).test(lower) ||
      /^(отмена|закрыть|назад|iptal|kapat|geri|batal|tutup|kembali|hủy|đóng|quay lại|إلغاء|إغلاق|رجوع|रद्द करें|बंद करें|वापस|取消|关闭|返回|キャンセル|閉じる|戻る|취소|닫기|뒤로)$/i.test(
        lower,
      )
    )
      kind = 'dismiss';
    if (isLink && kind === 'other') {
      // A short link in words Sudarshan does not know may still be "Apply" in another language.
      if (text.split(/\s+/).length <= 5 && links.length < 40) links.push({ id: tag(el, 'data-jaa-act', 'a'), text, kind, disabled: false });
      continue;
    }
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
  // Only a box you can see: Himalayas keeps reCAPTCHA's hidden helper frame (api2/aframe, no size) on every page, which
  // made a pop-up with "I'm ready to apply" look like a captcha (A5 Labs, 2026-10-03).
  const widget = Array.from(
    document.querySelectorAll(
      'iframe[src*="recaptcha"]:not([src*="invisible"]):not([src*="/aframe"]), iframe[src*="hcaptcha"], iframe[title*="challenge" i], #captcha-internal, iframe[src*="arkoselabs"], iframe[src*="funcaptcha"], iframe[src*="turnstile"]',
    ),
  ).some((el) => {
    if (el.id === 'captcha-internal') return true;
    const r = (el as HTMLElement).getBoundingClientRect();
    return r.width >= 50 && r.height >= 50 && getComputedStyle(el).visibility !== 'hidden';
  });
  const token = Array.from(
    document.querySelectorAll('textarea[name="g-recaptcha-response"], textarea[name="h-captcha-response"], input[name="cf-turnstile-response"]'),
  ).some((t) => ((t as HTMLTextAreaElement).value ?? '').length > 10);
  const captcha = (widget && !token) || textCaptchaPending || /\/checkpoint\/challenge/.test(location.href);

  return {
    url: location.href,
    scopeFound,
    fields,
    actions,
    links,
    text: textOf(scope).slice(0, 3000),
    errors,
    captcha,
  };
}
