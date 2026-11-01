import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        landing: fileURLToPath(new URL('./landing.html', import.meta.url)),
        workspace: fileURLToPath(new URL('./index.html', import.meta.url)),
        legacy: fileURLToPath(new URL('./legacy.html', import.meta.url)),
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 8741,
    watch: {
      ignored: ['**/.claude/worktrees/**', '**/.local/**', '**/.foundation-build/**', '**/dist/**'],
    },
    proxy: { '/api': 'http://127.0.0.1:4000', '/mcp': 'http://127.0.0.1:4010' },
  },
  preview: { host: '127.0.0.1', port: 8741 },
});
