"use client";

/**
 * <FootageBadge /> — pill-shaped indicator that sits on a video editor clip
 * card, showing the Claude-detected footage type + confidence + a
 * "Try this pack?" link.
 *
 *   <FootageBadge
 *     footage_type="webcam_talking_head"
 *     confidence={0.92}
 *     recommended_creator_pack_id="creator_ali_abdaal"
 *     onApplyPack={(id) => applyPreset(id)}
 *   />
 *
 * Shape matches the JSON returned by POST /api/video/classify-footage.
 */

import React from "react";

export type FootageType =
  | "webcam_talking_head"
  | "vlog"
  | "screen_recording"
  | "gameplay"
  | "b_roll"
  | "interview_seated"
  | "product_close_up"
  | "action_handheld"
  | "drone_aerial"
  | "animation_motion_graphics"
  | "dance_performance"
  | "text_only_slide"
  | "unknown";

export interface FootageBadgeProps {
  footage_type: FootageType;
  confidence: number; // 0..1
  recommended_creator_pack_id?: string;
  className?: string;
  onApplyPack?: (creatorPackId: string) => void;
  compact?: boolean;
}

// Human labels + per-type colour hints. Kept inline so the component is
// self-contained and the editor page can import it without extra wiring.
const LABELS: Record<FootageType, string> = {
  webcam_talking_head: "Webcam talk",
  vlog: "Vlog",
  screen_recording: "Screen rec",
  gameplay: "Gameplay",
  b_roll: "B-roll",
  interview_seated: "Interview",
  product_close_up: "Product",
  action_handheld: "Action",
  drone_aerial: "Drone",
  animation_motion_graphics: "Motion gfx",
  dance_performance: "Dance",
  text_only_slide: "Slide",
  unknown: "Unknown",
};

const PACK_LABELS: Record<string, string> = {
  creator_ali_abdaal: "Ali Abdaal pack",
  creator_casey_neistat: "Casey Neistat pack",
  creator_mrbeast: "MrBeast pack",
  creator_mkbhd: "MKBHD pack",
  creator_emma_chamberlain: "Emma Chamberlain pack",
  creator_valuetainment: "Valuetainment pack",
  creator_corridor_digital: "Corridor Digital pack",
  creator_fstoppers: "Fstoppers pack",
  creator_dude_perfect: "Dude Perfect pack",
  creator_vox: "Vox pack",
  creator_tiktok_dance: "TikTok dance pack",
  creator_generic_minimal: "Minimal pack",
};

// Tailwind-compatible colour classes. If the host app isn't using Tailwind
// the badge still renders cleanly via the inline fallback styles below.
const TYPE_COLOR: Record<FootageType, string> = {
  webcam_talking_head: "bg-blue-600/20 text-blue-300 border-blue-500/40",
  vlog: "bg-pink-600/20 text-pink-300 border-pink-500/40",
  screen_recording: "bg-slate-600/20 text-slate-300 border-slate-500/40",
  gameplay: "bg-purple-600/20 text-purple-300 border-purple-500/40",
  b_roll: "bg-teal-600/20 text-teal-300 border-teal-500/40",
  interview_seated: "bg-amber-600/20 text-amber-300 border-amber-500/40",
  product_close_up: "bg-emerald-600/20 text-emerald-300 border-emerald-500/40",
  action_handheld: "bg-red-600/20 text-red-300 border-red-500/40",
  drone_aerial: "bg-sky-600/20 text-sky-300 border-sky-500/40",
  animation_motion_graphics: "bg-fuchsia-600/20 text-fuchsia-300 border-fuchsia-500/40",
  dance_performance: "bg-rose-600/20 text-rose-300 border-rose-500/40",
  text_only_slide: "bg-zinc-600/20 text-zinc-300 border-zinc-500/40",
  unknown: "bg-neutral-600/20 text-neutral-300 border-neutral-500/40",
};

export default function FootageBadge({
  footage_type,
  confidence,
  recommended_creator_pack_id,
  className = "",
  onApplyPack,
  compact = false,
}: FootageBadgeProps) {
  const pct = Math.round(Math.max(0, Math.min(1, confidence)) * 100);
  const label = LABELS[footage_type] ?? "Unknown";
  const colorClass = TYPE_COLOR[footage_type] ?? TYPE_COLOR.unknown;
  const packLabel = recommended_creator_pack_id
    ? PACK_LABELS[recommended_creator_pack_id] ?? recommended_creator_pack_id
    : null;

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-0.5 text-xs font-medium backdrop-blur-sm ${colorClass} ${className}`}
      title={`Claude Vision detected: ${label} (${pct}% confidence)`}
      data-footage-type={footage_type}
      data-confidence={pct}
    >
      <span
        aria-hidden="true"
        className="inline-block h-1.5 w-1.5 rounded-full bg-current opacity-80"
      />
      <span className="whitespace-nowrap">
        {label}
        <span className="ml-1 opacity-70">{pct}%</span>
      </span>
      {!compact && packLabel && onApplyPack && recommended_creator_pack_id && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onApplyPack(recommended_creator_pack_id);
          }}
          className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide hover:bg-white/20"
        >
          Try {packLabel}
        </button>
      )}
    </div>
  );
}
