import { type FC } from 'react'
import { ShibaHead } from './ShibaHead'
import { ShibaFace } from './ShibaFace'
import { ShibaCollar } from './ShibaCollar'
import { useShibaAnimation, type BotState } from './useShibaAnimation'

interface ShibaMeshProps {
  state: BotState
}

export const ShibaMesh: FC<ShibaMeshProps> = ({ state }) => {
  const { groupRef, leftLidRef, rightLidRef, mouthRef, leftEyeRef, rightEyeRef } =
    useShibaAnimation(state)

  return (
    // Slight upward offset so character sits centred in canvas
    <group ref={groupRef} position={[0, 0.08, 0]}>
      <ShibaHead />
      <ShibaFace
        leftLidRef={leftLidRef}
        rightLidRef={rightLidRef}
        mouthRef={mouthRef}
        leftEyeRef={leftEyeRef}
        rightEyeRef={rightEyeRef}
        state={state}
      />
      <ShibaCollar />

      {/* Listening mic badge — top-right */}
      {state === 'listening' && (
        <group position={[0.82, 0.68, 0.72]}>
          <mesh>
            <sphereGeometry args={[0.22, 18, 18]} />
            <meshStandardMaterial color="#3b82f6" roughness={0.45} emissive="#3b82f6" emissiveIntensity={0.25} />
          </mesh>
          <mesh position={[0, 0.02, 0.18]}>
            <cylinderGeometry args={[0.058, 0.058, 0.13, 12]} />
            <meshStandardMaterial color="#ffffff" roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.1, 0.18]}>
            <sphereGeometry args={[0.062, 10, 10]} />
            <meshStandardMaterial color="#ffffff" roughness={0.3} />
          </mesh>
        </group>
      )}
    </group>
  )
}
