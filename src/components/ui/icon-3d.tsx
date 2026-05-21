'use client';

import React from 'react';

// icon-3d.tsx — 3D extruded icons + halftone patterns
// Exports: Icon3D, IsoIcon, HalftonePattern

// ---------------------------------------------------------------------------
// Path dictionary — all paths drawn on a 64×64 viewBox
// ---------------------------------------------------------------------------

type IconName = keyof typeof Icon3DPaths;

const Icon3DPaths = {
  home: (
    <path d="M10 30 L32 12 L54 30 L54 52 L40 52 L40 36 L24 36 L24 52 L10 52 Z" />
  ),
  grid: (
    <g>
      <rect x="10" y="10" width="20" height="20" rx="3" />
      <rect x="34" y="10" width="20" height="20" rx="3" />
      <rect x="10" y="34" width="20" height="20" rx="3" />
      <rect x="34" y="34" width="20" height="20" rx="3" />
    </g>
  ),
  stack: (
    <g>
      <path d="M32 8 L56 20 L32 32 L8 20 Z" />
      <path d="M8 32 L32 44 L56 32" />
      <path d="M8 44 L32 56 L56 44" />
    </g>
  ),
  chart: (
    <g>
      <path d="M8 8 V56 H56" />
      <path d="M16 40 L26 30 L34 36 L48 18" />
    </g>
  ),
  inbox: (
    <g>
      <path d="M10 32 L18 12 H46 L54 32" />
      <path d="M10 32 V52 H54 V32" />
      <path d="M10 32 H22 L26 38 H38 L42 32 H54" />
    </g>
  ),
  team: (
    <g>
      <circle cx="24" cy="20" r="8" />
      <path d="M8 52 c0-9 7-16 16-16 s16 7 16 16" />
      <circle cx="46" cy="24" r="7" />
      <path d="M40 52 c0-7 5-13 12-15" />
    </g>
  ),
  target: (
    <g>
      <circle cx="32" cy="32" r="22" />
      <circle cx="32" cy="32" r="14" />
      <circle cx="32" cy="32" r="4" fill="currentColor" />
    </g>
  ),
  doc: (
    <g>
      <path d="M38 8 H16 a4 4 0 0 0-4 4 v40 a4 4 0 0 0 4 4 h32 a4 4 0 0 0 4-4 V22 Z" />
      <path d="M38 8 V22 H52" />
      <path d="M20 34 H44 M20 42 H38" />
    </g>
  ),
  bolt: (
    <path d="M34 6 L12 36 H30 L26 58 L52 26 H34 L38 6 Z" />
  ),
  settings: (
    <g>
      <circle cx="32" cy="32" r="8" />
      <path d="M52 32 a20 20 0 0 0-.5-4 l4-3-4-7-5 1.5 a20 20 0 0 0-7-4 L39 10 H31 L29.5 15.5 a20 20 0 0 0-7 4 L17.5 18 l-4 7 4 3 A20 20 0 0 0 17 36 L13 39 l4 7 5-1.5 a20 20 0 0 0 7 4 L31 54 h8 L40.5 48.5 a20 20 0 0 0 7-4 l5 1.5 4-7-4-3 A20 20 0 0 0 52 32 Z" />
    </g>
  ),
  thumb: (
    <g>
      <rect x="6" y="12" width="52" height="38" rx="4" />
      <circle cx="20" cy="26" r="4" />
      <path d="M6 44 L22 30 L36 42 L46 34 L58 46" />
    </g>
  ),
  video: (
    <g>
      <rect x="6" y="14" width="38" height="36" rx="4" />
      <path d="M58 18 L46 26 V38 L58 46 Z" />
    </g>
  ),
  edit: (
    <g>
      <path d="M8 50 L20 38 L26 44 L14 56 Z" transform="translate(0,-6)" />
      <path d="M22 36 L38 20 L44 26 L28 42 Z" />
      <path d="M40 18 L48 10 L54 16 L46 24 Z" />
    </g>
  ),
  social: (
    <g>
      <circle cx="14" cy="16" r="6" />
      <circle cx="50" cy="16" r="6" />
      <circle cx="32" cy="48" r="6" />
      <path d="M18 18 L46 18 M16 22 L30 44 M48 22 L34 44" />
    </g>
  ),
  library: (
    <g>
      <rect x="8" y="10" width="48" height="44" rx="4" />
      <path d="M20 10 V54 M8 24 H56 M32 24 V54" />
    </g>
  ),
  brand: (
    <g>
      <path d="M16 12 H44 L52 22 L32 52 L12 22 Z" />
      <path d="M16 12 L32 22 L48 12 M12 22 H52 M32 22 V52" />
    </g>
  ),
  play: (
    <path d="M14 8 V56 L54 32 Z" />
  ),
  sparkle: (
    <g>
      <path d="M32 6 L36 26 L56 32 L36 38 L32 58 L28 38 L8 32 L28 26 Z" />
    </g>
  ),
} as const;

// ---------------------------------------------------------------------------
// Icon3D — 3D extruded icon with perspective container
// ---------------------------------------------------------------------------

export interface Icon3DProps {
  name: IconName;
  size?: number;
  /** Number of stacked layers (extrusion depth). Default 6. */
  depth?: number;
  /** Fill/stroke color. Defaults to chartreuse lime. */
  color?: string;
  /** Apply an isometric tilt. Default true. */
  tilt?: boolean;
  /** Continuously spin the icon. Default false. */
  spin?: boolean;
  /** Add a drop-shadow glow. Default false. */
  glow?: boolean;
  style?: React.CSSProperties;
}

export function Icon3D({
  name,
  size = 28,
  depth = 6,
  color,
  tilt = true,
  spin = false,
  glow = false,
  style,
}: Icon3DProps) {
  const layers = depth;
  const front = color ?? 'oklch(0.88 0.18 130)';
  const paths = Icon3DPaths[name] ?? Icon3DPaths.grid;

  return (
    <div
      style={{
        width: size,
        height: size,
        position: 'relative',
        perspective: 360,
        display: 'inline-block',
        ...style,
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          transformStyle: 'preserve-3d',
          transform: tilt ? 'rotateX(18deg) rotateY(-22deg)' : 'none',
          animation: spin ? 'spin3d 12s linear infinite' : undefined,
          filter: glow
            ? `drop-shadow(0 8px 14px color-mix(in oklch, ${front}, transparent 55%))`
            : undefined,
        }}
      >
        {Array.from({ length: layers }).map((_, i) => {
          const t = i / Math.max(1, layers - 1); // 0=back, 1=front
          const z = i - layers + 1; // negative=behind, 0=front
          return (
            <svg
              key={i}
              viewBox="0 0 64 64"
              width={size}
              height={size}
              fill="none"
              stroke={`color-mix(in oklch, ${front}, black ${(1 - t) * 45}%)`}
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                position: 'absolute',
                inset: 0,
                transform: `translateZ(${z * 1.2}px)`,
                opacity: 0.4 + 0.6 * t,
              }}
            >
              {paths}
            </svg>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// IsoIcon — flat/shadow-stacked icon (no perspective, sidebar-friendly)
// ---------------------------------------------------------------------------

export interface IsoIconProps {
  name: IconName;
  size?: number;
  /** Stroke color. Defaults to currentColor. */
  color?: string;
}

export function IsoIcon({ name, size = 18, color }: IsoIconProps) {
  const front = color ?? 'currentColor';
  const paths = Icon3DPaths[name] ?? Icon3DPaths.grid;

  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        position: 'relative',
      }}
    >
      {([0, 1, 2] as const).map((i) => (
        <svg
          key={i}
          viewBox="0 0 64 64"
          width={size}
          height={size}
          fill="none"
          stroke={front}
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            position: 'absolute',
            inset: 0,
            transform: `translate(${-i * 0.8}px, ${i * 0.8}px)`,
            opacity: i === 0 ? 1 : i === 1 ? 0.45 : 0.2,
          }}
        >
          {paths}
        </svg>
      ))}
    </span>
  );
}

// ---------------------------------------------------------------------------
// HalftonePattern — procedural dot-matrix SVG pattern
// ---------------------------------------------------------------------------

export type HalftoneMode = 'radial' | 'linear' | 'wave' | 'circle' | 'diag';

export interface HalftonePatternProps {
  width?: number;
  height?: number;
  /** Maximum dot radius. Default 4. */
  dot?: number;
  /** Grid spacing between dot centres. Default 8. */
  gap?: number;
  color?: string;
  mode?: HalftoneMode;
  /** Phase offset for wave/circle modes (radians). Default 0. */
  phase?: number;
  opacity?: number;
  style?: React.CSSProperties;
}

export function HalftonePattern({
  width = 320,
  height = 180,
  dot = 4,
  gap = 8,
  color = 'currentColor',
  mode = 'radial',
  phase = 0,
  opacity = 1,
  style,
}: HalftonePatternProps) {
  const cols = Math.floor(width / gap);
  const rows = Math.floor(height / gap);
  const maxR = dot / 2;
  const items: React.ReactElement[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * gap + gap / 2;
      const y = r * gap + gap / 2;
      let v = 0;

      if (mode === 'radial') {
        const dx = x - width / 2;
        const dy = y - height / 2;
        const d = Math.sqrt(dx * dx + dy * dy);
        const maxD = Math.sqrt(width * width + height * height) / 2;
        v = 1 - d / maxD;
      } else if (mode === 'linear') {
        v = 1 - x / width;
      } else if (mode === 'wave') {
        v =
          0.5 +
          0.5 *
            Math.sin(
              (x / width) * Math.PI * 4 + phase + (y / height) * Math.PI * 2,
            );
      } else if (mode === 'circle') {
        const dx = x - width / 2;
        const dy = y - height / 2;
        const d = Math.sqrt(dx * dx + dy * dy);
        v = 0.5 + 0.5 * Math.sin(d / 6 + phase);
      } else if (mode === 'diag') {
        v = (x + y) / (width + height);
      }

      v = Math.max(0, Math.min(1, v));
      const rad = v * maxR;
      if (rad > 0.2) {
        items.push(
          <circle key={`${r}-${c}`} cx={x} cy={y} r={rad} fill={color} />,
        );
      }
    }
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ opacity, display: 'block', ...style }}
    >
      {items}
    </svg>
  );
}
