"use client";

/**
 * PageHero3DCanvas — R3F implementation of PageHero3D. Lives in its own
 * file so the parent can dynamic-import with ssr=false (keeps three.js
 * out of the dashboard initial bundle).
 *
 * Each `theme` returns a different small composition of 2-4 shapes.
 * The themes are designed to MATCH the sidebar icon for the page —
 * e.g. /dashboard/eleven-agents (sidebar icon: Phone) renders the
 * `phone` theme (handset shape). Pages without a 1:1 icon match fall
 * back to the closest section-hub theme.
 *
 * Shapes are wrapped in `<Float>` for natural drift — no per-frame
 * React state, motion driven by drei's internal frame loop.
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

/* ─── Section-hub themes ─────────────────────────────────────────── */

function SalesScene() {
  return (
    <>
      <Float speed={1.2} rotationIntensity={0.6} floatIntensity={0.8}>
        <mesh position={[-0.6, 0.2, 0]} rotation={[Math.PI / 2.5, 0, 0]}>
          <cylinderGeometry args={[0.55, 0.55, 0.12, 24]} />
          <StdMaterial intensity={0.5} />
        </mesh>
      </Float>
      <Float speed={1.6} rotationIntensity={0.3} floatIntensity={1.0}>
        <mesh position={[0.7, 0.5, 0]} rotation={[0, 0, -0.4]}>
          <coneGeometry args={[0.32, 0.65, 18]} />
          <StdMaterial color={tokens.brand.accentSoft} intensity={0.6} />
        </mesh>
      </Float>
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
      <Float speed={1.4} rotationIntensity={0.4} floatIntensity={0.9}>
        <mesh position={[-0.55, 0.4, 0]} rotation={[0.3, 0.4, -Math.PI / 4]}>
          <coneGeometry args={[0.18, 0.95, 12]} />
          <StdMaterial color={tokens.brand.accentSoft} intensity={0.5} />
        </mesh>
      </Float>
      <Float speed={1.7} rotationIntensity={0.3} floatIntensity={1.2}>
        <mesh position={[0.55, 0.45, 0]}>
          <sphereGeometry args={[0.45, 24, 24]} />
          <StdMaterial intensity={0.7} metalness={0.5} />
        </mesh>
      </Float>
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
      <Float speed={1.1} rotationIntensity={0.6} floatIntensity={0.8}>
        <mesh position={[-0.45, 0.2, 0]} rotation={[0.3, 0.6, 0.1]}>
          <boxGeometry args={[0.7, 0.55, 0.05]} />
          <StdMaterial color={tokens.brand.accentSoft} intensity={0.5} />
        </mesh>
      </Float>
      <Float speed={1.5} rotationIntensity={0.4} floatIntensity={1.0}>
        <mesh position={[0.6, 0.3, 0]}>
          <sphereGeometry args={[0.42, 32, 32]} />
          <StdMaterial intensity={0.6} metalness={0.85} />
        </mesh>
      </Float>
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
      <Float speed={1.0} rotationIntensity={1.2} floatIntensity={0.7}>
        <mesh position={[-0.5, 0.3, 0]} rotation={[Math.PI / 2.5, 0, 0]}>
          <torusGeometry args={[0.55, 0.16, 6, 12]} />
          <StdMaterial intensity={0.55} />
        </mesh>
      </Float>
      <Float speed={1.6} rotationIntensity={0.5} floatIntensity={1.0}>
        <mesh position={[0.6, 0.5, 0]} rotation={[0.3, 0.3, 0]}>
          <boxGeometry args={[0.4, 0.4, 0.4]} />
          <StdMaterial color={tokens.brand.accentSoft} intensity={0.6} />
        </mesh>
      </Float>
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
      <Float speed={1.0} rotationIntensity={0.3} floatIntensity={0.7}>
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.4, 24, 24]} />
          <StdMaterial intensity={0.8} />
        </mesh>
      </Float>
      <Float speed={1.4} rotationIntensity={1.0} floatIntensity={0.5}>
        <mesh position={[0, 0, 0]} rotation={[Math.PI / 2.5, 0.4, 0]}>
          <torusGeometry args={[0.85, 0.04, 8, 32]} />
          <StdMaterial color={tokens.brand.accentSoft} intensity={0.7} />
        </mesh>
      </Float>
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
      <Float speed={1.0} rotationIntensity={0.6} floatIntensity={0.6}>
        <mesh position={[0, 0, 0]}>
          <icosahedronGeometry args={[0.55, 1]} />
          <StdMaterial intensity={0.9} metalness={0.85} />
        </mesh>
      </Float>
      <Float speed={1.4} rotationIntensity={1.0} floatIntensity={0.4}>
        <mesh position={[0, 0, 0]} rotation={[Math.PI / 2.6, 0.5, 0]}>
          <torusGeometry args={[0.85, 0.025, 8, 48]} />
          <StdMaterial color={tokens.brand.accentSoft} intensity={1.0} />
        </mesh>
      </Float>
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
      <Float speed={1.0} rotationIntensity={0.4} floatIntensity={0.7}>
        <mesh position={[0, 0.1, 0]} rotation={[0, 0, Math.PI]}>
          <coneGeometry args={[0.6, 0.85, 24]} />
          <StdMaterial intensity={0.55} />
        </mesh>
      </Float>
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
      <Float speed={1.0} rotationIntensity={0.4} floatIntensity={0.8}>
        <mesh position={[0, 0, 0]} rotation={[0.3, 0.4, 0]}>
          <boxGeometry args={[0.95, 0.6, 0.05]} />
          <StdMaterial intensity={0.55} />
        </mesh>
      </Float>
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

/* ─── Icon-matching themes (Apr 28 v7) ───────────────────────────── */

/** Phone — handset (curved like an old-school telephone receiver) */
function PhoneScene() {
  return (
    <>
      <Float speed={1.2} rotationIntensity={0.4} floatIntensity={0.8}>
        <group rotation={[0, 0, -0.3]}>
          {/* shaft */}
          <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.16, 0.16, 1.0, 16]} />
            <StdMaterial intensity={0.6} />
          </mesh>
          {/* earpiece */}
          <mesh position={[-0.55, 0.18, 0]}>
            <sphereGeometry args={[0.26, 16, 16]} />
            <StdMaterial color={tokens.brand.accentSoft} intensity={0.7} />
          </mesh>
          {/* mouthpiece */}
          <mesh position={[0.55, 0.18, 0]}>
            <sphereGeometry args={[0.26, 16, 16]} />
            <StdMaterial color={tokens.brand.accentSoft} intensity={0.7} />
          </mesh>
        </group>
      </Float>
      <Float speed={1.7} rotationIntensity={0.2} floatIntensity={1.2}>
        <mesh position={[0.7, -0.55, 0]}>
          <octahedronGeometry args={[0.14, 0]} />
          <StdMaterial intensity={0.9} />
        </mesh>
      </Float>
    </>
  );
}

/** Mic — single microphone capsule, no rings (distinct from VoiceScene). */
function MicScene() {
  return (
    <>
      <Float speed={1.2} rotationIntensity={0.3} floatIntensity={0.8}>
        <group position={[0, 0.1, 0]}>
          <mesh position={[0, 0.4, 0]}>
            <cylinderGeometry args={[0.28, 0.28, 0.7, 18]} />
            <StdMaterial intensity={0.65} />
          </mesh>
          <mesh position={[0, 0.78, 0]}>
            <sphereGeometry args={[0.30, 18, 18]} />
            <StdMaterial color={tokens.brand.accentSoft} intensity={0.8} />
          </mesh>
          {/* base ring */}
          <mesh position={[0, -0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.18, 0.04, 8, 16]} />
            <StdMaterial intensity={0.6} />
          </mesh>
          {/* stand */}
          <mesh position={[0, -0.5, 0]}>
            <cylinderGeometry args={[0.05, 0.20, 0.6, 12]} />
            <StdMaterial intensity={0.5} />
          </mesh>
        </group>
      </Float>
    </>
  );
}

/** Calendar — flat plate with a top bar (binding) */
function CalendarScene() {
  return (
    <>
      <Float speed={1.1} rotationIntensity={0.4} floatIntensity={0.7}>
        <group rotation={[0.2, 0.4, 0]}>
          {/* main page */}
          <mesh position={[0, -0.05, 0]}>
            <boxGeometry args={[1.1, 0.9, 0.06]} />
            <StdMaterial intensity={0.5} />
          </mesh>
          {/* top binding */}
          <mesh position={[0, 0.5, 0.04]}>
            <boxGeometry args={[1.1, 0.18, 0.10]} />
            <StdMaterial color={tokens.brand.accentSoft} intensity={0.7} />
          </mesh>
          {/* date dot */}
          <mesh position={[0, -0.05, 0.05]}>
            <sphereGeometry args={[0.10, 12, 12]} />
            <StdMaterial color={tokens.brand.accentSoft} intensity={1.0} />
          </mesh>
        </group>
      </Float>
    </>
  );
}

/** Mail / Send — paper plane (triangle wedge). */
function MailScene() {
  return (
    <>
      <Float speed={1.4} rotationIntensity={0.4} floatIntensity={0.9}>
        <mesh position={[0, 0, 0]} rotation={[0.4, 0.4, -0.2]}>
          <coneGeometry args={[0.6, 1.0, 4]} />
          <StdMaterial intensity={0.65} />
        </mesh>
      </Float>
      {/* trail dots */}
      <Float speed={2.0} rotationIntensity={0.2} floatIntensity={1.5}>
        <mesh position={[-0.7, -0.45, 0]}>
          <sphereGeometry args={[0.07, 12, 12]} />
          <StdMaterial color={tokens.brand.accentSoft} intensity={1.0} />
        </mesh>
      </Float>
      <Float speed={1.7} rotationIntensity={0.2} floatIntensity={1.3}>
        <mesh position={[-0.5, -0.65, 0]}>
          <sphereGeometry args={[0.05, 12, 12]} />
          <StdMaterial color={tokens.brand.accentSoft} intensity={1.0} />
        </mesh>
      </Float>
    </>
  );
}

/** Search — magnifying glass (circle ring + handle) */
function SearchScene() {
  return (
    <>
      <Float speed={1.0} rotationIntensity={0.3} floatIntensity={0.7}>
        <group rotation={[0, 0, -0.6]}>
          {/* lens ring */}
          <mesh position={[-0.3, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.45, 0.06, 12, 32]} />
            <StdMaterial intensity={0.7} />
          </mesh>
          {/* lens fill */}
          <mesh position={[-0.3, 0.3, 0]}>
            <sphereGeometry args={[0.40, 18, 18]} />
            <StdMaterial color={tokens.brand.accentSoft} intensity={0.5} metalness={0.85} />
          </mesh>
          {/* handle */}
          <mesh position={[0.25, -0.25, 0]} rotation={[0, 0, Math.PI / 4]}>
            <cylinderGeometry args={[0.06, 0.06, 0.7, 12]} />
            <StdMaterial intensity={0.6} />
          </mesh>
        </group>
      </Float>
    </>
  );
}

/** Settings — gear (low-poly torus with cog teeth) */
function SettingsScene() {
  // 8 cog teeth around a torus
  const TEETH = 8;
  return (
    <>
      <Float speed={1.0} rotationIntensity={1.4} floatIntensity={0.5}>
        <group>
          <mesh rotation={[Math.PI / 2.3, 0, 0]}>
            <torusGeometry args={[0.55, 0.18, 8, 24]} />
            <StdMaterial intensity={0.6} />
          </mesh>
          {Array.from({ length: TEETH }).map((_, i) => {
            const a = (i / TEETH) * Math.PI * 2;
            const x = Math.cos(a) * 0.62;
            const y = Math.sin(a) * 0.62;
            return (
              <mesh key={i} position={[x, y, 0]} rotation={[0, 0, a]}>
                <boxGeometry args={[0.20, 0.16, 0.32]} />
                <StdMaterial color={tokens.brand.accentSoft} intensity={0.7} />
              </mesh>
            );
          })}
          {/* center hub */}
          <mesh>
            <sphereGeometry args={[0.16, 16, 16]} />
            <StdMaterial color={tokens.brand.accentDim} intensity={0.5} />
          </mesh>
        </group>
      </Float>
    </>
  );
}

/** Bell — bell shape (half sphere + clapper) */
function BellScene() {
  return (
    <>
      <Float speed={1.0} rotationIntensity={0.5} floatIntensity={0.7}>
        <group>
          {/* bell body */}
          <mesh position={[0, 0.1, 0]}>
            <sphereGeometry args={[0.55, 18, 18, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <StdMaterial intensity={0.6} />
          </mesh>
          {/* rim */}
          <mesh position={[0, 0.10, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.55, 0.04, 8, 24]} />
            <StdMaterial color={tokens.brand.accentSoft} intensity={0.8} />
          </mesh>
          {/* top knob */}
          <mesh position={[0, 0.65, 0]}>
            <sphereGeometry args={[0.10, 12, 12]} />
            <StdMaterial color={tokens.brand.accentSoft} intensity={0.8} />
          </mesh>
          {/* clapper */}
          <mesh position={[0, -0.18, 0]}>
            <sphereGeometry args={[0.08, 12, 12]} />
            <StdMaterial color={tokens.brand.accentSoft} intensity={1.0} />
          </mesh>
        </group>
      </Float>
    </>
  );
}

/** Crown — geometric crown (5 spikes on a band) */
function CrownScene() {
  return (
    <>
      <Float speed={1.0} rotationIntensity={0.4} floatIntensity={0.7}>
        <group rotation={[0.2, 0, 0]}>
          {/* band */}
          <mesh position={[0, -0.15, 0]}>
            <cylinderGeometry args={[0.55, 0.55, 0.18, 24, 1, true]} />
            <StdMaterial intensity={0.6} />
          </mesh>
          {/* 5 spikes */}
          {[-0.5, -0.25, 0, 0.25, 0.5].map((x, i) => {
            const h = i === 2 ? 0.55 : i === 1 || i === 3 ? 0.42 : 0.32;
            return (
              <mesh key={i} position={[x, 0.20 + h / 2, 0]}>
                <coneGeometry args={[0.10, h, 6]} />
                <StdMaterial color={tokens.brand.accentSoft} intensity={0.8} />
              </mesh>
            );
          })}
          {/* gem */}
          <mesh position={[0, 0.45, 0]}>
            <octahedronGeometry args={[0.10, 0]} />
            <StdMaterial color={tokens.brand.accentSoft} intensity={1.2} />
          </mesh>
        </group>
      </Float>
    </>
  );
}

/** Bot / Robot — cube head with antenna */
function BotScene() {
  return (
    <>
      <Float speed={1.2} rotationIntensity={0.4} floatIntensity={0.8}>
        <group>
          {/* head */}
          <mesh position={[0, 0.1, 0]}>
            <boxGeometry args={[0.85, 0.7, 0.65]} />
            <StdMaterial intensity={0.6} />
          </mesh>
          {/* eyes */}
          <mesh position={[-0.20, 0.20, 0.34]}>
            <sphereGeometry args={[0.08, 12, 12]} />
            <StdMaterial color={tokens.brand.accentSoft} intensity={1.5} />
          </mesh>
          <mesh position={[0.20, 0.20, 0.34]}>
            <sphereGeometry args={[0.08, 12, 12]} />
            <StdMaterial color={tokens.brand.accentSoft} intensity={1.5} />
          </mesh>
          {/* antenna */}
          <mesh position={[0, 0.65, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 0.30, 8]} />
            <StdMaterial intensity={0.6} />
          </mesh>
          <mesh position={[0, 0.85, 0]}>
            <sphereGeometry args={[0.07, 12, 12]} />
            <StdMaterial color={tokens.brand.accentSoft} intensity={1.4} />
          </mesh>
        </group>
      </Float>
    </>
  );
}

/** Globe — sphere with longitude/latitude rings */
function GlobeScene() {
  return (
    <>
      <Float speed={1.0} rotationIntensity={0.6} floatIntensity={0.7}>
        <group>
          <mesh>
            <sphereGeometry args={[0.55, 32, 32]} />
            <StdMaterial intensity={0.55} metalness={0.85} />
          </mesh>
          {/* equator */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.56, 0.012, 8, 48]} />
            <StdMaterial color={tokens.brand.accentSoft} intensity={0.9} />
          </mesh>
          {/* meridian */}
          <mesh>
            <torusGeometry args={[0.56, 0.012, 8, 48]} />
            <StdMaterial color={tokens.brand.accentSoft} intensity={0.9} />
          </mesh>
          {/* tilted meridian */}
          <mesh rotation={[0, 0, Math.PI / 4]}>
            <torusGeometry args={[0.56, 0.012, 8, 48]} />
            <StdMaterial color={tokens.brand.accentSoft} intensity={0.7} />
          </mesh>
        </group>
      </Float>
    </>
  );
}

/** Heart — two spheres + a downward triangle */
function HeartScene() {
  return (
    <>
      <Float speed={1.4} rotationIntensity={0.3} floatIntensity={0.9}>
        <group rotation={[0, 0, Math.PI]}>
          {/* point */}
          <mesh position={[0, 0.5, 0]}>
            <coneGeometry args={[0.5, 0.6, 4]} />
            <StdMaterial intensity={0.7} />
          </mesh>
          {/* lobes (bottom in original orientation = top after flip) */}
          <mesh position={[-0.27, -0.0, 0]}>
            <sphereGeometry args={[0.30, 18, 18]} />
            <StdMaterial intensity={0.7} />
          </mesh>
          <mesh position={[0.27, -0.0, 0]}>
            <sphereGeometry args={[0.30, 18, 18]} />
            <StdMaterial intensity={0.7} />
          </mesh>
        </group>
      </Float>
    </>
  );
}

/** Star — flat 5-point star approximation via cone+rotated cones */
function StarScene() {
  const POINTS = 5;
  return (
    <>
      <Float speed={1.3} rotationIntensity={0.6} floatIntensity={0.8}>
        <group>
          {Array.from({ length: POINTS }).map((_, i) => {
            const a = (i / POINTS) * Math.PI * 2;
            return (
              <mesh key={i} rotation={[0, 0, a]}>
                <coneGeometry args={[0.18, 0.85, 4]} />
                <StdMaterial color={tokens.brand.accentSoft} intensity={0.8} />
              </mesh>
            );
          })}
          <mesh>
            <sphereGeometry args={[0.20, 16, 16]} />
            <StdMaterial intensity={0.7} />
          </mesh>
        </group>
      </Float>
    </>
  );
}

/** Key — cylinder shaft + serrated end */
function KeyScene() {
  return (
    <>
      <Float speed={1.1} rotationIntensity={0.5} floatIntensity={0.8}>
        <group rotation={[0, 0, -0.3]}>
          {/* head ring */}
          <mesh position={[-0.55, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.25, 0.07, 12, 24]} />
            <StdMaterial intensity={0.6} />
          </mesh>
          {/* shaft */}
          <mesh position={[0.15, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.07, 0.07, 0.85, 12]} />
            <StdMaterial intensity={0.6} />
          </mesh>
          {/* tooth 1 */}
          <mesh position={[0.45, -0.18, 0]}>
            <boxGeometry args={[0.10, 0.12, 0.10]} />
            <StdMaterial color={tokens.brand.accentSoft} intensity={0.7} />
          </mesh>
          {/* tooth 2 */}
          <mesh position={[0.62, -0.16, 0]}>
            <boxGeometry args={[0.10, 0.10, 0.10]} />
            <StdMaterial color={tokens.brand.accentSoft} intensity={0.7} />
          </mesh>
        </group>
      </Float>
    </>
  );
}

/** Shield — pentagon-ish shape made from a flat box + cone bottom */
function ShieldScene() {
  return (
    <>
      <Float speed={1.0} rotationIntensity={0.3} floatIntensity={0.7}>
        <group>
          {/* upper rounded body */}
          <mesh position={[0, 0.18, 0]}>
            <sphereGeometry args={[0.55, 18, 18, 0, Math.PI * 2, 0, Math.PI / 1.5]} />
            <StdMaterial intensity={0.6} />
          </mesh>
          {/* lower point */}
          <mesh position={[0, -0.32, 0]} rotation={[0, 0, Math.PI]}>
            <coneGeometry args={[0.55, 0.55, 4]} />
            <StdMaterial intensity={0.6} />
          </mesh>
          {/* center emblem */}
          <mesh position={[0, -0.05, 0.1]}>
            <octahedronGeometry args={[0.16, 0]} />
            <StdMaterial color={tokens.brand.accentSoft} intensity={1.2} />
          </mesh>
        </group>
      </Float>
    </>
  );
}

/** Target — concentric rings (bullseye) */
function TargetScene() {
  return (
    <>
      <Float speed={0.9} rotationIntensity={0.6} floatIntensity={0.6}>
        <group rotation={[0.1, 0, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.62, 0.05, 8, 32]} />
            <StdMaterial intensity={0.6} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.42, 0.05, 8, 32]} />
            <StdMaterial color={tokens.brand.accentSoft} intensity={0.7} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.22, 0.05, 8, 32]} />
            <StdMaterial intensity={0.6} />
          </mesh>
          {/* center dart */}
          <mesh>
            <sphereGeometry args={[0.10, 12, 12]} />
            <StdMaterial color={tokens.brand.accentSoft} intensity={1.4} />
          </mesh>
        </group>
      </Float>
    </>
  );
}

/** Briefcase — flat box with a handle on top */
function BriefcaseScene() {
  return (
    <>
      <Float speed={1.0} rotationIntensity={0.3} floatIntensity={0.7}>
        <group rotation={[0.2, 0.3, 0]}>
          {/* body */}
          <mesh>
            <boxGeometry args={[1.1, 0.7, 0.35]} />
            <StdMaterial intensity={0.6} />
          </mesh>
          {/* handle */}
          <mesh position={[0, 0.5, 0]} rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[0.16, 0.04, 8, 18]} />
            <StdMaterial color={tokens.brand.accentSoft} intensity={0.8} />
          </mesh>
          {/* clasp */}
          <mesh position={[0, -0.05, 0.18]}>
            <boxGeometry args={[0.18, 0.10, 0.04]} />
            <StdMaterial color={tokens.brand.accentSoft} intensity={1.0} />
          </mesh>
        </group>
      </Float>
    </>
  );
}

/** Headphones — two spheres connected by a torus arc */
function HeadphonesScene() {
  return (
    <>
      <Float speed={1.1} rotationIntensity={0.3} floatIntensity={0.7}>
        <group>
          {/* arc band */}
          <mesh rotation={[0, 0, 0]}>
            <torusGeometry args={[0.55, 0.06, 12, 32, Math.PI]} />
            <StdMaterial intensity={0.55} />
          </mesh>
          {/* left ear */}
          <mesh position={[-0.55, 0, 0]}>
            <sphereGeometry args={[0.25, 18, 18]} />
            <StdMaterial color={tokens.brand.accentSoft} intensity={0.8} />
          </mesh>
          {/* right ear */}
          <mesh position={[0.55, 0, 0]}>
            <sphereGeometry args={[0.25, 18, 18]} />
            <StdMaterial color={tokens.brand.accentSoft} intensity={0.8} />
          </mesh>
        </group>
      </Float>
    </>
  );
}

function DefaultScene() {
  return (
    <>
      <Float speed={1.2} rotationIntensity={0.5} floatIntensity={0.7}>
        <mesh position={[0, 0, 0]}>
          <icosahedronGeometry args={[0.55, 1]} />
          <StdMaterial intensity={0.7} metalness={0.85} />
        </mesh>
      </Float>
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
  // section hubs
  sales: SalesScene,
  create: CreateScene,
  visual: VisualScene,
  automate: AutomateScene,
  manage: ManageScene,
  connect: ConnectScene,
  // domain themes
  ai: AiScene,
  voice: VoiceScene,
  analytics: AnalyticsScene,
  leads: LeadsScene,
  inbox: InboxScene,
  // sidebar-icon-matched themes (Apr 28 v7)
  phone: PhoneScene,
  mic: MicScene,
  calendar: CalendarScene,
  mail: MailScene,
  search: SearchScene,
  settings: SettingsScene,
  bell: BellScene,
  crown: CrownScene,
  bot: BotScene,
  globe: GlobeScene,
  heart: HeartScene,
  star: StarScene,
  key: KeyScene,
  shield: ShieldScene,
  target: TargetScene,
  briefcase: BriefcaseScene,
  headphones: HeadphonesScene,
  // fallback
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
