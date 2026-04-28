"use client";

/**
 * Stack3DCanvas — the R3F (three.js) implementation of the Stack3D mark,
 * extracted into its own file so the parent stack-3d.tsx can dynamic-import
 * it with `{ ssr: false }`. That keeps three.js + @react-three/fiber out of
 * every-page bundles (Stack3D is rendered in the sidebar, so without this
 * split, three.js ships to every dashboard route).
 *
 * SSR / reduced-motion users get the CSS fallback in stack-3d.tsx instead.
 */

import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { tokens } from "@/lib/brand/tokens";

interface StackBlocksProps {
  rotating: boolean;
}

function StackBlocks({ rotating }: StackBlocksProps) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((_state, delta) => {
    if (!rotating) return;
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.2;
  });

  return (
    <group ref={groupRef} rotation={[0.32, 0.5, 0]}>
      {[
        { y: 0.5, xRot: 0.04 },
        { y: 0, xRot: 0 },
        { y: -0.5, xRot: -0.04 },
      ].map((slab, i) => (
        <group key={i} position={[0, slab.y, 0]} rotation={[slab.xRot, 0, 0]}>
          {/* Indigo edge highlight — slightly larger box behind */}
          <mesh position={[0, 0, -0.001]}>
            <boxGeometry args={[1.62, 0.32, 1.02]} />
            <meshStandardMaterial
              color={tokens.brand.accent}
              emissive={tokens.brand.accent}
              emissiveIntensity={0.6}
              roughness={0.4}
              metalness={0.2}
            />
          </mesh>
          {/* Dark base block — sits in front, occludes most of the indigo */}
          <mesh>
            <boxGeometry args={[1.6, 0.3, 1]} />
            <meshStandardMaterial color={tokens.bg.base} roughness={0.7} metalness={0.1} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

interface Stack3DCanvasProps {
  size: number;
  rotating: boolean;
}

export default function Stack3DCanvas({ size, rotating }: Stack3DCanvasProps) {
  return (
    <Canvas
      camera={{ position: [0, 0, 4.2], fov: 35 }}
      style={{ width: size, height: size }}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 4, 2]} intensity={1.2} />
      <directionalLight position={[-2, -1, 3]} intensity={0.5} color={tokens.brand.accent} />
      <StackBlocks rotating={rotating} />
    </Canvas>
  );
}
