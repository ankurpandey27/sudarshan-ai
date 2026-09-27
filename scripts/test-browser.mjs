// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

// The browser tests load puppeteer-core, which is ESM-only; Jest can load it from Node 24.9.
// The app itself runs on Node 22.13+, so on older Node these tests are skipped with a note.
import { spawnSync } from 'node:child_process';

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 24 || (major === 24 && minor < 9)) {
  console.log(`\n  Browser tests skipped: they need Node.js 24.9 or newer (you have ${process.version}). The app itself is fine on your version.\n`);
  process.exit(0);
}
const r = spawnSync('npm run test:browser -w apps/server', { stdio: 'inherit', shell: true });
process.exit(r.status ?? 1);
