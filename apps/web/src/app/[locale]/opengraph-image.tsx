import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'UjCha — Matcha & Đồ uống thủ công'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#1a3c34',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Radial glow accents */}
        <div
          style={{
            position: 'absolute',
            top: '-120px',
            right: '-120px',
            width: '480px',
            height: '480px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(153,214,179,0.14) 0%, transparent 70%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-80px',
            left: '-80px',
            width: '320px',
            height: '320px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(153,214,179,0.08) 0%, transparent 70%)',
          }}
        />

        {/* Logo circle */}
        <div
          style={{
            width: '88px',
            height: '88px',
            borderRadius: '24px',
            background: 'rgba(255,255,255,0.10)',
            border: '1.5px solid rgba(255,255,255,0.16)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '36px',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: '#99d6b3',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: '18px',
                height: '18px',
                borderRadius: '50% 50% 50% 0',
                background: '#1a3c34',
                transform: 'rotate(-45deg)',
              }}
            />
          </div>
        </div>

        {/* Brand name */}
        <div
          style={{
            fontSize: '96px',
            fontWeight: 700,
            color: '#ffffff',
            letterSpacing: '-3px',
            lineHeight: 1,
            marginBottom: '20px',
          }}
        >
          UjCha
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: '28px',
            fontWeight: 400,
            color: 'rgba(255,255,255,0.72)',
            letterSpacing: '0.3px',
          }}
        >
          Matcha &amp; Đồ uống thủ công
        </div>

        {/* Bottom label */}
        <div
          style={{
            position: 'absolute',
            bottom: '48px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div style={{ width: '40px', height: '1px', background: 'rgba(255,255,255,0.24)' }} />
          <span
            style={{
              fontSize: '13px',
              color: 'rgba(255,255,255,0.44)',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
            }}
          >
            Nguồn gốc bền vững · Chất lượng cao
          </span>
          <div style={{ width: '40px', height: '1px', background: 'rgba(255,255,255,0.24)' }} />
        </div>
      </div>
    ),
    { ...size },
  )
}
