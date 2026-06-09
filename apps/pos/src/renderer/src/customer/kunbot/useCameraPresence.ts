import { useEffect, useRef, useState, useCallback } from 'react'

const CANVAS_W = 80
const CANVAS_H = 60
const DIFF_THRESHOLD = 25
const PRESENCE_RATIO = 0.06
const PRESENCE_HOLD_MS = 600
const ABSENCE_HOLD_MS = 1200    // reduced: absence now confirmed faster
const CHECK_INTERVAL_MS = 400
const BG_WARMUP_MS = 1500
// Adaptive background rates: fast when empty (handles auto-exposure drift),
// very slow when occupied so the empty-scene model isn't overwritten by the person.
const ADAPT_ABSENT = 0.15
const ADAPT_PRESENT = 0.008

export interface CameraPresence {
  isPresent: boolean
  isReady: boolean
  error: string | null
}

export function useCameraPresence(): CameraPresence {
  const [presence, setPresence] = useState<CameraPresence>({
    isPresent: false,
    isReady: false,
    error: null,
  })

  const s = useRef({
    stream: null as MediaStream | null,
    video: null as HTMLVideoElement | null,
    canvas: null as HTMLCanvasElement | null,
    ctx: null as CanvasRenderingContext2D | null,
    bg: null as Float32Array | null,
    presenceSince: null as number | null,
    absenceSince: null as number | null,
    interval: null as ReturnType<typeof setInterval> | null,
    startedAt: 0,
  })

  const stop = useCallback(() => {
    const r = s.current
    if (r.interval) { clearInterval(r.interval); r.interval = null }
    if (r.stream) { r.stream.getTracks().forEach(t => t.stop()); r.stream = null }
    r.video = null; r.canvas = null; r.ctx = null; r.bg = null
  }, [])

  useEffect(() => {
    let cancelled = false

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 320 }, height: { ideal: 240 } },
        })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }

        const r = s.current
        r.stream = stream
        r.startedAt = Date.now()

        const video = document.createElement('video')
        video.srcObject = stream
        video.muted = true
        video.playsInline = true
        await video.play()
        r.video = video

        const canvas = document.createElement('canvas')
        canvas.width = CANVAS_W
        canvas.height = CANVAS_H
        r.canvas = canvas
        r.ctx = canvas.getContext('2d', { willReadFrequently: true })!

        setPresence(p => ({ ...p, isReady: true, error: null }))

        r.interval = setInterval(() => {
          if (!r.video || !r.canvas || !r.ctx) return

          r.ctx.drawImage(r.video, 0, 0, CANVAS_W, CANVAS_H)
          const frame = r.ctx.getImageData(0, 0, CANVAS_W, CANVAS_H)
          const cur = frame.data

          // Wait for camera to stabilize, then capture initial background
          if (!r.bg) {
            if (Date.now() - r.startedAt >= BG_WARMUP_MS) {
              r.bg = new Float32Array(cur)
            }
            return
          }

          const bg = r.bg
          let changed = 0
          for (let i = 0; i < bg.length; i += 4) {
            const d = (Math.abs(cur[i] - bg[i]) + Math.abs(cur[i + 1] - bg[i + 1]) + Math.abs(cur[i + 2] - bg[i + 2])) / 3
            if (d > DIFF_THRESHOLD) changed++
          }

          const ratio = changed / (CANVAS_W * CANVAS_H)
          const now = Date.now()

          // Continuously drift background toward current frame.
          // Fast when empty so auto-exposure changes don't cause false positives.
          const rate = ratio > PRESENCE_RATIO ? ADAPT_PRESENT : ADAPT_ABSENT
          for (let i = 0; i < bg.length; i++) bg[i] = bg[i] * (1 - rate) + cur[i] * rate

          if (ratio > PRESENCE_RATIO) {
            r.absenceSince = null
            if (r.presenceSince === null) r.presenceSince = now
            if (now - r.presenceSince >= PRESENCE_HOLD_MS) {
              setPresence(p => p.isPresent ? p : { ...p, isPresent: true })
            }
          } else {
            r.presenceSince = null
            if (r.absenceSince === null) r.absenceSince = now
            if (now - r.absenceSince >= ABSENCE_HOLD_MS) {
              r.absenceSince = now  // reset so it doesn't fire every subsequent tick
              setPresence(p => !p.isPresent ? p : { ...p, isPresent: false })
            }
          }
        }, CHECK_INTERVAL_MS)
      } catch (e) {
        if (!cancelled) {
          setPresence({ isPresent: false, isReady: false, error: String(e) })
        }
      }
    }

    void start()
    return () => { cancelled = true; stop() }
  }, [stop])

  return presence
}
