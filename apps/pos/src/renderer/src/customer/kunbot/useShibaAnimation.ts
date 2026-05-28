import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group, Mesh } from 'three'

export type BotState = 'idle' | 'speaking' | 'listening'

export interface ShibaRefs {
  groupRef: React.RefObject<Group | null>
  leftLidRef: React.RefObject<Mesh | null>
  rightLidRef: React.RefObject<Mesh | null>
  mouthRef: React.RefObject<Mesh | null>
  leftEyeRef: React.RefObject<Mesh | null>
  rightEyeRef: React.RefObject<Mesh | null>
}

export function useShibaAnimation(state: BotState): ShibaRefs {
  const groupRef = useRef<Group>(null)
  const leftLidRef = useRef<Mesh>(null)
  const rightLidRef = useRef<Mesh>(null)
  const mouthRef = useRef<Mesh>(null)
  const leftEyeRef = useRef<Mesh>(null)
  const rightEyeRef = useRef<Mesh>(null)

  useFrame(() => {
    const t = performance.now() / 1000
    const g = groupRef.current
    if (!g) return

    // Gentle float + head tilt sway
    g.position.y = Math.sin(t * 1.1) * 0.055
    g.rotation.z = state === 'listening'
      ? Math.sin(t * 0.5) * 0.035 + 0.1
      : Math.sin(t * 0.7) * 0.012
    // Subtle front-back rock
    g.rotation.x = Math.sin(t * 0.9) * 0.008

    // Pupil slight movement (alive look)
    const eyeX = Math.sin(t * 0.4) * 0.018
    const eyeY = Math.sin(t * 0.3) * 0.01
    if (leftEyeRef.current) {
      leftEyeRef.current.position.x = -0.01 + eyeX
      leftEyeRef.current.position.y = eyeY
    }
    if (rightEyeRef.current) {
      rightEyeRef.current.position.x = 0.01 + eyeX
      rightEyeRef.current.position.y = eyeY
    }

    // Blink
    const cycle = state === 'speaking' ? 2.0 : 5.2
    const phase = t % cycle
    const dur = 0.14
    let lidY = 0.015
    if (phase < dur) {
      const half = dur / 2
      lidY = phase < half ? (phase / half) * 2.4 : ((dur - phase) / half) * 2.4
    }
    if (leftLidRef.current) leftLidRef.current.scale.y = lidY
    if (rightLidRef.current) rightLidRef.current.scale.y = lidY

    // Mouth (speaking)
    if (mouthRef.current) {
      if (state === 'speaking') {
        mouthRef.current.visible = true
        const open = Math.abs(Math.sin(t * 10.5))
        mouthRef.current.scale.y = 0.5 + open * 0.7
        mouthRef.current.scale.x = 0.9 + open * 0.12
      } else {
        mouthRef.current.visible = false
      }
    }
  })

  return { groupRef, leftLidRef, rightLidRef, mouthRef, leftEyeRef, rightEyeRef }
}
