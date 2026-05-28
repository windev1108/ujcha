/**
 * KunCharCanvas — fully code-drawn Shiba Inu mascot.
 * All shapes are canvas 2D paths; no image assets used.
 * Animation is driven by requestAnimationFrame + performance.now().
 */
import { useEffect, useRef } from 'react'
import type { BotState } from './useShibaAnimation'
import { getAudioVolume } from './audioVolume'

// ── Logical canvas size (scaled to displaySize at render) ─────────────────
const W = 340
const H = 400
const CX = W / 2  // 170

// ── Palette ───────────────────────────────────────────────────────────────
const C = {
  furMain:   '#e8781a',
  furLight:  '#f5a840',
  furDark:   '#b85610',
  furDeep:   '#964010',
  earInner:  '#f0a870',
  cream:     '#f8edcc',
  creamDark: '#e8d8a8',
  eyeAmber1: '#e09020',
  eyeAmber2: '#b06010',
  eyeDark:   '#1a0800',
  eyeWhite:  '#ffffff',
  noseDark:  '#1a0800',
  blush:     'rgba(240,110,60,0.20)',
  mouthDark: '#9a3810',
  collarG:   '#2d8a62',
  collarH:   '#3aaa7a',
  tagGold:   '#f5c028',
  tagDark:   '#c09010',
  shadow:    'rgba(80,30,0,0.12)',
}

// ── Animation helpers ──────────────────────────────────────────────────────
function calcBlink(t: number, state: BotState): number {
  const cycle = state === 'speaking' ? 2.2 : 5.5
  const phase = t % cycle
  const dur = 0.13
  if (phase >= dur) return 0
  const h = dur / 2
  return phase < h ? phase / h : (dur - phase) / h
}

// ── Drawing helpers ────────────────────────────────────────────────────────
function ellipsePath(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  ctx.beginPath()
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
}

// ── Ear (one side) ────────────────────────────────────────────────────────
// Draw the right-ear shape at the given coords; used directly for right,
// and via horizontal mirror transform for left — guarantees perfect symmetry.
function drawEarShape(
  ctx: CanvasRenderingContext2D,
  bx: number, by: number,
  tx: number, ty: number,
  bw: number,
) {
  ctx.beginPath()
  ctx.moveTo(bx - bw, by)
  ctx.bezierCurveTo(bx - bw - 12, by - 40, tx - 16, ty + 18, tx, ty)
  ctx.bezierCurveTo(tx + 16, ty + 18, bx + bw + 12, by - 40, bx + bw, by)
  ctx.closePath()
  ctx.fillStyle = C.furDark
  ctx.fill()

  const s = 0.56
  ctx.beginPath()
  ctx.moveTo(bx - bw * s, by - 4)
  ctx.bezierCurveTo(bx - bw * s - 7, by - 30, tx - 8, ty + 22, tx, ty + 8)
  ctx.bezierCurveTo(tx + 8, ty + 22, bx + bw * s + 7, by - 30, bx + bw * s, by - 4)
  ctx.closePath()
  ctx.fillStyle = C.earInner
  ctx.fill()
}

function drawEar(
  ctx: CanvasRenderingContext2D,
  side: 'left' | 'right',
  perkT: number,
) {
  const bx = CX + 92
  const by = 138
  const tx = CX + 112
  const ty = 50 - perkT * 10
  const bw = 38
  if (side === 'right') {
    drawEarShape(ctx, bx, by, tx, ty, bw)
  } else {
    // Mirror the right ear across the canvas centre line
    ctx.save()
    ctx.translate(W, 0)
    ctx.scale(-1, 1)
    drawEarShape(ctx, bx, by, tx, ty, bw)
    ctx.restore()
  }
}

// ── Head ──────────────────────────────────────────────────────────────────
function drawHead(ctx: CanvasRenderingContext2D) {
  const hx = CX, hy = 200, hrx = 138, hry = 118

  // Radial gradient: bright top-left → main → dark edges
  const g = ctx.createRadialGradient(hx - 28, hy - 68, 22, hx, hy, 148)
  g.addColorStop(0,    '#fabe68')
  g.addColorStop(0.32, '#f0921e')
  g.addColorStop(0.68, C.furMain)
  g.addColorStop(0.88, C.furDark)
  g.addColorStop(1,    C.furDeep)

  ellipsePath(ctx, hx, hy, hrx, hry)
  ctx.fillStyle = g
  ctx.fill()

  // Subtle dark rim stroke
  ctx.strokeStyle = C.furDeep
  ctx.lineWidth = 1.5
  ctx.globalAlpha = 0.25
  ctx.stroke()
  ctx.globalAlpha = 1
}

// ── Forehead highlight ────────────────────────────────────────────────────
function drawForeheadHighlight(ctx: CanvasRenderingContext2D) {
  const g = ctx.createRadialGradient(CX - 18, 148, 4, CX - 10, 160, 52)
  g.addColorStop(0,   'rgba(255,210,120,0.55)')
  g.addColorStop(0.6, 'rgba(255,180, 80,0.15)')
  g.addColorStop(1,   'rgba(255,180, 80,0)')
  ellipsePath(ctx, CX - 10, 165, 54, 38)
  ctx.fillStyle = g
  ctx.fill()
}

// ── Cheek fur patch ───────────────────────────────────────────────────────
function drawCheekFur(ctx: CanvasRenderingContext2D, side: 'left' | 'right') {
  const flip = side === 'left' ? -1 : 1
  const cx = CX + flip * 96, cy = 228
  const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 28)
  g.addColorStop(0,   'rgba(248,225,180,0.55)')
  g.addColorStop(1,   'rgba(248,225,180,0)')
  ellipsePath(ctx, cx, cy, 28, 22)
  ctx.fillStyle = g
  ctx.fill()
}

// ── Muzzle ────────────────────────────────────────────────────────────────
function drawMuzzle(ctx: CanvasRenderingContext2D) {
  // Main dome
  const g = ctx.createRadialGradient(CX, 252, 8, CX, 262, 68)
  g.addColorStop(0,   '#fffdf5')
  g.addColorStop(0.5, C.cream)
  g.addColorStop(1,   C.creamDark)
  ellipsePath(ctx, CX, 264, 66, 46)
  ctx.fillStyle = g
  ctx.fill()
}

// ── Nose ─────────────────────────────────────────────────────────────────
function drawNose(ctx: CanvasRenderingContext2D) {
  // Nose body
  ctx.beginPath()
  ctx.ellipse(CX, 236, 14, 10, 0, 0, Math.PI * 2)
  const g = ctx.createRadialGradient(CX - 3, 232, 2, CX, 236, 14)
  g.addColorStop(0, '#3a1a08')
  g.addColorStop(1, C.noseDark)
  ctx.fillStyle = g
  ctx.fill()
  // Highlight
  ctx.beginPath()
  ctx.ellipse(CX - 4, 232, 4.5, 3, -0.4, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.45)'
  ctx.fill()
}

// ── Blush ─────────────────────────────────────────────────────────────────
function drawBlush(ctx: CanvasRenderingContext2D, side: 'left' | 'right') {
  const flip = side === 'left' ? -1 : 1
  const cx = CX + flip * 88, cy = 245
  ctx.save()
  ctx.filter = 'blur(5px)'
  ellipsePath(ctx, cx, cy, 24, 16)
  ctx.fillStyle = C.blush
  ctx.fill()
  ctx.restore()
}

// ── Mouth ─────────────────────────────────────────────────────────────────
function drawMouth(ctx: CanvasRenderingContext2D, open: number) {
  const mx = CX, my = 271
  const mw = 28

  if (open < 0.08) {
    // Closed — gentle smile
    ctx.beginPath()
    ctx.moveTo(mx - mw, my)
    ctx.quadraticCurveTo(mx, my + 13, mx + mw, my)
    ctx.strokeStyle = C.mouthDark
    ctx.lineWidth = 2.8
    ctx.lineCap = 'round'
    ctx.stroke()
    return
  }

  // Open mouth
  const openH = Math.round(26 * open)
  ctx.beginPath()
  ctx.ellipse(mx, my + 6, mw, openH * 0.85, 0, 0, Math.PI * 2)
  ctx.fillStyle = '#1a0800'
  ctx.fill()

  // Tongue (wider mouth)
  if (open > 0.35) {
    ctx.beginPath()
    ctx.ellipse(mx, my + openH * 0.62, mw * 0.55, openH * 0.44, 0, 0, Math.PI * 2)
    ctx.fillStyle = '#cc5858'
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(mx, my + openH * 0.38)
    ctx.lineTo(mx, my + openH * 0.68)
    ctx.strokeStyle = 'rgba(180,50,50,0.4)'
    ctx.lineWidth = 1
    ctx.stroke()
  }

  // Upper lip line
  ctx.beginPath()
  ctx.moveTo(mx - mw, my)
  ctx.quadraticCurveTo(mx, my + 4, mx + mw, my)
  ctx.strokeStyle = C.mouthDark
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  ctx.stroke()
}

// ── Single eye ────────────────────────────────────────────────────────────
function drawEye(
  ctx: CanvasRenderingContext2D,
  ex: number, ey: number,
  r: number,
  blink: number,
  eyeDX: number, eyeDY: number,  // pupil drift
) {
  const ir = r * 0.72    // iris radius
  const pr = r * 0.50    // pupil radius

  // Eyelid clip (blink) — clip region to draw eye inside
  ctx.save()
  ctx.beginPath()
  if (blink > 0.02) {
    // Eyelid drops from top
    const lidH = r * 1.1 * blink
    ctx.ellipse(ex, ey - r * 1.1 + lidH, r * 1.05, r * 1.1, 0, 0, Math.PI * 2)
    ctx.rect(ex - r * 1.2, ey - r * 1.2, r * 2.4, r * 1.2)
    ctx.clip()
    // Eyelid fill (fur colour)
    ellipsePath(ctx, ex, ey, r * 1.05, r * 1.1)
    ctx.fillStyle = C.furMain
    ctx.fill()
    ctx.restore()
    return
  }

  // Sclera (white, slight shadow at bottom)
  const sg = ctx.createRadialGradient(ex, ey - r * 0.2, r * 0.1, ex, ey, r * 1.12)
  sg.addColorStop(0, '#ffffff')
  sg.addColorStop(0.6, '#f5f5f2')
  sg.addColorStop(1, '#ddd8cc')
  ellipsePath(ctx, ex, ey, r, r * 1.1)
  ctx.fillStyle = sg
  ctx.fill()

  // Iris gradient (amber)
  const ig = ctx.createRadialGradient(ex - ir * 0.22, ey - ir * 0.28, ir * 0.08, ex, ey, ir)
  ig.addColorStop(0, '#f0b848')
  ig.addColorStop(0.35, C.eyeAmber1)
  ig.addColorStop(0.7, C.eyeAmber2)
  ig.addColorStop(1, '#804010')
  ellipsePath(ctx, ex + eyeDX, ey + eyeDY, ir, ir * 1.05)
  ctx.fillStyle = ig
  ctx.fill()

  // Limbal ring (dark edge of iris)
  ctx.beginPath()
  ctx.ellipse(ex + eyeDX, ey + eyeDY, ir, ir * 1.05, 0, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(80,30,0,0.55)'
  ctx.lineWidth = 2
  ctx.stroke()

  // Pupil
  ellipsePath(ctx, ex + eyeDX, ey + eyeDY, pr, pr * 1.06)
  const pg = ctx.createRadialGradient(ex + eyeDX - 2, ey + eyeDY - 2, 1, ex + eyeDX, ey + eyeDY, pr)
  pg.addColorStop(0, '#3a1a08')
  pg.addColorStop(1, C.eyeDark)
  ctx.fillStyle = pg
  ctx.fill()

  // Large sparkle (upper-left)
  ellipsePath(ctx, ex + eyeDX - ir * 0.26, ey + eyeDY - ir * 0.3, r * 0.2, r * 0.2)
  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  ctx.fill()

  // Small sparkle (lower-right)
  ellipsePath(ctx, ex + eyeDX + ir * 0.18, ey + eyeDY + ir * 0.05, r * 0.1, r * 0.1)
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.fill()

  // Outline sclera softly
  ellipsePath(ctx, ex, ey, r, r * 1.1)
  ctx.strokeStyle = 'rgba(140,80,20,0.22)'
  ctx.lineWidth = 1.5
  ctx.stroke()

  ctx.restore()
}

// ── Collar ────────────────────────────────────────────────────────────────
function drawCollar(ctx: CanvasRenderingContext2D) {
  const y = 316, h = 22, r = 6
  const x1 = CX - 92, x2 = CX + 92

  // Collar band
  ctx.beginPath()
  ctx.moveTo(x1 + r, y)
  ctx.lineTo(x2 - r, y)
  ctx.quadraticCurveTo(x2, y, x2, y + r)
  ctx.lineTo(x2, y + h - r)
  ctx.quadraticCurveTo(x2, y + h, x2 - r, y + h)
  ctx.lineTo(x1 + r, y + h)
  ctx.quadraticCurveTo(x1, y + h, x1, y + h - r)
  ctx.lineTo(x1, y + r)
  ctx.quadraticCurveTo(x1, y, x1 + r, y)
  ctx.closePath()

  const cg = ctx.createLinearGradient(CX, y, CX, y + h)
  cg.addColorStop(0,   '#38a876')
  cg.addColorStop(0.5, C.collarG)
  cg.addColorStop(1,   '#1e6648')
  ctx.fillStyle = cg
  ctx.fill()

  // Collar highlight stripe
  ctx.beginPath()
  ctx.roundRect(x1 + 4, y + 3, (x2 - x1) - 8, 5, 2)
  ctx.fillStyle = 'rgba(255,255,255,0.20)'
  ctx.fill()

  // Tag drop line
  ctx.beginPath()
  ctx.moveTo(CX, y + h)
  ctx.lineTo(CX, y + h + 8)
  ctx.strokeStyle = '#1e6648'
  ctx.lineWidth = 2
  ctx.stroke()

  // Gold tag disc
  const ty = y + h + 8 + 16
  ellipsePath(ctx, CX, ty, 16, 16)
  const tg = ctx.createRadialGradient(CX - 4, ty - 5, 2, CX, ty, 16)
  tg.addColorStop(0, '#ffe060')
  tg.addColorStop(0.5, C.tagGold)
  tg.addColorStop(1, C.tagDark)
  ctx.fillStyle = tg
  ctx.fill()
  ctx.strokeStyle = '#b08010'
  ctx.lineWidth = 1.5
  ctx.stroke()

  // K letter
  ctx.font = 'bold 14px "Be Vietnam Pro", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#1a3c2e'
  ctx.fillText('K', CX, ty + 0.5)
}

// ── Listening badge (mic icon) ────────────────────────────────────────────
function drawMicBadge(ctx: CanvasRenderingContext2D) {
  const bx = CX + 105, by = 135, br = 18
  // Blue circle
  ellipsePath(ctx, bx, by, br, br)
  ctx.fillStyle = '#3b82f6'
  ctx.fill()
  // Mic body
  ctx.save()
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.roundRect(bx - 5, by - 10, 10, 14, 5)
  ctx.fill()
  // Mic arc
  ctx.beginPath()
  ctx.arc(bx, by + 2, 8.5, Math.PI, 0)
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 2
  ctx.stroke()
  // Mic stem
  ctx.beginPath()
  ctx.moveTo(bx, by + 11)
  ctx.lineTo(bx, by + 15)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(bx - 5, by + 15)
  ctx.lineTo(bx + 5, by + 15)
  ctx.stroke()
  ctx.restore()
}

// ── Drop shadow under whole character ─────────────────────────────────────
function drawShadow(ctx: CanvasRenderingContext2D) {
  const g = ctx.createRadialGradient(CX, H - 30, 5, CX, H - 30, 72)
  g.addColorStop(0, 'rgba(80,30,0,0.18)')
  g.addColorStop(1, 'rgba(80,30,0,0)')
  ellipsePath(ctx, CX, H - 32, 68, 16)
  ctx.fillStyle = g
  ctx.fill()
}

// ── Neck / chest fluff below head ─────────────────────────────────────────
function drawChest(ctx: CanvasRenderingContext2D) {
  // Cream chest fur that peeks above collar
  const g = ctx.createRadialGradient(CX, 310, 10, CX, 310, 58)
  g.addColorStop(0, '#fffcf0')
  g.addColorStop(0.5, C.cream)
  g.addColorStop(1, 'rgba(240,220,170,0)')
  ellipsePath(ctx, CX, 312, 52, 32)
  ctx.fillStyle = g
  ctx.fill()
}

// ── Master draw ───────────────────────────────────────────────────────────
function drawShibaFrame(
  ctx: CanvasRenderingContext2D,
  t: number,
  state: BotState,
) {
  ctx.clearRect(0, 0, W, H)

  // Animation values
  const blink      = calcBlink(t, state)
  const vol        = state === 'speaking'  ? getAudioVolume()                    : 0
  const mouthOpen  = state === 'speaking'  ? Math.max(vol * 1.4, Math.abs(Math.sin(t * 9.5)) * 0.3) : 0
  const perk       = state === 'listening' ? (Math.sin(t * 0.6) * 0.12 + 0.55) : (Math.sin(t * 1.8) * 0.08)
  const headTilt   = state === 'listening' ? (Math.sin(t * 0.52) * 0.02 + 0.16) : Math.sin(t * 0.72) * 0.012
  const bodyBob    = Math.sin(t * 1.15) * 5.5
  const eyeDX      = Math.sin(t * 0.38) * 2.2
  const eyeDY      = Math.sin(t * 0.29) * 1.4
  const tailWag    = Math.sin(t * (state === 'speaking' ? 4.8 : 2.5)) * 0.18 + 0.08

  // ── Drop shadow ───────────────────────────────
  ctx.save()
  ctx.translate(0, bodyBob * 0.35)
  drawShadow(ctx)
  ctx.restore()

  // ── All character parts (bob up/down together) ─
  ctx.save()
  ctx.translate(0, bodyBob)

  // Chest + collar stay level relative to head
  drawChest(ctx)
  drawCollar(ctx)

  // Ears behind head
  ctx.save()
  ctx.translate(CX, 210)
  ctx.rotate(headTilt)
  ctx.translate(-CX, -210)
  drawEar(ctx, 'left',  perk)
  drawEar(ctx, 'right', perk)
  drawHead(ctx)
  drawForeheadHighlight(ctx)
  drawCheekFur(ctx, 'left')
  drawCheekFur(ctx, 'right')
  drawMuzzle(ctx)
  drawBlush(ctx, 'left')
  drawBlush(ctx, 'right')
  // Eyes
  drawEye(ctx, CX - 50, 196, 28, blink, eyeDX, eyeDY)
  drawEye(ctx, CX + 50, 196, 28, blink, eyeDX, eyeDY)
  drawNose(ctx)
  drawMouth(ctx, mouthOpen)

  // Listening mic badge
  if (state === 'listening') drawMicBadge(ctx)
  ctx.restore()  // head tilt

  ctx.restore()  // body bob
}

// ── React component ───────────────────────────────────────────────────────
interface KunCharCanvasProps {
  state: BotState
  displaySize: number
}

export function KunCharCanvas({ state, displaySize }: KunCharCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef  = useRef<BotState>(state)
  stateRef.current = state

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf: number
    const loop = () => {
      drawShibaFrame(ctx, performance.now() / 1000, stateRef.current)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const displayH = Math.round(displaySize * (H / W))

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      style={{ width: displaySize, height: displayH, imageRendering: 'crisp-edges' }}
    />
  )
}
