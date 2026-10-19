import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  base: '/',
  server: { port: 5794, strictPort: true },
  preview: { port: 5794, strictPort: true },
  build: {
    target: ['es2020', 'chrome80', 'safari15'],
    cssTarget: ['chrome80', 'safari15'],
    assetsInlineLimit: 2048,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: {
        tr: resolve(import.meta.dirname, 'index.html'),
        en: resolve(import.meta.dirname, 'en/index.html'),
      },
    },
  },
})
