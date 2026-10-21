import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const projectRoot = dirname(fileURLToPath(import.meta.url))
  const env = loadEnv(mode, projectRoot, '')

  return {
    root: projectRoot,
    envDir: projectRoot,
    build: { outDir: resolve(process.cwd(), 'dist') },
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: env.VITE_DEV_API_TARGET || 'http://localhost:3000',
          changeOrigin: true,
          cookieDomainRewrite: '',
          cookiePathRewrite: '/',
        },
      },
    },
  }
})
