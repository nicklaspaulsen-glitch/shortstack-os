"use client";

/**
 * AvatarGroup — Framer-style stacked avatar group with optional pulse ring.
 *
 * Renders overlapping avatar circles with a border ring and
 * an overflow count badge (+N). Supports a pulsing ring animation
 * on the first/active avatar (e.g. for "online" status).
 *
 * Usage:
 *   <AvatarGroup avatars={members} max={4} pulse />
 *
 * Props:
 *   avatars   — array of avatar definitions
 *   max       — max avatars shown before "+N" badge (default: 4)
 *   size      — avatar size in px (default: 32)
 *   overlap   — px overlap between avatars (default: 10)
 *   pulse     — show pulsing ring on first avatar (default: false)
 *   pulseColor — pulse ring color (default: "#3B82F6")
 *   showCount — whether to show +N overflow badge (default: true)
 */

import Image from "next/image";
import { motion } from "framer-motion";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AvatarDef {
  id: string;
  src?: string;
  initials?: string;
  /** Optional background color for initials fallback */
  color?: string;
  alt?: string;
  /** Show a status dot */
  status?: "online" | "away" | "offline";
}

interface AvatarGroupProps {
  avatars: AvatarDef[];
  max?: number;
  size?: number;
  overlap?: number;
  pulse?: boolean;
  pulseColor?: string;
  showCount?: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Status dot colors
// ---------------------------------------------------------------------------

const STATUS_COLORS = {
  online:  "#22C55E",
  away:    "#F59E0B",
  offline: "#6B7280",
};

// ---------------------------------------------------------------------------
// Single Avatar
// ---------------------------------------------------------------------------

interface AvatarCellProps {
  avatar: AvatarDef;
  size: number;
  borderColor?: string;
  style?: React.CSSProperties;
  pulse?: boolean;
  pulseColor?: string;
}

function AvatarCell({ avatar, size, style, pulse, pulseColor = "#3B82F6" }: AvatarCellProps) {
  const fontSize = Math.round(size * 0.38);
  const dotSize  = Math.round(size * 0.30);

  return (
    <div
      className="relative shrink-0 rounded-full"
      style={{ width: size, height: size, ...style }}
    >
      {/* Pulse ring — outer animated ring */}
      {pulse && (
        <>
          <motion.div
            className="absolute rounded-full pointer-events-none"
            style={{
              inset: -3,
              border: `2px solid ${pulseColor}`,
            }}
            animate={{ scale: [1, 1.35, 1], opacity: [0.8, 0, 0.8] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute rounded-full pointer-events-none"
            style={{ inset: -1, border: `1.5px solid ${pulseColor}66` }}
          />
        </>
      )}

      {/* Avatar image or initials */}
      <div
        className="relative w-full h-full rounded-full overflow-hidden flex items-center justify-center"
        style={{
          background: avatar.color ?? "rgba(30,35,56,1)",
          border: "2px solid #0D1120",
        }}
      >
        {avatar.src ? (
          <Image
            src={avatar.src}
            alt={avatar.alt ?? avatar.initials ?? "Avatar"}
            fill
            className="object-cover"
            sizes={`${size}px`}
          />
        ) : (
          <span
            className="font-semibold select-none"
            style={{ fontSize, color: "#fff", lineHeight: 1 }}
          >
            {(avatar.initials ?? "?").slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>

      {/* Status dot */}
      {avatar.status && (
        <span
          className="absolute bottom-0 right-0 rounded-full border-2 border-[#0D1120]"
          style={{
            width: dotSize,
            height: dotSize,
            background: STATUS_COLORS[avatar.status],
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AvatarGroup
// ---------------------------------------------------------------------------

export function AvatarGroup({
  avatars,
  max = 4,
  size = 32,
  overlap = 10,
  pulse = false,
  pulseColor = "#3B82F6",
  showCount = true,
  className = "",
}: AvatarGroupProps) {
  const visible  = avatars.slice(0, max);
  const overflow = avatars.length - max;

  const itemStyle = (i: number): React.CSSProperties => ({
    marginLeft: i === 0 ? 0 : -overlap,
    zIndex: visible.length - i,
  });

  return (
    <div className={`flex items-center ${className}`}>
      {visible.map((av, i) => (
        <motion.div
          key={av.id}
          style={itemStyle(i)}
          initial={{ opacity: 0, scale: 0.7, x: -4 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          transition={{ duration: 0.3, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
        >
          <AvatarCell
            avatar={av}
            size={size}
            pulse={pulse && i === 0}
            pulseColor={pulseColor}
          />
        </motion.div>
      ))}

      {/* Overflow count badge */}
      {showCount && overflow > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: visible.length * 0.06, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center justify-center rounded-full font-semibold shrink-0"
          style={{
            width: size,
            height: size,
            marginLeft: -overlap,
            fontSize: Math.round(size * 0.32),
            background: "rgba(30,35,56,1)",
            border: "2px solid #0D1120",
            color: "#A8A8B2",
            zIndex: 0,
          }}
        >
          +{overflow}
        </motion.div>
      )}
    </div>
  );
}
