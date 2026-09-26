import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const num = (v: string | undefined, d: number): number => {
  if (v === undefined || v.trim() === '') return d;
  const n = Number(v.trim());
  return Number.isFinite(n) ? n : d;
};

// JAA_* are the pre-rename names.
const env = (name: string): string | undefined => process.env[`SUDARSHAN_${name}`] ?? process.env[`JAA_${name}`];

// Existing installs keep their pre-rename data folder.
function defaultDataDir(): string {
  const current = join(homedir(), '.sudarshan');
  const legacy = join(homedir(), '.job-apply-agent');
  return !existsSync(current) && existsSync(legacy) ? legacy : current;
}

// Boot settings only; everything else is edited in the UI and stored in the database.
export const configFactory = () => {
  const dataDir = resolve(env('DATA_DIR') ?? defaultDataDir());
  return {
    server: {
      env: process.env.NODE_ENV ?? 'development',
      // Loopback only: this server controls a logged-in browser.
      host: env('HOST') ?? '127.0.0.1',
      port: num(env('PORT'), 4747),
      apiPrefix: 'api',
      openBrowser: env('OPEN_BROWSER') !== 'false',
    },
    paths: {
      dataDir,
      database: join(dataDir, 'agent.db'),
      secretKey: join(dataDir, 'secret.key'),
      uploads: join(dataDir, 'uploads'),
      browserProfile: join(dataDir, 'browser-profile'),
      screenshots: join(dataDir, 'screenshots'),
      logs: join(dataDir, 'logs'),
      webDist: resolve(env('WEB_DIST') ?? join(__dirname, '..', '..', '..', 'web', 'dist')),
    },
    logging: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
  };
};
