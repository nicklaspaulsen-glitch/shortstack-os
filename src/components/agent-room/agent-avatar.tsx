"use client";

import { motion, type PanInfo } from "framer-motion";
import { useRef } from "react";
import type { AgentDef } from "./roster";

export type AgentStatus = "live" | "recent" | "idle" | "error" | "disabled";

// Colors per status. Idle = low-contrast gray, live = green pulse, error =
// red flash, recent = amber, disabled = slate with a 45% opacity.
const STATUS_STYLE: Record<AgentStatus, {
  ring: string; badge: string; glow: string; dot: string; label: string;
}> = {
  live: {
    ring: "ring-emerald-400/70",
    badge: "bg-emerald-400 text-emerald-950",
    glow: "shadow-[0_0_24px_6px_rgba(52,211,153,0.45)]",
    dot: "bg-emerald-300",
    label: "Live",
  },
  recent: {
    ring: "ring-amber-400/60",
    badge: "bg-amber-400 text-amber-950",
    glow: "shadow-[0_0_12px_3px_rgba(251,191,36,0.3)]",
    dot: "bg-amber-300",
    label: "Recent",
  },
  idle: {
    // Bumped from ring-white/15 → ring-white/35 because at 15% the ring
    // basically dissolved into the dark room canvas — Nicklas reported
    // the avatars looked "missing" entirely on first glance. This is
    // visible without being loud.
    ring: "ring-white/35",
    badge: "bg-white/10 text-white/70",
    glow: "",
    dot: "bg-white/45",
    label: "Idle",
  },
  error: {
    ring: "ring-red-400/70",
    badge: "bg-red-400 text-red-950",
    glow: "shadow-[0_0_24px_6px_rgba(248,113,113,0.45)]",
    dot: "bg-red-300",
    label: "Error",
  },
  disabled: {
    ring: "ring-slate-600/40",
    badge: "bg-slate-700 text-slate-300",
    glow: "",
    dot: "bg-slate-500",
    label: "Disabled",
  },
};

interface Props {
  agent: AgentDef;
  status: AgentStatus;
  x: number; // % of container
  y: number;
  onClick: () => void;
  /** Called when the user finishes dragging. Delta values are in % of container. */
  onDragEnd?: (id: string, deltaXPct: number, deltaYPct: number) => void;
  /** px dimensions of the room container — needed to convert px drag delta → % */
  containerWidth?: number;
  containerHeight?: number;
  selected?: boolean;
}

// Small drifting avatar. Uses translate(-50%, -50%) so the x/y percentage
// represents the avatar's center. The whole thing is absolute-positioned
// by the parent room canvas.
export default function AgentAvatar({
  agent,
  status,
  x,
  y,
  onClick,
  onDragEnd,
  containerWidth = 0,
  containerHeight = 0,
  selected,
}: Props) {
  const s = STATUS_STYLE[status];
  // Pseudo-random drift per agent id so the room feels alive but each
  // avatar animates distinctly. Seeded from the id so it stays stable
  // across renders.
  const seed = hashString(agent.id);
  const driftX = (seed % 40) / 10 - 2;      // -2 .. +2 px
  const driftY = ((seed >> 3) % 40) / 10 - 2;
  const delay = ((seed >> 7) % 50) / 10;    // 0 .. 5 s

  // Track whether the pointer moved enough to be a drag (vs a click).
  const isDraggingRef = useRef(false);

  const handleDragStart = () => {
    isDraggingRef.current = false;
  };

  const handleDrag = (_: PointerEvent, info: PanInfo) => {
    if (Math.abs(info.offset.x) > 4 || Math.abs(info.offset.y) > 4) {
      isDraggingRef.current = true;
    }
  };

  const handleDragEnd = (_: PointerEvent, info: PanInfo) => {
    if (!isDraggingRef.current || !onDragEnd) return;
    const dxPct = containerWidth > 0 ? (info.offset.x / containerWidth) * 100 : 0;
    const dyPct = containerHeight > 0 ? (info.offset.y / containerHeight) * 100 : 0;
    onDragEnd(agent.id, dxPct, dyPct);
  };

  const handleClick = () => {
    // Only fire onClick when the pointer didn't travel (i.e. it's a tap, not a drag).
    if (!isDraggingRef.current) onClick();
  };

  return (
    <motion.div
      drag
      dragMomentum={false}
      dragElastic={0.08}
      // Reset drag offset after dragEnd — the committed position is baked
      // into x/y props so the drag origin snaps back to zero.
      dragConstraints={{ left: 0, top: 0, right: 0, bottom: 0 }}
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      aria-label={`${agent.name} — ${s.label}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(); }}
      className="absolute group -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing focus:outline-none"
      style={{ left: `${x}%`, top: `${y}%` }}
      whileDrag={{ scale: 1.15, zIndex: 50, cursor: "grabbing" }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{
          opacity: 1,
          scale: 1,
          x: [0, driftX, 0],
          y: [0, driftY, 0],
        }}
        transition={{
          opacity: { duration: 0.3 },
          scale: { duration: 0.3, type: "spring", stiffness: 200 },
          x: { duration: 6, repeat: Infinity, ease: "easeInOut", delay },
          y: { duration: 7, repeat: Infinity, ease: "easeInOut", delay },
        }}
        className="relative pointer-events-none"
      >
        {/* Halo pulse — only when live/error so idle avatars are calm */}
        {(status === "live" || status === "error") && (
          <motion.span
            aria-hidden
            className={`absolute inset-0 rounded-full ${s.glow}`}
            animate={{ scale: [1, 1.4, 1], opacity: [0.8, 0, 0.8] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        )}

        {/* Avatar bubble. Background bumped from slate-900/85 →
            slate-800/95 so the bubble actually pops against the dark
            room canvas (which is itself bg-slate-900→slate-950→black).
            Emojis are now legible even on the calmer idle status. */}
        <div
          className={`relative w-12 h-12 md:w-14 md:h-14 rounded-full bg-slate-800/95 border border-white/15 backdrop-blur ring-2 ${
            s.ring
          } ${s.glow} flex items-center justify-center text-[22px] md:text-[26px] transition-all duration-200 group-hover:scale-110 ${
            selected ? "ring-4 ring-offset-2 ring-offset-slate-950 ring-gold" : ""
          }`}
        >
          <span aria-hidden>{agent.emoji}</span>
          {/* Status dot */}
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900 ${s.dot}`}
          />
        </div>

        {/* Hover nameplate */}
        <div className="pointer-events-none absolute left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-slate-900/95 border border-white/10 rounded-md px-2 py-0.5 text-[10px] font-medium text-white shadow-lg">
            {agent.name}
            <span className={`ml-1.5 inline-block align-middle px-1 py-0.5 rounded text-[8px] ${s.badge}`}>
              {s.label}
            </span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Tiny string → int hash used only to seed per-avatar drift/delay.
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}
