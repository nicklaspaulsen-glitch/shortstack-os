"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Brain, ArrowRight } from "lucide-react";
import PageHero from "@/components/ui/page-hero";
import RoomCanvas from "@/components/agent-room/room-canvas";

// Kumospace-inspired live agent room. Every in-app agent + every third-party
// integration is rendered as a drifting avatar inside a themed zone. Avatars
// pulse green when they've run in the last 5 minutes, amber for runs in
// the last hour, red when half or more recent runs failed, and slate when
// the integration's env vars aren't set at all.
//
// Click an avatar → side drawer with the latest run, error count, and a
// jump-link into that agent's page.

type TrinityMode = "off" | "shadow" | "autopilot";

const MODE_DESCRIPTIONS: Record<TrinityMode, string> = {
  off: "Trinity will not act on its own.",
  shadow: "Trinity proposes — you approve before anything runs.",
  autopilot: "Trinity acts after the veto window unless you stop it.",
};

export default function AgentRoomPage() {
  const [mode, setMode] = useState<TrinityMode | null>(null);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [s, p] = await Promise.all([
          fetch("/api/trinity/settings"),
          fetch("/api/trinity/proposals?status=proposed&limit=1"),
        ]);
        if (cancelled) return;
        if (s.ok) {
          const data = (await s.json()) as { settings: { mode: TrinityMode } };
          setMode(data.settings.mode);
        }
        if (p.ok) {
          const data = (await p.json()) as {
            proposals: { id: string }[];
          };
          setPendingCount(data.proposals?.length ?? 0);
        }
      } catch (err) {
        console.error("[agent-room] trinity status load failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const switchMode = async (next: TrinityMode) => {
    setSaving(true);
    try {
      const res = await fetch("/api/trinity/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: next }),
      });
      if (res.ok) setMode(next);
    } catch (err) {
      console.error("[agent-room] mode switch failed", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fade-in space-y-5">
      <PageHero
        icon={<Users size={28} />}
        title="Agent Room"
        subtitle="Live view of every agent in your agency — their zones, status, and last runs."
        gradient="gold"
      />

      {/* Trinity autonomous mode strip */}
      <div className="card flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 text-purple-300">
            <Brain size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">
              Trinity Autonomous{" "}
              {pendingCount !== null && pendingCount > 0 && (
                <span className="ml-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                  {pendingCount} pending
                </span>
              )}
            </h3>
            <p className="text-xs text-muted">
              {mode ? MODE_DESCRIPTIONS[mode] : "Loading status..."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-1">
            {(["off", "shadow", "autopilot"] as TrinityMode[]).map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                disabled={saving || mode === m}
                className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition ${
                  mode === m
                    ? "bg-purple-500/20 text-purple-200"
                    : "text-muted hover:text-white"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <Link
            href="/dashboard/trinity/proposals"
            className="flex items-center gap-1.5 rounded-lg bg-purple-500/10 px-3 py-2 text-xs font-bold text-purple-300 hover:bg-purple-500/20"
          >
            Proposals
            <ArrowRight size={12} />
          </Link>
        </div>
      </div>

      <RoomCanvas />
    </div>
  );
}
