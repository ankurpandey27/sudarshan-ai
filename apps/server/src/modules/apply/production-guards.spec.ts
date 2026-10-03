// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { ApplyService } from './apply.service';
import { MAX_OPEN_TABS, NETWORK_ERROR, TAB_CLOSED } from './constants/apply.constants';

describe('running all day (2026-10-01)', () => {
  it('keeps at most a dozen handed-over tabs open, closing the oldest', () => {
    const none = { matches: () => false } as never;
    const svc = new ApplyService(none, none, none, none, none, none, none, none, none, none, none, none, none, none, none, none);
    const pages = Array.from({ length: MAX_OPEN_TABS + 3 }, () => {
      let closed = false;
      return { isClosed: () => closed, close: jest.fn(async () => void (closed = true)), once: () => undefined };
    });
    const remember = (svc as unknown as { remember: (...a: unknown[]) => void }).remember.bind(svc);
    pages.forEach((p, i) => {
      jest.spyOn(Date, 'now').mockReturnValue(1_000 + i);
      remember(i + 1, p, {}, {}, [], false);
    });
    jest.restoreAllMocks();
    expect(pages.filter((p) => p.close.mock.calls.length > 0)).toEqual(pages.slice(0, 3));
    expect(svc.openTabs()).toHaveLength(MAX_OPEN_TABS);
  });

  it.each([
    'net::ERR_QUIC_PROTOCOL_ERROR at https://example.com',
    'net::ERR_NAME_NOT_RESOLVED at https://example.com',
    'Navigation timeout of 30000 ms exceeded',
    'Instahyre did not open in time (stuck at chrome-error://chromewebdata/)',
  ])('treats "%s" as the connection, not the job', (msg) => expect(NETWORK_ERROR.test(msg)).toBe(true));

  it('does not treat a page error as the connection', () => {
    expect(NETWORK_ERROR.test('Execution context was destroyed')).toBe(false);
    expect(NETWORK_ERROR.test('No apply button found')).toBe(false);
  });
});

describe('a tab you close mid-application (Capco, 2026-10-03)', () => {
  it.each(['Protocol error (Runtime.callFunctionOn): Target closed', 'Session closed. Most likely the page has been closed.', 'Navigating frame was detached Frame'])(
    'reads "%s" as you closing it, not as a failure',
    (msg) => expect(TAB_CLOSED.test(msg)).toBe(true),
  );
  it('does not mistake other errors for it', () => expect(TAB_CLOSED.test('No apply button found')).toBe(false));
});
