"use client";

/**
 * Compact legend strip below the canvas — name + role + brand swatch
 * for every agent. Click a chip to focus that agent in the canvas
 * (drives the side panel). Doubles as a "what am I looking at?"
 * reference for first-time visitors.
 */

import { AGENTS } from "@/lib/pixel-office/agents";

interface LegendProps {
  selectedKey: string | null;
  onSelect: (key: string) => void;
}

export default function AgentLegend({ selectedKey, onSelect }: LegendProps) {
  return (
    <div className="flex flex-wrap items-stretch gap-2">
      {AGENTS.map((agent) => {
        const brand = `#${agent.brandColor.toString(16).padStart(6, "0")}`;
        const active = selectedKey === agent.key;
        return (
          <button
            key={agent.key}
            onClick={() => onSelect(agent.key)}
            className={`group flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition ${
              active
                ? "border-border bg-white/[0.06]"
                : "border-border bg-white/[0.02] hover:border-border hover:bg-white/[0.04]"
            }`}
            aria-pressed={active}
          >
            <span
              className="block h-3 w-3 shrink-0 rounded-sm"
              style={{
                background: brand,
                boxShadow: `0 0 8px ${brand}80, inset 0 0 0 1px ${brand}`,
              }}
            />
            <span className="flex flex-col leading-tight">
              <span className="text-xs font-bold text-white">{agent.name}</span>
              <span className="text-[10px] uppercase tracking-wide text-muted">
                {agent.role}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
