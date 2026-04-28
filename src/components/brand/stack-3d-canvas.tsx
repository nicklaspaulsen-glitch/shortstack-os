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
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.22;
  });

  // Apr 28: rebuilt to match the iconic isometric SVG at
  // C:/Claude/shortstack-logo-3d.svg — taller slabs, pronounced
  // horizontal offset between layers, wider indigo edge that reads
  // as a glowing rim. The new geometry feels noticeably more 3D /
  // more "building blocks stacked" than the old thin-disc treatment.
  return (
    <group ref={groupRef} rotation={[0.42, 0.6, 0]}>
      {[
        { y: 0.55, xOffset: 0.18,  scale: 0.94 },
        { y: 0,    xOffset: 0,     scale: 1.0  },
        { y: -0.55, xOffset: -0.18, scale: 1.06 },
      ].map((slab, i) => (
        <group
          key={i}
          position={[slab.xOffset, slab.y, 0]}
          scale={[slab.scale, 1, slab.scale]}
        >
          {/* Indigo glowing rim — slightly larger box behind the dark
              base. Higher emissiveIntensity so the edge reads even
              when the slab is rotated away from the viewer. */}
          <mesh position={[0, 0, -0.002]}>
            <boxGeometry args={[1.78, 0.46, 1.18]} />
            <meshStandardMaterial
              color={tokens.brand.accent}
              emissive={tokens.brand.accent}
              emissiveIntensity={1.05}
              roughness={0.32}
              metalness={0.28}
            />
          </mesh>
          {/* Dark base block — occludes most of the indigo, leaving a
              ~3px rim glow on every edge. */}
          <mesh>
            <boxGeometry args={[1.74, 0.42, 1.14]} />
            <meshStandardMaterial
              color={tokens.bg.base}
              roughness={0.55}
              metalness={0.18}
              emissive={tokens.brand.accent}
              emissiveIntensity={0.06}
            />
          </mesh>
          {/* Top-face highlight — narrow indigo band on the top edge
              for that bevel-from-light look. */}
          <mesh position={[0, 0.215, 0]}>
            <boxGeometry args={[1.74, 0.005, 1.14]} />
            <meshBasicMaterial color={tokens.brand.accentSoft} />
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
