import { defineConfig, externalizeDepsPlugin, loadEnv } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

const VITE_KEYS = ['VITE_INTERNAL_ANALY_KEY', 'VITE_SPF_RESTAURANT_IDS', 'VITE_KUN_POS_VERSION'] as const
const SECRET_KEYS = ['GOOGLE_API_KEY', 'GROQ_API_KEY', 'VIETTEL_TTS_TOKEN'] as const

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiUrl = env.VITE_API_URL ?? 'http://localhost:5000'
  const wsUrl = apiUrl.replace(/^http/, 'ws')

  const defineMainEnv = Object.fromEntries([
    ['process.env.VITE_API_URL', JSON.stringify(apiUrl)],
    ...[...VITE_KEYS, ...SECRET_KEYS].map((k) => [`process.env.${k}`, JSON.stringify(env[k] ?? '')]),
  ])

  return {
    main: {
      plugins: [externalizeDepsPlugin()],
      build: { outDir: 'out/main' },
      define: defineMainEnv,
    },
    preload: {
      plugins: [externalizeDepsPlugin()],
      build: { outDir: 'out/preload' },
    },
    renderer: {
      root: 'src/renderer',
      build: { outDir: 'out/renderer' },
      plugins: [
        react(),
        {
          name: 'html-csp-inject',
          transformIndexHtml(html) {
            return html.replace(
              /<meta http-equiv="Content-Security-Policy"[^>]*>/,
              `<meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' https: data: blob:; connect-src 'self' ${apiUrl} ${wsUrl};" />`,
            )
          },
        },
      ],
      resolve: {
        alias: { '@': resolve(__dirname, 'src/renderer/src') },
      },
      publicDir: resolve(__dirname, 'src/renderer/src/assets'),
    },
  }
})