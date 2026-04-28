"use client";

/**
 * KumoScene — Apr 28 v12 hyper-realistic office.
 *
 * Goal: Kumospace-style modern office (top-down with slight perspective).
 * Multi-zone open-plan layout with desks, lounge, meeting area, kitchen
 * corner, plants, sun rays through windows. Smooth flat-3D illustration
 * style — no pixel art, no 8-bit aesthetics.
 *
 * Used in two places:
 *   1. Dashboard tile  — `<KumoScene variant="tile" />` (compact, ~360px tall)
 *   2. Full page       — `<KumoScene variant="full" />` (~600px tall, with
 *                          larger interactive zones)
 *
 * Each agent gets a smooth circular avatar scattered across the zones
 * (NOT lined up at desks — Kumospace puts people in lounges, meeting
 * rooms, kitchens). Agents whose watched-table fired in the last 6s
 * get double pulse rings.
 *
 * Click-to-focus + hover tooltip + ambient activity rings preserved.
 */

import { useMemo } from "react";
import { AGENTS, type PixelAgent } from "@/lib/pixel-office/agents";
import Link from "next/link";

interface AgentSeat {
  agent: PixelAgent;
  /** Screen-space pixel position relative to the SVG viewBox. */
  x: number;
  y: number;
  /** Zone label rendered in the tooltip. */
  zone: string;
  isPulsing: boolean;
}

export interface KumoSceneProps {
  variant?: "tile" | "full";
  /** Map of agent_key → last-event timestamp (ms). */
  recent: Record<string, number>;
  hovered: string | null;
  setHovered: (key: string | null) => void;
  /** Optional click handler — defaults to navigating to focus that agent. */
  onAgentClick?: (key: string) => void;
}

const RECENT_PULSE_MS = 6_000;

function hexFromInt(c: number): string {
  return `#${c.toString(16).padStart(6, "0")}`;
}

/** Scatter the 10 agents across the office's distinct zones so the
 *  scene reads as a real working space, not 10 desks in a row. */
function buildSeats(roster: readonly PixelAgent[], recent: Record<string, number>, vbW: number, vbH: number): AgentSeat[] {
  const now = Date.now();

  // Hand-tuned positions per zone. Calibrated against the 1200x600
  // viewBox so they scale linearly when the SVG resizes.
  const positions: Array<{ x: number; y: number; zone: string }> = [
    // Workstation zone (top half) — 4 desks
    { x: 240, y: 230, zone: "Desk · Workstation A" },
    { x: 480, y: 230, zone: "Desk · Workstation B" },
    { x: 720, y: 230, zone: "Desk · Workstation C" },
    { x: 960, y: 230, zone: "Desk · Workstation D" },
    // Lounge zone (bottom-left)
    { x: 200, y: 460, zone: "Lounge · Couch" },
    { x: 320, y: 480, zone: "Lounge · Armchair" },
    // Meeting zone (bottom-center)
    { x: 600, y: 470, zone: "Meeting · Round table" },
    { x: 540, y: 510, zone: "Meeting · Whiteboard" },
    // Kitchen / cafe zone (bottom-right)
    { x: 920, y: 460, zone: "Kitchen · Counter" },
    { x: 1020, y: 490, zone: "Kitchen · Espresso bar" },
  ];

  return roster.slice(0, positions.length).map((agent, i) => {
    const pos = positions[i];
    // Scale to viewBox
    const x = (pos.x / 1200) * vbW;
    const y = (pos.y / 600) * vbH;
    const isPulsing = !!recent[agent.key] && now - recent[agent.key] < RECENT_PULSE_MS;
    return { agent, x, y, zone: pos.zone, isPulsing };
  });
}

/* ─── Furniture sub-components ────────────────────────────────────── */

/** A 3-face isometric desk with monitor + lamp. */
function Desk({ cx, cy, glowing, glowColor }: { cx: number; cy: number; glowing: boolean; glowColor: string }) {
  const w = 80, h = 36, z = 16;
  return (
    <g transform={`translate(${cx}, ${cy})`}>
      <ellipse cx={0} cy={h + 4} rx={w * 0.55} ry={h * 0.30} fill="rgba(0,0,0,0.32)" filter="url(#blur-soft)" />
      {/* Front face */}
      <path d={`M ${-w / 2} 0 L ${w / 2} 0 L ${w / 2} ${z} L ${-w / 2} ${z} Z`} fill="url(#desk-front-grad)" />
      {/* Right side */}
      <path d={`M ${w / 2} 0 L ${w / 2 + h * 0.30} ${-h * 0.45} L ${w / 2 + h * 0.30} ${z - h * 0.45} L ${w / 2} ${z} Z`} fill="url(#desk-side-grad)" />
      {/* Top face */}
      <path d={`M ${-w / 2} 0 L ${w / 2} 0 L ${w / 2 + h * 0.30} ${-h * 0.45} L ${-w / 2 + h * 0.30} ${-h * 0.45} Z`} fill="url(#desk-top-grad)" />

      {/* Monitor */}
      <g transform={`translate(${4}, ${-h * 0.45 - 4})`}>
        <rect x={-2} y={-2} width={4} height={6} fill="#1F2937" />
        <ellipse cx={0} cy={4} rx={6} ry={1.5} fill="rgba(0,0,0,0.4)" />
        <rect x={-18} y={-26} width={36} height={24} rx={2} fill="#0A0A0B" />
        <rect x={-16.5} y={-24.5} width={33} height={21} rx={1} fill={glowing ? glowColor : "#1F2937"} opacity={glowing ? 0.85 : 1} />
        {/* code lines */}
        <rect x={-13} y={-21} width={18} height={1.2} fill="rgba(255,255,255,0.40)" />
        <rect x={-13} y={-17.5} width={26} height={1.2} fill="rgba(255,255,255,0.30)" />
        <rect x={-13} y={-14} width={14} height={1.2} fill="rgba(255,255,255,0.30)" />
        <rect x={-13} y={-10.5} width={20} height={1.2} fill="rgba(255,255,255,0.25)" />
        {glowing && (
          <ellipse cx={0} cy={-13} rx={28} ry={10} fill={glowColor} opacity={0.30} filter="url(#blur-soft)" />
        )}
      </g>

      {/* Coffee mug */}
      <g transform={`translate(${22}, ${-h * 0.45 + 2})`}>
        <ellipse cx={0} cy={0} rx={3} ry={1} fill="rgba(0,0,0,0.35)" />
        <rect x={-2.5} y={-4} width={5} height={4} rx={0.5} fill="#0F766E" />
        <ellipse cx={0} cy={-4} rx={2.5} ry={0.7} fill="#0A0A0B" />
        <path d="M -1 -7 Q 0 -8 1 -7 Q 0 -6 -1 -7" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={0.4} />
      </g>

      {/* Stack of papers */}
      <g transform={`translate(${-22}, ${-h * 0.45 + 4})`}>
        <rect x={-5} y={-2} width={10} height={2} fill="#FAFAFA" />
        <rect x={-5} y={-4} width={10} height={2} fill="#FAFAFA" opacity={0.85} />
      </g>

      {/* Chair behind */}
      <g transform={`translate(0, ${-12})`}>
        <ellipse cx={0} cy={h * 0.55} rx={11} ry={5} fill="rgba(0,0,0,0.35)" />
        <path d={`M -10 -2 L 10 -2 L 11 ${h * 0.45} L -11 ${h * 0.45} Z`} fill="url(#chair-grad)" />
        <path d={`M -11 -14 L 11 -14 L 10 -2 L -10 -2 Z`} fill="url(#chair-back-grad)" />
      </g>
    </g>
  );
}

/** Modern couch — 3 seater with cushions. */
function Couch({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g transform={`translate(${cx}, ${cy})`}>
      <ellipse cx={0} cy={28} rx={70} ry={10} fill="rgba(0,0,0,0.35)" filter="url(#blur-soft)" />
      {/* Body */}
      <rect x={-65} y={-5} width={130} height={32} rx={6} fill="url(#couch-grad)" />
      {/* Cushions (3) */}
      <rect x={-58} y={-8} width={36} height={20} rx={4} fill="url(#couch-cushion-grad)" />
      <rect x={-18} y={-8} width={36} height={20} rx={4} fill="url(#couch-cushion-grad)" />
      <rect x={22} y={-8} width={36} height={20} rx={4} fill="url(#couch-cushion-grad)" />
      {/* Back rest */}
      <rect x={-65} y={-25} width={130} height={20} rx={4} fill="url(#couch-back-grad)" />
      {/* Armrests */}
      <rect x={-72} y={-15} width={9} height={42} rx={3} fill="url(#couch-arm-grad)" />
      <rect x={63} y={-15} width={9} height={42} rx={3} fill="url(#couch-arm-grad)" />
    </g>
  );
}

/** Round meeting table with chairs around it. */
function MeetingTable({ cx, cy }: { cx: number; cy: number }) {
  const r = 50;
  return (
    <g transform={`translate(${cx}, ${cy})`}>
      <ellipse cx={0} cy={r * 0.5 + 6} rx={r + 12} ry={r * 0.35} fill="rgba(0,0,0,0.32)" filter="url(#blur-soft)" />
      {/* Chairs around the table */}
      {Array.from({ length: 6 }).map((_, i) => {
        const angle = (i / 6) * Math.PI * 2;
        const cx2 = Math.cos(angle) * (r + 16);
        const cy2 = Math.sin(angle) * (r * 0.5 + 8);
        return (
          <g key={i} transform={`translate(${cx2}, ${cy2})`}>
            <ellipse cx={0} cy={2} rx={9} ry={5} fill="url(#chair-grad)" />
            <ellipse cx={0} cy={-1} rx={7} ry={3.5} fill="url(#chair-back-grad)" />
          </g>
        );
      })}
      {/* Table top — ellipse with subtle gradient */}
      <ellipse cx={0} cy={0} rx={r} ry={r * 0.5} fill="url(#table-grad)" />
      <ellipse cx={0} cy={-2} rx={r - 4} ry={r * 0.5 - 3} fill="url(#table-top-grad)" />
      {/* Pen + paper on table */}
      <rect x={-15} y={-4} width={14} height={8} fill="#FAFAFA" />
      <rect x={3} y={-2} width={1.5} height={10} fill="#0F766E" />
      {/* Coffee cup */}
      <g transform={`translate(${15}, ${-2})`}>
        <ellipse cx={0} cy={0} rx={3} ry={1} fill="rgba(0,0,0,0.4)" />
        <ellipse cx={0} cy={-1} rx={2.5} ry={1} fill="#0F766E" />
      </g>
    </g>
  );
}

/** Coffee table with a plant + book. */
function CoffeeTable({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g transform={`translate(${cx}, ${cy})`}>
      <ellipse cx={0} cy={14} rx={50} ry={7} fill="rgba(0,0,0,0.32)" filter="url(#blur-soft)" />
      <rect x={-46} y={-4} width={92} height={14} rx={3} fill="url(#table-grad)" />
      <rect x={-46} y={-4} width={92} height={5} fill="url(#table-top-grad)" />
      <rect x={-44} y={10} width={3} height={6} fill="#3F2D1F" />
      <rect x={41} y={10} width={3} height={6} fill="#3F2D1F" />
      {/* Books */}
      <rect x={-30} y={-10} width={20} height={6} rx={0.5} fill="#0F766E" />
      <rect x={-30} y={-13} width={20} height={3} rx={0.5} fill="#5EEAD4" />
      {/* Small plant in pot */}
      <g transform={`translate(${15}, ${-4})`}>
        <path d="M -5 0 L 5 0 L 4 8 L -4 8 Z" fill="url(#pot-grad)" />
        <path d="M 0 0 Q -3 -6 -6 -8 Q -2 -10 0 -8 Z" fill="url(#leaf-grad)" />
        <path d="M 0 0 Q 3 -6 6 -8 Q 2 -10 0 -8 Z" fill="url(#leaf-grad)" />
        <path d="M 0 0 Q 0 -8 1 -10 Q 1 -10 1 -6 Z" fill="url(#leaf-grad-light)" />
      </g>
    </g>
  );
}

/** Kitchen counter with espresso machine. */
function KitchenCounter({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g transform={`translate(${cx}, ${cy})`}>
      <ellipse cx={0} cy={28} rx={75} ry={10} fill="rgba(0,0,0,0.32)" filter="url(#blur-soft)" />
      {/* Counter */}
      <rect x={-70} y={-2} width={140} height={28} rx={2} fill="url(#counter-grad)" />
      {/* Counter top */}
      <rect x={-70} y={-2} width={140} height={5} fill="url(#counter-top-grad)" />
      {/* Espresso machine */}
      <g transform={`translate(${-40}, ${-4})`}>
        <rect x={-12} y={-22} width={24} height={22} rx={1} fill="#1F2937" />
        <rect x={-10} y={-20} width={20} height={6} rx={0.5} fill="#5EEAD4" opacity={0.6} />
        <rect x={-3} y={-12} width={6} height={3} fill="#0A0A0B" />
        <rect x={-2} y={-8} width={4} height={3} fill="#5C4534" />
      </g>
      {/* Mugs lined up */}
      {[0, 1, 2, 3].map(i => (
        <g key={i} transform={`translate(${-5 + i * 12}, ${-6})`}>
          <ellipse cx={0} cy={0} rx={4} ry={1} fill="rgba(0,0,0,0.3)" />
          <rect x={-3} y={-6} width={6} height={6} rx={1} fill="#FAFAFA" />
          <ellipse cx={0} cy={-6} rx={3} ry={0.8} fill="#0F766E" />
        </g>
      ))}
      {/* Plant on counter */}
      <g transform={`translate(${50}, ${-4})`}>
        <path d="M -6 0 L 6 0 L 5 10 L -5 10 Z" fill="url(#pot-grad)" />
        <path d="M 0 0 Q -5 -10 -8 -12 Q -3 -16 0 -10 Z" fill="url(#leaf-grad)" />
        <path d="M 0 0 Q 5 -10 8 -12 Q 3 -16 0 -10 Z" fill="url(#leaf-grad)" />
        <path d="M 0 0 Q 0 -12 1 -16 Q 2 -16 2 -10 Z" fill="url(#leaf-grad-light)" />
      </g>
    </g>
  );
}

/** Tall plant — floor decoration. */
function FloorPlant({ cx, cy, scale = 1 }: { cx: number; cy: number; scale?: number }) {
  return (
    <g transform={`translate(${cx}, ${cy}) scale(${scale})`}>
      <ellipse cx={0} cy={20} rx={14} ry={4} fill="rgba(0,0,0,0.32)" filter="url(#blur-soft)" />
      {/* Pot */}
      <path d="M -10 0 L 10 0 L 8 18 L -8 18 Z" fill="url(#pot-grad)" />
      <ellipse cx={0} cy={0} rx={10} ry={3} fill="#0F766E" />
      <ellipse cx={0} cy={0} rx={8} ry={2.4} fill="#042F2E" />
      {/* Tall leaves */}
      <path d="M 0 0 Q -8 -16 -12 -22 Q -4 -28 0 -18 Z" fill="url(#leaf-grad)" />
      <path d="M 0 0 Q 8 -16 12 -22 Q 4 -28 0 -18 Z" fill="url(#leaf-grad)" />
      <path d="M 0 0 Q -3 -22 -2 -32 Q 2 -32 3 -22 Z" fill="url(#leaf-grad-light)" />
      <path d="M 0 0 Q 6 -14 10 -16 Q 6 -8 0 -6 Z" fill="url(#leaf-grad)" opacity={0.85} />
      <path d="M 0 0 Q -6 -14 -10 -16 Q -6 -8 0 -6 Z" fill="url(#leaf-grad)" opacity={0.85} />
    </g>
  );
}

/** Modern character avatar — circular gradient disc. */
function Avatar({
  cx,
  cy,
  color,
  initial,
  isPulsing,
  hovered,
}: {
  cx: number;
  cy: number;
  color: string;
  initial: string;
  isPulsing: boolean;
  hovered: boolean;
}) {
  const size = hovered ? 16 : 13;
  return (
    <g transform={`translate(${cx}, ${cy})`}>
      {isPulsing && (
        <>
          <circle cx={0} cy={0} r={14} fill="none" stroke={color} strokeWidth={1.4} opacity={0.55}>
            <animate attributeName="r" from={11} to={26} dur="1.5s" repeatCount="indefinite" />
            <animate attributeName="opacity" from={0.7} to={0} dur="1.5s" repeatCount="indefinite" />
          </circle>
          <circle cx={0} cy={0} r={14} fill="none" stroke={color} strokeWidth={0.8} opacity={0.40}>
            <animate attributeName="r" from={11} to={22} dur="1.5s" begin="0.4s" repeatCount="indefinite" />
            <animate attributeName="opacity" from={0.5} to={0} dur="1.5s" begin="0.4s" repeatCount="indefinite" />
          </circle>
        </>
      )}
      <ellipse cx={0} cy={size + 1} rx={size * 0.7} ry={2.4} fill="rgba(0,0,0,0.40)" filter="url(#blur-soft)" />
      <circle cx={0} cy={0} r={size + 2} fill={color} opacity={0.20} />
      <circle cx={0} cy={0} r={size} fill={`url(#avatar-${initial})`} />
      <circle cx={0} cy={0} r={size} fill="none" stroke="rgba(255,255,255,0.40)" strokeWidth={0.6} />
      <text
        x={0}
        y={size === 16 ? 4 : 3.5}
        textAnchor="middle"
        fontFamily="Inter, system-ui"
        fontWeight={700}
        fontSize={size === 16 ? 13 : 11}
        fill="#0A0A0B"
        style={{ textShadow: "0 1px 0 rgba(255,255,255,0.4)" }}
      >
        {initial}
      </text>
    </g>
  );
}

/** Window with city skyline + sun ray. */
function Window({ cx, cy, w = 100, h = 40 }: { cx: number; cy: number; w?: number; h?: number }) {
  return (
    <g transform={`translate(${cx}, ${cy})`}>
      {/* Frame */}
      <rect x={-w / 2 - 2} y={-h / 2 - 2} width={w + 4} height={h + 4} rx={1} fill="#0A0A0B" />
      <rect x={-w / 2} y={-h / 2} width={w} height={h} fill="url(#sky-grad)" />
      {/* Skyline */}
      <path
        d={`M ${-w / 2} ${h / 2 - 2}
            L ${-w / 2} 8
            L ${-w / 2 + 12} 8
            L ${-w / 2 + 12} 2
            L ${-w / 2 + 24} 2
            L ${-w / 2 + 24} -4
            L ${-w / 2 + 36} -4
            L ${-w / 2 + 36} 4
            L ${-w / 2 + 50} 4
            L ${-w / 2 + 50} -8
            L ${-w / 2 + 60} -8
            L ${-w / 2 + 60} 0
            L ${-w / 2 + 70} 0
            L ${-w / 2 + 70} -4
            L ${-w / 2 + 84} -4
            L ${-w / 2 + 84} 6
            L ${w / 2} 6
            L ${w / 2} ${h / 2 - 2}
            Z`}
        fill="#0F766E"
        opacity={0.85}
      />
      {/* Cross panes */}
      <line x1={0} y1={-h / 2} x2={0} y2={h / 2} stroke="#0A0A0B" strokeWidth={1} />
      <line x1={-w / 2} y1={0} x2={w / 2} y2={0} stroke="#0A0A0B" strokeWidth={1} />
      {/* Sun ray streaking down through the window */}
      <path
        d={`M ${-w / 2} ${h / 2} L ${w / 2} ${h / 2} L ${w / 2 + 80} ${h / 2 + 100} L ${-w / 2 - 80} ${h / 2 + 100} Z`}
        fill="#FCD34D"
        opacity={0.06}
        filter="url(#blur-glow)"
      />
    </g>
  );
}

export default function KumoScene({
  variant = "tile",
  recent,
  hovered,
  setHovered,
  onAgentClick,
}: KumoSceneProps) {
  // Use all 10 agents for full variant, slice to 6 for tile
  const roster = useMemo(
    () => (variant === "full" ? AGENTS : AGENTS.slice(0, 6)) as readonly PixelAgent[],
    [variant],
  );

  const VB_W = 1200;
  const VB_H = 600;

  const seats = useMemo(
    () => buildSeats(roster, recent, VB_W, VB_H),
    [roster, recent],
  );

  return (
    <div
      className="relative rounded-2xl overflow-hidden border border-border-subtle"
      style={{
        background: "linear-gradient(180deg, #0F2C2A 0%, #042F2E 100%)",
      }}
    >
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        width="100%"
        height="auto"
        className="block"
        aria-hidden="true"
        style={{ imageRendering: "auto" }}
      >
        <defs>
          {/* Sky behind windows */}
          <linearGradient id="sky-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#5EEAD4" />
            <stop offset="60%" stopColor="#14B8A6" />
            <stop offset="100%" stopColor="#0D9488" />
          </linearGradient>

          {/* Wood floor — long oak planks via repeating pattern */}
          <pattern id="wood-floor" x="0" y="0" width="120" height="36" patternUnits="userSpaceOnUse">
            <rect width="120" height="36" fill="#0F2C2A" />
            <line x1="0" y1="0" x2="120" y2="0" stroke="rgba(94,234,212,0.10)" strokeWidth="0.5" />
            <line x1="0" y1="36" x2="120" y2="36" stroke="rgba(94,234,212,0.10)" strokeWidth="0.5" />
            {/* Plank divider verticals — staggered */}
            <line x1="40" y1="0" x2="40" y2="36" stroke="rgba(94,234,212,0.06)" strokeWidth="0.4" />
            <line x1="80" y1="0" x2="80" y2="36" stroke="rgba(94,234,212,0.06)" strokeWidth="0.4" />
            {/* Wood grain — subtle horizontal noise */}
            <line x1="0" y1="9" x2="120" y2="10" stroke="rgba(94,234,212,0.04)" strokeWidth="0.3" />
            <line x1="0" y1="22" x2="120" y2="21" stroke="rgba(94,234,212,0.03)" strokeWidth="0.3" />
            <line x1="0" y1="29" x2="120" y2="30" stroke="rgba(94,234,212,0.05)" strokeWidth="0.3" />
          </pattern>

          {/* Wall gradient */}
          <linearGradient id="wall-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0F766E" />
            <stop offset="100%" stopColor="#0A1F1E" />
          </linearGradient>

          {/* Floor central glow */}
          <radialGradient id="floor-glow" cx="50%" cy="55%" r="55%">
            <stop offset="0%" stopColor="#14B8A6" stopOpacity="0.32" />
            <stop offset="60%" stopColor="#0F766E" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#042F2E" stopOpacity="0" />
          </radialGradient>

          {/* Desk faces */}
          <linearGradient id="desk-top-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#5EEAD4" />
            <stop offset="100%" stopColor="#0D9488" />
          </linearGradient>
          <linearGradient id="desk-side-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0D9488" />
            <stop offset="100%" stopColor="#0F766E" />
          </linearGradient>
          <linearGradient id="desk-front-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0F766E" />
            <stop offset="100%" stopColor="#0A2625" />
          </linearGradient>

          {/* Couch */}
          <linearGradient id="couch-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="100%" stopColor="#1E293B" />
          </linearGradient>
          <linearGradient id="couch-cushion-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#64748B" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>
          <linearGradient id="couch-back-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3F4B5C" />
            <stop offset="100%" stopColor="#1E293B" />
          </linearGradient>
          <linearGradient id="couch-arm-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="100%" stopColor="#1E293B" />
          </linearGradient>

          {/* Tables */}
          <linearGradient id="table-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#5C4534" />
            <stop offset="100%" stopColor="#3F2D1F" />
          </linearGradient>
          <linearGradient id="table-top-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#7F5530" />
            <stop offset="100%" stopColor="#5C4534" />
          </linearGradient>

          {/* Chairs */}
          <linearGradient id="chair-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1F2937" />
            <stop offset="100%" stopColor="#0F172A" />
          </linearGradient>
          <linearGradient id="chair-back-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#374151" />
            <stop offset="100%" stopColor="#1F2937" />
          </linearGradient>

          {/* Counter */}
          <linearGradient id="counter-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FAFAFA" />
            <stop offset="100%" stopColor="#A1A1AA" />
          </linearGradient>
          <linearGradient id="counter-top-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#E2E8F0" />
            <stop offset="100%" stopColor="#94A3B8" />
          </linearGradient>

          {/* Plant */}
          <linearGradient id="pot-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#7F5530" />
            <stop offset="100%" stopColor="#3F2D1F" />
          </linearGradient>
          <radialGradient id="leaf-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#34D399" />
            <stop offset="100%" stopColor="#047857" />
          </radialGradient>
          <radialGradient id="leaf-grad-light" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#6EE7B7" />
            <stop offset="100%" stopColor="#10B981" />
          </radialGradient>

          {/* Avatar gradients */}
          {seats.map(seat => {
            const c = hexFromInt(seat.agent.brandColor);
            return (
              <radialGradient
                key={seat.agent.key}
                id={`avatar-${seat.agent.name.charAt(0)}`}
                cx="35%"
                cy="30%"
                r="70%"
              >
                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
                <stop offset="35%" stopColor={c} />
                <stop offset="100%" stopColor={c} stopOpacity="0.85" />
              </radialGradient>
            );
          })}

          {/* Filters */}
          <filter id="blur-soft" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
          <filter id="blur-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
        </defs>

        {/* ──────── BACK WALL ──────── */}
        <rect x={0} y={0} width={VB_W} height={150} fill="url(#wall-grad)" />
        {/* Wall trim */}
        <rect x={0} y={148} width={VB_W} height={2} fill="#5EEAD4" opacity={0.32} />
        {/* Wall ambient teal reflection from floor */}
        <ellipse cx={VB_W / 2} cy={150} rx={VB_W / 2} ry={50} fill="#14B8A6" opacity={0.18} filter="url(#blur-glow)" />

        {/* Windows on back wall */}
        <Window cx={200} cy={70} w={140} h={70} />
        <Window cx={500} cy={70} w={140} h={70} />
        <Window cx={800} cy={70} w={140} h={70} />
        <Window cx={1080} cy={70} w={140} h={70} />

        {/* ──────── FLOOR ──────── */}
        <rect x={0} y={150} width={VB_W} height={VB_H - 150} fill="url(#wood-floor)" />
        {/* Floor central glow */}
        <ellipse cx={VB_W / 2} cy={VB_H / 2 + 40} rx={VB_W / 2} ry={140} fill="url(#floor-glow)" />
        {/* Sun rays from windows hitting the floor */}
        <path d={`M 130 150 L 270 150 L 320 ${VB_H} L 80 ${VB_H} Z`} fill="#FCD34D" opacity={0.04} />
        <path d={`M 430 150 L 570 150 L 620 ${VB_H} L 380 ${VB_H} Z`} fill="#FCD34D" opacity={0.04} />
        <path d={`M 730 150 L 870 150 L 920 ${VB_H} L 680 ${VB_H} Z`} fill="#FCD34D" opacity={0.04} />
        <path d={`M 1010 150 L 1150 150 L 1180 ${VB_H} L 980 ${VB_H} Z`} fill="#FCD34D" opacity={0.04} />

        {/* ──────── WORKSTATION ZONE (top-half) ──────── */}
        {/* Zone label */}
        <text x={50} y={180} fontFamily="Inter" fontWeight={600} fontSize={11} fill="rgba(94,234,212,0.40)" letterSpacing={1.5}>
          WORKSTATION
        </text>
        {/* 4 desks evenly spaced */}
        {[240, 480, 720, 960].map((x, i) => (
          <Desk
            key={i}
            cx={x}
            cy={250}
            glowing={seats[i]?.isPulsing ?? false}
            glowColor={seats[i] ? hexFromInt(seats[i].agent.brandColor) : "#14B8A6"}
          />
        ))}

        {/* ──────── LOUNGE ZONE (bottom-left) ──────── */}
        <text x={50} y={400} fontFamily="Inter" fontWeight={600} fontSize={11} fill="rgba(94,234,212,0.40)" letterSpacing={1.5}>
          LOUNGE
        </text>
        <Couch cx={260} cy={460} />
        <CoffeeTable cx={260} cy={530} />

        {/* ──────── MEETING ZONE (bottom-center) ──────── */}
        <text x={500} y={400} fontFamily="Inter" fontWeight={600} fontSize={11} fill="rgba(94,234,212,0.40)" letterSpacing={1.5}>
          MEETING
        </text>
        <MeetingTable cx={580} cy={490} />

        {/* ──────── KITCHEN ZONE (bottom-right) ──────── */}
        <text x={870} y={400} fontFamily="Inter" fontWeight={600} fontSize={11} fill="rgba(94,234,212,0.40)" letterSpacing={1.5}>
          KITCHEN
        </text>
        <KitchenCounter cx={970} cy={460} />

        {/* ──────── PLANTS scattered ──────── */}
        <FloorPlant cx={50} cy={420} scale={1.4} />
        <FloorPlant cx={VB_W - 50} cy={400} scale={1.6} />
        <FloorPlant cx={VB_W / 2 - 250} cy={350} scale={0.9} />
        <FloorPlant cx={VB_W / 2 + 250} cy={350} scale={0.9} />

        {/* ──────── AGENTS scattered across zones ──────── */}
        {seats.map(seat => {
          const color = hexFromInt(seat.agent.brandColor);
          return (
            <g
              key={seat.agent.key}
              onMouseEnter={() => setHovered(seat.agent.key)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onAgentClick?.(seat.agent.key)}
              style={{ cursor: "pointer" }}
            >
              <Avatar
                cx={seat.x}
                cy={seat.y}
                color={color}
                initial={seat.agent.name.charAt(0)}
                isPulsing={seat.isPulsing}
                hovered={hovered === seat.agent.key}
              />
            </g>
          );
        })}
      </svg>

      {/* Tooltip overlay — shown on hover */}
      {hovered && (() => {
        const seat = seats.find(s => s.agent.key === hovered);
        if (!seat) return null;
        return (
          <div
            className="absolute top-3 right-3 rounded-lg border border-border-subtle bg-bg-surface-2/95 backdrop-blur-sm px-3 py-2 text-[11px] shadow-xl pointer-events-none"
            style={{ minWidth: 200 }}
          >
            <p className="font-semibold text-text-primary text-[13px]">{seat.agent.name}</p>
            <p className="text-text-secondary mt-0.5">{seat.agent.role}</p>
            <p className="text-brand-accent text-[10px] mt-1.5 font-medium">{seat.zone}</p>
            <p className="text-text-muted mt-1 text-[10px] leading-snug">{seat.agent.blurb}</p>
            {seat.isPulsing && (
              <p className="mt-2 inline-flex items-center gap-1 text-[10px] text-brand-accent">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-accent animate-pulse" />
                Active now
              </p>
            )}
          </div>
        );
      })()}
    </div>
  );
}

/* Re-export the agent legend pill row for use under the scene */
export function AgentLegendPills({ recent }: { recent: Record<string, number> }) {
  const now = Date.now();
  return (
    <div className="flex flex-wrap gap-1.5">
      {AGENTS.slice(0, 10).map(agent => {
        const color = hexFromInt(agent.brandColor);
        const isPulsing = !!recent[agent.key] && now - recent[agent.key] < RECENT_PULSE_MS;
        return (
          <Link
            key={agent.key}
            href={`/dashboard/agent-office?focus=${agent.key}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface-light/60 px-2.5 py-1 text-[10px] transition-all hover:border-brand-accent/40 hover:bg-brand-accent/10"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{
                background: color,
                boxShadow: isPulsing ? `0 0 8px ${color}, 0 0 4px ${color}` : undefined,
              }}
            />
            <span className="text-text-primary font-medium">{agent.name}</span>
            <span className="text-text-muted">· {agent.role}</span>
          </Link>
        );
      })}
    </div>
  );
}
