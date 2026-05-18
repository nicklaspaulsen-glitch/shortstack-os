"use client";

/**
 * AgentOfficeTile — Apr 28 v12 reuse.
 *
 * Now a thin wrapper around the shared `KumoScene` component (which
 * also drives the full /dashboard/agent-office page). Same hyper-
 * realistic Kumospace-style office, just sized for the dashboard tile.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import KumoScene, { AgentLegendPills } from "@/components/agent-office/kumo-scene";

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

  return (
    <section className="glass rounded-xl p-4 relative overflow-hidden" aria-label="Agent Office preview">
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

      <KumoScene
        variant="tile"
        recent={recent}
        hovered={hovered}
        setHovered={setHovered}
      />

      <div className="relative z-10 mt-3">
        <AgentLegendPills recent={recent} />
      </div>
    </section>
  );
}
