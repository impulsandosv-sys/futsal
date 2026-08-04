import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(async () => {
  const plugins = [react()]
  if (!process.env.VITEST) {
    const { cloudflare } = await import('@cloudflare/vite-plugin')
    plugins.push(cloudflare())
  }

  return {
    plugins,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
      exclude: [...configDefaults.exclude, '**/temp/**', '**/.agents/**'],
      // Incrementa el límite de memoria Heap de Node.js a 4GB para los workers de JSDOM
      execArgv: ['--max-old-space-size=4096'],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules/recharts')) {
              return 'charts'
            }
            if (id.includes('node_modules/xlsx')) {
              return 'spreadsheet'
            }
          }
        }
      }
    }
  }
})