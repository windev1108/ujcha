import { ipcMain } from 'electron'
import type { BrowserWindow } from 'electron'
import { fetchMenuAndToppings, invalidateMenuCache, getCachedMenuNames } from './agent'
import { runAgentTurnGemini, clearGeminiSession } from './agentGemini'
import { transcribeAudio } from './vtcStt'
import { readSubConfig, writeSubConfig } from '../../renderer/src/store/config-store'

const API_BASE = process.env['VITE_API_URL'] ?? 'http://localhost:5000'

export interface AiAppConfig {
  enabled: boolean
  name: string
  /** Custom STT text corrections: { "wrong phrase": "correct phrase" } */
  sttCorrections?: Record<string, string>
}

const DEFAULT_APP_CONFIG: AiAppConfig = { enabled: false, name: 'UjCha', sttCorrections: {} }

function applyCorrections(text: string, corrections: Record<string, string>): string {
  if (!corrections || Object.keys(corrections).length === 0) return text
  let result = text
  for (const [wrong, correct] of Object.entries(corrections)) {
    if (!wrong.trim()) continue
    try {
      result = result.replace(new RegExp(wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), correct)
    } catch { /* invalid regex — skip */ }
  }
  return result
}

function getGeminiKey(): string {
  return process.env['GOOGLE_API_KEY'] ?? ''
}

const STT_BASE_VOCAB = 'Cà phê, trà sữa, sinh tố, matcha, bạc xỉu, đen đá, sữa đá, americano, latte, cappuccino, espresso, trân châu, phô mai. Size S, M, L. Ít đường, vừa ngọt, nhiều đường, không đường. Ít đá, vừa đá, nhiều đá, không đá. Thêm, bớt, đổi, xoá, thanh toán, tiền mặt, chuyển khoản.'

function buildSttPrompt(menuNames: string[]): string {
  if (menuNames.length === 0) return STT_BASE_VOCAB
  return `${menuNames.join(', ')}. ${STT_BASE_VOCAB}`
}

function getAppConfig(): AiAppConfig {
  const saved = readSubConfig('aiApp') as Partial<AiAppConfig> | null
  return { ...DEFAULT_APP_CONFIG, ...saved }
}

export function registerAiHandlers(staffWin: () => BrowserWindow | null) {
  ipcMain.handle('ai:chat', async (_, sessionId: string, message: string, accessToken: string) => {
    const apiKey = getGeminiKey()
    const cfg = getAppConfig()
    const win = staffWin()
    if (!apiKey) {
      win?.webContents.send('ai:error', { sessionId, error: 'Chưa cấu hình GOOGLE_API_KEY trong file .env.' })
      return
    }

    let menu: import('./types').AiMenuItem[]
    let toppings: { id: string; name: string; price: number }[]
    try {
      ; ({ menu, toppings } = await fetchMenuAndToppings(API_BASE, accessToken))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      win?.webContents.send('ai:error', { sessionId, error: `Không thể tải menu: ${msg}` })
      return
    }

    await runAgentTurnGemini(
      {
        sessionId,
        userMessage: message,
        apiKey,
        model: 'gemini-2.5-flash',
        apiBaseUrl: API_BASE,
        accessToken,
        aiName: cfg.name,
        onChunk: (text) => win?.webContents.send('ai:chunk', { sessionId, text }),
        onAddToCart: (items) => win?.webContents.send('ai:addToCart', items),
        onUpdateCartItem: (position, qty) => win?.webContents.send('ai:updateCartItem', { position, qty }),
        onCheckout: (pm) => win?.webContents.send('ai:checkout', { sessionId, paymentMethod: pm }),
        onDone: () => win?.webContents.send('ai:done', { sessionId }),
        onError: (err) => win?.webContents.send('ai:error', { sessionId, error: err }),
      },
      menu,
      toppings,
    )
  })

  ipcMain.handle('ai:transcribe', async (_, audioBuffer: ArrayBuffer) => {
    const sttPrompt = buildSttPrompt(getCachedMenuNames())
    const transcript = await transcribeAudio(Buffer.from(audioBuffer), sttPrompt)  // throws on API error
    if (!transcript) return null
    const cfg = getAppConfig()
    return applyCorrections(transcript, cfg.sttCorrections ?? {})
  })

  ipcMain.handle('ai:clearSession', (_, sessionId: string) => clearGeminiSession(sessionId))

  ipcMain.handle('ai:invalidateMenu', () => invalidateMenuCache())

  ipcMain.handle('ai:hasKey', () => !!getGeminiKey())

  ipcMain.handle('ai:getAppConfig', () => getAppConfig())

  ipcMain.handle('ai:setAppConfig', (_, config: Partial<AiAppConfig>) => {
    const current = getAppConfig()
    writeSubConfig('aiApp', { ...current, ...config })
  })
}
