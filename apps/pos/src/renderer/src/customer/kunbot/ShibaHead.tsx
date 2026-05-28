import { type FC } from 'react'

// Chibi Shiba: big round head, small rounded ears at top
// Color palette from the logo
const FUR_MAIN = '#e8781a'
const FUR_DARK = '#c05c0a'
const FUR_LIGHT = '#f5a840'
const EAR_INNER = '#f0a870'

interface EarProps {
  side: 'left' | 'right'
}

const ShibaEar: FC<EarProps> = ({ side }) => {
  const x = side === 'left' ? -0.72 : 0.72
  const rotZ = side === 'left' ? -0.28 : 0.28
  const rotY = side === 'left' ? 0.12 : -0.12
  return (
    <group position={[x, 0.82, -0.08]} rotation={[0.1, rotY, rotZ]}>
      {/* Outer ear — rounded, not pointy */}
      <mesh scale={[1, 1.35, 0.75]}>
        <sphereGeometry args={[0.3, 20, 20]} />
        <meshStandardMaterial color={FUR_DARK} roughness={0.85} />
      </mesh>
      {/* Inner ear pink pad */}
      <mesh position={[0, 0.06, 0.15]} scale={[0.58, 0.82, 0.28]}>
        <sphereGeometry args={[0.28, 16, 16]} />
        <meshStandardMaterial color={EAR_INNER} roughness={0.8} />
      </mesh>
    </group>
  )
}

export const ShibaHead: FC = () => (
  <>
    {/* Ears rendered first (behind head) */}
    <ShibaEar side="left" />
    <ShibaEar side="right" />

    {/* Main head — big chibi sphere */}
    <mesh>
      <sphereGeometry args={[1.08, 40, 40]} />
      <meshStandardMaterial color={FUR_MAIN} roughness={0.76} />
    </mesh>

    {/* Top highlight — lighter patch on forehead */}
    <mesh position={[-0.1, 0.42, 0.82]} scale={[0.5, 0.38, 0.12]}>
      <sphereGeometry args={[1, 14, 14]} />
      <meshStandardMaterial color={FUR_LIGHT} roughness={0.9} transparent opacity={0.55} />
    </mesh>

    {/* Side fur darkening left */}
    <mesh position={[-0.88, 0, 0.3]} scale={[0.35, 0.65, 0.35]}>
      <sphereGeometry args={[1, 12, 12]} />
      <meshStandardMaterial color={FUR_DARK} roughness={0.9} transparent opacity={0.28} />
    </mesh>
    {/* Side fur darkening right */}
    <mesh position={[0.88, 0, 0.3]} scale={[0.35, 0.65, 0.35]}>
      <sphereGeometry args={[1, 12, 12]} />
      <meshStandardMaterial color={FUR_DARK} roughness={0.9} transparent opacity={0.28} />
    </mesh>
  </>
)
