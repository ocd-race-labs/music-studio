import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';

// Every build gets an id. The app compares it with version.json (never cached) and offers a reload when a
// newer version is published, so a browser or a Home Screen app never stays stuck on an old copy.
const BUILD = process.env.GITHUB_SHA?.slice(0, 7) ?? new Date().toISOString();

const versionFile = (): Plugin => ({
  name: 'version-file',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD }) });
  },
});

// GitHub Pages serves the app under /<repo>/; the deploy workflow sets BASE_PATH.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  define: { __BUILD__: JSON.stringify(BUILD) },
  plugins: [react(), versionFile()],
  // Tone.js is most of the bundle (about 200 KB gzipped in total); one file is fine for a family app.
  build: { chunkSizeWarningLimit: 900 },
});
