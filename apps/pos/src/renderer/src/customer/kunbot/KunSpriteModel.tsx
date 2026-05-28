/**
 * Layered sprite-stack model — each body part is a textured plane
 * positioned at a different Z depth. renderOrder + depthTest=false
 * guarantees correct draw order. The parallax between layers as the
 * group rotates creates the 3D illusion.
 *
 * Layer order (back → front):
 *   1 tail  2 back-body  3 front-body  4 head-base  5 ears  6 feet  7 face  8 mouth-overlay
 */
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import type { Group, Mesh } from 'three'
import type { BotState } from './useShibaAnimation'

// @ts-ignore
import headNoFaceUrl from '../../../../assets/kun-3d/head-no-face.png'
// @ts-ignore
import faceUrl       from '../../../../assets/kun-3d/face.png'
// @ts-ignore
import earsUrl       from '../../../../assets/kun-3d/ears.png'
// @ts-ignore
import frontBodyUrl  from '../../../../assets/kun-3d/font-body.png'
// @ts-ignore
import backBodyUrl   from '../../../../assets/kun-3d/back-body.png'
// @ts-ignore
import tailUrl       from '../../../../assets/kun-3d/tail.png'
// @ts-ignore
import feetUrl       from '../../../../assets/kun-3d/fet.png'

// ── Shared material props ────────────────────────────────────────────────────
const MAT = { transparent: true, alphaTest: 0.04, depthTest: false, depthWrite: false } as const

interface KunSpriteModelProps { state: BotState }

export function KunSpriteModel({ state }: KunSpriteModelProps) {
  const tex = useTexture({
    headNoFace: headNoFaceUrl as string,
    face:       faceUrl       as string,
    ears:       earsUrl       as string,
    frontBody:  frontBodyUrl  as string,
    backBody:   backBodyUrl   as string,
    tail:       tailUrl       as string,
    feet:       feetUrl       as string,
  })

  const rootRef    = useRef<Group>(null)
  const headRef    = useRef<Group>(null)
  const tailRef    = useRef<Mesh>(null)
  const faceRef    = useRef<Mesh>(null)
  const mouthRef   = useRef<Mesh>(null)

  useFrame(() => {
    const t = performance.now() / 1000

    // ── Root float ────────────────────────────────
    if (rootRef.current) {
      rootRef.current.position.y = Math.sin(t * 1.15) * 0.08
    }

    // ── Head motion ───────────────────────────────
    if (headRef.current) {
      if (state === 'listening') {
        headRef.current.rotation.z = Math.sin(t * 0.52) * 0.03 + 0.15
        headRef.current.rotation.x = 0
      } else if (state === 'speaking') {
        headRef.current.rotation.z = Math.sin(t * 0.6) * 0.01
        headRef.current.rotation.x = Math.sin(t * 7.5) * 0.022   // nod
      } else {
        headRef.current.rotation.z = Math.sin(t * 0.72) * 0.01
        headRef.current.rotation.x = Math.sin(t * 0.88) * 0.006
      }
    }

    // ── Tail wag ──────────────────────────────────
    if (tailRef.current) {
      const speed = state === 'speaking' ? 5 : 2.8
      tailRef.current.rotation.z = Math.sin(t * speed) * 0.22 + 0.12
    }

    // ── Face breathing parallax ───────────────────
    if (faceRef.current) {
      faceRef.current.position.z = 0.44 + Math.sin(t * 1.3) * 0.012
    }

    // ── Mouth overlay (speaking) ──────────────────
    if (mouthRef.current) {
      if (state === 'speaking') {
        mouthRef.current.visible = true
        const open = Math.abs(Math.sin(t * 9.5))
        mouthRef.current.scale.y = 0.3 + open * 0.85
        mouthRef.current.scale.x = 1 + open * 0.1
      } else {
        mouthRef.current.visible = false
      }
    }
  })

  return (
    <group ref={rootRef}>

      {/* ── 1. Tail (behind body) ─────────────────── */}
      <mesh ref={tailRef} position={[0.52, -0.78, -0.12]} renderOrder={1}>
        <planeGeometry args={[1.15, 1.45]} />
        <meshBasicMaterial map={tex.tail} {...MAT} />
      </mesh>

      {/* ── 2. Back body ─────────────────────────── */}
      <mesh position={[0, -1.05, -0.08]} renderOrder={2}>
        <planeGeometry args={[2.55, 1.55]} />
        <meshBasicMaterial map={tex.backBody} {...MAT} />
      </mesh>

      {/* ── 3. Front body (overlaps neck area) ─────── */}
      <mesh position={[0, -1.05, 0.1]} renderOrder={3}>
        <planeGeometry args={[2.55, 1.55]} />
        <meshBasicMaterial map={tex.frontBody} {...MAT} />
      </mesh>

      {/* ── Head group (moves independently) ────── */}
      <group ref={headRef} position={[0, 0.38, 0]}>

        {/* 4. Head base — orange fur, no face */}
        <mesh position={[0, 0, 0]} renderOrder={4}>
          <planeGeometry args={[2.25, 2.25]} />
          <meshBasicMaterial map={tex.headNoFace} {...MAT} />
        </mesh>

        {/* 5. Ears — slightly above and forward */}
        <mesh position={[0, 0.18, 0.08]} renderOrder={5}>
          <planeGeometry args={[2.1, 1.35]} />
          <meshBasicMaterial map={tex.ears} {...MAT} />
        </mesh>

        {/* 7. Face — in front of head base */}
        <mesh ref={faceRef} position={[0, -0.1, 0.44]} renderOrder={7}>
          <planeGeometry args={[1.75, 1.75]} />
          <meshBasicMaterial map={tex.face} {...MAT} />
        </mesh>

        {/* 8. Mouth overlay (speaking only) */}
        {/* Position: centre of mouth in face.png ≈ 68% down from top of face plane */}
        <mesh
          ref={mouthRef}
          position={[0, -0.44, 0.55]}
          scale={[0.28, 0.12, 1]}
          visible={false}
          renderOrder={8}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial color="#1a0800" transparent opacity={0.88} depthTest={false} depthWrite={false} />
        </mesh>

      </group>

      {/* ── 6. Feet (in front of body) ──────────── */}
      <mesh position={[0, -1.88, 0.18]} renderOrder={6}>
        <planeGeometry args={[1.65, 0.88]} />
        <meshBasicMaterial map={tex.feet} {...MAT} />
      </mesh>

    </group>
  )
}
