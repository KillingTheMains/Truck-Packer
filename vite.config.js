import { defineConfig } from 'vite';

// GitHub Pages serves from https://killingthemains.github.io/Truck-Packer/
// so static assets need the /Truck-Packer/ base prefix.
export default defineConfig({
  base: '/Truck-Packer/',
  // React, Firebase, jsPDF, html2canvas, and LZ-String are loaded from CDNs
  // (kept that way intentionally — see the <script src=…> tags in index.html).
  // Esbuild handles JSX without an explicit React import via the classic
  // runtime + window.React.
  esbuild: {
    jsx: 'transform',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      // Treat globals from CDN scripts as external so Vite doesn't try to
      // resolve them from npm.
      external: [],
    },
  },
});
