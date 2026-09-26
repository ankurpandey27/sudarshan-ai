// Installs and builds only when needed, then starts the server.
import { spawnSync, spawn } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const p = (...parts) => join(root, ...parts);

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error(`Node.js 22.13 or newer is required (you have ${process.version}). Get it from https://nodejs.org`);
  process.exit(1);
}

const mtime = (file) => (existsSync(file) ? statSync(file).mtimeMs : 0);
const newest = (dir) =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true }).reduce((max, e) => {
        const full = join(dir, e.name);
        return Math.max(max, e.isDirectory() ? newest(full) : statSync(full).mtimeMs);
      }, 0)
    : 0;

const npm = (...args) => {
  const r = spawnSync('npm', args, { cwd: root, stdio: 'inherit', shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

// Install on first run or when package-lock changed.
if (!existsSync(p('node_modules')) || mtime(p('package-lock.json')) > mtime(p('node_modules', '.package-lock.json'))) {
  console.log('Installing dependencies (first run takes a few minutes)...');
  npm('install', '--no-audit', '--no-fund');
}

// Rebuild when sources are newer than the build.
const serverBuilt = mtime(p('apps', 'server', 'dist', 'main.js'));
const webBuilt = mtime(p('apps', 'web', 'dist', 'index.html'));
if (!serverBuilt || !webBuilt || newest(p('apps', 'server', 'src')) > serverBuilt || newest(p('apps', 'web', 'src')) > webBuilt) {
  console.log('Building...');
  npm('run', 'build');
}

const server = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'dist/main.js', '--open'], {
  cwd: p('apps', 'server'),
  stdio: 'inherit',
});
const stop = () => server.kill('SIGINT');
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
// Windows does not kill child processes with the parent.
process.on('exit', () => server.kill());
server.on('exit', (code) => process.exit(code ?? 0));
