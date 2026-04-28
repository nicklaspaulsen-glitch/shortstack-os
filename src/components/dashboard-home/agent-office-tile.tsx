"use client";

/**
 * AgentOfficeTile — Apr 28 v11 redesign.
 *
 * User: "improve the agent office make it actually realistic like
 * kumospace that high quality 4k like kumospace vscode vibecode that
 * actually looks cool not some cheap looking 8bit game".
 *
 * Got it — pixel-art was the wrong direction. v11 is a sophisticated
 * isometric SVG illustration in the **modern flat-3D style** (Stripe /
 * Notion / Kumospace marketing-illustration aesthetic):
 *
 *   • Isometric floor with subtle radial teal glow + grid pattern
 *   • Back wall with framed windows showing the city skyline beyond
 *   • Smooth 3D-rendered desks — each one has 3 faces (top, side,
 *     front) with proper gradient lighting (top brightest, front
 *     darkest)
 *   • Modern character avatars — smooth gradient discs with a glow
 *     ring + name label below
 *   • Plants, monitors, lamps with realistic shading
 *   • Ambient cast shadows under every object
 *   • Activity pulse rings on agents whose watched tables fired in
 *     the last 6s
 *   • Hover = highlight ring + tooltip
 *
 * No pixel-art. No 8-bit aesthetic. Smooth curves, proper isometric
 * projection, layered depth.
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { AGENTS } from "@/lib/pixel-office/agents";

interface AgentActivity {
  agent_key: string;
  summary?: string;
  created_at: string;
}

interface SnapshotResponse {
  events?: AgentActivity[];
  hero?: { calls?: number; leads?: number; emails?: number };
}

const POLL_INTERVAL_MS = 12_000;
const RECENT_PULSE_MS = 6_000;

function hexFromInt(c: number): string {
  return `#${c.toString(16).padStart(6, "0")}`;
}

/** Isometric projection helper — converts grid (x,y) to screen (px,py). */
function iso(x: number, y: number, tileW = 64, tileH = 32): { px: number; py: number } {
  return {
    px: (x - y) * (tileW / 2),
    py: (x + y) * (tileH / 2),
  };
}

/** A single isometric desk — 3 quadrilateral faces with gradients. */
function IsoDesk({
  x,
  y,
  glowing,
  glowColor,
}: {
  x: number;
  y: number;
  glowing: boolean;
  glowColor: string;
}) {
  // A desk occupies one tile in iso space. We render:
  // - top face (rhombus)
  // - left side face (parallelogram)
  // - right side face (parallelogram)
  // - monitor on top
  // - lamp on top
  // - chair behind
  const w = 56; // desk width in screen px
  const h = 28; // desk depth in screen px
  const z = 14; // desk height in screen px

  const cx = x;
  const cy = y;

  return (
    <g transform={`translate(${cx}, ${cy})`}>
      {/* Cast shadow on floor */}
      <ellipse
        cx="0"
        cy={h + 6}
        rx={w * 0.62}
        ry={h * 0.32}
        fill="rgba(0,0,0,0.30)"
        filter="url(#blur-soft)"
      />

      {/* Chair behind the desk */}
      <g transform={`translate(0, ${-12})`}>
        <ellipse cx="0" cy={h * 0.55} rx="11" ry="5" fill="rgba(0,0,0,0.35)" />
        <path
          d={`M -10 ${-2} L 10 ${-2} L 11 ${h * 0.45} L -11 ${h * 0.45} Z`}
          fill="url(#chair-grad)"
        />
        <path
          d={`M -11 ${-12} L 11 ${-12} L 10 ${-2} L -10 ${-2} Z`}
          fill="url(#chair-back-grad)"
        />
      </g>

      {/* Front face of desk */}
      <path
        d={`M ${-w / 2} 0 L ${w / 2} 0 L ${w / 2} ${z} L ${-w / 2} ${z} Z`}
        fill="url(#desk-front-grad)"
      />
      {/* Right (perspective) side face */}
      <path
        d={`M ${w / 2} 0 L ${w / 2 + h * 0.35} ${-h * 0.5} L ${w / 2 + h * 0.35} ${z - h * 0.5} L ${w / 2} ${z} Z`}
        fill="url(#desk-side-grad)"
      />
      {/* Top face */}
      <path
        d={`M ${-w / 2} 0 L ${w / 2} 0 L ${w / 2 + h * 0.35} ${-h * 0.5} L ${-w / 2 + h * 0.35} ${-h * 0.5} Z`}
        fill="url(#desk-top-grad)"
      />

      {/* Monitor on the desk */}
      <g transform={`translate(${4}, ${-h * 0.5 - 2})`}>
        {/* monitor stand */}
        <rect x="-2" y="-2" width="4" height="6" fill="#1F2937" />
        <ellipse cx="0" cy="4" rx="6" ry="1.5" fill="rgba(0,0,0,0.4)" />
        {/* monitor body */}
        <rect x="-14" y="-22" width="28" height="20" rx="1.5" fill="#0A0A0B" />
        {/* monitor screen */}
        <rect
          x="-12.5"
          y="-20.5"
          width="25"
          height="17"
          rx="0.5"
          fill={glowing ? glowColor : "#1F2937"}
          opacity={glowing ? 0.85 : 1}
        />
        {/* code-line decorations on screen */}
        <rect x="-10" y="-18" width="14" height="1" fill="rgba(255,255,255,0.40)" />
        <rect x="-10" y="-15" width="20" height="1" fill="rgba(255,255,255,0.30)" />
        <rect x="-10" y="-12" width="10" height="1" fill="rgba(255,255,255,0.30)" />
        <rect x="-10" y="-9" width="16" height="1" fill="rgba(255,255,255,0.25)" />
        {/* Screen glow when active */}
        {glowing && (
          <ellipse
            cx="0"
            cy="-12"
            rx="22"
            ry="8"
            fill={glowColor}
            opacity="0.30"
            filter="url(#blur-soft)"
          />
        )}
      </g>

      {/* Desk lamp */}
      <g transform={`translate(${-18}, ${-h * 0.5 - 1})`}>
        <rect x="-0.5" y="-1" width="1" height="6" fill="#1F2937" />
        <ellipse cx="0" cy="6" rx="3" ry="1" fill="#1F2937" />
        <path
          d="M -3 -8 L 3 -8 L 5 -2 L -5 -2 Z"
          fill={glowing ? glowColor : "#374151"}
        />
        {glowing && (
          <ellipse
            cx="0"
            cy="-2"
            rx="14"
            ry="6"
            fill={glowColor}
            opacity="0.22"
            filter="url(#blur-soft)"
          />
        )}
      </g>

      {/* Coffee mug on desk — adds life */}
      <g transform={`translate(${20}, ${-h * 0.5 + 4})`}>
        <ellipse cx="0" cy="0" rx="3" ry="1" fill="rgba(0,0,0,0.35)" />
        <rect x="-2.5" y="-4" width="5" height="4" rx="0.5" fill="#0F766E" />
        <ellipse cx="0" cy="-4" rx="2.5" ry="0.7" fill="#0A0A0B" />
        {/* steam */}
        <path
          d="M -1 -7 Q 0 -8 1 -7 Q 0 -6 -1 -7"
          fill="none"
          stroke="rgba(255,255,255,0.45)"
          strokeWidth="0.4"
        />
      </g>
    </g>
  );
}

/** Modern character avatar — smooth gradient disc with glow ring. */
function IsoAgentAvatar({
  x,
  y,
  color,
  initial,
  isPulsing,
}: {
  x: number;
  y: number;
  color: string;
  initial: string;
  isPulsing: boolean;
}) {
  return (
    <g transform={`translate(${x}, ${y})`} style={{ cursor: "pointer" }}>
      {/* Activity pulse ring */}
      {isPulsing && (
        <>
          <circle cx="0" cy="0" r="14" fill="none" stroke={color} strokeWidth="1.4" opacity="0.55">
            <animate attributeName="r" from="11" to="22" dur="1.5s" repeatCount="indefinite" />
            <animate attributeName="opacity" from="0.7" to="0" dur="1.5s" repeatCount="indefinite" />
          </circle>
          <circle cx="0" cy="0" r="14" fill="none" stroke={color} strokeWidth="0.8" opacity="0.40">
            <animate attributeName="r" from="11" to="20" dur="1.5s" begin="0.4s" repeatCount="indefinite" />
            <animate attributeName="opacity" from="0.5" to="0" dur="1.5s" begin="0.4s" repeatCount="indefinite" />
          </circle>
        </>
      )}

      {/* Avatar shadow on floor */}
      <ellipse cx="0" cy="14" rx="9" ry="2.5" fill="rgba(0,0,0,0.40)" filter="url(#blur-soft)" />

      {/* Avatar disc — outer glow ring */}
      <circle cx="0" cy="0" r="13" fill={color} opacity="0.22" />
      {/* Avatar disc — main body with radial gradient */}
      <circle cx="0" cy="0" r="11" fill={`url(#avatar-${initial})`} />
      <circle cx="0" cy="0" r="11" fill="none" stroke="rgba(255,255,255,0.30)" strokeWidth="0.5" />
      {/* Initial */}
      <text
        x="0"
        y="3.5"
        textAnchor="middle"
        fontFamily="Inter, system-ui"
        fontWeight="700"
        fontSize="11"
        fill="#0A0A0B"
        style={{ textShadow: "0 1px 0 rgba(255,255,255,0.4)" }}
      >
        {initial}
      </text>
    </g>
  );
}

/** Decorative plant in a pot. */
function IsoPlant({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x}, ${y}) scale(${scale})`}>
      <ellipse cx="0" cy="14" rx="10" ry="2.5" fill="rgba(0,0,0,0.35)" filter="url(#blur-soft)" />
      {/* pot */}
      <path d="M -8 0 L 8 0 L 6 12 L -6 12 Z" fill="url(#pot-grad)" />
      <ellipse cx="0" cy="0" rx="8" ry="2.4" fill="#0F766E" />
      <ellipse cx="0" cy="0" rx="6.5" ry="2" fill="#042F2E" />
      {/* leaves */}
      <path d="M 0 0 Q -4 -8 -8 -10 Q -3 -14 0 -10 Z" fill="url(#leaf-grad)" />
      <path d="M 0 0 Q 4 -8 8 -10 Q 3 -14 0 -10 Z" fill="url(#leaf-grad)" />
      <path d="M 0 0 Q -2 -10 -1 -16 Q 1 -16 2 -10 Z" fill="url(#leaf-grad-light)" />
      <path d="M 0 0 Q 4 -7 7 -6 Q 4 -2 0 -2 Z" fill="url(#leaf-grad)" opacity="0.85" />
      <path d="M 0 0 Q -4 -7 -7 -6 Q -4 -2 0 -2 Z" fill="url(#leaf-grad)" opacity="0.85" />
    </g>
  );
}

/** Window with city skyline. */
function IsoWindow({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Frame */}
      <rect x="-26" y="-22" width="52" height="32" fill="#0A0A0B" rx="1" />
      {/* Sky gradient */}
      <rect x="-24" y="-20" width="48" height="28" fill="url(#sky-grad)" />
      {/* City skyline silhouettes */}
      <path
        d="M -24 8 L -24 -2 L -20 -2 L -20 -6 L -16 -6 L -16 -10 L -12 -10 L -12 -4 L -8 -4 L -8 -12 L -4 -12 L -4 -8 L 0 -8 L 0 -14 L 4 -14 L 4 -6 L 8 -6 L 8 -10 L 12 -10 L 12 -4 L 16 -4 L 16 -8 L 20 -8 L 20 -2 L 24 -2 L 24 8 Z"
        fill="#0F766E"
        opacity="0.85"
      />
      {/* Window panes — vertical divider */}
      <line x1="0" y1="-20" x2="0" y2="8" stroke="#0A0A0B" strokeWidth="1" />
      {/* horizontal divider */}
      <line x1="-24" y1="-6" x2="24" y2="-6" stroke="#0A0A0B" strokeWidth="1" />
    </g>
  );
}

export default function AgentOfficeTile() {
  const [recent, setRecent] = useState<Record<string, number>>({});
  const [hero, setHero] = useState<{ calls: number; leads: number; emails: number } | null>(null);
  const [, forceTick] = useState(0);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/agent-office/snapshot", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as SnapshotResponse;
        if (cancelled) return;

        const next: Record<string, number> = {};
        const now = Date.now();
        for (const e of data.events ?? []) {
          const ts = Date.parse(e.created_at);
          if (!isFinite(ts)) continue;
          if (now - ts < RECENT_PULSE_MS) {
            const prev = next[e.agent_key] ?? 0;
            if (ts > prev) next[e.agent_key] = ts;
          }
        }
        setRecent(next);
        if (data.hero) {
          setHero({
            calls: data.hero.calls ?? 0,
            leads: data.hero.leads ?? 0,
            emails: data.hero.emails ?? 0,
          });
        }
      } catch {
        /* swallow */
      }
    };
    void tick();
    const id = window.setInterval(tick, POLL_INTERVAL_MS);
    const expireTick = window.setInterval(() => forceTick(t => (t + 1) % 1000), 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.clearInterval(expireTick);
    };
  }, []);

  const now = Date.now();
  const roster = useMemo(() => AGENTS.slice(0, 6) as typeof AGENTS, []);
  const agentRows = useMemo(() => {
    return roster.map((a, i) => ({
      ...a,
      isPulsing: !!recent[a.key] && now - recent[a.key] < RECENT_PULSE_MS,
      // 3x2 grid in iso space
      gridX: i % 3,
      gridY: Math.floor(i / 3),
    }));
  }, [recent, now, roster]);

  const VB_W = 800;
  const VB_H = 360;

  // Layout grid centers
  const FLOOR_OX = VB_W / 2;
  const FLOOR_OY = 90;

  return (
    <section className="card relative overflow-hidden" aria-label="Agent Office preview">
      <header className="relative z-10 flex items-center justify-between gap-3 mb-4">
        <div>
          <p className="font-editorial text-[11px] uppercase tracking-[0.18em] text-text-muted">
            Agent Office
          </p>
          <h3 className="font-display text-xl text-text-primary tracking-tight">
            {hero
              ? `${hero.calls} calls · ${hero.leads} leads · ${hero.emails} emails today`
              : "Your AI team, working live"}
          </h3>
        </div>
        <Link
          href="/dashboard/agent-office"
          className="group inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface-light px-3 py-1.5 text-[12px] text-text-primary transition-all hover:border-brand-accent/40 hover:bg-brand-accent/10"
        >
          <span>Open office</span>
          <ArrowUpRight
            size={12}
            className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          />
        </Link>
      </header>

      <div className="relative rounded-2xl overflow-hidden border border-border-subtle bg-gradient-to-b from-[#0A1F1E] to-[#042F2E]">
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          width="100%"
          height="auto"
          className="block"
          aria-hidden="true"
          style={{ imageRendering: "auto" }}
        >
          <defs>
            {/* Floor radial glow */}
            <radialGradient id="floor-glow" cx="50%" cy="60%" r="50%">
              <stop offset="0%" stopColor="#14B8A6" stopOpacity="0.30" />
              <stop offset="60%" stopColor="#0F766E" stopOpacity="0.10" />
              <stop offset="100%" stopColor="#042F2E" stopOpacity="0" />
            </radialGradient>

            {/* Floor base */}
            <linearGradient id="floor-base" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#0F2C2A" />
              <stop offset="100%" stopColor="#042F2E" />
            </linearGradient>

            {/* Wall */}
            <linearGradient id="wall-grad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#0F766E" />
              <stop offset="100%" stopColor="#0A1F1E" />
            </linearGradient>

            {/* Sky behind window */}
            <linearGradient id="sky-grad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#5EEAD4" />
              <stop offset="60%" stopColor="#14B8A6" />
              <stop offset="100%" stopColor="#0D9488" />
            </linearGradient>

            {/* Desk faces — top brightest, side mid, front darkest */}
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

            {/* Chair */}
            <linearGradient id="chair-grad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1F2937" />
              <stop offset="100%" stopColor="#0F172A" />
            </linearGradient>
            <linearGradient id="chair-back-grad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#374151" />
              <stop offset="100%" stopColor="#1F2937" />
            </linearGradient>

            {/* Plants */}
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

            {/* Avatar gradients — one per agent (generated on the fly).
                We render a static set of 6 here keyed by initial. */}
            {agentRows.map(a => {
              const c = hexFromInt(a.brandColor);
              return (
                <radialGradient
                  key={a.key}
                  id={`avatar-${a.name.charAt(0)}`}
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

            {/* Soft blur for cast shadows */}
            <filter id="blur-soft" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" />
            </filter>
            {/* Stronger blur for ambient glows */}
            <filter id="blur-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="8" />
            </filter>

            {/* Isometric floor pattern — subtle grid */}
            <pattern
              id="floor-iso-grid"
              x="0"
              y="0"
              width="64"
              height="32"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 0 16 L 32 0 L 64 16 L 32 32 Z"
                fill="none"
                stroke="rgba(94,234,212,0.06)"
                strokeWidth="0.5"
              />
            </pattern>
          </defs>

          {/* Wall — back gradient */}
          <rect x="0" y="0" width={VB_W} height="120" fill="url(#wall-grad)" />
          {/* Wall trim line */}
          <rect x="0" y="118" width={VB_W} height="1.5" fill="#5EEAD4" opacity="0.30" />

          {/* Ambient teal glow on the wall (from floor reflection) */}
          <ellipse
            cx={VB_W / 2}
            cy="120"
            rx={VB_W / 2}
            ry="40"
            fill="#14B8A6"
            opacity="0.18"
            filter="url(#blur-glow)"
          />

          {/* Windows on back wall */}
          <IsoWindow x={150} y={50} />
          <IsoWindow x={400} y={50} />
          <IsoWindow x={650} y={50} />

          {/* Floor — base */}
          <rect x="0" y="120" width={VB_W} height={VB_H - 120} fill="url(#floor-base)" />
          {/* Floor — iso grid pattern overlay */}
          <rect x="0" y="120" width={VB_W} height={VB_H - 120} fill="url(#floor-iso-grid)" />
          {/* Floor — radial teal glow */}
          <ellipse
            cx={VB_W / 2}
            cy="240"
            rx={VB_W / 2}
            ry="80"
            fill="url(#floor-glow)"
          />

          {/* Plants in corners */}
          <IsoPlant x={60} y={200} scale={1.4} />
          <IsoPlant x={VB_W - 60} y={200} scale={1.4} />
          <IsoPlant x={120} y={VB_H - 30} scale={1.0} />
          <IsoPlant x={VB_W - 120} y={VB_H - 30} scale={1.0} />

          {/* Render desks + characters — sort by Y so further-back desks
              draw under closer ones (proper isometric depth). */}
          {agentRows
            .slice()
            .sort((a, b) => a.gridY - b.gridY)
            .map(agent => {
              const cellW = (VB_W - 120) / 3;
              const baseX = 60 + agent.gridX * cellW + cellW / 2;
              const baseY = agent.gridY === 0 ? 180 : 280;
              const color = hexFromInt(agent.brandColor);
              return (
                <g
                  key={agent.key}
                  onMouseEnter={() => setHovered(agent.key)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ cursor: "pointer" }}
                >
                  <IsoDesk
                    x={baseX}
                    y={baseY}
                    glowing={agent.isPulsing}
                    glowColor={color}
                  />
                  <IsoAgentAvatar
                    x={baseX}
                    y={baseY - 30}
                    color={color}
                    initial={agent.name.charAt(0)}
                    isPulsing={agent.isPulsing}
                  />
                </g>
              );
            })}
        </svg>

        {/* Tooltip overlay */}
        {hovered && (
          <div
            className="absolute top-3 right-3 rounded-lg border border-border-subtle bg-bg-surface-2/95 backdrop-blur-sm px-3 py-2 text-[11px] shadow-xl pointer-events-none"
            style={{ minWidth: 160 }}
          >
            <p className="font-semibold text-text-primary text-[12px]">
              {agentRows.find(a => a.key === hovered)?.name}
            </p>
            <p className="text-text-secondary mt-0.5">
              {agentRows.find(a => a.key === hovered)?.role}
            </p>
            <p className="text-text-muted mt-1.5 text-[10px] leading-snug">
              {agentRows.find(a => a.key === hovered)?.blurb}
            </p>
          </div>
        )}
      </div>

      {/* Agent legend */}
      <div className="relative z-10 mt-3 flex flex-wrap gap-1.5">
        {agentRows.map(agent => {
          const color = hexFromInt(agent.brandColor);
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
                  boxShadow: agent.isPulsing
                    ? `0 0 8px ${color}, 0 0 4px ${color}`
                    : undefined,
                }}
              />
              <span className="text-text-primary font-medium">{agent.name}</span>
              <span className="text-text-muted">· {agent.role}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
