"use client";

/**
 * PageHero3DCanvas — R3F implementation of PageHero3D. Lives in its own
 * file so the parent can dynamic-import with ssr=false (keeps three.js
 * out of the dashboard initial bundle).
 *
 * Each `theme` returns a different small composition of 2-4 shapes.
 * Shapes are wrapped in `<Float>` for natural drift — no per-frame
 * React state, all motion driven by drei's internal frame loop.
 */

import { Canvas } from "@react-three/fiber";
import { Float, Environment } from "@react-three/drei";
import { Suspense } from "react";
import { tokens } from "@/lib/brand/tokens";
import type { PageHero3DTheme } from "./page-hero-3d";

interface CanvasProps {
  theme: PageHero3DTheme;
  size: number;
}

/** Standard mesh material used across themes — teal accent with mid
 *  metalness so the HDR environment reflects nicely off the facets. */
function StdMaterial({
  color,
  emissive,
  intensity = 0.4,
  metalness = 0.7,
  roughness = 0.3,
}: {
  color?: string;
  emissive?: string;
  intensity?: number;
  metalness?: number;
  roughness?: number;
}) {
  return (
    <meshStandardMaterial
      color={color ?? tokens.brand.accent}
      emissive={emissive ?? tokens.brand.accentDim}
      emissiveIntensity={intensity}
      roughness={roughness}
      metalness={metalness}
    />
  );
}

/* ─── Theme scenes ────────────────────────────────────────────────── */

function SalesScene() {
  return (
    <>
      {/* Dollar coin — flat thick disc */}
      <Float speed={1.2} rotationIntensity={0.6} floatIntensity={0.8}>
        <mesh position={[-0.6, 0.2, 0]} rotation={[Math.PI / 2.5, 0, 0]}>
          <cylinderGeometry args={[0.55, 0.55, 0.12, 24]} />
          <StdMaterial intensity={0.5} />
        </mesh>
      </Float>
      {/* Arrow cone — points up-right (revenue going up) */}
      <Float speed={1.6} rotationIntensity={0.3} floatIntensity={1.0}>
        <mesh position={[0.7, 0.5, 0]} rotation={[0, 0, -0.4]}>
          <coneGeometry args={[0.32, 0.65, 18]} />
          <StdMaterial color={tokens.brand.accentSoft} intensity={0.6} />
        </mesh>
      </Float>
      {/* Spinning ring — funnel feel */}
      <Float speed={0.9} rotationIntensity={0.5} floatIntensity={0.6}>
        <mesh position={[0.2, -0.5, 0]} rotation={[Math.PI / 2.8, 0.4, 0]}>
          <torusGeometry args={[0.38, 0.07, 12, 32]} />
          <StdMaterial intensity={0.5} />
        </mesh>
      </Float>
    </>
  );
}

function CreateScene() {
  return (
    <>
      {/* Pen / writing instrument */}
      <Float speed={1.4} rotationIntensity={0.4} floatIntensity={0.9}>
        <mesh position={[-0.55, 0.4, 0]} rotation={[0.3, 0.4, -Math.PI / 4]}>
          <coneGeometry args={[0.18, 0.95, 12]} />
          <StdMaterial color={tokens.brand.accentSoft} intensity={0.5} />
        </mesh>
      </Float>
      {/* Idea bubble */}
      <Float speed={1.7} rotationIntensity={0.3} floatIntensity={1.2}>
        <mesh position={[0.55, 0.45, 0]}>
          <sphereGeometry args={[0.45, 24, 24]} />
          <StdMaterial intensity={0.7} metalness={0.5} />
        </mesh>
      </Float>
      {/* Spark — small octahedron */}
      <Float speed={2.2} rotationIntensity={0.8} floatIntensity={1.4}>
        <mesh position={[0.1, -0.55, 0]}>
          <octahedronGeometry args={[0.32, 0]} />
          <StdMaterial intensity={0.9} />
        </mesh>
      </Float>
    </>
  );
}

function VisualScene() {
  return (
    <>
      {/* Photo cube — box at angle, like a 3D postcard */}
      <Float speed={1.1} rotationIntensity={0.6} floatIntensity={0.8}>
        <mesh position={[-0.45, 0.2, 0]} rotation={[0.3, 0.6, 0.1]}>
          <boxGeometry args={[0.7, 0.55, 0.05]} />
          <StdMaterial color={tokens.brand.accentSoft} intensity={0.5} />
        </mesh>
      </Float>
      {/* Lens sphere */}
      <Float speed={1.5} rotationIntensity={0.4} floatIntensity={1.0}>
        <mesh position={[0.6, 0.3, 0]}>
          <sphereGeometry args={[0.42, 32, 32]} />
          <StdMaterial intensity={0.6} metalness={0.85} />
        </mesh>
      </Float>
      {/* Frame torus — picture frame */}
      <Float speed={1.0} rotationIntensity={0.5} floatIntensity={0.7}>
        <mesh position={[0.1, -0.5, 0]} rotation={[Math.PI / 2.5, 0.2, 0]}>
          <torusGeometry args={[0.38, 0.06, 8, 24]} />
          <StdMaterial intensity={0.6} />
        </mesh>
      </Float>
    </>
  );
}

function AutomateScene() {
  return (
    <>
      {/* Gear — wide flat torus */}
      <Float speed={1.0} rotationIntensity={1.2} floatIntensity={0.7}>
        <mesh position={[-0.5, 0.3, 0]} rotation={[Math.PI / 2.5, 0, 0]}>
          <torusGeometry args={[0.55, 0.16, 6, 12]} />
          <StdMaterial intensity={0.55} />
        </mesh>
      </Float>
      {/* Chip — small cube */}
      <Float speed={1.6} rotationIntensity={0.5} floatIntensity={1.0}>
        <mesh position={[0.6, 0.5, 0]} rotation={[0.3, 0.3, 0]}>
          <boxGeometry args={[0.4, 0.4, 0.4]} />
          <StdMaterial color={tokens.brand.accentSoft} intensity={0.6} />
        </mesh>
      </Float>
      {/* Zap — sharp octahedron */}
      <Float speed={2.0} rotationIntensity={0.8} floatIntensity={1.2}>
        <mesh position={[0.15, -0.55, 0]} rotation={[0, 0, Math.PI / 4]}>
          <octahedronGeometry args={[0.32, 0]} />
          <StdMaterial intensity={1.0} />
        </mesh>
      </Float>
    </>
  );
}

function ManageScene() {
  return (
    <>
      {/* Building stack — 3 boxes of decreasing width */}
      <Float speed={0.9} rotationIntensity={0.3} floatIntensity={0.6}>
        <group position={[-0.4, 0, 0]}>
          <mesh position={[0, 0.5, 0]}>
            <boxGeometry args={[0.32, 0.32, 0.32]} />
            <StdMaterial color={tokens.brand.accentSoft} intensity={0.6} />
          </mesh>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.5, 0.32, 0.32]} />
            <StdMaterial intensity={0.5} />
          </mesh>
          <mesh position={[0, -0.5, 0]}>
            <boxGeometry args={[0.65, 0.32, 0.32]} />
            <StdMaterial color={tokens.brand.accentDim} intensity={0.45} />
          </mesh>
        </group>
      </Float>
      {/* Chart ring */}
      <Float speed={1.2} rotationIntensity={0.6} floatIntensity={0.9}>
        <mesh position={[0.65, 0.2, 0]}>
          <torusGeometry args={[0.42, 0.05, 12, 32]} />
          <StdMaterial intensity={0.7} />
        </mesh>
      </Float>
    </>
  );
}

function ConnectScene() {
  return (
    <>
      {/* Central node sphere */}
      <Float speed={1.0} rotationIntensity={0.3} floatIntensity={0.7}>
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.4, 24, 24]} />
          <StdMaterial intensity={0.8} />
        </mesh>
      </Float>
      {/* Link torus — orbiting connection */}
      <Float speed={1.4} rotationIntensity={1.0} floatIntensity={0.5}>
        <mesh position={[0, 0, 0]} rotation={[Math.PI / 2.5, 0.4, 0]}>
          <torusGeometry args={[0.85, 0.04, 8, 32]} />
          <StdMaterial color={tokens.brand.accentSoft} intensity={0.7} />
        </mesh>
      </Float>
      {/* Satellite cubes — orbiting endpoints */}
      <Float speed={1.6} rotationIntensity={0.6} floatIntensity={1.0}>
        <mesh position={[0.85, 0.4, 0]}>
          <boxGeometry args={[0.22, 0.22, 0.22]} />
          <StdMaterial color={tokens.brand.accentSoft} intensity={0.7} />
        </mesh>
      </Float>
      <Float speed={1.8} rotationIntensity={0.5} floatIntensity={1.1}>
        <mesh position={[-0.85, -0.3, 0]}>
          <boxGeometry args={[0.22, 0.22, 0.22]} />
          <StdMaterial color={tokens.brand.accentSoft} intensity={0.7} />
        </mesh>
      </Float>
    </>
  );
}

function AiScene() {
  return (
    <>
      {/* Brain orb — icosahedron */}
      <Float speed={1.0} rotationIntensity={0.6} floatIntensity={0.6}>
        <mesh position={[0, 0, 0]}>
          <icosahedronGeometry args={[0.55, 1]} />
          <StdMaterial intensity={0.9} metalness={0.85} />
        </mesh>
      </Float>
      {/* Circuit ring */}
      <Float speed={1.4} rotationIntensity={1.0} floatIntensity={0.4}>
        <mesh position={[0, 0, 0]} rotation={[Math.PI / 2.6, 0.5, 0]}>
          <torusGeometry args={[0.85, 0.025, 8, 48]} />
          <StdMaterial color={tokens.brand.accentSoft} intensity={1.0} />
        </mesh>
      </Float>
      {/* Spark satellite */}
      <Float speed={2.0} rotationIntensity={0.8} floatIntensity={1.4}>
        <mesh position={[0.85, 0.45, 0]}>
          <octahedronGeometry args={[0.18, 0]} />
          <StdMaterial color={tokens.brand.accentSoft} intensity={1.2} />
        </mesh>
      </Float>
    </>
  );
}

function VoiceScene() {
  return (
    <>
      {/* Microphone capsule — cylinder + sphere on top */}
      <Float speed={1.2} rotationIntensity={0.3} floatIntensity={0.8}>
        <group position={[0, 0.1, 0]}>
          <mesh position={[0, 0.3, 0]}>
            <cylinderGeometry args={[0.22, 0.22, 0.5, 16]} />
            <StdMaterial intensity={0.6} />
          </mesh>
          <mesh position={[0, 0.6, 0]}>
            <sphereGeometry args={[0.26, 16, 16]} />
            <StdMaterial color={tokens.brand.accentSoft} intensity={0.7} />
          </mesh>
        </group>
      </Float>
      {/* Sound wave torus */}
      <Float speed={1.5} rotationIntensity={0.6} floatIntensity={0.7}>
        <mesh position={[0, -0.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.55, 0.04, 12, 32]} />
          <StdMaterial intensity={0.8} />
        </mesh>
      </Float>
      <Float speed={2.0} rotationIntensity={0.5} floatIntensity={0.6}>
        <mesh position={[0, -0.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.78, 0.03, 12, 32]} />
          <StdMaterial color={tokens.brand.accentSoft} intensity={0.7} />
        </mesh>
      </Float>
    </>
  );
}

function AnalyticsScene() {
  return (
    <>
      {/* 3 bars of increasing height — a 3D bar chart */}
      <Float speed={0.9} rotationIntensity={0.2} floatIntensity={0.5}>
        <group position={[-0.1, -0.1, 0]}>
          <mesh position={[-0.42, -0.15, 0]}>
            <boxGeometry args={[0.22, 0.45, 0.22]} />
            <StdMaterial color={tokens.brand.accentDim} intensity={0.5} />
          </mesh>
          <mesh position={[0, 0.05, 0]}>
            <boxGeometry args={[0.22, 0.85, 0.22]} />
            <StdMaterial intensity={0.65} />
          </mesh>
          <mesh position={[0.42, 0.25, 0]}>
            <boxGeometry args={[0.22, 1.25, 0.22]} />
            <StdMaterial color={tokens.brand.accentSoft} intensity={0.85} />
          </mesh>
        </group>
      </Float>
    </>
  );
}

function LeadsScene() {
  return (
    <>
      {/* Funnel cone — points down */}
      <Float speed={1.0} rotationIntensity={0.4} floatIntensity={0.7}>
        <mesh position={[0, 0.1, 0]} rotation={[0, 0, Math.PI]}>
          <coneGeometry args={[0.6, 0.85, 24]} />
          <StdMaterial intensity={0.55} />
        </mesh>
      </Float>
      {/* Drop spheres */}
      <Float speed={1.6} rotationIntensity={0.2} floatIntensity={1.2}>
        <mesh position={[0, -0.5, 0]}>
          <sphereGeometry args={[0.16, 16, 16]} />
          <StdMaterial color={tokens.brand.accentSoft} intensity={0.85} />
        </mesh>
      </Float>
      <Float speed={1.9} rotationIntensity={0.2} floatIntensity={1.4}>
        <mesh position={[0.4, -0.65, 0.1]}>
          <sphereGeometry args={[0.12, 16, 16]} />
          <StdMaterial color={tokens.brand.accentSoft} intensity={0.85} />
        </mesh>
      </Float>
      <Float speed={1.7} rotationIntensity={0.2} floatIntensity={1.3}>
        <mesh position={[-0.4, -0.7, -0.1]}>
          <sphereGeometry args={[0.12, 16, 16]} />
          <StdMaterial color={tokens.brand.accentSoft} intensity={0.85} />
        </mesh>
      </Float>
    </>
  );
}

function InboxScene() {
  return (
    <>
      {/* Envelope — flat box rotated to look like a card */}
      <Float speed={1.0} rotationIntensity={0.4} floatIntensity={0.8}>
        <mesh position={[0, 0, 0]} rotation={[0.3, 0.4, 0]}>
          <boxGeometry args={[0.95, 0.6, 0.05]} />
          <StdMaterial intensity={0.55} />
        </mesh>
      </Float>
      {/* Notification dots */}
      <Float speed={1.5} rotationIntensity={0.2} floatIntensity={1.0}>
        <mesh position={[0.7, 0.5, 0]}>
          <sphereGeometry args={[0.16, 16, 16]} />
          <StdMaterial color={tokens.brand.accentSoft} intensity={1.0} />
        </mesh>
      </Float>
      <Float speed={1.8} rotationIntensity={0.2} floatIntensity={1.3}>
        <mesh position={[-0.6, -0.45, 0]}>
          <sphereGeometry args={[0.13, 16, 16]} />
          <StdMaterial color={tokens.brand.accentSoft} intensity={0.9} />
        </mesh>
      </Float>
    </>
  );
}

function DefaultScene() {
  return (
    <>
      {/* Trinity icosahedron core */}
      <Float speed={1.2} rotationIntensity={0.5} floatIntensity={0.7}>
        <mesh position={[0, 0, 0]}>
          <icosahedronGeometry args={[0.55, 1]} />
          <StdMaterial intensity={0.7} metalness={0.85} />
        </mesh>
      </Float>
      {/* 2 satellite shards */}
      <Float speed={1.6} rotationIntensity={0.6} floatIntensity={1.1}>
        <mesh position={[0.7, 0.45, 0]}>
          <octahedronGeometry args={[0.18, 0]} />
          <StdMaterial color={tokens.brand.accentSoft} intensity={0.8} />
        </mesh>
      </Float>
      <Float speed={1.9} rotationIntensity={0.5} floatIntensity={1.3}>
        <mesh position={[-0.65, -0.35, 0]}>
          <octahedronGeometry args={[0.15, 0]} />
          <StdMaterial color={tokens.brand.accentSoft} intensity={0.8} />
        </mesh>
      </Float>
    </>
  );
}

const SCENES: Record<PageHero3DTheme, () => React.JSX.Element> = {
  sales: SalesScene,
  create: CreateScene,
  visual: VisualScene,
  automate: AutomateScene,
  manage: ManageScene,
  connect: ConnectScene,
  ai: AiScene,
  voice: VoiceScene,
  analytics: AnalyticsScene,
  leads: LeadsScene,
  inbox: InboxScene,
  default: DefaultScene,
};

export default function PageHero3DCanvas({ theme, size }: CanvasProps) {
  const Scene = SCENES[theme] ?? DefaultScene;

  return (
    <Canvas
      camera={{ position: [0, 0, 3.0], fov: 38 }}
      style={{ width: size, height: size }}
      dpr={[1, 2.5]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
    >
      <Suspense fallback={null}>
        <ambientLight intensity={0.45} />
        <directionalLight position={[3, 4, 4]} intensity={0.9} />
        <pointLight position={[-2, -1, 2]} color={tokens.brand.accent} intensity={1.0} />
        <pointLight position={[2, 1.5, -2]} color={tokens.brand.accentSoft} intensity={0.55} />
        <Environment preset="city" />
        <Scene />
      </Suspense>
    </Canvas>
  );
}
