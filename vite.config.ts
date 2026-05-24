import { defineConfig } from 'vite';

// GitHub Pages serves the site under /<repo-name>/.
// Override with VITE_BASE=/ when previewing locally with `vite preview` from root.
const base = process.env.VITE_BASE ?? '/congenial-octo-sniffle/';

export default defineConfig({
  base,
  server: {
    host: true,
    port: 5173,
  },
  build: {
    target: 'es2020',
    sourcemap: true,
  },
});
