"use client";

/**
 * TrinityHero3DCanvas — Apr 28 v4 upgrade.
 *
 * Major glow-up over the previous octahedron+halo:
 *   • MeshTransmissionMaterial — chromatic glass with refraction/dispersion.
 *     The crystal now reads as actual glass-like 3D, not a flat-shaded
 *     octahedron with emissive paint.
 *   • Float wrapper from drei — breathing levitation. Replaces the
 *     hand-rolled scale+rotation in useFrame.
 *   • Sparkles ambient field — drei built-in particle system, GPU-batched
 *     so it's free.
 *   • Environment preset — HDR-backed reflections without shipping an
 *     HDR image. drei "city" / "warehouse" presets work well for clear
 *     glass.
 *   • Speaking state pulses the crystal's distortion + sparkle density,
 *     so it visually responds to what Trinity is saying.
 *
 * Visual direction: teal accent throughout. The transmission material
 * picks up the scene's accent lights via thickness + chromaticAberration.
 */

import { Canvas, useFrame } from "@react-three/fiber";
import {
  Float,
  MeshTransmissionMaterial,
  Sparkles,
  Environment,
} from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";
import { tokens } from "@/lib/brand/tokens";

interface TrinityHero3DCanvasProps {
  size: number;
  isSpeaking: boolean;
}

/** The crystal core — chromatic glass icosahedron with subtle pulse. */
function CrystalCore({ isSpeaking }: { isSpeaking: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    // Slow self-rotation for ambient life. Float wrapper handles the
    // levitation so we only need rotation here.
    meshRef.current.rotation.y = t * 0.35;
    meshRef.current.rotation.x = Math.sin(t * 0.3) * 0.15;

    // Speaking: subtle scale pulse keyed to a fast sine. Quiet: hold steady.
    const speakAmp = isSpeaking ? 0.10 : 0.02;
    const speakRate = isSpeaking ? 9 : 1.2;
    const s = 1 + Math.sin(t * speakRate) * speakAmp;
    meshRef.current.scale.setScalar(s);
  });

  return (
    <mesh ref={meshRef}>
      {/* Icosahedron at detail=1 reads as a cut crystal — more facets
       *  catch the chromatic refraction than an octahedron. */}
      <icosahedronGeometry args={[1, 1]} />
      <MeshTransmissionMaterial
        // Glass-like physical properties
        transmission={1}
        thickness={1.4}
        ior={1.55}
        chromaticAberration={isSpeaking ? 0.4 : 0.18}
        anisotropicBlur={0.25}
        distortion={isSpeaking ? 0.45 : 0.18}
        distortionScale={0.3}
        temporalDistortion={0.1}
        roughness={0.05}
        // Brand teal in the transmission layer — the surface picks up a
        // teal tint at grazing angles (like real glass with slight
        // dichroic coating).
        color={tokens.brand.accent}
        attenuationColor={tokens.brand.accentSoft}
        attenuationDistance={2.4}
        backside
      />
    </mesh>
  );
}

/** Inner luminous core — visible through the glass, gives the crystal
 *  something to "contain" so it doesn't look hollow. */
function InnerCore() {
  return (
    <mesh>
      <sphereGeometry args={[0.42, 32, 32]} />
      <meshStandardMaterial
        color={tokens.brand.accentSoft}
        emissive={tokens.brand.accent}
        emissiveIntensity={1.4}
        toneMapped={false}
      />
    </mesh>
  );
}

export default function TrinityHero3DCanvas({
  size,
  isSpeaking,
}: TrinityHero3DCanvasProps) {
  // Sparkles count + speed react to the speaking state — feels like the
  // crystal is "breathing harder" while talking.
  const sparkCount = isSpeaking ? 60 : 32;
  const sparkSpeed = isSpeaking ? 0.6 : 0.18;

  return (
    <Canvas
      camera={{ position: [0, 0, 4.2], fov: 35 }}
      style={{ width: size, height: size }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      dpr={[1, 2]}
    >
      {/* HDR-backed reflections without shipping an .hdr file — drei has
       *  a few baked presets. "city" gives a balanced reflection profile
       *  that flatters teal glass. */}
      <Environment preset="city" />

      {/* Three lights — soft key from above, teal rim from front-left,
       *  warm fill from behind. Together they shape the facets without
       *  blowing out the transmission. */}
      <ambientLight intensity={0.35} />
      <directionalLight position={[3, 5, 4]} intensity={1.0} />
      <pointLight
        position={[-2.5, -1, 3]}
        color={tokens.brand.accent}
        intensity={1.2}
      />
      <pointLight
        position={[2, 1.5, -3]}
        color={tokens.brand.accentSoft}
        intensity={0.6}
      />

      {/* Float gives the crystal a slow levitation + drift — replaces
       *  hand-rolled position oscillation. */}
      <Float
        speed={isSpeaking ? 2.2 : 1.0}
        rotationIntensity={0.4}
        floatIntensity={0.55}
      >
        <CrystalCore isSpeaking={isSpeaking} />
        <InnerCore />
      </Float>

      {/* Ambient teal sparkle field — fills the space around the crystal
       *  so the canvas reads as "alive" rather than empty rectangle. */}
      <Sparkles
        count={sparkCount}
        scale={[3.5, 3.5, 3.5]}
        size={3.2}
        speed={sparkSpeed}
        opacity={0.9}
        color={tokens.brand.accentSoft}
      />
    </Canvas>
  );
}
