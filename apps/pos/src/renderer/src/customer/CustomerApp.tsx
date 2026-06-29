import { useEffect, useRef, useState, useCallback } from 'react'
import { QrCode } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import type { CustomerUpdate } from '../types/common'
import logoUrl from '../assets/logo.png'
import NumberFlow from '@number-flow/react'
import { KunBot3D } from './kunbot'

const eAPI = (window as unknown as {
  electronAPI?: { customer: { onUpdate(cb: (d: CustomerUpdate) => void): () => void } }
}).electronAPI

function fmt(n: number) { return n.toLocaleString('vi-VN') + 'đ' }

interface BotState {
  text: string
  state: 'idle' | 'speaking' | 'listening'
}


// ── CustomerApp ───────────────────────────────────────────────────────────────

export function CustomerApp() {
  const [state, setState] = useState<CustomerUpdate>({ type: 'idle' })
  const [bot, setBot] = useState<BotState>({ text: '', state: 'idle' })
  const [aiMode, setAiMode] = useState(false)
  const [aiName, setAiName] = useState('Thu')
  const [time, setTime] = useState(new Date())
  const [animKey, setAnimKey] = useState(0)

  useEffect(() => {
    const off = eAPI?.customer.onUpdate((data) => {
      if (data.type === 'ai') {
        setBot({ text: data.text ?? '', state: (data.state as BotState['state']) ?? 'idle' })
        return
      }
      if (data.type === 'ai-mode') {
        const enabled = data.enabled ?? false
        const name = data.name ?? 'Thu'
        setAiMode(enabled)
        setAiName(name)
        if (enabled) {
          setBot((b) => b.text ? b : { text: `Xin chào! Em là ${name} — AI thu ngân của UjCha. Anh/chị muốn gọi gì ạ?`, state: 'idle' })
        } else {
          setBot({ text: '', state: 'idle' })
        }
        return
      }
      setAnimKey((k) => k + 1)
      setState(data)
      if (data.type !== 'idle') {
        setBot((b) => ({ ...b, state: 'idle' }))
      }
    })
    const ticker = setInterval(() => setTime(new Date()), 1000)
    return () => { off?.(); clearInterval(ticker) }
  }, [])

  useEffect(() => {
    if (state.type !== 'success') return
    const t = setTimeout(() => {
      setAnimKey((k) => k + 1)
      setState({ type: 'idle' })
      setBot(aiMode
        ? { text: `Xin chào! Em là ${aiName} — AI thu ngân của UjCha. Anh/chị muốn gọi gì ạ?`, state: 'idle' }
        : { text: '', state: 'idle' }
      )
    }, 9000)
    return () => clearTimeout(t)
  }, [state, aiMode, aiName])

  return (
    <div style={{ fontFamily: "'Be Vietnam Pro', 'Segoe UI', sans-serif" }} className="flex h-full flex-col overflow-hidden bg-[#0a1f16] text-[#1a3c2e]">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@300;400;600;700;900&display=swap');
        @keyframes pulse-ring { 0%,100%{transform:scale(1);opacity:.35} 50%{transform:scale(1.12);opacity:.08} }
        @keyframes shimmer { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
        @keyframes progress { from{width:0%} to{width:100%} }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }

        @keyframes kun-float {
          0%,100% { transform: translateY(0px) rotate(-1deg); }
          50% { transform: translateY(-18px) rotate(1deg); }
        }
        @keyframes kun-blink {
          0%,88%,100% { transform: scaleY(1); }
          93% { transform: scaleY(0.08); }
          96% { transform: scaleY(1); }
        }
        @keyframes kun-talk {
          from { ry: 3px; }
          to { ry: 8px; }
        }
        @keyframes kun-ring {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.05); opacity: 0; }
        }
        @keyframes kun-listen {
          0%,100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.08); opacity: 0.2; }
        }
        @keyframes star-twinkle {
          0%,100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.3); }
        }
        @keyframes orb-drift {
          0%,100% { transform: translate(0,0) scale(1); }
          33% { transform: translate(20px,-15px) scale(1.05); }
          66% { transform: translate(-12px,10px) scale(0.97); }
        }
      `}</style>

      <AnimatePresence mode="wait">
        {state.type === 'idle' && !aiMode && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.4 }}
            className="flex flex-1 flex-col overflow-hidden"
          >
            <IdleScreen time={time} />
          </motion.div>
        )}

        {state.type === 'idle' && aiMode && (
          <motion.div
            key="ai-idle"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.5, ease: [0.22, 0.68, 0, 1.2] }}
            className="flex flex-1 flex-col overflow-hidden"
          >
            <AiModeScreen bot={bot} aiName={aiName} />
          </motion.div>
        )}

        {state.type === 'cart' && state.items && (
          <motion.div
            key="cart"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.35, ease: [0.22, 0.68, 0, 1.2] }}
            className="flex flex-1 flex-col overflow-hidden"
          >
            <CartScreen key={animKey} items={state.items} total={state.total ?? 0} bot={bot} aiMode={aiMode} />
          </motion.div>
        )}

        {state.type === 'payment' && state.qrUrl && (
          <motion.div
            key="payment"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.4, ease: [0.22, 0.68, 0, 1.2] }}
            className="flex flex-1 flex-col overflow-hidden"
          >
            <PaymentScreen key={animKey} qrUrl={state.qrUrl} amount={state.amount ?? 0} bankInfo={state.bankInfo} bot={bot} aiMode={aiMode} />
          </motion.div>
        )}

        {state.type === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5, ease: [0.22, 0.68, 0, 1.2] }}
            className="flex flex-1 flex-col overflow-hidden"
          >
            <SuccessScreen key={animKey} amount={state.amount ?? 0} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Screens ───────────────────────────────────────────────────────────────────

function IdleScreen({ time }: { time: Date }) {
  const hours = time.getHours()
  const minutes = time.getMinutes()

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-white">
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[#d4ede3]/60" style={{ filter: 'blur(64px)' }} />
        <div className="absolute -left-16 bottom-16 h-72 w-72 rounded-full bg-[#e8f5ee]/80" style={{ filter: 'blur(48px)' }} />
        <div className="absolute left-1/2 top-1/3 h-48 w-48 -translate-x-1/2 rounded-full bg-[#c2e8d4]/40" style={{ filter: 'blur(80px)' }} />
      </div>

      {/* Grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: `linear-gradient(to right, #1a6644 1px, transparent 1px), linear-gradient(to bottom, #1a6644 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 80% 70% at 50% 50%, transparent 40%, white 100%)' }}
      />

      <div className="relative flex flex-1 flex-col items-center justify-center gap-8 px-8">
        {/* Logo + title */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center"
        >
          <div className="relative h-40 w-96 overflow-hidden rounded-full bg-white p-1.5">
            <img src={logoUrl} alt="UjCha" className="h-full w-full object-contain" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-[#1a3c2e]">Matcha & Drinks</h1>
        </motion.div>

        {/* Clock */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="flex flex-col items-center gap-2"
        >
          <div className="rounded-2xl bg-[#f0faf5] px-10 py-6 shadow-inner ring-1 ring-[#c2e8d4]">
            <div className="flex items-center font-mono text-8xl font-black tabular-nums text-[#1a3c2e] tracking-tight">
              <NumberFlow
                value={hours}
                format={{ minimumIntegerDigits: 2 }}
                trend={1}
                transformTiming={{ duration: 600, easing: 'cubic-bezier(0.22, 0.68, 0, 1.2)' }}
                spinTiming={{ duration: 600, easing: 'cubic-bezier(0.22, 0.68, 0, 1.2)' }}
                opacityTiming={{ duration: 300, easing: 'ease' }}
              />
              <span className="mx-2 select-none">:</span>
              <NumberFlow
                value={minutes}
                format={{ minimumIntegerDigits: 2 }}
                trend={1}
                transformTiming={{ duration: 600, easing: 'cubic-bezier(0.22, 0.68, 0, 1.2)' }}
                spinTiming={{ duration: 600, easing: 'cubic-bezier(0.22, 0.68, 0, 1.2)' }}
                opacityTiming={{ duration: 300, easing: 'ease' }}
              />
            </div>
          </div>
          <p className="text-base font-light text-[#5a8f7a] capitalize">
            {time.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex items-center gap-4"
        >
          <div className="h-px w-16 bg-[#c2e8d4]" />
          <p className="text-xs font-semibold tracking-[0.35em] text-[#8abfaa] uppercase">Đặt món tại quầy</p>
          <div className="h-px w-16 bg-[#c2e8d4]" />
        </motion.div>
      </div>

      <div className="relative border-t border-[#e8f0ec] px-8 py-3">
        <p className="text-center text-xs text-[#a0bfb0] tracking-wider">Powered by UjCha POS</p>
      </div>
    </div>
  )
}

// Stars data — generated once so they don't re-randomize on re-renders
const STARS = Array.from({ length: 28 }, (_, i) => ({
  id: i,
  x: (i * 37 + 11) % 100,
  y: (i * 53 + 7) % 100,
  size: ((i * 19) % 3) + 1,
  delay: (i * 0.23) % 3,
  dur: 2 + ((i * 0.17) % 2),
}))

// ── Camera presence preview (customer-side) ────────────────────────────────────

const CAM_W = 80
const CAM_H = 60

function CameraPreviewPanel() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPresent, setIsPresent] = useState(false)
  const [isReady, setIsReady] = useState(false)

  const stopRef = useRef<(() => void) | null>(null)

  const start = useCallback(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = CAM_W; canvas.height = CAM_H
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 320 }, height: { ideal: 240 } },
      })
    } catch { return }

    if (videoRef.current) {
      videoRef.current.srcObject = stream
      await videoRef.current.play().catch(() => { })
    }

    const startedAt = Date.now()
    // Float32Array lets us lerp without integer quantization drift
    let bg: Float32Array | null = null
    let presenceSince: number | null = null
    let absenceSince: number | null = null

    const PRESENCE_RATIO = 0.06
    const DIFF_THRESHOLD = 25
    const PRESENCE_HOLD = 600
    const ABSENCE_HOLD = 1200   // faster than before
    // Adaptive rates: fast update when empty (handles auto-exposure), very slow when occupied
    const ADAPT_ABSENT = 0.15
    const ADAPT_PRESENT = 0.008

    const interval = setInterval(() => {
      if (!videoRef.current) return
      ctx.drawImage(videoRef.current, 0, 0, CAM_W, CAM_H)
      const cur = ctx.getImageData(0, 0, CAM_W, CAM_H).data

      if (!bg) {
        if (Date.now() - startedAt >= 1500) bg = new Float32Array(cur)
        return
      }

      let changed = 0
      for (let i = 0; i < bg.length; i += 4) {
        const d = (Math.abs(cur[i] - bg[i]) + Math.abs(cur[i + 1] - bg[i + 1]) + Math.abs(cur[i + 2] - bg[i + 2])) / 3
        if (d > DIFF_THRESHOLD) changed++
      }

      const ratio = changed / (CAM_W * CAM_H)
      const now = Date.now()

      // Continuously drift background toward current frame — fast when empty,
      // very slow when occupied so the empty-scene model stays fresh for auto-exposure.
      const rate = ratio > PRESENCE_RATIO ? ADAPT_PRESENT : ADAPT_ABSENT
      for (let i = 0; i < bg.length; i++) bg[i] = bg[i] * (1 - rate) + cur[i] * rate

      if (ratio > PRESENCE_RATIO) {
        absenceSince = null
        if (presenceSince === null) presenceSince = now
        if (now - presenceSince >= PRESENCE_HOLD) setIsPresent(true)
      } else {
        presenceSince = null
        if (absenceSince === null) absenceSince = now
        if (now - absenceSince >= ABSENCE_HOLD) {
          absenceSince = now  // reset so it doesn't fire every subsequent tick
          setIsPresent(false)
        }
      }
    }, 400)

    setIsReady(true)

    stopRef.current = () => {
      clearInterval(interval)
      stream.getTracks().forEach(t => t.stop())
    }
  }, [])

  useEffect(() => {
    void start()
    return () => stopRef.current?.()
  }, [start])

  if (!isReady) return null

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="flex flex-col items-center gap-2"
    >
      {/* Preview window */}
      <div
        className={`relative overflow-hidden rounded-2xl shadow-2xl transition-all duration-500
          ${isPresent
            ? 'ring-2 ring-[#2d8a62] shadow-[#2d8a62]/35'
            : 'ring-1 ring-black/10 shadow-black/15'
          }`}
        style={{ width: 180, height: 135 }}
      >
        {/* Mirrored video */}
        <video
          ref={videoRef}
          autoPlay muted playsInline
          className="h-full w-full object-cover"
          style={{ transform: 'scaleX(-1)' }}
        />

        {/* Viewfinder corner brackets */}
        <div className="pointer-events-none absolute inset-0">
          {/* top-left */}
          <div className="absolute left-3 top-3">
            <div className={`absolute left-0 top-0 h-px w-5 transition-colors ${isPresent ? 'bg-[#4ade80]' : 'bg-white/70'}`} />
            <div className={`absolute left-0 top-0 h-5 w-px transition-colors ${isPresent ? 'bg-[#4ade80]' : 'bg-white/70'}`} />
          </div>
          {/* top-right */}
          <div className="absolute right-3 top-3">
            <div className={`absolute right-0 top-0 h-px w-5 transition-colors ${isPresent ? 'bg-[#4ade80]' : 'bg-white/70'}`} />
            <div className={`absolute right-0 top-0 h-5 w-px transition-colors ${isPresent ? 'bg-[#4ade80]' : 'bg-white/70'}`} />
          </div>
          {/* bottom-left */}
          <div className="absolute bottom-9 left-3">
            <div className={`absolute bottom-0 left-0 h-px w-5 transition-colors ${isPresent ? 'bg-[#4ade80]' : 'bg-white/70'}`} />
            <div className={`absolute bottom-0 left-0 h-5 w-px transition-colors ${isPresent ? 'bg-[#4ade80]' : 'bg-white/70'}`} />
          </div>
          {/* bottom-right */}
          <div className="absolute bottom-9 right-3">
            <div className={`absolute bottom-0 right-0 h-px w-5 transition-colors ${isPresent ? 'bg-[#4ade80]' : 'bg-white/70'}`} />
            <div className={`absolute bottom-0 right-0 h-5 w-px transition-colors ${isPresent ? 'bg-[#4ade80]' : 'bg-white/70'}`} />
          </div>
        </div>

        {/* Status bar */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-3 py-2">
          <div className="flex items-center justify-center gap-1.5">
            <div className={`h-1.5 w-1.5 rounded-full transition-colors ${isPresent ? 'bg-[#4ade80] animate-pulse' : 'bg-white/40'}`} />
            <p className={`text-[10px] font-bold tracking-wide transition-colors ${isPresent ? 'text-[#4ade80]' : 'text-white/55'}`}>
              {isPresent ? 'Đã nhận diện' : 'Nhìn vào camera'}
            </p>
          </div>
        </div>

        {/* Presence glow ring */}
        {isPresent && (
          <div className="pointer-events-none absolute inset-0 animate-pulse rounded-2xl ring-2 ring-inset ring-[#2d8a62]/50" />
        )}
      </div>

      {/* Caption */}
      <p className={`text-[11px] font-semibold tracking-wide transition-colors duration-300
        ${isPresent ? 'text-[#2d8a62]' : 'text-[#8abfaa]/70'}`}>
        {isPresent ? 'Sẵn sàng đặt hàng!' : 'Đứng vào đây để order'}
      </p>
    </motion.div>
  )
}

// ── AiModeScreen ──────────────────────────────────────────────────────────────

function AiModeScreen({ bot, aiName }: { bot: BotState; aiName: string }) {
  return (
    <div
      className="relative flex flex-1 flex-col items-center justify-center overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #f0faf5 0%, #ffffff 40%, #f5fdf8 70%, #eef8f2 100%)' }}
    >
      {/* Soft sparkle dots */}
      <div className="pointer-events-none absolute inset-0">
        {STARS.map((s) => (
          <div
            key={s.id}
            className="absolute rounded-full bg-[#2d8a62]"
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: s.size + 1,
              height: s.size + 1,
              opacity: 0.07,
              animation: `star-twinkle ${s.dur}s ease-in-out ${s.delay}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Ambient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute rounded-full"
          style={{
            width: 520, height: 520, top: '5%', left: '50%',
            transform: 'translateX(-50%)',
            background: 'radial-gradient(circle, #bbf7d0 0%, transparent 70%)',
            animation: 'orb-drift 8s ease-in-out infinite',
            filter: 'blur(70px)', opacity: 0.55,
          }} />
        <div className="absolute rounded-full"
          style={{
            width: 340, height: 340, bottom: '10%', right: '5%',
            background: 'radial-gradient(circle, #d1fae5 0%, transparent 70%)',
            animation: 'orb-drift 11s ease-in-out 2s infinite',
            filter: 'blur(55px)', opacity: 0.5,
          }} />
        <div className="absolute rounded-full"
          style={{
            width: 280, height: 280, top: '15%', left: '3%',
            background: 'radial-gradient(circle, #fde68a 0%, transparent 70%)',
            animation: 'orb-drift 9s ease-in-out 1s infinite reverse',
            filter: 'blur(50px)', opacity: 0.3,
          }} />
      </div>

      {/* Subtle grid */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: `linear-gradient(to right, #2d8a62 1px, transparent 1px), linear-gradient(to bottom, #2d8a62 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }} />

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 0.68, 0, 1.2] }}
        className="relative flex flex-col items-center gap-5 z-10"
      >
        {/* Name label above */}
        <div className="flex flex-col items-center gap-1">
          <p className="text-[10px] font-bold tracking-[0.5em] text-[#2d8a62]/55 uppercase">AI Thu ngân</p>
          <motion.h2
            key={aiName}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-5xl font-black tracking-tight text-[#1a3c2e]"
          >
            {aiName}
          </motion.h2>
        </div>

        {/* Shiba 3D character */}
        <KunBot3D bot={bot} size={300} />
      </motion.div>

      {/* Camera presence preview — bottom-left overlay */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="absolute bottom-16 left-8 z-10"
      >
        <CameraPreviewPanel />
      </motion.div>

      {/* Bottom watermark */}
      <div className="absolute bottom-5 left-0 right-0 flex justify-center">
        <p className="text-[10px] font-semibold tracking-[0.4em] text-[#2d8a62]/25 uppercase">UjCha POS · AI Cashier</p>
      </div>
    </div>
  )
}

function BotOverlay({ bot }: { bot: BotState }) {
  const isActive = bot.state !== 'idle' || !!bot.text
  if (!isActive) return null
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, x: 20 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.8, x: 20 }}
      transition={{ duration: 0.3 }}
      className="absolute bottom-20 right-2 z-10"
    >
      <KunBot3D bot={bot} size={110} />
    </motion.div>
  )
}

function CartScreen({ items, total, bot, aiMode }: {
  items: Array<{
    name: string; quantity: number; price: number; imageUrl?: string | null
    optionDetails?: Array<{ group: string; label: string; priceDelta: number }>
    extras?: Array<{ id: string; name: string; price: number }>
    note?: string
  }>
  total: number
  bot: BotState
  aiMode: boolean
}) {
  const count = items.length
  const prevCountRef = useRef(0)
  const [newItemIndex, setNewItemIndex] = useState<number | null>(null)

  useEffect(() => {
    const prev = prevCountRef.current
    if (items.length > prev) {
      setNewItemIndex(items.length - 1)
      const t = setTimeout(() => setNewItemIndex(null), 600)
      prevCountRef.current = items.length
      return () => clearTimeout(t)
    }
    prevCountRef.current = items.length
  }, [items.length])

  const cols = count <= 1 ? 1 : count <= 4 ? 2 : 3
  const isVeryCompact = count > 9
  const isCompact = count > 4
  const gridGap = isVeryCompact ? 4 : 8
  const cardPad = isVeryCompact ? 'px-2 py-1.5' : isCompact ? 'px-3 py-2' : 'px-4 py-3'
  const imgSize = isVeryCompact ? 'h-8 w-8' : isCompact ? 'h-10 w-10' : 'h-12 w-12'
  const imgText = isVeryCompact ? 'text-base' : 'text-lg'
  const nameSize = isVeryCompact ? 'text-[11px]' : isCompact ? 'text-xs' : 'text-sm'
  const priceSize = isVeryCompact ? 'text-[11px]' : 'text-sm'
  const showSub = !isVeryCompact

  return (
    <div className="relative flex flex-1 flex-col bg-white" style={{ minHeight: 0 }}>
      {/* Header */}
      <div className="border-b border-[#e8f0ec] bg-white px-6 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f0faf5] ring-1 ring-[#c2e8d4]">
            <img src={logoUrl} alt="UjCha" className="h-6 w-6 object-contain" />
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-widest text-[#8abfaa] uppercase">Đơn hàng</p>
            <h2 className="text-base font-bold text-[#1a3c2e]">Xác nhận món của bạn</h2>
          </div>
          <motion.div
            key={count}
            initial={{ scale: 1.4 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            className="ml-auto flex h-7 min-w-7 items-center justify-center rounded-full bg-[#2d8a62] px-2.5 text-xs font-bold text-white"
          >
            {items.reduce((s, i) => s + i.quantity, 0)}
          </motion.div>
        </div>
      </div>

      {/* Items grid */}
      <div
        className="flex-1 bg-[#f8fbf9] overflow-hidden"
        style={{ padding: gridGap, display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoRows: 'min-content', alignContent: 'start', gap: gridGap, width: '100%', boxSizing: 'border-box' }}
      >
        {items.map((item, i) => {
          const isNew = i === newItemIndex
          return (
            <motion.div
              key={`${item.name}-${i}`}
              initial={isNew ? { opacity: 0, scale: 0.93, y: 6 } : false}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={isNew ? { duration: 0.32, ease: [0.22, 0.68, 0, 1.2] } : undefined}
              className={`flex min-w-0 items-center gap-2 rounded-xl bg-white shadow-sm ring-1 ${cardPad} ${isNew ? 'ring-[#2d8a62]/50' : 'ring-[#e4ede8]'}`}
            >
              {item.imageUrl ? (
                <img src={item.imageUrl} alt={item.name} className={`${imgSize} shrink-0 rounded-lg object-cover ring-1 ring-[#e4ede8]`} />
              ) : (
                <div className={`${imgSize} ${imgText} shrink-0 flex items-center justify-center rounded-lg bg-[#f0faf5] font-black text-[#2d8a62]/50 ring-1 ring-[#c2e8d4]`}>
                  {item.name[0]}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className={`truncate font-semibold text-[#1a3c2e] leading-tight ${nameSize}`}>{item.name}</p>
                {showSub && item.optionDetails && item.optionDetails.length > 0 && (
                  <p className={`truncate text-[#8abfaa] mt-0.5 ${nameSize}`}>
                    {item.optionDetails.map((o, idx) => <span key={o.group}>{idx > 0 && ' · '}{o.label}</span>)}
                  </p>
                )}
                {showSub && item.extras && item.extras.length > 0 && (
                  <p className={`truncate text-[#8abfaa] mt-0.5 ${nameSize}`}>
                    {item.extras.map((e, idx) => <span key={e.id}>{idx > 0 && ' · '}+{e.name}</span>)}
                  </p>
                )}
                {showSub && item.note && <p className={`truncate italic text-[#b07a40] mt-0.5 ${nameSize}`}>* {item.note}</p>}
                <div className={`mt-0.5 inline-flex items-center rounded-full bg-[#f0faf5] px-1.5 py-px font-semibold text-[#5a8f7a] ring-1 ring-[#c2e8d4] ${isVeryCompact ? 'text-[9px]' : 'text-[10px]'}`}>×{item.quantity}</div>
              </div>
              <div className="shrink-0 text-right">
                <p className={`font-bold tabular-nums text-[#1a3c2e] ${priceSize}`}>{fmt(item.price)}</p>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Total */}
      <div className="border-t border-[#e8f0ec] bg-white px-5 py-3 shrink-0">
        <div className="flex items-center justify-between rounded-2xl bg-[#1a3c2e] px-6 py-3">
          <span className="font-semibold text-white/70">Tổng cộng</span>
          <span className="text-3xl font-black tabular-nums text-white">{fmt(total)}</span>
        </div>
      </div>

      {/* KunBot overlay — only when AI mode is on */}
      {aiMode && (
        <AnimatePresence>
          <BotOverlay bot={bot} />
        </AnimatePresence>
      )}
    </div>
  )
}

function PaymentScreen({ qrUrl, amount, bankInfo, bot, aiMode }: {
  qrUrl: string; amount: number
  bankInfo?: { bankCode: string; accountNumber: string; accountName: string }
  bot: BotState
  aiMode: boolean
}) {
  return (
    <div className="relative flex flex-1 flex-col bg-white">
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="border-b border-[#e8f0ec] px-8 py-5"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f0faf5] ring-1 ring-[#c2e8d4]">
            <img src={logoUrl} alt="UjCha" className="h-7 w-7 object-contain" />
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-widest text-[#8abfaa] uppercase">Thanh toán</p>
            <h2 className="text-lg font-bold text-[#1a3c2e]">Quét mã để thanh toán</h2>
          </div>
        </div>
      </motion.div>

      <div className="flex flex-1 items-center justify-center px-8 py-6">
        <div className="flex gap-14 items-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.22, 0.68, 0, 1.2] }}
            className="flex flex-col items-center gap-4"
          >
            <div className="rounded-3xl bg-white p-5 shadow-2xl shadow-[#2d8a62]/10 ring-1 ring-[#e4ede8]">
              <img src={qrUrl} alt="QR thanh toán" className="h-64 w-64 rounded-xl" />
            </div>
            <div className="flex items-center gap-2 rounded-full bg-[#f0faf5] px-4 py-2 ring-1 ring-[#c2e8d4]">
              <QrCode className="size-4 text-[#2d8a62]" />
              <span className="text-sm text-[#5a8f7a]">Dùng app ngân hàng để quét</span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex flex-col gap-6"
          >
            <div>
              <p className="text-xs font-bold tracking-widest text-[#8abfaa] uppercase">Số tiền</p>
              <p className="mt-1 text-6xl font-black tabular-nums text-[#1a3c2e] leading-none">{fmt(amount)}</p>
            </div>
            {bankInfo && (
              <div className="space-y-3 rounded-2xl bg-[#f8fbf9] p-5 ring-1 ring-[#e4ede8]">
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold tracking-widest text-[#8abfaa] uppercase">Ngân hàng</p>
                  <p className="text-xl font-bold text-[#2d8a62]">{bankInfo.bankCode}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold tracking-widest text-[#8abfaa] uppercase">Số tài khoản</p>
                  <p className="font-mono text-xl font-bold text-[#1a3c2e] tracking-widest">{bankInfo.accountNumber}</p>
                </div>
                {bankInfo.accountName && (
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-bold tracking-widest text-[#8abfaa] uppercase">Chủ tài khoản</p>
                    <p className="font-semibold text-[#1a3c2e]">{bankInfo.accountName}</p>
                  </div>
                )}
              </div>
            )}
            <div className="flex items-center gap-3 rounded-2xl bg-amber-50 px-5 py-4 ring-1 ring-amber-200">
              <div className="relative flex h-3 w-3 shrink-0">
                <div className="absolute inset-0 rounded-full bg-amber-400" style={{ animation: 'pulse-ring 1.5s ease-in-out infinite' }} />
                <div className="relative h-3 w-3 rounded-full bg-amber-400" />
              </div>
              <span className="font-semibold text-amber-700">Đang chờ thanh toán…</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-[#e4ede8]">
              <div className="h-full rounded-full" style={{ animation: 'shimmer 2s linear infinite', background: 'linear-gradient(90deg, transparent, #2d8a62, transparent)', backgroundSize: '400px 100%' }} />
            </div>
          </motion.div>
        </div>
      </div>

      {aiMode && (
        <AnimatePresence>
          <BotOverlay bot={bot} />
        </AnimatePresence>
      )}
    </div>
  )
}

function SuccessScreen({ amount }: { amount: number }) {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center gap-10 overflow-hidden bg-white px-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#d4ede3]/60" style={{ filter: 'blur(100px)' }} />
        <div className="absolute -right-20 top-10 h-64 w-64 rounded-full bg-[#e8f5ee]/80" style={{ filter: 'blur(60px)' }} />
      </div>

      <div className="relative flex h-44 w-44 items-center justify-center">
        {[1.6, 1.35, 1.1].map((scale, i) => (
          <div key={i} className="absolute inset-0 rounded-full border-2 border-[#2d8a62]/20"
            style={{ transform: `scale(${scale})`, animation: `pulse-ring ${2 + i * 0.4}s ease-in-out infinite`, animationDelay: `${i * 0.2}s` }} />
        ))}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 0.68, 0, 1.2] }}
          className="relative flex h-44 w-44 items-center justify-center rounded-full bg-[#f0faf5] shadow-2xl shadow-[#2d8a62]/20 ring-4 ring-[#c2e8d4]"
        >
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
            <motion.path
              d="M16 42L32 58L64 24"
              stroke="#2d8a62"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.6, delay: 0.3, ease: 'easeOut' }}
            />
          </svg>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="text-center"
      >
        <h2 className="text-5xl font-black text-[#1a3c2e]">Thanh toán thành công!</h2>
        <p className="mt-4 text-6xl font-black tabular-nums text-[#2d8a62]">{fmt(amount)}</p>
      </motion.div>

      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.4 }}
        className="text-2xl text-[#8abfaa]"
      >
        Cảm ơn quý khách! Hẹn gặp lại 🍵
      </motion.p>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="absolute bottom-8 left-8 right-8"
      >
        <p className="mb-2 text-xs text-[#a0bfb0]">Đang trở về màn hình chính…</p>
        <div className="h-1 overflow-hidden rounded-full bg-[#e4ede8]">
          <div className="h-full rounded-full bg-[#2d8a62]" style={{ animation: 'progress 9s linear forwards' }} />
        </div>
      </motion.div>
    </div>
  )
}
