import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// GitHub Pages serves the app under /<repo>/; the deploy workflow sets BASE_PATH.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  // Tone.js is most of the bundle (about 200 KB gzipped in total); one file is fine for a family app.
  build: { chunkSizeWarningLimit: 900 },
});
