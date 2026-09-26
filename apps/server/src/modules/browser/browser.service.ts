import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import puppeteer, { Browser, Page } from 'puppeteer-core';
import { EventsService } from '../../common/events/events.service';
import { AgentEventType } from '../../common/events/enums/agent-event-type.enum';
import { SettingsService } from '../settings/settings.service';
import { BROWSER_ARGS, SITES } from './constants/sites.constants';
import { BrowserStatus, SiteId } from './interfaces/site-session.interface';
import { findBrowserExecutable } from './utils/browser-executable.util';
import { BrowserUnavailableError } from './errors/browser-unavailable.error';

/**
 * One persistent browser profile. Users log in once in this window, so no
 * passwords are stored and sites don't see a new device on every run.
 */
@Injectable()
export class BrowserService implements OnApplicationShutdown {
  private readonly logger = new Logger(BrowserService.name);
  private readonly profileDir: string;
  private readonly screenshotsDir: string;
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
  }

  isRunning(): boolean {
    return this.browser?.connected === true;
  }

  async ensure(opts: { visible?: boolean } = {}): Promise<Browser> {
    const wantHeadless = opts.visible ? false : this.settings.get().agent.headless;
    if (this.browser?.connected) {
      if (!(this.launchedHeadless && !wantHeadless)) return this.browser;
      // Logging in needs a visible window.
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
    const page = await this.newPage();
    try {
      return await fn(page);
    } finally {
      await page.close().catch(() => undefined);
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
        const ok = cookies.some(
          (c) =>
            c.domain.replace(/^\./, '').endsWith(site.cookieDomain) &&
            site.authCookies.includes(c.name) &&
            (c.expires === -1 || c.expires > now),
        );
        if (ok) out.add(site.id);
      }
    } catch (err) {
      this.logger.warn(`Cookie check failed: ${(err as Error).message}`);
    }
    return out;
  }

  private async launch(headless: boolean): Promise<Browser> {
    const executablePath = findBrowserExecutable(this.settings.get().agent.browserPath);
    if (!executablePath) {
      throw new BrowserUnavailableError(
        'No Chrome, Edge or Chromium found. Install Google Chrome, or set the browser path in Settings.',
      );
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
      await blank.goto('data:text/html,<title>Sudarshan</title><body style="font:16px system-ui;padding:40px;color:%23444">This window is driven by <b>Sudarshan</b>. You can watch it work, log in to sites, or solve a captcha here.</body>').catch(() => undefined);
    }
    this.events.emit({ type: AgentEventType.BROWSER_STATE, message: 'Browser started', data: { running: true, headless } });
    return browser;
  }
}
