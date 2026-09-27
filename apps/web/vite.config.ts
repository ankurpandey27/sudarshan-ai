// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Dev: the UI runs on Vite and proxies the API to the local agent server.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:4747', changeOrigin: false } },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // sudarshan-ai.html is the start page of the agent's own browser.
    rollupOptions: {
      input: { main: resolve(import.meta.dirname, 'index.html'), sudarshanAi: resolve(import.meta.dirname, 'sudarshan-ai.html') },
      output: { postBanner: '/*! Sudarshan - crafted by Ankur Pandey (https://github.com/ankurpandey27) | MIT License */' },
    },
  },
});
