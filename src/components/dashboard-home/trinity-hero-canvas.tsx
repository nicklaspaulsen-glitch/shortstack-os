"use client";

/**
 * TrinityHero3DCanvas — the R3F implementation of the Trinity speaking
 * hero. Lives in its own file so the parent (`trinity-hero-3d.tsx`) can
 * dynamic-import it with `{ ssr: false }`. That keeps three.js +
 * @react-three/fiber out of the dashboard initial bundle.
 *
 * Visual direction (Apr 28, ui-ux-pro-max + soft-skill):
 *   - Abstract not literal: a single floating crystal core stands in for
 *     "Trinity". Avoids uncanny-valley humanoid + renders cheaply on any
 *     GPU.
 *   - Indigo signature glow matches the new monochrome theme.
 *   - When `isSpeaking=true`, the core scales gently up + down to suggest
 *     speech without faking lip-sync.
 *   - Six orbiting particle dots track around the core like an ambient
 *     halo. Slows when not speaking.
 *
 * No props leak DOM events; the canvas is purely visual.
 */

import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { tokens } from "@/lib/brand/tokens";

interface TrinityHero3DCanvasProps {
  size: number;
  isSpeaking: boolean;
}

function CrystalCore({ isSpeaking }: { isSpeaking: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const baseScale = useRef(1);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    // Slow continuous rotation — adds life even when idle.
    meshRef.current.rotation.y += delta * 0.4;
    meshRef.current.rotation.x += delta * 0.18;

    // Gentle breathing scale; amplifies + speeds up when speaking so the
    // core looks like it's articulating syllables.
    const t = state.clock.elapsedTime;
    const speakAmplitude = isSpeaking ? 0.16 : 0.04;
    const speakRate = isSpeaking ? 8 : 1.4;
    const target = baseScale.current + Math.sin(t * speakRate) * speakAmplitude;
    meshRef.current.scale.setScalar(target);
  });

  return (
    <mesh ref={meshRef}>
      {/* Octahedron reads as a crystal more than a sphere does. 1 subdivision
          keeps the facets visible (= more "alive" feel from light bouncing). */}
      <octahedronGeometry args={[1, 1]} />
      <meshStandardMaterial
        color={tokens.brand.accent}
        emissive={tokens.brand.accent}
        emissiveIntensity={0.6}
        roughness={0.25}
        metalness={0.7}
        flatShading
      />
    </mesh>
  );
}

function HaloParticles({ isSpeaking, count = 6 }: { isSpeaking: boolean; count?: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const radius = 1.85;

  useFrame((_state, delta) => {
    if (!groupRef.current) return;
    // Halo rotates faster when Trinity is speaking — feels reactive.
    const speed = isSpeaking ? 1.2 : 0.4;
    groupRef.current.rotation.y += delta * speed;
    groupRef.current.rotation.x = Math.sin(_state.clock.elapsedTime * 0.3) * 0.18;
  });

  return (
    <group ref={groupRef}>
      {Array.from({ length: count }).map((_, i) => {
        const angle = (i / count) * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        return (
          <mesh key={i} position={[x, 0, z]}>
            <sphereGeometry args={[0.06, 12, 12]} />
            <meshStandardMaterial
              color={tokens.brand.accentSoft}
              emissive={tokens.brand.accentSoft}
              emissiveIntensity={1.2}
              roughness={0.3}
            />
          </mesh>
        );
      })}
    </group>
  );
}

export default function TrinityHero3DCanvas({ size, isSpeaking }: TrinityHero3DCanvasProps) {
  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 32 }}
      style={{ width: size, height: size }}
      gl={{ antialias: true, alpha: true }}
      dpr={[1, 1.75]}
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[3, 4, 3]} intensity={1.2} />
      <directionalLight position={[-2, -1, 3]} intensity={0.6} color={tokens.brand.accent} />
      {/* Soft indigo back-light to read the silhouette against any background */}
      <pointLight position={[-3, -2, -3]} color={tokens.brand.accentSoft} intensity={0.6} />

      <CrystalCore isSpeaking={isSpeaking} />
      <HaloParticles isSpeaking={isSpeaking} />
    </Canvas>
  );
}
