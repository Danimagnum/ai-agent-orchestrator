import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  base: process.env.DEMO_BASE_PATH ?? '/demos/orchestrator/',
  plugins: [react(), tailwindcss()],
  resolve: {
    dedupe: ['react', 'react-dom', '@xyflow/react'],
    alias: [
      { find: 'next/link', replacement: fileURLToPath(new URL('./src/link.tsx', import.meta.url)) },
      { find: 'next/navigation', replacement: fileURLToPath(new URL('./src/navigation.ts', import.meta.url)) },
      { find: /^\.\.\/lib\/api$/, replacement: fileURLToPath(new URL('./src/api.ts', import.meta.url)) },
      { find: /^\.\.\/lib\/use-run$/, replacement: fileURLToPath(new URL('./src/use-run.ts', import.meta.url)) },
      // Use the portable source; never import backend adapters or provider code.
      { find: '@orchestrator/engine', replacement: fileURLToPath(new URL('../../packages/engine/src/index.ts', import.meta.url)) },
      { find: '@orchestrator/shared', replacement: fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)) },
    ],
  },
  build: { target: 'es2022', outDir: 'dist', sourcemap: false },
});
