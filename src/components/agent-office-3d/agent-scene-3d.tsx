"use client";

/**
 * AgentScene3D — React Three Fiber upgrade for /dashboard/agent-office.
 *
 * Full isometric 3D scene showing the 10 ShortStack OS AI agents at their
 * workstations, driven by the same Supabase `recent` map as KumoScene.
 *
 * Layout:  horseshoe of 10 pods around a central Stack3D orb.
 * Rendering: R3F + Drei. No extra packages needed beyond what's already
 *   installed (@react-three/fiber, @react-three/drei, three).
 *
 * Features:
 *  - Unique 3D geometry per agent (sphere/torus/octahedron/etc)
 *  - Per-agent desk + monitor + emissive point light
 *  - Sparkle particle burst when agent is actively working
 *  - Data-stream arcs between working agents → center orb
 *  - Floating holographic billboard with agent name + current task
 *  - OLED dark reflective floor with glowing grid seams
 *  - Central rotating Stack3D brand mark (3 stacked boxes)
 *  - Slow auto-rotate camera; click to focus an agent
 *  - Smoothly interpolates agent glow when state changes
 */

import { Suspense, useRef, useMemo, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Text,
  Float,
  Sparkles,
  Html,
  Billboard,
  Grid,
  PerspectiveCamera,
  Cylinder,
  Box,
  Sphere,
  Octahedron,
  Torus,
  TorusKnot,
  Dodecahedron,
  Icosahedron,
  Tetrahedron,
  Ring,
} from "@react-three/drei";
import * as THREE from "three";
import { AGENTS } from "@/lib/pixel-office/agents";

// ─── Layout ──────────────────────────────────────────────────────────────────

const WORK_ACTIVE_MS = 60_000;
const RECENT_PULSE_MS = 6_000;

/** Horseshoe positions — top arc + two trailing sides. */
const AGENT_POSITIONS: Record<string, [number, number, number]> = {
  echo:   [-6.5,  0, -3.5],
  lyra:   [-3.5,  0, -6],
  sage:   [0,     0, -7.5],
  reef:   [3.5,   0, -6],
  onyx:   [6.5,   0, -3.5],
  nova:   [8.5,   0, 0],
  casper: [6.5,   0, 4],
  pixel:  [3,     0, 6.5],
  maven:  [-1,    0, 7.5],
  aria:   [-5,    0, 5.5],
};

/** Hex accent per agent, matching agents.ts brandColor. */
const AGENT_HEX: Record<string, string> = {
  echo:   "#5E5BFF",
  lyra:   "#6366F1",
  sage:   "#7FE5B8",
  reef:   "#3EDDC7",
  onyx:   "#FF8A4C",
  nova:   "#E8FF66",
  casper: "#FFC062",
  pixel:  "#7C5CFF",
  maven:  "#F26063",
  aria:   "#A78BFA",
};

/** Short task label shown on the monitor when working. */
const AGENT_TASKS: Record<string, string> = {
  echo:   "Calling 14 leads",
  lyra:   "Coaching analysis",
  sage:   "Scoring 847 contacts",
  reef:   "Validating outreach",
  onyx:   "Sending sequences",
  nova:   "Monitoring news",
  casper: "Scheduling posts",
  pixel:  "Gen thumbnails",
  maven:  "Optimising ads",
  aria:   "Orchestrating",
};

/** Page shown on the agent's monitor when active (miniature dashboard mockup). */
const AGENT_PAGE: Record<string, string> = {
  echo:   "/crm",
  lyra:   "/analytics",
  sage:   "/crm",
  reef:   "/outreach",
  onyx:   "/email",
  nova:   "/news",
  casper: "/calendar",
  pixel:  "/thumbnails",
  maven:  "/ads",
  aria:   "/dashboard",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToColor(hex: string): THREE.Color {
  return new THREE.Color(hex);
}

function isWorking(recent: Record<string, number>, key: string): boolean {
  const ts = recent[key] ?? 0;
  return ts > 0 && Date.now() - ts < WORK_ACTIVE_MS;
}

function isPulsing(recent: Record<string, number>, key: string): boolean {
  const ts = recent[key] ?? 0;
  return ts > 0 && Date.now() - ts < RECENT_PULSE_MS;
}

// ─── Floor ────────────────────────────────────────────────────────────────────

function OledFloor() {
  return (
    <>
      {/* Dark base plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial
          color="#070708"
          roughness={0.9}
          metalness={0.1}
        />
      </mesh>
      {/* Subtle grid */}
      <Grid
        position={[0, 0, 0]}
        args={[60, 60]}
        cellSize={2}
        cellThickness={0.3}
        cellColor="#6366F130"
        sectionSize={10}
        sectionThickness={0.6}
        sectionColor="#6366F160"
        fadeDistance={45}
        fadeStrength={1}
        infiniteGrid
      />
      {/* Central glow disk */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[8, 64]} />
        <meshStandardMaterial
          color="#6366F1"
          emissive="#6366F1"
          emissiveIntensity={0.06}
          transparent
          opacity={0.15}
        />
      </mesh>
    </>
  );
}

// ─── Central Stack3D Mark ─────────────────────────────────────────────────────

function CentralStack3D() {
  const groupRef = useRef<THREE.Group>(null!);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = clock.getElapsedTime() * 0.25;
    groupRef.current.position.y = 1.2 + Math.sin(clock.getElapsedTime() * 0.6) * 0.15;
  });

  const slabs = [
    { y: 0,    rotation: 0.3 },
    { y: 0.55, rotation: 0 },
    { y: 1.1,  rotation: -0.3 },
  ] as const;

  return (
    <group ref={groupRef} position={[0, 1.2, 0]}>
      {slabs.map((s, i) => (
        <mesh key={i} position={[0, s.y, 0]} rotation={[0, s.rotation, 0.06]}>
          <boxGeometry args={[2.2, 0.35, 1.1]} />
          <meshStandardMaterial
            color="#6366F1"
            emissive="#6366F1"
            emissiveIntensity={0.6 + i * 0.2}
            roughness={0.1}
            metalness={0.8}
          />
        </mesh>
      ))}
      {/* Rim glow beneath the stack */}
      <mesh position={[0, -0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.2, 2.2, 48]} />
        <meshStandardMaterial
          color="#6366F1"
          emissive="#6366F1"
          emissiveIntensity={1}
          transparent
          opacity={0.35}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Point light at the stack */}
      <pointLight color="#6366F1" intensity={4} distance={18} decay={2} />
      {/* Floating "TRINITY" label */}
      <Billboard position={[0, 2.4, 0]}>
        <Text
          fontSize={0.3}
          color="#A78BFA"
          font="/fonts/Inter-Bold.woff"
          anchorX="center"
          anchorY="middle"
          letterSpacing={0.15}
        >
          TRINITY OS
        </Text>
      </Billboard>
    </group>
  );
}

// ─── Agent Avatar Geometry ─────────────────────────────────────────────────────

/** Each agent gets a distinct 3D shape that matches their personality. */
function AgentAvatar({
  agentKey,
  color,
  working,
  pulsing,
}: {
  agentKey: string;
  color: THREE.Color;
  working: boolean;
  pulsing: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const emissiveIntensity = useRef(0);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    meshRef.current.rotation.y = t * 0.6;
    meshRef.current.rotation.x = Math.sin(t * 0.4) * 0.2;
    // Smoothly ramp emissive
    const target = working ? 0.9 : pulsing ? 0.5 : 0.2;
    emissiveIntensity.current = THREE.MathUtils.lerp(emissiveIntensity.current, target, 0.05);
    (meshRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = emissiveIntensity.current;
  });

  const mat = (
    <meshStandardMaterial
      color={color}
      emissive={color}
      emissiveIntensity={0.2}
      roughness={0.15}
      metalness={0.75}
    />
  );

  const shapes: Record<string, React.ReactNode> = {
    echo:   <mesh ref={meshRef} castShadow><sphereGeometry args={[0.38, 32, 32]} />{mat}</mesh>,
    lyra:   <mesh ref={meshRef} castShadow><torusGeometry args={[0.32, 0.12, 16, 48]} />{mat}</mesh>,
    sage:   <mesh ref={meshRef} castShadow><octahedronGeometry args={[0.42]} />{mat}</mesh>,
    reef:   <mesh ref={meshRef} castShadow><cylinderGeometry args={[0.3, 0.3, 0.6, 32]} />{mat}</mesh>,
    onyx:   <mesh ref={meshRef} castShadow><boxGeometry args={[0.6, 0.45, 0.45]} />{mat}</mesh>,
    nova:   <mesh ref={meshRef} castShadow><tetrahedronGeometry args={[0.46]} />{mat}</mesh>,
    casper: <mesh ref={meshRef} castShadow><icosahedronGeometry args={[0.38, 1]} />{mat}</mesh>,
    pixel:  <mesh ref={meshRef} castShadow><dodecahedronGeometry args={[0.4]} />{mat}</mesh>,
    maven:  <mesh ref={meshRef} castShadow><torusKnotGeometry args={[0.26, 0.09, 80, 12]} />{mat}</mesh>,
    aria:   <mesh ref={meshRef} castShadow><icosahedronGeometry args={[0.42, 2]} />{mat}</mesh>,
  };

  return (
    <Float speed={2} rotationIntensity={0.3} floatIntensity={0.4}>
      {shapes[agentKey] ?? <mesh ref={meshRef} castShadow><sphereGeometry args={[0.35]} />{mat}</mesh>}
    </Float>
  );
}

// ─── Monitor Screen ───────────────────────────────────────────────────────────

/** Thin 3D monitor showing a mini dashboard mockup. */
function AgentMonitor({
  agentKey,
  color,
  working,
}: {
  agentKey: string;
  color: THREE.Color;
  working: boolean;
}) {
  const screenRef = useRef<THREE.Mesh>(null!);
  const task = AGENT_TASKS[agentKey] ?? "Idle";
  const page = AGENT_PAGE[agentKey] ?? "/dashboard";
  const emissive = useRef(0);

  useFrame(() => {
    if (!screenRef.current) return;
    const target = working ? 0.7 : 0.15;
    emissive.current = THREE.MathUtils.lerp(emissive.current, target, 0.05);
    (screenRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = emissive.current;
  });

  return (
    <group position={[0, 0.75, 0.02]}>
      {/* Monitor bezel */}
      <mesh castShadow>
        <boxGeometry args={[1.1, 0.72, 0.06]} />
        <meshStandardMaterial color="#101012" roughness={0.8} metalness={0.3} />
      </mesh>
      {/* Screen surface */}
      <mesh ref={screenRef} position={[0, 0, 0.04]}>
        <planeGeometry args={[0.95, 0.58]} />
        <meshStandardMaterial
          color={working ? "#0d0d1a" : "#070708"}
          emissive={color}
          emissiveIntensity={0.15}
          roughness={1}
          metalness={0}
        />
      </mesh>
      {/* Mini dashboard HTML overlay on monitor */}
      {working && (
        <Html
          position={[0, 0, 0.08]}
          center
          transform
          occlude
          style={{ width: 130, pointerEvents: "none" }}
        >
          <div
            style={{
              background: "#0d0d1a",
              border: `1px solid ${AGENT_HEX[agentKey]}40`,
              borderRadius: 4,
              padding: "4px 6px",
              fontFamily: "Inter, sans-serif",
              width: 130,
            }}
          >
            {/* Fake browser bar */}
            <div style={{ display: "flex", alignItems: "center", gap: 3, marginBottom: 4 }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#F26063" }} />
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#FFC062" }} />
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#7FE5B8" }} />
              <div
                style={{
                  flex: 1,
                  background: "#1a1a2e",
                  borderRadius: 2,
                  padding: "1px 4px",
                  fontSize: 6,
                  color: "#6366F1",
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                }}
              >
                shortstack.work{page}
              </div>
            </div>
            {/* Mini dashboard content */}
            <MiniDashboardContent agentKey={agentKey} color={AGENT_HEX[agentKey]} task={task} />
          </div>
        </Html>
      )}
      {/* Idle screen — just a pulsing brand indicator */}
      {!working && (
        <Html position={[0, 0, 0.08]} center transform occlude style={{ pointerEvents: "none" }}>
          <div
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 8,
              color: `${AGENT_HEX[agentKey]}80`,
              textAlign: "center",
              letterSpacing: "0.12em",
              fontWeight: 700,
            }}
          >
            IDLE
          </div>
        </Html>
      )}
      {/* Monitor stand */}
      <mesh position={[0, -0.44, -0.04]}>
        <cylinderGeometry args={[0.04, 0.08, 0.14, 12]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.6} metalness={0.5} />
      </mesh>
      <mesh position={[0, -0.52, -0.04]}>
        <boxGeometry args={[0.38, 0.04, 0.18]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.6} metalness={0.5} />
      </mesh>
    </group>
  );
}

/** Tiny mockup of the relevant dashboard page — rendered as HTML inside the monitor. */
function MiniDashboardContent({
  agentKey,
  color,
  task,
}: {
  agentKey: string;
  color: string;
  task: string;
}) {
  // Shared bar-chart style bars
  const bars = [0.4, 0.7, 0.55, 0.85, 0.65, 0.9, 0.75];

  if (agentKey === "sage" || agentKey === "lyra") {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 30, marginBottom: 3 }}>
          {bars.map((h, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: `${h * 100}%`,
                background: color,
                borderRadius: "1px 1px 0 0",
                opacity: 0.7 + i * 0.04,
              }}
            />
          ))}
        </div>
        <div style={{ fontSize: 6, color, fontWeight: 700 }}>{task}</div>
      </div>
    );
  }

  if (agentKey === "maven") {
    // Sparkline
    const pts = [2, 10, 6, 18, 12, 22, 16, 28].map((v, i) => `${i * 14},${30 - v}`).join(" ");
    return (
      <div>
        <svg width={110} height={32}>
          <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} />
        </svg>
        <div style={{ fontSize: 6, color, fontWeight: 700, marginTop: 2 }}>{task}</div>
      </div>
    );
  }

  if (agentKey === "echo" || agentKey === "reef") {
    // List rows
    return (
      <div>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 3, marginBottom: 2 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: color, opacity: 0.8 }} />
            <div style={{ height: 3, flex: 1, background: "#ffffff20", borderRadius: 1 }} />
          </div>
        ))}
        <div style={{ fontSize: 6, color, fontWeight: 700 }}>{task}</div>
      </div>
    );
  }

  if (agentKey === "casper") {
    // Calendar grid
    return (
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, marginBottom: 3 }}>
          {Array.from({ length: 28 }).map((_, i) => (
            <div
              key={i}
              style={{
                height: 6,
                background: i % 4 === 1 ? color : "#ffffff15",
                borderRadius: 1,
                opacity: i % 4 === 1 ? 0.9 : 0.5,
              }}
            />
          ))}
        </div>
        <div style={{ fontSize: 6, color, fontWeight: 700 }}>{task}</div>
      </div>
    );
  }

  // Default: title + metric
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        {[70, 45, 60].map((w, i) => (
          <div key={i} style={{ height: 16, width: w, background: "#ffffff10", borderRadius: 2 }} />
        ))}
      </div>
      <div style={{ height: 3, background: "#ffffff10", borderRadius: 1, marginBottom: 2 }}>
        <div style={{ height: "100%", width: "68%", background: color, borderRadius: 1 }} />
      </div>
      <div style={{ fontSize: 6, color, fontWeight: 700, marginTop: 3 }}>{task}</div>
    </div>
  );
}

// ─── Desk Platform ────────────────────────────────────────────────────────────

function AgentDesk({ color, working }: { color: THREE.Color; working: boolean }) {
  const emissive = useRef(0);
  const meshRef = useRef<THREE.Mesh>(null!);

  useFrame(() => {
    if (!meshRef.current) return;
    const target = working ? 0.18 : 0.04;
    emissive.current = THREE.MathUtils.lerp(emissive.current, target, 0.04);
    (meshRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = emissive.current;
  });

  return (
    <group>
      {/* Desk top */}
      <mesh ref={meshRef} position={[0, 0.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.4, 0.08, 0.9]} />
        <meshStandardMaterial
          color="#17171A"
          emissive={color}
          emissiveIntensity={0.04}
          roughness={0.4}
          metalness={0.6}
        />
      </mesh>
      {/* Desk side supports */}
      {[-0.6, 0.6].map((x) => (
        <mesh key={x} position={[x, 0.14, 0]} castShadow>
          <boxGeometry args={[0.06, 0.3, 0.82]} />
          <meshStandardMaterial color="#101012" roughness={0.8} metalness={0.4} />
        </mesh>
      ))}
      {/* Glowing edge strip */}
      <mesh position={[0, 0.345, 0.45]}>
        <boxGeometry args={[1.38, 0.02, 0.01]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={working ? 1.2 : 0.3}
          roughness={0}
          metalness={1}
        />
      </mesh>
    </group>
  );
}

// ─── Full Agent Pod ───────────────────────────────────────────────────────────

function AgentPod({
  agent,
  recent,
  hovered,
  onHover,
  onClick,
}: {
  agent: (typeof AGENTS)[number];
  recent: Record<string, number>;
  hovered: boolean;
  onHover: (key: string | null) => void;
  onClick: (key: string) => void;
}) {
  const pos = AGENT_POSITIONS[agent.key] ?? [0, 0, 0];
  const color = hexToColor(AGENT_HEX[agent.key] ?? "#6366F1");
  const working = isWorking(recent, agent.key);
  const pulsing = isPulsing(recent, agent.key);
  const task = AGENT_TASKS[agent.key] ?? "Idle";
  const groupRef = useRef<THREE.Group>(null!);

  // Facing inward toward origin
  const facing = Math.atan2(-pos[0], -pos[2]);

  useFrame(() => {
    if (!groupRef.current) return;
    // Subtle scale-up when hovered
    const targetScale = hovered ? 1.04 : 1;
    groupRef.current.scale.setScalar(
      THREE.MathUtils.lerp(groupRef.current.scale.x, targetScale, 0.1)
    );
  });

  return (
    <group
      ref={groupRef}
      position={pos}
      rotation={[0, facing, 0]}
      onClick={() => onClick(agent.key)}
      onPointerEnter={() => onHover(agent.key)}
      onPointerLeave={() => onHover(null)}
    >
      {/* Desk */}
      <AgentDesk color={color} working={working} />

      {/* Monitor — sits on desk top */}
      <group position={[0, 0.34, -0.1]}>
        <AgentMonitor agentKey={agent.key} color={color} working={working} />
      </group>

      {/* Avatar — floats above the monitor when working */}
      <group position={[0, working ? 2.1 : 1.8, 0]}>
        <AgentAvatar agentKey={agent.key} color={color} working={working} pulsing={pulsing} />
      </group>

      {/* Glow light under avatar */}
      <pointLight
        color={color}
        intensity={working ? 3 : 0.4}
        distance={8}
        decay={2}
        position={[0, 1.6, 0]}
      />

      {/* Sparkles when pulsing */}
      {pulsing && (
        <Sparkles
          count={24}
          scale={[1.8, 2.4, 1.8]}
          position={[0, 1.6, 0]}
          size={1.5}
          speed={0.5}
          color={AGENT_HEX[agent.key]}
          opacity={0.85}
        />
      )}

      {/* Floating label on hover */}
      {hovered && (
        <Billboard position={[0, 3.4, 0]}>
          <Html center transform occlude style={{ pointerEvents: "none" }}>
            <div
              style={{
                background: "#17171Af0",
                border: `1px solid ${AGENT_HEX[agent.key]}60`,
                borderRadius: 8,
                padding: "8px 12px",
                fontFamily: "Inter, sans-serif",
                minWidth: 180,
                backdropFilter: "blur(8px)",
              }}
            >
              <div style={{ color: "#F5F4F1", fontWeight: 700, fontSize: 13, marginBottom: 2 }}>
                {agent.name}
              </div>
              <div style={{ color: "#9F9DAA", fontSize: 11, marginBottom: 6 }}>
                {agent.role}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 10,
                  color: AGENT_HEX[agent.key],
                  fontWeight: 600,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: AGENT_HEX[agent.key],
                    display: "inline-block",
                    boxShadow: working ? `0 0 8px ${AGENT_HEX[agent.key]}` : "none",
                  }}
                />
                {working ? task : "Idle"}
              </div>
            </div>
          </Html>
        </Billboard>
      )}

      {/* Floor glow ring under each pod */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <ringGeometry args={[0.8, 1.4, 48]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={working ? 0.35 : 0.08}
          transparent
          opacity={working ? 0.4 : 0.12}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

// ─── Data Stream Arcs (active agents → center) ────────────────────────────────

function DataStreams({ recent }: { recent: Record<string, number> }) {
  const streamsRef = useRef<THREE.Group>(null!);
  const t = useRef(0);

  // Build tube curves from each active agent to center
  const curves = useMemo(() => {
    return AGENTS.filter((a) => isWorking(recent, a.key)).map((a) => {
      const pos = AGENT_POSITIONS[a.key] ?? [0, 0, 0];
      const start = new THREE.Vector3(pos[0], 1.6, pos[2]);
      const end = new THREE.Vector3(0, 1.4, 0);
      const mid = start.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 2.5, 0));
      return {
        key: a.key,
        curve: new THREE.QuadraticBezierCurve3(start, mid, end),
        color: AGENT_HEX[a.key],
      };
    });
  }, [recent]);

  useFrame(({ clock }) => {
    t.current = clock.getElapsedTime();
  });

  if (curves.length === 0) return null;

  return (
    <group ref={streamsRef}>
      {curves.map(({ key, curve, color }) => {
        const points = curve.getPoints(40);
        const geom = new THREE.BufferGeometry().setFromPoints(points);
        // Cast to any to avoid TS confusing R3F <line> with SVG <line>.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const LineR3F = "line" as any;
        return (
          <LineR3F key={key} geometry={geom}>
            <lineBasicMaterial
              color={color}
              transparent
              opacity={0.45}
              linewidth={1}
            />
          </LineR3F>
        );
      })}
    </group>
  );
}

// ─── Camera rig ───────────────────────────────────────────────────────────────

function CameraRig({ focused }: { focused: string | null }) {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3(0, 0, 0));

  useFrame(() => {
    if (focused) {
      const pos = AGENT_POSITIONS[focused];
      if (pos) {
        target.current.lerp(new THREE.Vector3(pos[0] * 0.4, 0, pos[2] * 0.4), 0.04);
      }
    } else {
      target.current.lerp(new THREE.Vector3(0, 0, 0), 0.02);
    }
  });

  return null;
}

// ─── Ambient Particles ────────────────────────────────────────────────────────

function AmbientParticles() {
  return (
    <Sparkles
      count={120}
      scale={[28, 12, 28]}
      position={[0, 3, 0]}
      size={0.6}
      speed={0.1}
      color="#6366F1"
      opacity={0.2}
    />
  );
}

// ─── Pillar lights (room atmosphere) ─────────────────────────────────────────

function RoomLights() {
  return (
    <>
      {/* Overhead key light */}
      <directionalLight
        position={[5, 20, 10]}
        intensity={0.8}
        color="#F5F4F1"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={0.5}
        shadow-camera-far={50}
        shadow-camera-left={-25}
        shadow-camera-right={25}
        shadow-camera-top={25}
        shadow-camera-bottom={-25}
      />
      {/* Ambient */}
      <ambientLight intensity={0.15} color="#101028" />
      {/* Fill rim from below */}
      <pointLight position={[0, -1, 0]} color="#6366F1" intensity={0.8} distance={20} decay={2} />
      {/* Corner fills */}
      <pointLight position={[-20, 8, -20]} color="#A78BFA" intensity={0.5} distance={30} />
      <pointLight position={[20, 8, 20]} color="#7FE5B8" intensity={0.3} distance={30} />
    </>
  );
}

// ─── Scene root ───────────────────────────────────────────────────────────────

function Scene3DRoot({
  recent,
  hovered,
  setHovered,
  onAgentClick,
}: {
  recent: Record<string, number>;
  hovered: string | null;
  setHovered: (k: string | null) => void;
  onAgentClick?: (k: string) => void;
}) {
  return (
    <>
      <fog attach="fog" args={["#070708", 30, 55]} />

      <RoomLights />
      <OledFloor />
      <CentralStack3D />
      <AmbientParticles />
      <DataStreams recent={recent} />
      <CameraRig focused={hovered} />

      {AGENTS.map((agent) => (
        <AgentPod
          key={agent.key}
          agent={agent}
          recent={recent}
          hovered={hovered === agent.key}
          onHover={setHovered}
          onClick={(k) => onAgentClick?.(k)}
        />
      ))}

      <OrbitControls
        enableZoom
        enablePan={false}
        maxPolarAngle={Math.PI / 2.1}
        minPolarAngle={Math.PI / 5}
        autoRotate
        autoRotateSpeed={0.35}
        minDistance={12}
        maxDistance={35}
        target={[0, 0.5, 0]}
        makeDefault
      />
    </>
  );
}

// ─── Exported component ───────────────────────────────────────────────────────

export interface AgentScene3DProps {
  recent: Record<string, number>;
  hovered: string | null;
  setHovered: (k: string | null) => void;
  onAgentClick?: (k: string) => void;
  className?: string;
}

export default function AgentScene3D({
  recent,
  hovered,
  setHovered,
  onAgentClick,
  className,
}: AgentScene3DProps) {
  return (
    <div
      className={`relative overflow-hidden  border border-white/8 bg-[#070708] ${className ?? ""}`}
      style={{ aspectRatio: "16 / 9" }}
    >
      <Canvas
        shadows
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: false }}
        style={{ width: "100%", height: "100%" }}
      >
        <PerspectiveCamera
          makeDefault
          position={[0, 18, 22]}
          fov={42}
          near={0.1}
          far={100}
        />
        <Suspense fallback={null}>
          <Scene3DRoot
            recent={recent}
            hovered={hovered}
            setHovered={setHovered}
            onAgentClick={onAgentClick}
          />
        </Suspense>
      </Canvas>

      {/* Controls hint */}
      <div className="pointer-events-none absolute bottom-3 right-3 text-[10px] text-white/25 font-medium tracking-wide select-none">
        drag to orbit · scroll to zoom · click agent to inspect
      </div>

      {/* Live indicator */}
      <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#7FE5B8]/80" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#7FE5B8]" />
        </span>
        <span className="text-[10px] font-bold tracking-widest text-[#7FE5B8] uppercase">Live 3D</span>
      </div>
    </div>
  );
}
