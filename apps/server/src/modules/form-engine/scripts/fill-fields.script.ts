// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import type { FillInstruction, FillResult } from '../interfaces/fill-instruction.interface';

/**
 * Runs in the page (self-contained). Values go through the prototype setter plus
 * input/change events because controlled React inputs ignore `el.value = x`.
 * File and combobox fields are filled from Node instead.
 */
export function fillFieldsInPage(instructions: FillInstruction[]): FillResult[] {
  const fire = (el: Element, ...types: string[]) => {
    for (const eventType of types) el.dispatchEvent(new Event(eventType, { bubbles: true }));
  };
  const setNative = (el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) => {
    const proto =
      el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : el instanceof HTMLSelectElement
          ? HTMLSelectElement.prototype
          : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
  };
  const clickOption = (optEl: Element) => {
    const input = optEl as HTMLInputElement;
    // Hidden native inputs: click their label, which is what users click.
    const target = input.tagName === 'INPUT' && input.labels && input.labels[0] ? input.labels[0] : (optEl as HTMLElement);
    target.scrollIntoView({ block: 'center' });
    (target as HTMLElement).click();
    if (input.tagName === 'INPUT' && !input.checked) {
      input.checked = true;
      fire(input, 'input', 'change');
    }
  };

  const results: FillResult[] = [];
  for (const ins of instructions) {
    const el = document.querySelector(`[data-jaa-id="${ins.id}"]`);
    if (!el) {
      results.push({ id: ins.id, ok: false, error: 'field disappeared' });
      continue;
    }
    try {
      switch (ins.kind) {
        case 'select': {
          const sel = el as HTMLSelectElement;
          const opt = sel.options[ins.optionIndexes[0]];
          if (!opt) throw new Error('option missing');
          sel.focus();
          setNative(sel, opt.value);
          opt.selected = true;
          fire(sel, 'input', 'change', 'blur');
          break;
        }
        case 'radio':
        case 'checkbox-group': {
          if (ins.optionIds.length === 0) throw new Error('no option chosen');
          for (const optId of ins.optionIds) {
            const opt = document.querySelector(`[data-jaa-opt="${optId}"]`);
            if (!opt) throw new Error('option missing');
            const checked =
              (opt as HTMLInputElement).checked === true || opt.getAttribute('aria-checked') === 'true' || opt.getAttribute('aria-pressed') === 'true';
            if (!checked) clickOption(opt);
          }
          break;
        }
        case 'checkbox': {
          const cb = el as HTMLInputElement;
          const want = ins.value === 'true';
          if (cb.checked !== want) {
            const target = cb.labels && cb.labels[0] ? cb.labels[0] : cb;
            (target as HTMLElement).click();
            if (cb.checked !== want) {
              cb.checked = want;
              fire(cb, 'input', 'change');
            }
          }
          break;
        }
        case 'file':
        case 'combobox':
          continue;
        default: {
          const htmlEl = el as HTMLElement;
          htmlEl.scrollIntoView({ block: 'center' });
          htmlEl.focus();
          if (htmlEl.getAttribute('contenteditable') === 'true') {
            htmlEl.textContent = ins.value;
            htmlEl.dispatchEvent(new InputEvent('input', { bubbles: true, data: ins.value, inputType: 'insertText' }));
          } else {
            const input = el as HTMLInputElement;
            setNative(input, ins.value);
            fire(input, 'input', 'change');
          }
          fire(htmlEl, 'blur', 'focusout');
        }
      }
      results.push({ id: ins.id, ok: true });
    } catch (err) {
      results.push({ id: ins.id, ok: false, error: (err as Error).message });
    }
  }
  return results;
}
