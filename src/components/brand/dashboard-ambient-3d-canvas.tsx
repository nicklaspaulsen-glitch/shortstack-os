"use client";

/**
 * DashboardAmbient3DCanvas — R3F implementation of the ambient 3D layer.
 *
 * v2 overhaul (May 16):
 *   • 5 shapes instead of 3 — richer, more balanced composition
 *   • Glass / transmission material on the sphere — premium look
 *   • Reduced emissive intensity — shapes feel ambient, not neon
 *   • Wireframe torus — adds elegant line-art detail
 *   • Shapes at lower opacity (0.20–0.40) so the CSS blob gradient
 *     behind them reads cleanly without competing
 *   • Slower drift speeds — 16-24s cycles match the CSS blobs
 *   • Better camera position — tighter framing for a wider field feel
 *
 * Perf:
 *   - DPR cap 1.5 — background context, no need for full retina
 *   - 5 shapes — still very low triangle count (all primitives)
 *   - Float wrapper handles drift — zero per-frame React state
 *   - Frame loop pauses when canvas is offscreen
 */

import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial, MeshTransmissionMaterial, Environment } from "@react-three/drei";
import { Suspense, useRef } from "react";
import type { Mesh } from "three";

const C_BLUE  = "#D4FF00";
const C_SOFT  = "#D4FF00";
const C_DIM   = "#AACC00";
const C_INDIGO = "#4F46E5";
const C_SKY   = "#0EA5E9";

/** Translucent glass sphere — premium centrepiece */
function GlassSphere({ position }: { position: [number, number, number] }) {
  return (
    <Float speed={1.4} rotationIntensity={0.2} floatIntensity={1.2}>
      <mesh position={position}>
        <sphereGeometry args={[0.60, 32, 32]} />
        <MeshTransmissionMaterial
          backside
          samples={4}
          thickness={0.4}
          roughness={0.05}
          transmission={0.92}
          ior={1.35}
          color={C_SOFT}
          chromaticAberration={0.04}
          distortionScale={0.2}
          temporalDistortion={0.1}
          transparent
          opacity={0.28}
        />
      </mesh>
    </Float>
  );
}

/** Distorted metallic torus — upper left */
function MetallicTorus({ position }: { position: [number, number, number] }) {
  const ref = useRef<Mesh>(null!);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    ref.current.rotation.x = t * 0.08;
    ref.current.rotation.y = t * 0.13;
  });
  return (
    <Float speed={1.1} rotationIntensity={0.25} floatIntensity={0.9}>
      <mesh ref={ref} position={position}>
        <torusGeometry args={[0.80, 0.18, 14, 28]} />
        <MeshDistortMaterial
          color={C_BLUE}
          emissive={C_DIM}
          emissiveIntensity={0.18}
          roughness={0.25}
          metalness={0.85}
          distort={0.12}
          speed={0.9}
          transparent
          opacity={0.28}
        />
      </mesh>
    </Float>
  );
}

/** Wireframe torus — elegant line-art detail */
function WireframeTorus({ position }: { position: [number, number, number] }) {
  const ref = useRef<Mesh>(null!);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    ref.current.rotation.x = t * 0.06;
    ref.current.rotation.z = t * 0.09;
  });
  return (
    <Float speed={0.9} rotationIntensity={0.35} floatIntensity={0.7}>
      <mesh ref={ref} position={position}>
        <torusKnotGeometry args={[0.45, 0.12, 80, 12]} />
        <meshStandardMaterial
          color={C_INDIGO}
          emissive={C_INDIGO}
          emissiveIntensity={0.25}
          roughness={0.2}
          metalness={0.9}
          wireframe
          transparent
          opacity={0.22}
        />
      </mesh>
    </Float>
  );
}

/** Distorted octahedron — lower right */
function IridescentOcta({ position }: { position: [number, number, number] }) {
  const ref = useRef<Mesh>(null!);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    ref.current.rotation.y = t * 0.18;
    ref.current.rotation.z = t * 0.09;
  });
  return (
    <Float speed={1.2} rotationIntensity={0.4} floatIntensity={1.0}>
      <mesh ref={ref} position={position}>
        <octahedronGeometry args={[0.48, 0]} />
        <MeshDistortMaterial
          color={C_SKY}
          emissive={C_SOFT}
          emissiveIntensity={0.22}
          roughness={0.15}
          metalness={0.92}
          distort={0.22}
          speed={1.4}
          transparent
          opacity={0.26}
        />
      </mesh>
    </Float>
  );
}

/** Small reflective icosahedron — floating accent */
function ReflectiveIco({ position }: { position: [number, number, number] }) {
  const ref = useRef<Mesh>(null!);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    ref.current.rotation.x = t * 0.14;
    ref.current.rotation.y = t * 0.20;
  });
  return (
    <Float speed={1.7} rotationIntensity={0.5} floatIntensity={1.5}>
      <mesh ref={ref} position={position}>
        <icosahedronGeometry args={[0.32, 0]} />
        <meshStandardMaterial
          color={C_BLUE}
          emissive={C_DIM}
          emissiveIntensity={0.30}
          roughness={0.10}
          metalness={0.95}
          transparent
          opacity={0.35}
        />
      </mesh>
    </Float>
  );
}

function SceneContent() {
  return (
    <>
      <ambientLight intensity={0.35} color="#E0F2FE" />
      <directionalLight position={[4, 5, 4]}  intensity={0.55} color={C_SOFT} />
      <directionalLight position={[-4, -2, 2]} intensity={0.22} color={C_INDIGO} />
      <directionalLight position={[0, -4, -2]} intensity={0.18} color="#BAE6FD" />
      <Environment preset="city" />

      {/* Composition: spread across all four quadrants + one centre-right
       *  accent. This creates balanced depth without crowding any single
       *  corner. Z values push shapes behind the focal plane for atmosphere. */}
      <MetallicTorus    position={[-2.8,  1.2, -2.5]} />
      <GlassSphere      position={[ 2.6, -0.6, -1.8]} />
      <WireframeTorus   position={[ 1.8,  2.0, -3.0]} />
      <IridescentOcta   position={[-1.6, -1.8, -2.2]} />
      <ReflectiveIco    position={[ 0.4,  1.5, -1.4]} />
    </>
  );
}

export default function DashboardAmbient3DCanvas() {
  return (
    <Canvas
      camera={{ position: [0, 0, 5.5], fov: 48 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
    >
      <Suspense fallback={null}>
        <SceneContent />
      </Suspense>
    </Canvas>
  );
}
