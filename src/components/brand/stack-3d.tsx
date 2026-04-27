"use client";

/**
 * Stack3D — the signature brand mark for ShortStack OS.
 *
 * Three offset rectangular blocks at slight rotation, lime-edged on a dark
 * base. Slowly rotates around the Y axis. Used on:
 *   - Login screen (massive)
 *   - Empty states (small)
 *   - Hero surfaces optionally (via PageHero `showStack3D` prop)
 *   - 404 / loading states
 *
 * Implementation: React Three Fiber when client + motion is allowed; CSS 3D
 * fallback otherwise (SSR, prefers-reduced-motion). R3F + three.js are
 * already project dependencies — see `src/components/landing/hero-3d-scene.tsx`
 * for an existing pattern.
 */

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { tokens } from "@/lib/brand/tokens";

export type Stack3DSize = "sm" | "md" | "lg";

interface Stack3DProps {
  /** Visual size — sm=64px, md=128px, lg=256px. */
  size?: Stack3DSize;
  /** Whether the mark slowly rotates around Y. Defaults to true. */
  rotating?: boolean;
  /** Additional className applied to the wrapping element. */
  className?: string;
}

const SIZE_PX: Record<Stack3DSize, number> = {
  sm: 64,
  md: 128,
  lg: 256,
};

function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduce(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return reduce;
}

/**
 * Renders three lime-edged rectangular slabs as a rotating group inside an
 * R3F <Canvas>. Slabs are offset on Y with small angular splay around X so
 * the silhouette reads as a depth-stacked stack rather than a flat icon.
 */
function StackBlocks({ rotating }: { rotating: boolean }) {
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
          {/* Lime edge highlight — slightly larger box behind */}
          <mesh position={[0, 0, -0.001]}>
            <boxGeometry args={[1.62, 0.32, 1.02]} />
            <meshStandardMaterial
              color={tokens.brand.lime}
              emissive={tokens.brand.lime}
              emissiveIntensity={0.6}
              roughness={0.4}
              metalness={0.2}
            />
          </mesh>
          {/* Dark base block — sits in front, occludes most of the lime */}
          <mesh>
            <boxGeometry args={[1.6, 0.3, 1]} />
            <meshStandardMaterial color={tokens.bg.base} roughness={0.7} metalness={0.1} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function StackR3F({ size, rotating }: { size: number; rotating: boolean }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 4.2], fov: 35 }}
      style={{ width: size, height: size }}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 4, 2]} intensity={1.2} />
      <directionalLight position={[-2, -1, 3]} intensity={0.5} color={tokens.brand.lime} />
      <StackBlocks rotating={rotating} />
    </Canvas>
  );
}

/**
 * Pure CSS fallback — three layered divs with lime borders. Used during SSR
 * and when reduced motion is requested.
 */
function StackCssFallback({ size, rotating }: { size: number; rotating: boolean }) {
  const slabHeight = Math.round(size * 0.18);
  const slabWidth = Math.round(size * 0.86);
  const offset = Math.round(size * 0.16);
  return (
    <div
      className={rotating ? "animate-stack-rotate" : ""}
      style={{
        width: size,
        height: size,
        position: "relative",
        perspective: `${size * 4}px`,
        transformStyle: "preserve-3d",
      }}
      aria-hidden
    >
      {[2, 1, 0].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: slabWidth,
            height: slabHeight,
            transform: `translate(-50%, -50%) translateY(${(i - 1) * offset}px) rotateX(20deg) rotateY(-25deg)`,
            background: tokens.bg.surface1,
            border: `1.5px solid ${tokens.brand.lime}`,
            borderRadius: 4,
            boxShadow: `0 0 ${size * 0.12}px ${tokens.brand.limeGlow}, 0 ${size * 0.04}px ${size * 0.12}px rgba(0,0,0,0.4)`,
          }}
        />
      ))}
    </div>
  );
}

export default function Stack3D({ size = "md", rotating = true, className = "" }: Stack3DProps) {
  const px = SIZE_PX[size];
  const reduceMotion = usePrefersReducedMotion();
  const [mounted, setMounted] = useState(false);
  // Defer the R3F mount until after hydration so SSR returns the CSS
  // fallback. Prevents three.js from running on the server.
  useEffect(() => setMounted(true), []);

  const useCanvas = mounted && !reduceMotion;
  const shouldRotate = rotating && !reduceMotion;

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: px, height: px }}
    >
      {useCanvas ? (
        <StackR3F size={px} rotating={shouldRotate} />
      ) : (
        <StackCssFallback size={px} rotating={shouldRotate} />
      )}
    </div>
  );
}
