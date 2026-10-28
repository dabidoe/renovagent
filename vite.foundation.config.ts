import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Compile the diagnostic and its shared modules separately; the product preview bundle is unchanged.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    outDir: '.foundation-build',
    emptyOutDir: true,
    rollupOptions: { input: fileURLToPath(new URL('./foundation.html', import.meta.url)) },
  },
});
