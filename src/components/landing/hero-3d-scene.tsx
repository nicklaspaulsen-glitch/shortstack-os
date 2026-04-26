"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial, Environment } from "@react-three/drei";
import { Suspense, useEffect, useRef, useState } from "react";
import type { Mesh } from "three";

const GOLD = "#c8a855";
const GOLD_LIGHT = "#e4c876";
const GOLD_DARK = "#8a6f2f";

function FloatingTorus({ position }: { position: [number, number, number] }) {
  const ref = useRef<Mesh>(null!);
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.x = state.clock.getElapsedTime() * 0.15;
    ref.current.rotation.y = state.clock.getElapsedTime() * 0.22;
  });
  return (
    <Float speed={1.4} rotationIntensity={0.4} floatIntensity={1.2}>
      <mesh ref={ref} position={position}>
        {/* low-poly torus: 24 radial, 12 tubular → 288 faces */}
        <torusGeometry args={[0.9, 0.22, 12, 24]} />
        <MeshDistortMaterial
          color={GOLD}
          emissive={GOLD_DARK}
          emissiveIntensity={0.4}
          roughness={0.35}
          metalness={0.7}
          distort={0.18}
          speed={1.2}
        />
      </mesh>
    </Float>
  );
}

function FloatingSphere({ position }: { position: [number, number, number] }) {
  return (
    <Float speed={1.8} rotationIntensity={0.3} floatIntensity={1.6}>
      <mesh position={position}>
        {/* low-poly icosphere via sphereGeometry 16x16 ≈ 480 tris */}
        <sphereGeometry args={[0.55, 16, 16]} />
        <MeshDistortMaterial
          color={GOLD_LIGHT}
          emissive={GOLD}
          emissiveIntensity={0.25}
          roughness={0.25}
          metalness={0.85}
          distort={0.3}
          speed={2}
        />
      </mesh>
    </Float>
  );
}

function FloatingOctahedron({ position }: { position: [number, number, number] }) {
  const ref = useRef<Mesh>(null!);
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y = state.clock.getElapsedTime() * 0.3;
    ref.current.rotation.z = state.clock.getElapsedTime() * 0.12;
  });
  return (
    <Float speed={1.2} rotationIntensity={0.5} floatIntensity={1.0}>
      <mesh ref={ref} position={position}>
        <octahedronGeometry args={[0.45, 0]} />
        <meshStandardMaterial
          color={GOLD_DARK}
          emissive={GOLD}
          emissiveIntensity={0.3}
          roughness={0.3}
          metalness={0.9}
        />
      </mesh>
    </Float>
  );
}

function SceneContent() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useFrame(({ camera }) => {
    // drift camera subtly on scroll for parallax feel
    const t = Math.min(scrollY / 600, 1);
    camera.position.y = -t * 0.5;
    camera.lookAt(0, 0, 0);
  });

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[4, 4, 4]} intensity={0.8} color={GOLD_LIGHT} />
      <directionalLight position={[-3, -2, 2]} intensity={0.3} color={GOLD} />
      <Environment preset="studio" />

      <FloatingTorus position={[-2.2, 0.6, -1]} />
      <FloatingSphere position={[2.4, -0.2, -0.5]} />
      <FloatingOctahedron position={[1.2, 1.5, -1.8]} />
      <FloatingSphere position={[-1.6, -1.4, -1.2]} />
      <FloatingOctahedron position={[-2.8, -0.8, -2.2]} />
    </>
  );
}

function StaticFallback() {
  return (
    <svg
      viewBox="0 0 800 500"
      className="w-full h-full"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <radialGradient id="g-gold" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={GOLD_LIGHT} stopOpacity="0.7" />
          <stop offset="100%" stopColor={GOLD_DARK} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="210" cy="240" r="90" fill="url(#g-gold)" />
      <circle cx="600" cy="200" r="60" fill="url(#g-gold)" />
      <circle cx="520" cy="380" r="50" fill="url(#g-gold)" />
    </svg>
  );
}

export default function Hero3DScene() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  if (reduceMotion) {
    return (
      <div className="absolute inset-0 opacity-40 pointer-events-none">
        <StaticFallback />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 50 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <Suspense fallback={null}>
          <SceneContent />
        </Suspense>
      </Canvas>
    </div>
  );
}
