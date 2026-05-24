"use client";

/**
 * TrinityHero3DCanvas — Apr 28 v6 redesign.
 *
 * Completely new visual direction. Previous attempts:
 *   v1: octahedron + halo dots (flat-shaded, plain)
 *   v2: chromatic icosahedron + Sparkle (better but still single-object)
 *   v3 (now): "Trinity Orb" — a full scene, not a single shape.
 *
 * Composition:
 *   1. Central faceted icosahedron in chromatic glass — the orb.
 *   2. THREE orbital rings around the orb at different angles —
 *      named "trinity" because of three. Thin neon-teal tori. Each
 *      ring rotates at a different speed for parallax depth.
 *   3. Six small floating shards orbiting like satellites — adds
 *      movement at the periphery so the canvas reads as alive even
 *      at idle.
 *   4. Inner emissive core inside the glass orb — visible THROUGH the
 *      transmission layer, gives the orb something to "contain".
 *   5. Sparkle particle field — count + speed react to isSpeaking.
 *   6. Three-light setup: key from above, teal rim front-left,
 *      accentSoft fill back-right. Plus an HDR Environment for
 *      free reflections.
 *
 * Behavior:
 *   • Speaking: ring rotation accelerates 2.5x, sparkle count doubles,
 *     orb scales 1.0 → 1.10 in a fast sine, distortion bumps up.
 *   • Idle: smooth slow rotation, gentle breathing.
 *
 * Perf:
 *   • DPR cap 3 for 4K crispness on the hero.
 *   • Suspense boundary keeps the rest of the dashboard interactive
 *     while the canvas chunk loads.
 */

import { Canvas, useFrame } from "@react-three/fiber";
import {
  Float,
  MeshTransmissionMaterial,
  Sparkles,
  Environment,
} from "@react-three/drei";
import { Suspense, useRef } from "react";
import * as THREE from "three";
import { tokens } from "@/lib/brand/tokens";

interface TrinityHero3DCanvasProps {
  size: number;
  isSpeaking: boolean;
}

/** Central glass orb — chromatic refraction, teal dichroic tint. */
function GlassOrb({ isSpeaking }: { isSpeaking: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    meshRef.current.rotation.y = t * 0.30;
    meshRef.current.rotation.x = Math.sin(t * 0.25) * 0.18;
    const speakAmp = isSpeaking ? 0.10 : 0.02;
    const speakRate = isSpeaking ? 9 : 1.2;
    const s = 1 + Math.sin(t * speakRate) * speakAmp;
    meshRef.current.scale.setScalar(s);
  });

  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[1, 1]} />
      <MeshTransmissionMaterial
        transmission={1}
        thickness={1.4}
        ior={1.55}
        chromaticAberration={isSpeaking ? 0.45 : 0.20}
        anisotropicBlur={0.25}
        distortion={isSpeaking ? 0.40 : 0.16}
        distortionScale={0.3}
        temporalDistortion={0.10}
        roughness={0.05}
        color={tokens.brand.accent}
        attenuationColor={tokens.brand.accentSoft}
        attenuationDistance={2.4}
        backside
      />
    </mesh>
  );
}

/** Inner luminous core visible through the glass. */
function InnerCore({ isSpeaking }: { isSpeaking: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    const pulse = isSpeaking ? Math.sin(t * 8) * 0.15 + 1 : Math.sin(t * 2) * 0.05 + 1;
    ref.current.scale.setScalar(0.42 * pulse);
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshStandardMaterial
        color={tokens.brand.accentSoft}
        emissive={tokens.brand.accent}
        emissiveIntensity={isSpeaking ? 1.8 : 1.4}
        toneMapped={false}
      />
    </mesh>
  );
}

/** A single orbital ring — thin torus rotating around the orb. */
function OrbitalRing({
  radius,
  tube,
  rotation,
  speed,
  color,
  isSpeaking,
}: {
  radius: number;
  tube: number;
  rotation: [number, number, number];
  speed: number;
  color: string;
  isSpeaking: boolean;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_state, delta) => {
    if (!ref.current) return;
    const accel = isSpeaking ? 2.5 : 1;
    ref.current.rotation.z += delta * speed * accel;
    ref.current.rotation.x += delta * speed * 0.4 * accel;
  });
  return (
    <mesh ref={ref} rotation={rotation}>
      <torusGeometry args={[radius, tube, 16, 64]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={isSpeaking ? 1.2 : 0.7}
        roughness={0.3}
        metalness={0.7}
        toneMapped={false}
      />
    </mesh>
  );
}

/** Six tiny crystal shards orbiting the orb at varying radii. */
function OrbitingShards({ isSpeaking }: { isSpeaking: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const COUNT = 6;
  const RADIUS = 1.95;

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    const accel = isSpeaking ? 2.0 : 0.8;
    groupRef.current.rotation.y = t * accel * 0.4;
    // Gentle wobble on X for parallax depth.
    groupRef.current.rotation.x = Math.sin(t * 0.4) * 0.22;
  });

  return (
    <group ref={groupRef}>
      {Array.from({ length: COUNT }).map((_, i) => {
        const angle = (i / COUNT) * Math.PI * 2;
        const x = Math.cos(angle) * RADIUS;
        const z = Math.sin(angle) * RADIUS;
        const y = Math.sin(angle * 2) * 0.15; // wave in Y for visual interest
        return (
          <mesh key={i} position={[x, y, z]} rotation={[angle, angle * 0.8, 0]}>
            <octahedronGeometry args={[0.085, 0]} />
            <meshStandardMaterial
              color={tokens.brand.accentSoft}
              emissive={tokens.brand.accent}
              emissiveIntensity={isSpeaking ? 1.5 : 0.9}
              roughness={0.2}
              metalness={0.85}
              toneMapped={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function SceneContent({ isSpeaking }: { isSpeaking: boolean }) {
  // Sparkle count + speed react to speaking state.
  const sparkCount = isSpeaking ? 80 : 40;
  const sparkSpeed = isSpeaking ? 0.7 : 0.20;

  return (
    <>
      {/* HDR Environment for reflections without shipping an .hdr file. */}
      <Environment preset="city" />

      {/* Three lights: key, teal rim, soft fill. */}
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

      {/* Orb + inner core wrapped in a Float for breathing levitation. */}
      <Float
        speed={isSpeaking ? 2.2 : 1.0}
        rotationIntensity={0.4}
        floatIntensity={0.55}
      >
        <GlassOrb isSpeaking={isSpeaking} />
        <InnerCore isSpeaking={isSpeaking} />
      </Float>

      {/* Three orbital rings — the "Trinity". Each at a different
       *  angle so they read as nested, not concentric. */}
      <OrbitalRing
        radius={1.55}
        tube={0.018}
        rotation={[Math.PI / 2.2, 0, 0]}
        speed={0.5}
        color={tokens.brand.accent}
        isSpeaking={isSpeaking}
      />
      <OrbitalRing
        radius={1.75}
        tube={0.014}
        rotation={[Math.PI / 3, Math.PI / 4, 0]}
        speed={0.35}
        color={tokens.brand.accentSoft}
        isSpeaking={isSpeaking}
      />
      <OrbitalRing
        radius={1.45}
        tube={0.012}
        rotation={[0, Math.PI / 3, Math.PI / 2.5]}
        speed={0.7}
        color={tokens.brand.accent}
        isSpeaking={isSpeaking}
      />

      {/* Six orbiting crystal shards. */}
      <OrbitingShards isSpeaking={isSpeaking} />

      {/* Ambient sparkles fill the background space. */}
      <Sparkles
        count={sparkCount}
        scale={[3.8, 3.8, 3.8]}
        size={3.2}
        speed={sparkSpeed}
        opacity={0.9}
        color={tokens.brand.accentSoft}
      />
    </>
  );
}

export default function TrinityHero3DCanvas({
  size,
  isSpeaking,
}: TrinityHero3DCanvasProps) {
  return (
    <Canvas
      camera={{ position: [0, 0, 4.5], fov: 35 }}
      style={{ width: size, height: size }}
      // Apr 28 v6: bumped DPR cap to 3 for 4K crispness on the hero.
      // The scene is small (~320px) so even at 3x the GPU cost is
      // bounded. Browser caps at min(window.devicePixelRatio, 3).
      dpr={[1, 3]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
    >
      <Suspense fallback={null}>
        <SceneContent isSpeaking={isSpeaking} />
      </Suspense>
    </Canvas>
  );
}
