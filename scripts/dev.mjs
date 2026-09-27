// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

// Dev: server in watch mode + Vite UI on http://localhost:5173.
import { spawn } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const run = (args) => spawn(npm, args, { stdio: 'inherit', shell: process.platform === 'win32' });

const children = [run(['run', 'start:dev', '-w', 'apps/server']), run(['run', 'dev', '-w', 'apps/web'])];
const stop = () => children.forEach((c) => c.kill());
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
children.forEach((c) => c.on('exit', (code) => code && stop()));
