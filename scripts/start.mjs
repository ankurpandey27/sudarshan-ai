// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

// Installs and builds only when needed, then starts the server - showing each step as it happens.
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { request } from 'node:http';
import { join } from 'node:path';
import { fetchModel, haveModel } from './fetch-model.mjs';

const root = join(import.meta.dirname, '..');
const fromRoot = (...parts) => join(root, ...parts);
const port = Number(process.env.SUDARSHAN_PORT || process.env.JAA_PORT || 4747);
const tty = process.stdout.isTTY;
const started = Date.now();

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error(`Node.js 22.13 or newer is required (you have ${process.version}). Get it from https://nodejs.org`);
  process.exit(1);
}

const secs = (ms) => `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;
const done = (text, since) => console.log(`  ✓ ${text}${since ? ` (${secs(Date.now() - since)})` : ''}`);

/** A one-line spinner with elapsed time; without a terminal, a line every 10 seconds. */
function step(text) {
  const since = Date.now();
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  const draw = () => process.stdout.write(`\r  ${frames[i++ % frames.length]} ${text} ${secs(Date.now() - since)}   `);
  if (tty) draw();
  else console.log(`  - ${text}`);
  let told = since;
  const timer = setInterval(
    () => {
      if (tty) return draw();
      if (Date.now() - told < 10_000) return;
      told = Date.now();
      console.log(`    still ${text.toLowerCase()} ${secs(Date.now() - since)}`);
    },
    tty ? 100 : 1000,
  );
  return {
    stop(finalText) {
      clearInterval(timer);
      if (tty) process.stdout.write('\r\x1b[2K');
      if (finalText) done(finalText, since);
    },
  };
}

/** Runs npm quietly behind a spinner; its output is shown only if it fails. */
function npm(label, doneText, args) {
  return new Promise((resolve) => {
    const s = step(label);
    const out = [];
    // One command string: npm is a script on Windows, so it needs a shell.
    const child = spawn(`npm ${args.join(' ')}`, { cwd: root, shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', (d) => out.push(d));
    child.stderr.on('data', (d) => out.push(d));
    child.on('exit', (code) => {
      if (code === 0) {
        s.stop(doneText);
        return resolve();
      }
      s.stop();
      process.stdout.write(Buffer.concat(out));
      console.error(`\n  ✗ ${label} failed (exit code ${code}). The output above says why.`);
      process.exit(code ?? 1);
    });
  });
}

const mtime = (file) => (existsSync(file) ? statSync(file).mtimeMs : 0);
const newest = (dir) =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true }).reduce((max, e) => {
        const full = join(dir, e.name);
        return Math.max(max, e.isDirectory() ? newest(full) : statSync(full).mtimeMs);
      }, 0)
    : 0;

const healthy = () =>
  new Promise((resolve) => {
    const req = request({ host: '127.0.0.1', port, path: '/api/health', timeout: 800 }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => req.destroy());
    req.end();
  });

console.log(`\n  Sudarshan - goes out, finishes the task, returns.\n`);

// Installed with the one-line installer: brought up to date first. A developer's clone (no marker file), or a copy
// with local changes, is left alone; offline, this version starts.
if (existsSync(fromRoot('.sudarshan-auto-update')) && existsSync(fromRoot('.git')) && process.env.SUDARSHAN_AUTO_UPDATE !== '0') await update();

async function update() {
  const s = step('Checking for updates');
  const git = (args) =>
    new Promise((resolve) => {
      const child = spawn('git', args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
      let out = '';
      const timer = setTimeout(() => child.kill(), 30_000);
      child.stdout.on('data', (d) => (out += d));
      child.on('error', () => resolve({ code: 1, out: '' }));
      child.on('exit', (code) => {
        clearTimeout(timer);
        resolve({ code, out: out.trim() });
      });
    });
  const changed = await git(['status', '--porcelain', '--untracked-files=no']);
  if (changed.code !== 0 || changed.out) return s.stop('Not updated - this copy has local changes');
  if ((await git(['fetch', '--quiet', 'origin'])).code !== 0) return s.stop('Could not check for updates (offline?) - starting this version');
  const before = (await git(['rev-parse', 'HEAD'])).out;
  const merged = await git(['merge', '--ff-only', '--quiet', '@{u}']);
  const after = (await git(['rev-parse', 'HEAD'])).out;
  s.stop(merged.code !== 0 ? 'Not updated - the update could not be applied cleanly' : before === after ? 'Up to date' : 'Updated to the latest version');
}

// Install on first run or when package-lock changed.
if (!existsSync(fromRoot('node_modules')) || mtime(fromRoot('package-lock.json')) > mtime(fromRoot('node_modules', '.package-lock.json'))) {
  await npm('Installing dependencies (the first run takes a few minutes)', 'Dependencies installed', ['install', '--no-audit', '--no-fund']);
} else {
  done('Dependencies ready');
}

// Rebuild when sources are newer than the build.
const serverBuilt = mtime(fromRoot('apps', 'server', 'dist', 'main.js'));
const webBuilt = mtime(fromRoot('apps', 'web', 'dist', 'index.html'));
const serverStale = !serverBuilt || newest(fromRoot('apps', 'server', 'src')) > serverBuilt;
const webStale = !webBuilt || newest(fromRoot('apps', 'web', 'src')) > webBuilt || newest(fromRoot('apps', 'web', 'public')) > webBuilt;
if (serverStale || webStale) {
  await npm(`Building the app (${!serverBuilt || !webBuilt ? 'first build' : 'code changed since the last build'})`, 'App built', ['run', 'build']);
} else {
  done('App is up to date');
}

// The answer-matching model: fetched once if an earlier install could not (offline, or installed before it
// existed). Never stops the start - without it, Sudarshan works as before.
if (haveModel()) {
  done('Answer-matching model ready');
} else if (process.env.SUDARSHAN_SKIP_MODEL !== '1') {
  const s = step('Getting the answer-matching model (about 130 MB, once)');
  const ok = await fetchModel({ quiet: true });
  s.stop(ok ? 'Answer-matching model ready' : 'Answer-matching model not available now - starting without it');
}

// Start the server; the spinner runs until it answers, then its own log takes over.
// Exit code 75 asks for a fresh start (after restoring a backup): it is started again.
const RESTART_EXIT_CODE = 75;
let server;
const stop = () => server?.kill('SIGINT');
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
// Windows does not kill child processes with the parent.
process.on('exit', () => server?.kill());

function launch(label = 'Starting the server') {
  const boot = step(label);
  let booting = true;
  server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'dist/main.js', ...(label === 'Starting the server' ? ['--open'] : [])], {
    cwd: fromRoot('apps', 'server'),
    stdio: ['inherit', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: tty ? '1' : '0' },
  });
  // Startup chatter (module and route lists) is held back until the server is up, and shown only if it fails.
  const held = [];
  const forward = (stream, target) =>
    stream.on('data', (d) => {
      if (booting) held.push(d);
      else target.write(d);
    });
  forward(server.stdout, process.stdout);
  forward(server.stderr, process.stderr);

  const poll = setInterval(async () => {
    if (!booting || !(await healthy())) return;
    booting = false;
    clearInterval(poll);
    boot.stop('Server started');
    console.log(`
  Ready in ${secs(Date.now() - started)} - open http://localhost:${port}
  Press Ctrl + C to stop.
`);
  }, 400);

  server.on('exit', (code) => {
    clearInterval(poll);
    if (code === RESTART_EXIT_CODE) {
      if (booting) boot.stop();
      launch('Restarting to apply your backup');
      return;
    }
    if (booting) {
      boot.stop();
      process.stdout.write(Buffer.concat(held));
      console.error(`
  ✗ The server stopped while starting (exit code ${code}). The log above says why.`);
    }
    process.exit(code ?? 0);
  });
}
launch();
