import { existsSync } from 'node:fs';
import { join } from 'node:path';

// Use an installed Chrome/Edge/Brave instead of downloading a bundled Chromium.
export function findBrowserExecutable(configured?: string): string | null {
  if (configured && existsSync(configured)) return configured;
  const env = process.env;
  const candidates = [
    env.LOCALAPPDATA && join(env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    env.PROGRAMFILES && join(env.PROGRAMFILES, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    env['PROGRAMFILES(X86)'] && join(env['PROGRAMFILES(X86)'], 'Google', 'Chrome', 'Application', 'chrome.exe'),
    env['PROGRAMFILES(X86)'] && join(env['PROGRAMFILES(X86)'], 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    env.PROGRAMFILES && join(env.PROGRAMFILES, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    env.LOCALAPPDATA && join(env.LOCALAPPDATA, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/microsoft-edge',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
  ].filter((p): p is string => typeof p === 'string' && p.length > 0);
  return candidates.find((p) => existsSync(p)) ?? null;
}
