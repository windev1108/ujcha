import { useEffect, useRef, useState, useCallback } from 'react'
import { X, Mic, MicOff, Send, Trash2, Bot, Loader2, Power, AlertCircle, SlidersHorizontal, ChevronLeft, Plus, Camera, CameraOff } from 'lucide-react'
import { usePosStore } from '../store/pos-store'
import logoUrl from '../assets/logo.png'
import { setAudioVolume } from '../customer/kunbot/audioVolume'
import { useCameraPresence } from '../customer/kunbot/useCameraPresence'
import { applyProductDiscount } from '../lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────

interface AutoListenState {
  stream: MediaStream
  ctx: AudioContext
  analyser: AnalyserNode
  data: Uint8Array
  speechMinBin: number
  speechMaxBin: number
  intervalId: ReturnType<typeof setInterval>
  recorder: MediaRecorder | null  // speech-scoped; null when idle
  isSpeaking: boolean
  silenceStart: number | null
  recordStart: number | null
}

interface AiCartItem {
  productId: string; name: string; basePrice: number; imageUrl: string | null
  quantity: number; options: Record<string, string>
  optionDetails: { group: string; label: string; priceDelta: number }[]
  optionDelta: number; extras: { id: string; name: string; price: number }[]; note: string
}

interface ChatMessage {
  id: string; role: 'user' | 'assistant'; text: string; pending?: boolean
}

type AiCustomerUpdate =
  | { type: 'ai'; text: string; state: 'speaking' | 'listening' | 'idle' }
  | { type: 'ai-mode'; enabled: boolean; name: string }

type ElectronAI = {
  chat(sessionId: string, message: string, accessToken: string): Promise<void>
  transcribe(buf: ArrayBuffer): Promise<string | null>
  clearSession(sessionId: string): Promise<void>
  hasKey(): Promise<boolean>
  getAppConfig(): Promise<{ enabled: boolean; name: string }>
  setAppConfig(cfg: { enabled?: boolean; name?: string; sttCorrections?: Record<string, string> }): Promise<void>
  onChunk(cb: (d: { sessionId: string; text: string }) => void): () => void
  onDone(cb: (d: { sessionId: string }) => void): () => void
  onError(cb: (d: { sessionId: string; error: string }) => void): () => void
  onAddToCart(cb: (items: AiCartItem[]) => void): () => void
  onUpdateCartItem(cb: (d: { position: number; qty: number }) => void): () => void
  onCheckout(cb: (d: { sessionId: string; paymentMethod: 'cash' | 'transfer' }) => void): () => void
}

const eAPI = (window as unknown as {
  electronAPI?: {
    ai?: ElectronAI
    customer?: { update(d: AiCustomerUpdate | { type: 'idle' }): void }
    tts?: { speak(text: string): Promise<ArrayBuffer | null> }
  }
}).electronAPI

// ── Audio helpers ─────────────────────────────────────────────────────────────

function playBuffer(buf: ArrayBuffer, onEnded?: () => void): void {
  try {
    const blob = new Blob([buf], { type: 'audio/mpeg' })
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)

    const actx = new AudioContext()
    const src = actx.createMediaElementSource(audio)
    const analyser = actx.createAnalyser()
    analyser.fftSize = 256
    src.connect(analyser)
    analyser.connect(actx.destination)
    const freqData = new Uint8Array(analyser.frequencyBinCount)

    let raf: number
    const tick = () => {
      analyser.getByteFrequencyData(freqData)
      const avg = freqData.reduce((s, v) => s + v, 0) / freqData.length
      setAudioVolume(avg / 128)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    const cleanup = () => {
      cancelAnimationFrame(raf)
      setAudioVolume(0)
      URL.revokeObjectURL(url)
      actx.close()
      onEnded?.()
    }
    audio.addEventListener('ended', cleanup, { once: true })
    audio.addEventListener('error', cleanup, { once: true })
    audio.play().catch(cleanup)
  } catch { onEnded?.() }
}

// Whisper hallucinations: substring match (block even if inside longer text)
const HALLUCINATION_CONTAINS = [
  'subscribe', 'ghiền mì gõ', 'cảm ơn bạn đã xem', 'like và share',
  'đừng quên like', 'kênh youtube', 'bấm vào chuông', 'ủng hộ kênh',
  'hãy subscribe', 'xem video', 'xin chào các bạn', 'hẹn gặp lại',
]
// Whisper hallucinations: exact short phrases generated when hearing English/noise
// Kept separate so "cảm ơn" inside a real order sentence is NOT blocked
const HALLUCINATION_EXACT = new Set([
  'cảm ơn', 'cảm ơn.', 'cảm ơn!', 'cảm ơn ạ', 'cảm ơn ạ.',
  'hello', 'hello.', 'hi', 'hi.', 'okay', 'ok', 'yes', 'no',
  'thank you', 'thanks', 'bye', 'goodbye',
  'xin chào', 'xin chào.', 'xin chào!',
  'ừ', 'ừm', 'uh', 'um', 'hmm',
])
function isHallucination(text: string): boolean {
  const lower = text.toLowerCase().trim().replace(/[.,!?]+$/, '')
  if (HALLUCINATION_EXACT.has(lower)) return true
  return HALLUCINATION_CONTAINS.some((h) => lower.includes(h))
}

function float32ToWav(pcm: Float32Array, sampleRate: number): ArrayBuffer {
  const int16 = new Int16Array(pcm.length)
  for (let i = 0; i < pcm.length; i++) int16[i] = Math.max(-32768, Math.min(32767, Math.round(pcm[i] * 32767)))
  const buf = new ArrayBuffer(44 + int16.byteLength)
  const v = new DataView(buf)
  const s = (o: number, str: string) => { for (let i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i)) }
  s(0, 'RIFF'); v.setUint32(4, 36 + int16.byteLength, true); s(8, 'WAVE')
  s(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true)
  s(36, 'data'); v.setUint32(40, int16.byteLength, true)
  new Uint8Array(buf, 44).set(new Uint8Array(int16.buffer))
  return buf
}

async function blobToWav(blob: Blob): Promise<ArrayBuffer> {
  const raw = await blob.arrayBuffer()
  const ctx = new AudioContext()
  const decoded = await ctx.decodeAudioData(raw)
  void ctx.close()
  const SR = 16000
  const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * SR), SR)
  const src = offline.createBufferSource()
  src.buffer = decoded; src.connect(offline.destination); src.start()
  const rendered = await offline.startRendering()
  return float32ToWav(rendered.getChannelData(0), SR)
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  isOpen: boolean
  onClose: () => void
  onCheckout: (paymentMethod: 'cash' | 'transfer') => void
  onListeningChange?: (listening: boolean) => void
  onRegisterClearSession?: (fn: () => void) => void
}

export function AIOrderPanel({ isOpen, onClose, onCheckout, onListeningChange, onRegisterClearSession }: Props) {
  const sessionId = useRef(crypto.randomUUID()).current
  const posConfig = usePosStore((s) => s.posConfig)
  const cart = usePosStore((s) => s.cart)
  const products = usePosStore((s) => s.products)
  const addToCart = usePosStore((s) => s.addToCart)
  const updateQty = usePosStore((s) => s.updateQty)
  const removeFromCart = usePosStore((s) => s.removeFromCart)
  const cartRef = useRef(cart)
  useEffect(() => { cartRef.current = cart }, [cart])

  // Config state
  const [hasKey, setHasKey] = useState<boolean | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [aiName, setAiName] = useState('UjCha')
  const [sttCorrections, setSttCorrections] = useState<Record<string, string>>({})
  const [settingsOpen, setSettingsOpen] = useState(false)
  // Settings edit state (raw lines "wrong→correct")
  const [correctionLines, setCorrectionLines] = useState('')

  // Pronunciation recorder state
  const [pronRecording, setPronRecording] = useState(false)
  const [pronTranscribing, setPronTranscribing] = useState(false)
  const [pronResult, setPronResult] = useState<string | null>(null)
  const [pronCorrect, setPronCorrect] = useState('')
  const pronChunksRef = useRef<Blob[]>([])
  const pronRecorderRef = useRef<MediaRecorder | null>(null)

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const pendingIdRef = useRef<string | null>(null)
  const aiTextAccRef = useRef('')
  const posConfigRef = useRef(posConfig)
  useEffect(() => { posConfigRef.current = posConfig }, [posConfig])
  const isLoadingRef = useRef(false)
  useEffect(() => { isLoadingRef.current = isLoading }, [isLoading])

  const sendMessageRef = useRef<((text: string) => Promise<void>) | null>(null)
  const autoListenRef = useRef<AutoListenState | null>(null)
  const isProcessingRef = useRef(false)
  const enabledRef = useRef(enabled)
  useEffect(() => { enabledRef.current = enabled }, [enabled])

  // ── Camera presence detection ────────────────────────────────────────────────
  const cameraPresence = useCameraPresence()
  const isPresentRef = useRef(cameraPresence.isPresent)
  const isCameraReadyRef = useRef(cameraPresence.isReady)
  useEffect(() => { isPresentRef.current = cameraPresence.isPresent }, [cameraPresence.isPresent])
  useEffect(() => { isCameraReadyRef.current = cameraPresence.isReady }, [cameraPresence.isReady])

  // ── Boot ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const [key, cfg] = await Promise.all([
        eAPI?.ai?.hasKey()?.catch(() => false),
        eAPI?.ai?.getAppConfig()?.catch(() => ({ enabled: false, name: 'UjCha' })),
      ])
      setHasKey(!!key)
      if (cfg) {
        setEnabled(cfg.enabled)
        setAiName(cfg.name)
        const corrections = (cfg as { sttCorrections?: Record<string, string> }).sttCorrections ?? {}
        setSttCorrections(corrections)
        setCorrectionLines(Object.entries(corrections).map(([w, c]) => `${w}→${c}`).join('\n'))
        // Sync AI mode to customer screen on boot so it reflects saved state
        eAPI?.customer?.update({ type: 'ai-mode', enabled: cfg.enabled, name: cfg.name })
      }
      // Add welcome message
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        text: `Xin chào! Em là ${cfg?.name ?? 'UjCha'} — thu ngân AI của UjCha. Anh/chị muốn gọi gì ạ?`,
      }])
    }
    void init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Register order-complete clear function for parent ───────────────────────
  useEffect(() => {
    onRegisterClearSession?.(() => {
      void eAPI?.ai?.clearSession(sessionId)
      isProcessingRef.current = false
      setIsLoading(false)
      setIsTranscribing(false)
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        text: `Xin chào! Em là ${aiName || 'UjCha'} — thu ngân AI. Anh/chị muốn gọi gì ạ?`,
      }])
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRegisterClearSession])

  // ── IPC listeners ────────────────────────────────────────────────────────────
  useEffect(() => {
    const ai = eAPI?.ai
    if (!ai) return

    const unsubChunk = ai.onChunk(({ sessionId: sid, text }) => {
      if (sid !== sessionId) return
      aiTextAccRef.current += text
      eAPI?.customer?.update({ type: 'ai', text: aiTextAccRef.current, state: 'speaking' })
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (last?.id === pendingIdRef.current) {
          return [...prev.slice(0, -1), { ...last, text: last.text + text, pending: true }]
        }
        const id = crypto.randomUUID()
        pendingIdRef.current = id
        return [...prev, { id, role: 'assistant', text, pending: true }]
      })
    })

    const unsubDone = ai.onDone(({ sessionId: sid }) => {
      if (sid !== sessionId) return
      pendingIdRef.current = null
      setIsLoading(false)
      const finalText = aiTextAccRef.current
      aiTextAccRef.current = ''
      setMessages((prev) => prev.map((m) => (m.pending ? { ...m, pending: false } : m)))

      if (!finalText) {
        eAPI?.customer?.update({ type: 'ai', text: '', state: 'idle' })
        return
      }

      // Block VAD while TTS is playing so mic doesn't pick up AI voice
      isProcessingRef.current = true
      eAPI?.customer?.update({ type: 'ai', text: finalText, state: 'speaking' })

      const onTtsDone = () => {
        eAPI?.customer?.update({ type: 'ai', text: finalText, state: 'idle' })
        isProcessingRef.current = false
      }
      if (eAPI?.tts) {
        eAPI.tts.speak(finalText)
          .then(buf => {
            if (buf) playBuffer(buf, onTtsDone)
            else onTtsDone()
          })
          .catch(() => onTtsDone())
      } else {
        onTtsDone()
      }
    })

    const unsubError = ai.onError(({ sessionId: sid, error }) => {
      if (sid !== sessionId) return
      pendingIdRef.current = null
      aiTextAccRef.current = ''
      setIsLoading(false)
      setMessages((prev) => [
        ...prev.filter((m) => !m.pending),
        { id: crypto.randomUUID(), role: 'assistant', text: `⚠️ ${error}` },
      ])
    })

    const unsubCart = ai.onAddToCart((items) => {
      const products = usePosStore.getState().products
      for (const item of items) {
        // Re-derive basePrice from the renderer's products store so discount is
        // always identical to the manual-add path (ProductConfigModal).
        const product = products.find((p) => p.id === item.productId)
        const basePrice = product
          ? (product.finalPrice ?? applyProductDiscount(parseFloat(product.price), product.effectiveDiscountPercent ?? product.discountPercent))
          : item.basePrice
        addToCart({ ...item, basePrice })
      }
      showToast(`Đã thêm: ${items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}`)
    })

    const unsubUpdateCart = ai.onUpdateCartItem?.(({ position, qty }) => {
      const current = cartRef.current
      const idx = position - 1
      if (idx < 0 || idx >= current.length) return
      const item = current[idx]
      if (qty <= 0) {
        removeFromCart(item.cartId)
        showToast(`Đã xoá: ${item.name}`)
      } else {
        updateQty(item.cartId, qty)
        showToast(`Đã cập nhật: ${item.name} × ${qty}`)
      }
    })

    const unsubCheckout = ai.onCheckout(({ paymentMethod }) => {
      onCheckout(paymentMethod)
    })

    return () => { unsubChunk(); unsubDone(); unsubError(); unsubCart(); unsubUpdateCart?.(); unsubCheckout() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, addToCart, updateQty, removeFromCart])

  // ── Auto-scroll ──────────────────────────────────────────────────────────────
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  // ── Toggle enable/disable ────────────────────────────────────────────────────
  const handleToggle = useCallback(async () => {
    const next = !enabled
    setEnabled(next)
    await eAPI?.ai?.setAppConfig({ enabled: next })
    eAPI?.customer?.update({ type: 'ai-mode', enabled: next, name: aiName })
    if (next) showToast(`Đã bật AI ${aiName}`)
    else { showToast('Đã tắt AI'); eAPI?.customer?.update({ type: 'idle' }) }
  }, [enabled, aiName])


  // ── Send message ─────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isLoading || !enabled) return
    setInput('')
    setIsLoading(true)
    pendingIdRef.current = null
    aiTextAccRef.current = ''
    eAPI?.customer?.update({ type: 'ai', text: '...', state: 'speaking' })
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', text: trimmed }])

    // Prepend current cart so AI can reference positions for update_cart_item
    let messageWithContext = trimmed
    const currentCart = cartRef.current
    if (currentCart.length > 0) {
      const cartLines = currentCart.map((item, i) => {
        const opts = Object.entries(item.options ?? {}).map(([k, v]) => `${k}: ${v}`).join(', ')
        return `[${i + 1}] ${item.name} x${item.quantity}${opts ? ` (${opts})` : ''}`
      }).join('\n')
      messageWithContext = `[Giỏ hàng hiện tại:\n${cartLines}]\n${trimmed}`
    }

    await eAPI?.ai?.chat(sessionId, messageWithContext, posConfig.accessToken)
  }, [isLoading, enabled, sessionId, posConfig.accessToken])

  // ── Voice ────────────────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (!enabled) return
    isProcessingRef.current = true
    window.speechSynthesis.cancel()
    eAPI?.customer?.update({ type: 'ai', text: 'Đang nghe...', state: 'listening' })
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 16000, channelCount: 1 } })
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        setIsTranscribing(true)
        try {
          const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type ?? 'audio/webm' })
          const wav = await blobToWav(blob)
          const transcript = await eAPI?.ai?.transcribe(wav)
          if (transcript && !isHallucination(transcript)) await sendMessage(transcript)
          else { isProcessingRef.current = false; showToast('Không nhận ra — thử lại hoặc nhập tay') }
        } catch (e) {
          isProcessingRef.current = false
          const raw = String(e)
          const ipcMatch = /Error invoking remote method[^:]+:\s*(.+)$/.exec(raw)
          showToast('Lỗi STT: ' + (ipcMatch?.[1] ?? raw).slice(0, 100))
        }
        finally { setIsTranscribing(false) }
      }
      mr.start()
      mediaRecorderRef.current = mr
      setIsRecording(true)
    } catch { showToast('Không truy cập được microphone') }
  }, [enabled, sendMessage])

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop()
    mediaRecorderRef.current = null
    setIsRecording(false)
  }, [])

  const handleClear = useCallback(async () => {
    await eAPI?.ai?.clearSession(sessionId)
    setMessages([{
      id: 'welcome', role: 'assistant',
      text: `Xin chào! Em là ${aiName || 'UjCha'} — thu ngân AI của UjCha. Anh/chị muốn gọi gì ạ?`,
    }])
  }, [sessionId, aiName])

  // ── Keep sendMessageRef in sync ──────────────────────────────────────────────
  useEffect(() => { sendMessageRef.current = sendMessage }, [sendMessage])

  // ── Auto-listen (VAD) ────────────────────────────────────────────────────────
  const startAutoListen = useCallback(async () => {
    if (autoListenRef.current) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1 },
      })
      const ctx = new AudioContext()
      const src = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.3
      src.connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount)

      // Speech band: 400–2800 Hz — avoids desk vibration and high-freq hiss
      const binWidth = ctx.sampleRate / analyser.fftSize
      const speechMinBin = Math.max(1, Math.floor(400 / binWidth))
      const speechMaxBin = Math.ceil(2800 / binWidth)

      const THRESHOLD = 58         // keyboard avg ≈ 35-50, voice avg ≈ 60-120
      const SILENCE_MS = 900
      const MAX_RECORD_MS = 8000
      const CONFIRM_TICKS = 3      // 3 × 80ms = 240ms sustained voice to trigger
      const NO_CAM_PROMPT_COOLDOWN = 6000  // ms between "please stand in front" prompts

      let confirmTicks = 0
      let lastNoCamPromptMs = 0

      const s: AutoListenState = {
        stream, ctx, analyser, data,
        speechMinBin, speechMaxBin,
        recorder: null,
        isSpeaking: false,
        silenceStart: null,
        recordStart: null,
        intervalId: setInterval(() => {
          if (!autoListenRef.current) return
          if (mediaRecorderRef.current) return  // manual PTT in progress

          analyser.getByteFrequencyData(data)
          const st = autoListenRef.current

          let sum = 0
          let activeBins = 0
          for (let i = st.speechMinBin; i <= st.speechMaxBin && i < data.length; i++) {
            sum += data[i]
            if (data[i] > THRESHOLD) activeBins++
          }
          const totalBins = st.speechMaxBin - st.speechMinBin + 1
          const avg = sum / totalBins
          // Voice spreads energy across many bins; keyboard click concentrates in few bins
          const isSpeechLike = avg > THRESHOLD && activeBins > totalBins * 0.15

          if (!st.isSpeaking) {
            if (isSpeechLike && enabledRef.current && !isProcessingRef.current && !isLoadingRef.current) {
              confirmTicks++
              if (confirmTicks >= CONFIRM_TICKS) {
                confirmTicks = 0

                // ── Camera presence guard ────────────────────────────────────
                if (isCameraReadyRef.current && !isPresentRef.current) {
                  const now = Date.now()
                  if (now - lastNoCamPromptMs > NO_CAM_PROMPT_COOLDOWN) {
                    lastNoCamPromptMs = now
                    isProcessingRef.current = true
                    const msg = 'Vui lòng đứng trước camera để đặt hàng ạ!'
                    eAPI?.customer?.update({ type: 'ai', text: msg, state: 'speaking' })
                    const done = () => {
                      isProcessingRef.current = false
                      if (enabledRef.current) eAPI?.customer?.update({ type: 'ai', text: '', state: 'listening' })
                    }
                    if (eAPI?.tts) {
                      eAPI.tts.speak(msg).then(buf => buf ? playBuffer(buf, done) : done()).catch(done)
                    } else {
                      done()
                    }
                  }
                  return
                }
                // ─────────────────────────────────────────────────────────────

                st.isSpeaking = true
                st.silenceStart = null
                st.recordStart = Date.now()
                setIsRecording(true)
                eAPI?.customer?.update({ type: 'ai', text: 'Đang nghe...', state: 'listening' })

                // Start a fresh recorder — no timeslice so stop() finalises the WebM file
                const mr = new MediaRecorder(stream)
                const chunks: Blob[] = []
                mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
                mr.onstop = () => {
                  if (chunks.length === 0) {
                    isProcessingRef.current = false
                    setIsTranscribing(false)
                    if (enabledRef.current) eAPI?.customer?.update({ type: 'ai', text: '', state: 'listening' })
                    return
                  }
                  void (async () => {
                    try {
                      const blob = new Blob(chunks, { type: chunks[0]!.type ?? 'audio/webm' })
                      console.log('[VAD] blob:', blob.size, 'bytes, type:', blob.type)
                      const wav = await blobToWav(blob)
                      console.log('[VAD] wav:', wav.byteLength, 'bytes')
                      const transcript = await eAPI?.ai?.transcribe(wav)
                      console.log('[VAD] transcript:', JSON.stringify(transcript))
                      isProcessingRef.current = false
                      if (transcript?.trim() && enabledRef.current && !isHallucination(transcript)) {
                        await sendMessageRef.current?.(transcript)
                      } else {
                        showToast('Không nhận ra giọng nói — thử lại')
                        if (enabledRef.current) eAPI?.customer?.update({ type: 'ai', text: '', state: 'listening' })
                      }
                    } catch (e) {
                      console.error('[VAD] error:', e)
                      isProcessingRef.current = false
                      const raw = String(e)
                      const ipcMatch = /Error invoking remote method[^:]+:\s*(.+)$/.exec(raw)
                      showToast('Lỗi STT: ' + (ipcMatch?.[1] ?? raw).slice(0, 100))
                      if (enabledRef.current) eAPI?.customer?.update({ type: 'ai', text: '', state: 'listening' })
                    } finally {
                      setIsTranscribing(false)
                    }
                  })()
                }
                mr.start()
                st.recorder = mr
              }
            } else {
              confirmTicks = 0
            }
          } else {
            const elapsed = Date.now() - (st.recordStart ?? 0)
            const silenceTriggered = !isSpeechLike
              && st.silenceStart !== null
              && Date.now() - st.silenceStart >= SILENCE_MS

            if (elapsed >= MAX_RECORD_MS || silenceTriggered) {
              st.isSpeaking = false
              confirmTicks = 0
              setIsRecording(false)
              st.silenceStart = null

              isProcessingRef.current = true
              setIsTranscribing(true)
              if (enabledRef.current) eAPI?.customer?.update({ type: 'ai', text: '...', state: 'speaking' })

              // Stopping the recorder finalises the WebM and triggers onstop → STT
              st.recorder?.stop()
              st.recorder = null
            } else if (!isSpeechLike) {
              if (st.silenceStart === null) st.silenceStart = Date.now()
            } else {
              st.silenceStart = null
            }
          }
        }, 80),
      }

      autoListenRef.current = s
      onListeningChange?.(true)
    } catch {
      setToast('Không truy cập được microphone')
      setTimeout(() => setToast(null), 3000)
    }
  }, [onListeningChange])

  const stopAutoListen = useCallback(() => {
    const s = autoListenRef.current
    if (!s) return
    clearInterval(s.intervalId)
    try { s.recorder?.stop() } catch { /* ignore */ }
    s.stream.getTracks().forEach((t) => t.stop())
    void s.ctx.close()
    autoListenRef.current = null
    isProcessingRef.current = false
    setIsRecording(false)
    onListeningChange?.(false)
  }, [onListeningChange])

  // Start microphone as soon as API key is confirmed — stays active regardless of panel open/close
  useEffect(() => {
    if (hasKey === true) void startAutoListen()
    else if (hasKey === false) stopAutoListen()
    return () => stopAutoListen()
  }, [hasKey, startAutoListen, stopAutoListen])

  // Sync customer screen when AI is toggled off
  useEffect(() => {
    if (!enabled) eAPI?.customer?.update({ type: 'ai', text: '', state: 'idle' })
  }, [enabled])

  // ── Pronunciation recorder ───────────────────────────────────────────────────
  const startPronRecording = useCallback(async () => {
    if (pronRecorderRef.current) return
    setPronResult(null)
    setPronCorrect('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 16000, channelCount: 1 } })
      const mr = new MediaRecorder(stream)
      pronChunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) pronChunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        if (pronChunksRef.current.length === 0) return
        setPronTranscribing(true)
        try {
          const blob = new Blob(pronChunksRef.current, { type: pronChunksRef.current[0]?.type ?? 'audio/webm' })
          const wav = await blobToWav(blob)
          const transcript = await eAPI?.ai?.transcribe(wav)
          setPronResult(transcript?.trim() ?? '')
        } finally {
          setPronTranscribing(false)
        }
      }
      mr.start()
      pronRecorderRef.current = mr
      setPronRecording(true)
    } catch { showToast('Không truy cập được microphone') }
  }, [])

  const stopPronRecording = useCallback(() => {
    pronRecorderRef.current?.stop()
    pronRecorderRef.current = null
    setPronRecording(false)
  }, [])

  const addPronCorrection = useCallback(() => {
    if (!pronResult || !pronCorrect.trim()) return
    const wrong = pronResult.trim()
    const correct = pronCorrect.trim()
    setCorrectionLines((prev) => {
      const lines = prev.split('\n').filter((l) => l.trim())
      const idx = lines.findIndex((l) => l.split('→')[0]?.trim() === wrong)
      const newLine = `${wrong}→${correct}`
      if (idx >= 0) lines[idx] = newLine
      else lines.push(newLine)
      return lines.join('\n')
    })
    setPronResult(null)
    setPronCorrect('')
    showToast(`Đã thêm: "${wrong}" → "${correct}"`)
  }, [pronResult, pronCorrect])

  // ── Visual guard — hooks still run when panel is closed (VAD keeps listening) ──
  if (!isOpen) return null

  // ── Loading state ─────────────────────────────────────────────────────────────
  if (hasKey === null) {
    return (
      <div className="fixed right-0 top-14 bottom-0 z-50 flex w-[400px] items-center justify-center border-l border-gray-100 bg-white shadow-2xl">
        <Loader2 className="size-7 animate-spin text-gray-300" />
      </div>
    )
  }

  const handleSaveCorrections = async () => {
    const corrections: Record<string, string> = {}
    correctionLines.split('\n').forEach((line) => {
      const sep = line.indexOf('→')
      if (sep < 1) return
      const wrong = line.slice(0, sep).trim()
      const correct = line.slice(sep + 1).trim()
      if (wrong && correct) corrections[wrong] = correct
    })
    setSttCorrections(corrections)
    await eAPI?.ai?.setAppConfig({ sttCorrections: corrections })
    setSettingsOpen(false)
    showToast('Đã lưu từ vựng STT')
  }

  return (
    <div className="fixed right-0 top-14 bottom-0 z-50 flex w-[400px] flex-col border-l border-gray-100 bg-white shadow-2xl">
      {/* ── Header ── */}
      <header className="flex h-14 shrink-0 items-center gap-2.5 border-b border-gray-100 px-4">
        {settingsOpen ? (
          <>
            <button onClick={() => setSettingsOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100">
              <ChevronLeft className="size-4" />
            </button>
            <p className="flex-1 text-sm font-bold text-gray-800">Sửa lỗi STT</p>
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100">
              <X className="size-4" />
            </button>
          </>
        ) : (
          <>
            {/* Bot avatar */}
            <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-white shadow-sm">
              <Bot className="size-4" />
              {enabled && (
                <span className={`absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-white animate-pulse ${isRecording ? 'bg-red-400' :
                    isLoading || isTranscribing ? 'bg-amber-400' :
                      'bg-green-400'
                  }`} />
              )}
            </div>

            {/* Name */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-800 truncate">{aiName}</p>
              <p className="text-[10px] text-gray-400">
                {!enabled ? 'Đã tắt' :
                  isRecording ? '🔴 Đang ghi âm...' :
                    isTranscribing ? '⟳ Đang nhận dạng...' :
                      isLoading ? '⟳ AI đang xử lý...' :
                        '🎙 Đang lắng nghe'}
              </p>
            </div>

            {/* Camera presence indicator */}
            {cameraPresence.isReady && (
              <div
                title={cameraPresence.isPresent ? 'Phát hiện khách' : 'Chưa có khách trước camera'}
                className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium ${
                  cameraPresence.isPresent
                    ? 'bg-green-50 text-green-600'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {cameraPresence.isPresent
                  ? <Camera className="size-3" />
                  : <CameraOff className="size-3" />}
              </div>
            )}

            {!hasKey && (
              <div className="flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-600">
                <AlertCircle className="size-3" />
                Thiếu API key
              </div>
            )}

            <button onClick={() => setSettingsOpen(true)} title="Sửa lỗi STT" className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100">
              <SlidersHorizontal className="size-4" />
            </button>
            <button onClick={handleToggle} disabled={!hasKey} title={enabled ? 'Tắt AI' : 'Bật AI'}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-40 ${enabled ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
              <Power className="size-4" />
            </button>
            <button onClick={handleClear} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-red-500">
              <Trash2 className="size-4" />
            </button>
            <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100">
              <X className="size-4" />
            </button>
          </>
        )}
      </header>

      {/* ── Settings view ── */}
      {settingsOpen && (
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          {/* ── Pronunciation recorder ── */}
          <div>
            <p className="text-xs font-semibold text-gray-700">Ghi âm mẫu phát âm</p>
            <p className="mt-1 text-[11px] text-gray-400">Nói tên món khó nhận dạng → hệ thống tự tạo correction.</p>
          </div>

          <button
            onMouseDown={() => void startPronRecording()}
            onMouseUp={stopPronRecording}
            onTouchStart={() => void startPronRecording()}
            onTouchEnd={stopPronRecording}
            disabled={pronTranscribing}
            className={`flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 ${pronRecording
                ? 'animate-pulse bg-red-500 text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
          >
            {pronTranscribing ? (
              <><Loader2 className="size-4 animate-spin" /> Đang nhận dạng...</>
            ) : pronRecording ? (
              <><MicOff className="size-4" /> Thả để nhận dạng</>
            ) : (
              <><Mic className="size-4" /> Giữ &amp; nói tên món</>
            )}
          </button>

          {pronResult !== null && (
            <div className="flex flex-col gap-2">
              <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[11px]">
                <p className="text-red-500 font-medium">STT nhận được:</p>
                <p className="mt-0.5 font-mono text-sm font-semibold text-red-700">
                  {pronResult || <span className="italic text-red-400">Không nhận được âm thanh</span>}
                </p>
              </div>
              {pronResult && (
                <>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        value={pronCorrect}
                        onChange={(e) => setPronCorrect(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') addPronCorrection() }}
                        placeholder="Tên đúng (vd: Matcha Latte)"
                        list="pron-menu-list"
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/10"
                      />
                      <datalist id="pron-menu-list">
                        {products.map((p) => <option key={p.id} value={p.name} />)}
                      </datalist>
                    </div>
                    <button
                      onClick={addPronCorrection}
                      disabled={!pronCorrect.trim()}
                      className="flex items-center gap-1 rounded-xl bg-brand px-3 text-sm font-semibold text-white shadow-sm disabled:opacity-40"
                    >
                      <Plus className="size-3.5" /> Thêm
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400">
                    Correction sẽ được thêm vào từ điển bên dưới. Nhấn <strong>Lưu từ điển</strong> để áp dụng.
                  </p>
                </>
              )}
            </div>
          )}

          <div className="border-t border-gray-100 pt-2">
            <p className="text-xs font-semibold text-gray-700">Từ điển sửa lỗi STT</p>
            <p className="mt-1 text-[11px] text-gray-400">Mỗi dòng: <span className="font-mono">sai→đúng</span>. Áp dụng sau khi nhận dạng giọng nói.</p>
          </div>
          <textarea
            value={correctionLines}
            onChange={(e) => setCorrectionLines(e.target.value)}
            rows={8}
            placeholder={"cà phê sữa đá→Cà Phê Sữa Đá\nmatcha latté→Matcha Latte\n1 ly→một ly"}
            className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-xs leading-relaxed text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
          <button onClick={() => void handleSaveCorrections()} className="flex items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white shadow-sm">
            Lưu từ điển
          </button>
          <div className="text-[11px] text-gray-400">
            <p className="font-medium text-gray-500">Hiện có {Object.keys(sttCorrections).length} từ</p>
          </div>
        </div>
      )}

      {/* ── Disabled overlay ── */}
      {!settingsOpen && !enabled && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-gradient-to-b from-emerald-50/60 to-white p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand/60">Thu Ngân AI</p>
          <img src={logoUrl} alt="UjCha AI" className="h-36 w-36 object-contain drop-shadow-lg" />
          <div className="text-center">
            <p className="text-base font-bold text-gray-800">{aiName}</p>
            <p className="mt-1 text-sm text-gray-400">Bật để nhận order bằng giọng nói hoặc chat.</p>
          </div>
          {!hasKey && (
            <p className="flex items-center gap-1 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-600">
              <AlertCircle className="size-3.5" /> Thiếu GOOGLE_API_KEY trong .env
            </p>
          )}
          <button
            onClick={handleToggle}
            disabled={!hasKey}
            className="mt-1 flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand/20 disabled:opacity-40"
          >
            <Power className="size-4" />
            Bật AI {aiName}
          </button>
        </div>
      )}

      {/* ── Chat messages ── */}
      {enabled && (
        <>
          <div className="flex-1 overflow-y-auto space-y-3 px-4 py-4">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="mr-2 mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/10">
                    <Bot className="size-3.5 text-brand" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${msg.role === 'user' ? 'rounded-tr-sm bg-brand text-white' : 'rounded-tl-sm bg-gray-100 text-gray-800'
                    } ${msg.pending ? 'opacity-80' : ''}`}
                >
                  {msg.text}
                  {msg.pending && <span className="ml-1 inline-block animate-pulse text-brand/60">▌</span>}
                </div>
              </div>
            ))}

            {isLoading && !messages.some((m) => m.pending) && (
              <div className="flex justify-start">
                <div className="mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/10">
                  <Bot className="size-3.5 text-brand" />
                </div>
                <div className="rounded-2xl rounded-tl-sm bg-gray-100 px-3.5 py-3">
                  <Loader2 className="size-4 animate-spin text-gray-400" />
                </div>
              </div>
            )}

            {isTranscribing && (
              <div className="flex justify-center">
                <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-600">
                  Đang nhận dạng...
                </span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ── Input ── */}
          <div className="shrink-0 border-t border-gray-100 p-3">
            <div className="flex min-w-0 items-end gap-2">
              <button
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onTouchStart={startRecording}
                onTouchEnd={stopRecording}
                disabled={isLoading || isTranscribing}
                title="Giữ để nói"
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all disabled:opacity-40 ${isRecording ? 'animate-pulse bg-red-500 text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
              >
                {isRecording ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
              </button>

              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendMessage(input) }
                }}
                placeholder={isRecording ? 'Đang nghe...' : 'Nhập order hoặc giữ mic...'}
                disabled={isLoading || isRecording || isTranscribing}
                rows={1}
                className="flex-1 resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/10 disabled:opacity-50"
                style={{ maxHeight: 80 }}
              />

              <button
                onClick={() => void sendMessage(input)}
                disabled={!input.trim() || isLoading || isRecording}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand text-white disabled:opacity-40"
              >
                {isLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
              </button>
            </div>
            {isRecording && (
              <p className="mt-1.5 text-center text-[10px] font-medium text-red-500">
                {autoListenRef.current ? 'Phát hiện giọng nói — đang ghi âm...' : 'Đang ghi âm — thả để gửi'}
              </p>
            )}
          </div>
        </>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-max max-w-[340px] text-center rounded-full bg-gray-800 px-4 py-2 text-xs font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
