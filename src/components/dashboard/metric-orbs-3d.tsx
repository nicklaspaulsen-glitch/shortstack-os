"use client";

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Html, Float } from "@react-three/drei";
import * as THREE from "three";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrbData {
  label: string;
  value: string | number;
  sub: string;
  color: string;
  x: number;
  floatSpeed: number;
}

export interface MetricOrbs3DProps {
  clients: number | null;
  leads: number | null;
  workflows: number | null;
}

// ─── Single orb ───────────────────────────────────────────────────────────────

function Orb({ data }: { data: OrbData }) {
  const color = useMemo(() => new THREE.Color(data.color), [data.color]);

  return (
    <group position={[data.x, 0, 0]}>
      {/* Per-orb colored halo light */}
      <pointLight
        color={data.color}
        intensity={2.8}
        distance={3.2}
        decay={2}
        position={[0, 0.3, 0.6]}
      />

      {/* Float animation — each orb bobs at its own speed */}
      <Float
        speed={data.floatSpeed}
        rotationIntensity={0.16}
        floatIntensity={0.42}
      >
        {/* Glow shell — back-face sphere slightly larger than main orb */}
        <mesh>
          <sphereGeometry args={[0.70, 32, 32]} />
          <meshStandardMaterial
            color={data.color}
            emissive={color}
            emissiveIntensity={0.7}
            transparent
            opacity={0.06}
            side={THREE.BackSide}
          />
        </mesh>

        {/* Main orb — clearcoat glass-like sphere */}
        <mesh>
          <sphereGeometry args={[0.58, 64, 64]} />
          <meshPhysicalMaterial
            color={data.color}
            emissive={color}
            emissiveIntensity={0.24}
            roughness={0.05}
            metalness={0.1}
            clearcoat={1.0}
            clearcoatRoughness={0.04}
            transparent
            opacity={0.88}
          />
        </mesh>

        {/* Value label — centered on orb face, follows Float animation */}
        <Html
          center
          position={[0, 0, 0.64]}
          style={{ pointerEvents: "none", userSelect: "none" }}
          distanceFactor={3.5}
        >
          <div
            style={{
              fontFamily: "var(--font-satoshi, 'Satoshi', sans-serif)",
              fontSize: 24,
              fontWeight: 900,
              color: "#fff",
              letterSpacing: "-0.04em",
              lineHeight: 1,
              textShadow: `0 0 18px ${data.color}, 0 0 8px ${data.color}80`,
            }}
          >
            {data.value}
          </div>
        </Html>
      </Float>

      {/* Metric label row — stays fixed below the floating orb */}
      <Html
        center
        position={[0, -0.96, 0]}
        style={{
          pointerEvents: "none",
          userSelect: "none",
          whiteSpace: "nowrap",
        }}
        distanceFactor={3.5}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontFamily: "var(--font-satoshi, 'Satoshi', sans-serif)",
              fontSize: 11,
              fontWeight: 700,
              color: data.color,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            {data.label}
          </div>
          <div
            style={{
              fontFamily: "var(--font-satoshi, 'Satoshi', sans-serif)",
              fontSize: 9.5,
              color: "rgba(255,255,255,0.4)",
              marginTop: 3,
            }}
          >
            {data.sub}
          </div>
        </div>
      </Html>
    </group>
  );
}

// ─── Scene contents ───────────────────────────────────────────────────────────

function OrbScene({ clients, leads, workflows }: MetricOrbs3DProps) {
  // Memoised so Orb keys are stable and THREE.Color instances inside each Orb
  // are not re-created on every parent render.
  const orbs: OrbData[] = useMemo(
    () => [
      {
        label: "Clients",
        value: clients ?? "—",
        sub: "active",
        color: "#14B8A6",
        x: -3.6,
        floatSpeed: 1.4,
      },
      {
        label: "Leads",
        value: leads ?? "—",
        sub: "in pipeline",
        color: "#A78BFA",
        x: -1.2,
        floatSpeed: 1.7,
      },
      {
        label: "Workflows",
        value: workflows ?? "—",
        sub: "running",
        color: "#F97316",
        x: 1.2,
        floatSpeed: 1.5,
      },
      {
        label: "AI Credits",
        value: "∞",
        sub: "unlimited",
        color: "#22C55E",
        x: 3.6,
        floatSpeed: 1.9,
      },
    ],
    [clients, leads, workflows]
  );

  return (
    <>
      {/* Scene lighting */}
      <ambientLight intensity={0.55} color="#ffffff" />
      <directionalLight position={[5, 7, 5]} intensity={1.5} color="#ffffff" />
      <directionalLight
        position={[-4, -2, -4]}
        intensity={0.28}
        color="#D4FF00"
      />

      {orbs.map((orb) => (
        <Orb key={orb.label} data={orb} />
      ))}
    </>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

export function MetricOrbs3D({ clients, leads, workflows }: MetricOrbs3DProps) {
  return (
    <div
      style={{ width: "100%", height: 240, position: "relative" }}
      aria-label="Agency metrics: animated 3D orbs showing clients, leads, workflows, and AI credits"
      role="img"
    >
      <Canvas
        camera={{ position: [0, 0.15, 8.5], fov: 52 }}
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 2]}
        style={{ position: "absolute", inset: 0 }}
      >
        <OrbScene clients={clients} leads={leads} workflows={workflows} />
      </Canvas>
    </div>
  );
}
