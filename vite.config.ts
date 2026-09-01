import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: './',
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/index-v2-[hash].js',
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
