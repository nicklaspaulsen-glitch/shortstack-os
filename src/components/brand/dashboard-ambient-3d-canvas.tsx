"use client";

/**
 * DashboardAmbient3DCanvas — the R3F implementation of the ambient
 * floating-shapes background. Lives in its own file so the parent
 * (`dashboard-ambient-3d.tsx`) can dynamic-import with ssr=false.
 *
 * Three shapes (low-poly, distorted) drift slowly through the scene.
 * Teal accent materials, dim emissive so the shapes glow softly
 * without overpowering UI on top.
 *
 * Perf budget:
 *   - DPR cap 1.5 (background context, doesn't need crisp facets)
 *   - 3 shapes total
 *   - Float wrapper handles motion (no per-frame React state)
 *   - Single Environment preset for free reflections
 *   - Frame-loop pauses automatically when canvas is offscreen (browser
 *     throttles requestAnimationFrame for hidden canvases).
 */

import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial, Environment } from "@react-three/drei";
import { Suspense, useRef } from "react";
import type { Mesh } from "three";

const TEAL = "#14B8A6";
const TEAL_LIGHT = "#5EEAD4";
const TEAL_DARK = "#0F766E";

function FloatingTorus({ position }: { position: [number, number, number] }) {
  const ref = useRef<Mesh>(null!);
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.x = state.clock.getElapsedTime() * 0.10;
    ref.current.rotation.y = state.clock.getElapsedTime() * 0.16;
  });
  return (
    <Float speed={1.2} rotationIntensity={0.3} floatIntensity={1.0}>
      <mesh ref={ref} position={position}>
        <torusGeometry args={[0.85, 0.20, 12, 24]} />
        <MeshDistortMaterial
          color={TEAL}
          emissive={TEAL_DARK}
          emissiveIntensity={0.35}
          roughness={0.35}
          metalness={0.7}
          distort={0.16}
          speed={1.0}
          transparent
          opacity={0.55}
        />
      </mesh>
    </Float>
  );
}

function FloatingSphere({ position }: { position: [number, number, number] }) {
  return (
    <Float speed={1.6} rotationIntensity={0.25} floatIntensity={1.4}>
      <mesh position={position}>
        <sphereGeometry args={[0.50, 16, 16]} />
        <MeshDistortMaterial
          color={TEAL_LIGHT}
          emissive={TEAL}
          emissiveIntensity={0.30}
          roughness={0.30}
          metalness={0.85}
          distort={0.28}
          speed={1.6}
          transparent
          opacity={0.50}
        />
      </mesh>
    </Float>
  );
}

function FloatingOctahedron({ position }: { position: [number, number, number] }) {
  const ref = useRef<Mesh>(null!);
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y = state.clock.getElapsedTime() * 0.22;
    ref.current.rotation.z = state.clock.getElapsedTime() * 0.10;
  });
  return (
    <Float speed={1.0} rotationIntensity={0.4} floatIntensity={0.9}>
      <mesh ref={ref} position={position}>
        <octahedronGeometry args={[0.42, 0]} />
        <meshStandardMaterial
          color={TEAL_DARK}
          emissive={TEAL}
          emissiveIntensity={0.40}
          roughness={0.30}
          metalness={0.90}
          transparent
          opacity={0.55}
        />
      </mesh>
    </Float>
  );
}

function SceneContent() {
  return (
    <>
      <ambientLight intensity={0.45} />
      <directionalLight position={[3, 4, 4]} intensity={0.7} color={TEAL_LIGHT} />
      <directionalLight position={[-3, -2, 2]} intensity={0.30} color={TEAL} />
      <Environment preset="city" />

      {/* 3 shapes positioned to fill the viewport corners — covers the
       *  full screen background without crowding the center where most
       *  page content sits. Z values keep them slightly behind the focal
       *  plane for a depth-of-field feel. */}
      <FloatingTorus position={[-2.6, 1.1, -2]} />
      <FloatingSphere position={[2.8, -0.4, -1.8]} />
      <FloatingOctahedron position={[1.6, 1.8, -2.5]} />
    </>
  );
}

export default function DashboardAmbient3DCanvas() {
  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 50 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
    >
      <Suspense fallback={null}>
        <SceneContent />
      </Suspense>
    </Canvas>
  );
}
