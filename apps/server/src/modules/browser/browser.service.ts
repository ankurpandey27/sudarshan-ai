// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import puppeteer, { Browser, Page } from 'puppeteer-core';
import { EventsService } from '../../common/events/events.service';
import { AgentEventType } from '../../common/events/enums/agent-event-type.enum';
import { SettingsService } from '../settings/settings.service';
import { BROWSER_ARGS, SITES } from './constants/sites.constants';
import { authFingerprint } from './utils/auth-fingerprint.util';
import { BrowserStatus, SiteId } from './interfaces/site-session.interface';
import { findBrowserExecutable } from './utils/browser-executable.util';
import { BrowserUnavailableError } from './errors/browser-unavailable.error';

/**
 * One persistent browser profile. Users log in once in this window, so no
 * passwords are stored and sites don't see a new device on every run.
 */
@Injectable()
export class BrowserService implements OnApplicationShutdown {
  private inUse = 0;
  private readonly staleLogins = new Map<SiteId, string>();
  private readonly logger = new Logger(BrowserService.name);
  private readonly profileDir: string;
  private readonly screenshotsDir: string;
  private readonly startPage: string;
  private browser: Browser | null = null;
  private launching: Promise<Browser> | null = null;
  private launchedHeadless = false;

  constructor(
    config: ConfigService,
    private readonly settings: SettingsService,
    private readonly events: EventsService,
  ) {
    this.profileDir = config.getOrThrow<string>('paths.browserProfile');
    this.screenshotsDir = config.getOrThrow<string>('paths.screenshots');
    this.startPage = `http://localhost:${config.get<number>('server.port', 4747)}/sudarshan-ai.html`;
  }

  isRunning(): boolean {
    return this.browser?.connected === true;
  }

  async ensure(opts: { visible?: boolean } = {}): Promise<Browser> {
    const wantHeadless = opts.visible ? false : this.settings.get().agent.headless;
    if (this.browser?.connected) {
      if (!(this.launchedHeadless && !wantHeadless)) return this.browser;
      // Logging in needs a visible window, which means restarting the hidden one - never mid-task.
      if (this.inUse > 0) {
        throw new Error(
          'Sudarshan is using the hidden browser for an application or search right now - try Log in again in a minute, or stop the agent first.',
        );
      }
      await this.close();
    }
    this.launching ??= this.launch(wantHeadless).finally(() => {
      this.launching = null;
    });
    return this.launching;
  }

  async newPage(): Promise<Page> {
    const browser = await this.ensure();
    const page = await browser.newPage();
    page.setDefaultTimeout(30_000);
    page.setDefaultNavigationTimeout(45_000);
    return page;
  }

  async withPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
    return this.busyWith(async () => {
      const page = await this.newPage();
      try {
        return await fn(page);
      } finally {
        await page.close().catch(() => undefined);
      }
    });
  }

  /** Marks the browser as in use while `work` runs, so it is not restarted underneath it. */
  async busyWith<T>(work: () => Promise<T>): Promise<T> {
    this.inUse++;
    try {
      return await work();
    } finally {
      this.inUse--;
    }
  }

  async status(): Promise<BrowserStatus> {
    const executable = findBrowserExecutable(this.settings.get().agent.browserPath);
    const loggedIn = this.isRunning() ? await this.loggedInSites() : new Set<SiteId>();
    return {
      running: this.isRunning(),
      executable,
      headless: this.launchedHeadless,
      sessions: SITES.map((s) => ({ id: s.id, label: s.label, loggedIn: loggedIn.has(s.id) })),
    };
  }

  /**
   * The site showed its login wall although its cookie is there - the session ended on the
   * site's side. Treat it as logged out until the cookie changes (you log in again).
   */
  async markLoggedOut(site: SiteId): Promise<void> {
    const target = SITES.find((s) => s.id === site);
    if (!target || !this.browser?.connected) return;
    const cookies = await this.browser.cookies().catch(() => []);
    const auth = cookies.filter((c) => c.domain.replace(/^\./, '').endsWith(target.cookieDomain) && target.authCookies.includes(c.name));
    if (auth.length) this.staleLogins.set(site, authFingerprint(auth));
  }

  async isLoggedIn(site: SiteId): Promise<boolean> {
    return (await this.loggedInSites()).has(site);
  }

  async openLogin(site: SiteId): Promise<void> {
    const target = SITES.find((s) => s.id === site);
    if (!target) throw new Error(`Unknown site ${site}`);
    await this.ensure({ visible: true });
    const page = await this.newPage();
    const loggedIn = await this.isLoggedIn(site);
    await page.goto(loggedIn ? target.homeUrl : target.loginUrl, { waitUntil: 'domcontentloaded' });
    await page.bringToFront();
  }

  async openForUser(url: string): Promise<void> {
    await this.ensure({ visible: true });
    const page = await this.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => undefined);
    await page.bringToFront();
  }

  async screenshot(page: Page, name: string): Promise<string | null> {
    try {
      mkdirSync(this.screenshotsDir, { recursive: true });
      const file = join(this.screenshotsDir, `${name.replace(/[^\w-]+/g, '_')}-${Date.now()}.png`);
      await page.screenshot({ path: file as `${string}.png` });
      return file;
    } catch (err) {
      this.logger.warn(`Screenshot failed: ${(err as Error).message}`);
      return null;
    }
  }

  async close(): Promise<void> {
    const b = this.browser;
    this.browser = null;
    if (b?.connected) await b.close().catch(() => undefined);
  }

  async onApplicationShutdown(): Promise<void> {
    await this.close();
  }

  private async loggedInSites(): Promise<Set<SiteId>> {
    const out = new Set<SiteId>();
    if (!this.browser?.connected) return out;
    try {
      const cookies = await this.browser.cookies();
      const now = Date.now() / 1000;
      for (const site of SITES) {
        const auth = cookies.filter(
          (c) => c.domain.replace(/^\./, '').endsWith(site.cookieDomain) && site.authCookies.includes(c.name) && (c.expires === -1 || c.expires > now),
        );
        // A cookie the site already turned away (login wall) does not count until it changes.
        const stale = this.staleLogins.get(site.id);
        if (auth.length && stale !== authFingerprint(auth)) out.add(site.id);
        if (stale && stale !== authFingerprint(auth)) this.staleLogins.delete(site.id);
      }
    } catch (err) {
      this.logger.warn(`Cookie check failed: ${(err as Error).message}`);
    }
    return out;
  }

  private async launch(headless: boolean): Promise<Browser> {
    const executablePath = findBrowserExecutable(this.settings.get().agent.browserPath);
    if (!executablePath) {
      throw new BrowserUnavailableError('No Chrome, Edge or Chromium found. Install Google Chrome, or set the browser path in Settings.');
    }
    mkdirSync(this.profileDir, { recursive: true });
    this.logger.log(`Launching browser (${headless ? 'headless' : 'visible'}): ${executablePath}`);
    let browser: Browser;
    try {
      browser = await puppeteer.launch({
        executablePath,
        headless,
        userDataDir: this.profileDir,
        defaultViewport: null,
        args: BROWSER_ARGS,
        ignoreDefaultArgs: ['--enable-automation'],
        protocolTimeout: 120_000,
      });
    } catch (err) {
      const msg = (err as Error).message;
      if (/lock|already running|in use|SingletonLock/i.test(msg)) {
        throw new BrowserUnavailableError('The agent browser profile is already open. Close the other agent window and retry.');
      }
      throw new BrowserUnavailableError(`Could not start the browser: ${msg}`);
    }
    this.browser = browser;
    this.launchedHeadless = headless;
    browser.once('disconnected', () => {
      if (this.browser === browser) this.browser = null;
      this.events.emit({ type: AgentEventType.BROWSER_STATE, message: 'Browser closed', data: { running: false } });
    });
    const [blank] = await browser.pages();
    if (blank && blank.url() === 'about:blank') {
      await blank.goto(this.startPage).catch(() => undefined);
    }
    this.events.emit({ type: AgentEventType.BROWSER_STATE, message: 'Browser started', data: { running: true, headless } });
    return browser;
  }
}
