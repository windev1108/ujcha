import { type FC } from 'react'
import type { Mesh } from 'three'
import type { BotState } from './useShibaAnimation'

// Logo-accurate face: very large chibi eyes in the MIDDLE of the face,
// wide cream muzzle, tiny dark nose, faint blush

const FUR_MAIN = '#e8781a'
const CREAM = '#f8edce'
const EYE_DARK = '#1c0c00'
const NOSE_COLOR = '#1c0c00'
const BLUSH = '#f08040'

interface EyeProps {
  x: number
  lidRef: React.RefObject<Mesh | null>
  pupilRef: React.RefObject<Mesh | null>
}

const Eye: FC<EyeProps> = ({ x, lidRef, pupilRef }) => (
  // Eyes sit in the MIDDLE of the face — y≈0, not high up
  <group position={[x, 0.0, 0.94]}>
    {/* Sclera — large white sphere */}
    <mesh>
      <sphereGeometry args={[0.32, 24, 24]} />
      <meshStandardMaterial color="#ffffff" roughness={0.1} />
    </mesh>
    {/* Dark iris + pupil */}
    <mesh ref={pupilRef} position={[0, 0, 0.18]}>
      <sphereGeometry args={[0.24, 20, 20]} />
      <meshStandardMaterial color={EYE_DARK} roughness={0.5} />
    </mesh>
    {/* Deep brown iris ring */}
    <mesh position={[0, 0, 0.21]}>
      <sphereGeometry args={[0.19, 16, 16]} />
      <meshStandardMaterial color="#3d1800" roughness={0.6} />
    </mesh>
    {/* Large sparkle highlight (upper-left) */}
    <mesh position={[-0.09, 0.1, 0.29]}>
      <sphereGeometry args={[0.072, 10, 10]} />
      <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} roughness={0.05} />
    </mesh>
    {/* Small sparkle highlight */}
    <mesh position={[0.07, -0.05, 0.3]}>
      <sphereGeometry args={[0.035, 8, 8]} />
      <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.35} roughness={0.05} />
    </mesh>
    {/* Eyelid — fur color, covers from top; scale.y drives blink */}
    <mesh ref={lidRef} position={[0, 0.32, 0.04]} scale={[1.02, 0.015, 1.02]}>
      <sphereGeometry args={[0.33, 20, 20]} />
      <meshStandardMaterial color={FUR_MAIN} roughness={0.88} />
    </mesh>
  </group>
)

interface ShibaFaceProps {
  leftLidRef: React.RefObject<Mesh | null>
  rightLidRef: React.RefObject<Mesh | null>
  mouthRef: React.RefObject<Mesh | null>
  leftEyeRef: React.RefObject<Mesh | null>
  rightEyeRef: React.RefObject<Mesh | null>
  state: BotState
}

export const ShibaFace: FC<ShibaFaceProps> = ({
  leftLidRef, rightLidRef, mouthRef,
  leftEyeRef, rightEyeRef, state,
}) => (
  <>
    {/* Left eye */}
    <Eye x={-0.42} lidRef={leftLidRef} pupilRef={leftEyeRef} />
    {/* Right eye */}
    <Eye x={0.42} lidRef={rightLidRef} pupilRef={rightEyeRef} />

    {/* Cheek blush — subtle, round */}
    <mesh position={[-0.72, -0.2, 0.76]} scale={[0.3, 0.22, 0.05]}>
      <sphereGeometry args={[1, 12, 12]} />
      <meshStandardMaterial color={BLUSH} roughness={1} transparent opacity={0.26} />
    </mesh>
    <mesh position={[0.72, -0.2, 0.76]} scale={[0.3, 0.22, 0.05]}>
      <sphereGeometry args={[1, 12, 12]} />
      <meshStandardMaterial color={BLUSH} roughness={1} transparent opacity={0.26} />
    </mesh>

    {/* Muzzle — wide cream dome, chibi proportion */}
    <mesh position={[0, -0.32, 0.78]} scale={[0.6, 0.44, 0.42]}>
      <sphereGeometry args={[1, 24, 24]} />
      <meshStandardMaterial color={CREAM} roughness={0.78} />
    </mesh>
    {/* Muzzle lower cream extension */}
    <mesh position={[0, -0.48, 0.68]} scale={[0.46, 0.28, 0.32]}>
      <sphereGeometry args={[1, 16, 16]} />
      <meshStandardMaterial color={CREAM} roughness={0.82} />
    </mesh>

    {/* Nose — small dark ellipsoid */}
    <mesh position={[0, -0.16, 0.99]} scale={[0.13, 0.09, 0.07]}>
      <sphereGeometry args={[1, 14, 14]} />
      <meshStandardMaterial color={NOSE_COLOR} roughness={0.45} />
    </mesh>
    {/* Nose highlight */}
    <mesh position={[-0.04, -0.13, 1.03]} scale={[0.052, 0.036, 0.022]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.4} roughness={0.1} />
    </mesh>

    {/* Idle smile — gentle arc */}
    {state !== 'speaking' && (
      <>
        {/* Left corner */}
        <mesh position={[-0.19, -0.44, 0.89]} scale={[0.06, 0.05, 0.04]}>
          <sphereGeometry args={[1, 8, 8]} />
          <meshStandardMaterial color="#a04820" roughness={0.8} />
        </mesh>
        {/* Right corner */}
        <mesh position={[0.19, -0.44, 0.89]} scale={[0.06, 0.05, 0.04]}>
          <sphereGeometry args={[1, 8, 8]} />
          <meshStandardMaterial color="#a04820" roughness={0.8} />
        </mesh>
        {/* Centre lip curve */}
        <mesh position={[0, -0.48, 0.89]} scale={[0.22, 0.038, 0.03]}>
          <torusGeometry args={[1, 0.4, 6, 22, Math.PI]} />
          <meshStandardMaterial color="#a04820" roughness={0.8} />
        </mesh>
      </>
    )}

    {/* Speaking open mouth */}
    <mesh
      ref={mouthRef}
      position={[0, -0.46, 0.88]}
      scale={[0.19, 0.09, 0.05]}
      visible={state === 'speaking'}
    >
      <sphereGeometry args={[1, 14, 14]} />
      <meshStandardMaterial color="#1c0c00" roughness={0.6} />
    </mesh>
    {/* Tongue inside (speaking) */}
    {state === 'speaking' && (
      <mesh position={[0, -0.52, 0.86]} scale={[0.11, 0.055, 0.03]}>
        <sphereGeometry args={[1, 10, 10]} />
        <meshStandardMaterial color="#cc5858" roughness={0.7} />
      </mesh>
    )}
  </>
)
