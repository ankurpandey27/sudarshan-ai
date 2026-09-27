// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { ConfigService } from '@nestjs/config';
import { EventsService } from '../src/common/events/events.service';
import { SettingsService } from '../src/modules/settings/settings.service';
import { BrowserService } from '../src/modules/browser/browser.service';

describe('BrowserService logins', () => {
  const make = () => {
    let cookies = [{ name: 'li_at', value: 'session-1', domain: '.linkedin.com', expires: -1 }];
    const svc = new BrowserService({ getOrThrow: () => 'unused', get: () => 4747 } as unknown as ConfigService, {} as SettingsService, new EventsService());
    (svc as unknown as { browser: unknown }).browser = { connected: true, cookies: async () => cookies };
    return { svc, setSession: (value: string) => (cookies = [{ ...cookies[0], value }]) };
  };

  it('treats a login the site turned away as logged out until you log in again', async () => {
    const { svc, setSession } = make();
    expect(await svc.isLoggedIn('linkedin')).toBe(true);

    // LinkedIn showed its login wall although li_at is still there.
    await svc.markLoggedOut('linkedin');
    expect(await svc.isLoggedIn('linkedin')).toBe(false);
    expect(await svc.isLoggedIn('linkedin')).toBe(false);

    // Logging in again gives a new session cookie.
    setSession('session-2');
    expect(await svc.isLoggedIn('linkedin')).toBe(true);
  });

  it('refuses to restart a hidden browser for a login window while it is working', async () => {
    const { svc } = make();
    Object.assign(svc as unknown as Record<string, unknown>, { launchedHeadless: true, settings: { get: () => ({ agent: { headless: true } }) } });
    let release!: () => void;
    const work = svc.busyWith(() => new Promise<void>((r) => (release = r)));
    await expect(svc.ensure({ visible: true })).rejects.toThrow(/using the hidden browser/);
    release();
    await work;
  });
});
