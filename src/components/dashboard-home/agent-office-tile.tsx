"use client";

/**
 * AgentOfficeTile — premium dashboard preview of the Agent Office.
 *
 * Replaces the pixel-art preview the user described as "pixelated".
 * Renders each agent as a smooth circular avatar arranged in an
 * isometric grid with indigo glow, theme-matched colors, and live
 * activity pulses driven from /api/agent-office/snapshot.
 *
 * Click any avatar → routes to /dashboard/agent-office for the full
 * (live PixiJS) experience.
 *
 * Implementation:
 *   - SVG-only render. No PixiJS / R3F here, so it ships in the main
 *     dashboard bundle without code-splitting.
 *   - Each agent shows: a colored disc + name + role, plus a pulsing
 *     ring when there was a recent agent_activity_event in their
 *     watched tables. Pulse fades after 6s.
 *   - Polls the snapshot endpoint every 12s. Cheap — the snapshot is
 *     pre-built per agency and aggressively cached.
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Activity } from "lucide-react";
import { AGENTS } from "@/lib/pixel-office/agents";
import { tokens } from "@/lib/brand/tokens";

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

export default function AgentOfficeTile() {
  const [recent, setRecent] = useState<Record<string, number>>({}); // agent_key → timestamp
  const [hero, setHero] = useState<{ calls: number; leads: number; emails: number } | null>(null);
  const [, forceTick] = useState(0);

  // Poll the snapshot endpoint — same one the live PixiJS office uses.
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
            // keep the most recent timestamp per agent
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
        /* swallow — next tick will retry */
      }
    };
    void tick();
    const id = window.setInterval(tick, POLL_INTERVAL_MS);
    // 1Hz tick to expire pulses smoothly (no fetch — just rerender)
    const expireTick = window.setInterval(() => forceTick(t => (t + 1) % 1000), 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.clearInterval(expireTick);
    };
  }, []);

  const now = Date.now();
  const agentRows = useMemo(() => {
    // Use the agent's homeDesk x/y as a rough hint for layout — but we
    // collapse to a 5-column responsive grid for the smooth tile so
    // every agent is visible even on narrow viewports.
    return AGENTS.map((a) => ({
      ...a,
      isPulsing: !!recent[a.key] && now - recent[a.key] < RECENT_PULSE_MS,
      pulseAge: recent[a.key] ? now - recent[a.key] : Infinity,
    }));
  }, [recent, now]);

  return (
    <section
      className="card relative overflow-hidden"
      aria-label="Agent Office preview"
    >
      {/* Decorative indigo radial behind the agent grid for depth */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-24 h-[420px] w-[420px] rounded-full opacity-[0.10] blur-3xl"
        style={{
          background: `radial-gradient(closest-side, ${tokens.brand.accentGlow}, transparent 70%)`,
        }}
      />

      <div className="relative z-10 flex flex-col gap-4">
        <header className="flex items-center justify-between gap-3">
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

        {/* Smooth agent grid — 5-column responsive */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {agentRows.map((agent) => {
            const color = hexFromInt(agent.brandColor);
            return (
              <Link
                key={agent.key}
                href={`/dashboard/agent-office?focus=${agent.key}`}
                className="group relative flex items-center gap-2.5 rounded-xl border border-border-subtle bg-surface-light/60 px-3 py-2.5 transition-all hover:border-brand-accent/40 hover:bg-brand-accent/5"
              >
                {/* Avatar disc — uses the agent's brand color but gets an
                    indigo ring overlay so the palette stays cohesive. */}
                <span className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center">
                  <span
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: `radial-gradient(circle at 30% 30%, ${color} 0%, ${color} 50%, ${tokens.brand.accentDim} 100%)`,
                      boxShadow: `0 4px 12px -2px ${color}55, inset 0 1px 0 rgba(255,255,255,0.3)`,
                    }}
                  />
                  <span
                    className="relative font-display text-[13px] font-bold"
                    style={{ color: "#0A0A0B", textShadow: "0 1px 0 rgba(255,255,255,0.4)" }}
                  >
                    {agent.name.charAt(0)}
                  </span>
                  {agent.isPulsing && (
                    <span
                      className="pointer-events-none absolute inset-0 rounded-full animate-ping"
                      style={{ background: `${color}55` }}
                      aria-hidden
                    />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-semibold text-text-primary leading-tight">
                    {agent.name}
                  </p>
                  <p className="truncate text-[10px] text-text-muted leading-tight mt-0.5">
                    {agent.role}
                  </p>
                </div>

                {agent.isPulsing && (
                  <Activity
                    size={11}
                    className="shrink-0 text-brand-accent"
                    aria-label="Recently active"
                  />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
