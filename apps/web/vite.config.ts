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
  build: { outDir: 'dist', sourcemap: false },
});
