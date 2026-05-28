import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import type { Mesh } from 'three'
import type { BotState } from './useShibaAnimation'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore – png asset import
import logoUrl from '../../assets/logo.png'

interface KunLogoModelProps {
  state: BotState
}

export function KunLogoModel({ state }: KunLogoModelProps) {
  const meshRef = useRef<Mesh>(null)
  const texture = useTexture(logoUrl as string)

  useFrame(() => {
    const t = performance.now() / 1000
    const m = meshRef.current
    if (!m) return

    // Gentle float
    m.position.y = Math.sin(t * 1.15) * 0.09

    // Head tilt / sway
    if (state === 'listening') {
      m.rotation.z = Math.sin(t * 0.5) * 0.035 + 0.12
      m.rotation.x = 0
    } else {
      m.rotation.z = Math.sin(t * 0.72) * 0.016
      m.rotation.x = Math.sin(t * 0.85) * 0.008
    }

    // Speaking: chibi squish-stretch like it's talking
    if (state === 'speaking') {
      const talk = Math.abs(Math.sin(t * 10))
      m.scale.x = 1 + talk * 0.028
      m.scale.y = 1 - talk * 0.018
      m.scale.z = 1
    } else {
      // Subtle breathing scale
      const breath = 1 + Math.sin(t * 1.4) * 0.007
      m.scale.set(breath, breath, 1)
    }
  })

  return (
    <mesh ref={meshRef}>
      {/* Square plane — logo PNG is already round with transparent bg */}
      <planeGeometry args={[2.8, 2.8]} />
      <meshBasicMaterial map={texture} transparent alphaTest={0.01} />
    </mesh>
  )
}
