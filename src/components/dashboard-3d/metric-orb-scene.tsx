"use client";

/**
 * MetricOrbScene — R3F 3D scene for /dashboard/3d.
 *
 * Six floating spheres positioned in a hex ring. Each sphere:
 *   • Radius proportional to the normalised metric value (0.2–1.0)
 *   • Branded color with emissive glow
 *   • Sine-wave Y-axis bob, phase-offset so they don't sync
 *   • <Text> label floating beneath
 *
 * Dynamic-imported by the parent page — never rendered server-side.
 */

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Text, OrbitControls, Stars, Environment } from "@react-three/drei";
import * as THREE from "three";

// ── Orb ring positions ────────────────────────────────────────────────────────
// Six evenly-spaced positions on a ring of radius 4.5, centred at (0,0,0).

const RING_RADIUS = 4.5;
const ORB_POSITIONS: [number, number, number][] = Array.from({ length: 6 }, (_, i) => {
  const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
  return [Math.cos(angle) * RING_RADIUS, 0, Math.sin(angle) * RING_RADIUS];
});

// ── Single orb ────────────────────────────────────────────────────────────────

interface OrbProps {
  position: [number, number, number];
  radius: number;
  color: string;
  label: string;
  sublabel: string;
  phaseOffset: number;
  formattedValue: string;
}

function Orb({
  position,
  radius,
  color,
  label,
  sublabel,
  phaseOffset,
  formattedValue,
}: OrbProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const bob = Math.sin(t * 0.8 + phaseOffset) * 0.25;
    if (meshRef.current) {
      meshRef.current.position.y = bob;
      meshRef.current.rotation.y = t * 0.3 + phaseOffset;
    }
    if (glowRef.current) {
      glowRef.current.position.y = bob;
      const pulse = 0.9 + Math.sin(t * 1.2 + phaseOffset) * 0.1;
      glowRef.current.scale.setScalar(pulse);
    }
  });

  const threeColor = new THREE.Color(color);

  return (
    <group position={position}>
      {/* Outer glow sphere */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[radius * 1.55, 16, 16]} />
        <meshStandardMaterial
          color={threeColor}
          transparent
          opacity={0.06}
          roughness={1}
          metalness={0}
        />
      </mesh>

      {/* Core sphere */}
      <mesh ref={meshRef} castShadow>
        <sphereGeometry args={[radius, 40, 40]} />
        <meshStandardMaterial
          color={threeColor}
          emissive={threeColor}
          emissiveIntensity={0.35}
          roughness={0.18}
          metalness={0.65}
          envMapIntensity={1.2}
        />
      </mesh>

      {/* Value label — floats above */}
      <Text
        position={[0, radius + 0.55, 0]}
        fontSize={0.38}
        color={color}
        anchorX="center"
        anchorY="middle"
        font="/fonts/Satoshi-Bold.woff"
        renderOrder={1}
      >
        {formattedValue}
      </Text>

      {/* Name label — floats below */}
      <Text
        position={[0, -(radius + 0.55), 0]}
        fontSize={0.22}
        color="#A8A8B2"
        anchorX="center"
        anchorY="middle"
        renderOrder={1}
      >
        {label.toUpperCase()}
      </Text>
      <Text
        position={[0, -(radius + 0.85), 0]}
        fontSize={0.17}
        color="#4A4A5A"
        anchorX="center"
        anchorY="middle"
        renderOrder={1}
      >
        {sublabel}
      </Text>
    </group>
  );
}

// ── Animated connection lines ─────────────────────────────────────────────────

function RingConnector({ colors }: { colors: string[] }) {
  const lineRef = useRef<THREE.LineLoop>(null);

  useFrame(({ clock }) => {
    if (lineRef.current) {
      lineRef.current.rotation.y = clock.getElapsedTime() * 0.04;
    }
  });

  const points = [...ORB_POSITIONS, ORB_POSITIONS[0]].map(
    ([x, , z]) => new THREE.Vector3(x, 0, z),
  );
  const geometry = new THREE.BufferGeometry().setFromPoints(points);

  return (
    <lineLoop ref={lineRef} geometry={geometry}>
      <lineBasicMaterial color="#D4FF00" opacity={0.08} transparent />
    </lineLoop>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface OrbDef {
  key: string;
  label: string;
  sublabel: string;
  color: string;
  format: (v: number) => string;
  phaseOffset: number;
}

interface MetricOrbSceneProps {
  orbs: readonly OrbDef[];
  normalised: Record<string, number>;
  values: Record<string, number>;
}

// ── Scene root ────────────────────────────────────────────────────────────────

function SceneContent({
  orbs,
  normalised,
  values,
}: MetricOrbSceneProps) {
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.15} />
      <directionalLight position={[8, 12, 8]} intensity={0.6} castShadow />
      <pointLight position={[0, 6, 0]} color="#D4FF00" intensity={0.4} distance={18} />

      {/* Background stars */}
      <Stars radius={60} depth={40} count={600} factor={3} fade speed={0.6} />

      {/* Environment for reflections */}
      <Environment preset="night" />

      {/* Connection ring */}
      <RingConnector colors={orbs.map((o) => o.color)} />

      {/* Orbs */}
      {orbs.map((orb, i) => {
        const scale = normalised[orb.key] ?? 0.2;
        const radius = 0.45 + scale * 0.55; // 0.45 → 1.0 range
        return (
          <Orb
            key={orb.key}
            position={ORB_POSITIONS[i] ?? [0, 0, 0]}
            radius={radius}
            color={orb.color}
            label={orb.label}
            sublabel={orb.sublabel}
            phaseOffset={orb.phaseOffset}
            formattedValue={orb.format(values[orb.key] ?? 0)}
          />
        );
      })}
    </>
  );
}

// ── Exported component ────────────────────────────────────────────────────────

export default function MetricOrbScene({ orbs, normalised, values }: MetricOrbSceneProps) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      style={{ height: 480, background: "transparent" }}
      camera={{ position: [0, 9, 14], fov: 42 }}
      gl={{ antialias: true, alpha: true }}
    >
      <SceneContent orbs={orbs} normalised={normalised} values={values} />
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI / 2.2}
        autoRotate
        autoRotateSpeed={0.35}
      />
    </Canvas>
  );
}
