"use client";

/**
 * AgentOfficeTile — Apr 28 v9 redesign.
 *
 * User: "the agent room that still looks like crap make it premium
 * like the github pixel agent office".
 *
 * The previous version showed letter-circle avatars (E, L, S, R, O…),
 * which didn't read as a "real" agent office. This rebuild renders a
 * **mini isometric pixel-office scene** as a single SVG so it ships
 * lightweight (no PixiJS), looks premium, and clicks through to the
 * full live PixiJS experience at /dashboard/agent-office.
 *
 * Design:
 *   • Isometric floor grid with teal accent walls.
 *   • 6 agent characters at desks — each a 16x24 pixel-art figure
 *     drawn as SVG <rect> so it renders crisp at any DPI.
 *   • Live activity ring around the character if their watched
 *     table fired an event in the last 6s (driven by snapshot poll).
 *   • Desk lamps glow when their owner is active.
 *   • Subtle ambient glow + grain overlay for depth.
 *   • Hover any character → tooltip with name + role.
 *
 * Snapshot polling kept identical so the live activity behavior
 * matches the full pixel office page.
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

// 6-character roster picked from AGENTS (the full office has 10, but a
// preview tile reads cleaner with fewer figures + cleaner spacing).
function pickRoster(): typeof AGENTS {
  // First 6 agents (Echo, Lyra, Sage, Reef, Onyx, Nova) — covers the
  // major domains: voice, coaching, leads, validation, outreach, news.
  return AGENTS.slice(0, 6) as typeof AGENTS;
}

/** A small isometric pixel-art character (16x24 px sprite). */
function PixelCharacter({
  x,
  y,
  color,
  isPulsing,
}: {
  x: number;
  y: number;
  color: string;
  isPulsing: boolean;
}) {
  // Body palette derived from the agent's brand color
  const skin = "#FFD7B5";
  const shirt = color;
  const shirtDark = color + "AA";
  const pants = "#1F2937";
  const hair = "#3F2D1F";

  return (
    <g transform={`translate(${x},${y})`}>
      {isPulsing && (
        <circle
          cx="8"
          cy="20"
          r="14"
          fill="none"
          stroke={color}
          strokeWidth="0.6"
          opacity="0.55"
        >
          <animate
            attributeName="r"
            from="9"
            to="18"
            dur="1.3s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            from="0.7"
            to="0"
            dur="1.3s"
            repeatCount="indefinite"
          />
        </circle>
      )}
      {/* shadow at feet */}
      <ellipse cx="8" cy="22.5" rx="5" ry="0.8" fill="rgba(0,0,0,0.30)" />
      {/* hair / hat band (top of head) */}
      <rect x="5" y="2" width="6" height="2" fill={hair} />
      {/* head */}
      <rect x="5" y="4" width="6" height="5" fill={skin} />
      {/* eyes */}
      <rect x="6" y="6" width="1" height="1" fill="#0A0A0B" />
      <rect x="9" y="6" width="1" height="1" fill="#0A0A0B" />
      {/* shirt body */}
      <rect x="4" y="9" width="8" height="6" fill={shirt} />
      {/* shirt shadow band */}
      <rect x="4" y="13" width="8" height="2" fill={shirtDark} />
      {/* arms */}
      <rect x="2" y="9" width="2" height="5" fill={shirt} />
      <rect x="12" y="9" width="2" height="5" fill={shirt} />
      {/* pants */}
      <rect x="4" y="15" width="3" height="6" fill={pants} />
      <rect x="9" y="15" width="3" height="6" fill={pants} />
      {/* shoes */}
      <rect x="3" y="21" width="4" height="1" fill="#0A0A0B" />
      <rect x="9" y="21" width="4" height="1" fill="#0A0A0B" />
    </g>
  );
}

/** A pixel-art desk with optional glowing lamp. */
function PixelDesk({
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
  return (
    <g transform={`translate(${x},${y})`}>
      {/* desk top */}
      <rect x="0" y="0" width="18" height="3" fill="#3F2D1F" />
      <rect x="0" y="0" width="18" height="1" fill="#5C4534" />
      {/* desk legs */}
      <rect x="1" y="3" width="2" height="4" fill="#2A1D14" />
      <rect x="15" y="3" width="2" height="4" fill="#2A1D14" />
      {/* monitor */}
      <rect x="3" y="-7" width="7" height="6" fill="#0A0A0B" />
      <rect x="3.5" y="-6.5" width="6" height="5" fill={glowing ? glowColor : "#1F2937"} opacity={glowing ? 0.85 : 1} />
      {/* monitor stand */}
      <rect x="6" y="-1" width="1" height="2" fill="#0A0A0B" />
      {/* lamp */}
      <rect x="13" y="-4" width="1" height="4" fill="#0A0A0B" />
      <rect x="11" y="-5" width="4" height="1.5" fill={glowing ? glowColor : "#1F2937"} />
      {glowing && (
        <ellipse
          cx="13"
          cy="-3"
          rx="6"
          ry="3"
          fill={glowColor}
          opacity="0.18"
          filter="blur(2px)"
        />
      )}
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
  const roster = useMemo(() => pickRoster(), []);
  const agentRows = useMemo(() => {
    return roster.map((a, i) => ({
      ...a,
      isPulsing: !!recent[a.key] && now - recent[a.key] < RECENT_PULSE_MS,
      // Lay out 6 agents in a 3-col x 2-row floor grid
      gridX: i % 3,
      gridY: Math.floor(i / 3),
    }));
  }, [recent, now, roster]);

  // Pixel-art office canvas dimensions (wide-aspect to match the bento card)
  const VB_W = 320;
  const VB_H = 140;

  return (
    <section
      className="card relative overflow-hidden"
      aria-label="Agent Office preview"
    >
      <header className="relative z-10 flex items-center justify-between gap-3 mb-3">
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

      {/* Pixel-art office scene */}
      <div className="relative rounded-xl overflow-hidden border border-border-subtle">
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          width="100%"
          height="auto"
          className="block"
          style={{ imageRendering: "pixelated" }}
          aria-hidden="true"
          shapeRendering="crispEdges"
        >
          <defs>
            {/* Teal floor gradient */}
            <linearGradient id="floor-grad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#134E4A" />
              <stop offset="100%" stopColor="#0F2C2A" />
            </linearGradient>
            {/* Wall gradient */}
            <linearGradient id="wall-grad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#0F766E" />
              <stop offset="100%" stopColor="#134E4A" />
            </linearGradient>
            {/* Floor tile pattern */}
            <pattern id="floor-tiles" x="0" y="0" width="32" height="16" patternUnits="userSpaceOnUse">
              <rect width="32" height="16" fill="url(#floor-grad)" />
              <line x1="0" y1="16" x2="32" y2="16" stroke="rgba(204,251,241,0.06)" strokeWidth="0.5" />
              <line x1="16" y1="0" x2="16" y2="16" stroke="rgba(204,251,241,0.04)" strokeWidth="0.5" />
            </pattern>
          </defs>

          {/* Wall (back) */}
          <rect width={VB_W} height="40" fill="url(#wall-grad)" />
          {/* Wall trim */}
          <rect y="38" width={VB_W} height="2" fill="#5EEAD4" opacity="0.40" />
          {/* Wall posters / windows */}
          <g opacity="0.65">
            <rect x="20" y="8" width="22" height="14" fill="#0A0A0B" />
            <rect x="22" y="10" width="18" height="10" fill="#2DD4BF" opacity="0.5" />
            <rect x="58" y="6" width="28" height="18" fill="#0A0A0B" />
            <rect x="60" y="8" width="24" height="14" fill="#5EEAD4" opacity="0.35" />
            <rect x="100" y="10" width="14" height="12" fill="#0A0A0B" />
            <rect x="234" y="8" width="22" height="14" fill="#0A0A0B" />
            <rect x="236" y="10" width="18" height="10" fill="#2DD4BF" opacity="0.5" />
            <rect x="270" y="6" width="32" height="18" fill="#0A0A0B" />
            <rect x="272" y="8" width="28" height="14" fill="#5EEAD4" opacity="0.35" />
          </g>

          {/* Floor */}
          <rect y="40" width={VB_W} height={VB_H - 40} fill="url(#floor-tiles)" />

          {/* Ambient teal floor glow */}
          <ellipse
            cx={VB_W / 2}
            cy={VB_H - 10}
            rx={VB_W / 2.2}
            ry="14"
            fill="#14B8A6"
            opacity="0.10"
            filter="blur(6px)"
          />

          {/* Render agents at desk positions in a 3x2 grid */}
          {agentRows.map((agent) => {
            const cellW = VB_W / 3;
            const baseX = agent.gridX * cellW + cellW / 2 - 9;
            const baseY = agent.gridY === 0 ? 60 : 100;
            const color = hexFromInt(agent.brandColor);
            return (
              <g
                key={agent.key}
                onMouseEnter={() => setHovered(agent.key)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: "pointer" }}
              >
                <PixelDesk
                  x={baseX - 3}
                  y={baseY + 23}
                  glowing={agent.isPulsing}
                  glowColor={color}
                />
                <PixelCharacter
                  x={baseX}
                  y={baseY}
                  color={color}
                  isPulsing={agent.isPulsing}
                />
              </g>
            );
          })}
        </svg>

        {/* Tooltip overlay — shown on hover */}
        {hovered && (
          <div
            className="absolute top-2 right-2 rounded-md border border-border-subtle bg-bg-surface-2 px-2 py-1.5 text-[11px] shadow-lg pointer-events-none"
            style={{ minWidth: 120 }}
          >
            <p className="font-semibold text-text-primary">
              {agentRows.find(a => a.key === hovered)?.name}
            </p>
            <p className="text-text-muted">
              {agentRows.find(a => a.key === hovered)?.role}
            </p>
          </div>
        )}
      </div>

      {/* Compact agent legend */}
      <div className="relative z-10 mt-3 flex flex-wrap gap-1.5">
        {agentRows.map((agent) => {
          const color = hexFromInt(agent.brandColor);
          return (
            <span
              key={agent.key}
              className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface-light/60 px-2 py-0.5 text-[10px]"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{
                  background: color,
                  boxShadow: agent.isPulsing ? `0 0 8px ${color}` : undefined,
                }}
              />
              <span className="text-text-primary">{agent.name}</span>
              <span className="text-text-muted">· {agent.role}</span>
            </span>
          );
        })}
      </div>
    </section>
  );
}
