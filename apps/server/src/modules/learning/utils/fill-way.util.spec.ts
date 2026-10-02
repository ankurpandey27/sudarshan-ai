// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { FillMethod } from '../../form-engine/enums/fill-method.enum';
import { FillOp } from '../enums/fill-op.enum';
import { fillWayFromOps, isCustomWidget, showsAnswer } from './fill-way.util';

describe('the way you filled a field', () => {
  const { CLICK, TYPE, ENTER, OPTION, CHOICE } = FillOp;

  it.each([
    [[CLICK, OPTION], FillMethod.OPEN_PICK],
    [[CLICK, TYPE, TYPE, OPTION], FillMethod.TYPE_PICK],
    [[CLICK, TYPE, ENTER], FillMethod.TYPE_ENTER],
    [[CHOICE], FillMethod.LABEL_CLICK],
    [[CLICK, TYPE], FillMethod.KEYS],
    // Typed, gave up, then opened the list and clicked: the last way that worked counts.
    [[TYPE, ENTER, CLICK, OPTION], FillMethod.TYPE_PICK],
  ])('%j is %s', (ops, method) => expect(fillWayFromOps(ops)).toBe(method));

  it('learns nothing from a click alone', () => expect(fillWayFromOps([CLICK])).toBeNull());

  it("tells a site's own widget from a plain field", () => {
    expect(isCustomWidget('button||submit|listbox||')).toBe(true); // Indeed's button dropdown
    expect(isCustomWidget('input|combobox|text||list|select')).toBe(true); // Greenhouse's searchable select
    expect(isCustomWidget('div|radiogroup||||')).toBe(true);
    expect(isCustomWidget('input||text||||')).toBe(false);
    expect(isCustomWidget('select||select-one||||')).toBe(false);
    expect(isCustomWidget('input||radio||||')).toBe(false);
    expect(isCustomWidget('fieldset||fieldset|||')).toBe(false); // a group of real radio buttons
  });

  it('knows a placeholder is not an answer', () => {
    expect(showsAnswer('Select an option')).toBe(false);
    expect(showsAnswer('  ')).toBe(false);
    expect(showsAnswer('LinkedIn')).toBe(true);
  });
});
