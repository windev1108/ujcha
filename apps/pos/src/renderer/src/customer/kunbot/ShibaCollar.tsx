import { type FC } from 'react'

export const ShibaCollar: FC = () => (
  <group position={[0, -0.9, 0.06]}>
    {/* Green collar */}
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.72, 0.115, 14, 52]} />
      <meshStandardMaterial color="#2d8a62" roughness={0.62} />
    </mesh>
    {/* Highlight stripe on collar */}
    <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.05]}>
      <torusGeometry args={[0.72, 0.048, 8, 52]} />
      <meshStandardMaterial color="#ffffff" roughness={0.5} transparent opacity={0.2} />
    </mesh>
    {/* Gold tag */}
    <mesh position={[0, -0.14, 0.64]}>
      <cylinderGeometry args={[0.14, 0.14, 0.048, 26]} />
      <meshStandardMaterial color="#f5c028" roughness={0.28} metalness={0.7} />
    </mesh>
    {/* Tag edge ring */}
    <mesh position={[0, -0.14, 0.665]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.14, 0.018, 8, 26]} />
      <meshStandardMaterial color="#d4a010" roughness={0.4} metalness={0.6} />
    </mesh>
    {/* Small "K" represented as dark dot on tag */}
    <mesh position={[0, -0.14, 0.69]}>
      <cylinderGeometry args={[0.06, 0.06, 0.01, 14]} />
      <meshStandardMaterial color="#1a3c2e" roughness={0.8} />
    </mesh>
  </group>
)
