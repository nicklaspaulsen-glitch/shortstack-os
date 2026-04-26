"use client";

/* ────────────────────────────────────────────────────────────────
 * Sub-task 3: SectionMarkers — colored band overlay for timeline.
 *
 * Renders three zones (intro / body / outro) as semi-transparent
 * bands overlaid on the timeline rail. Boundaries are fixed at:
 *   - Intro : 0 → introDurationMs  (default 3 s)
 *   - Outro : (total - outroDurationMs) → total  (default 3 s)
 *   - Body  : intro end → outro start
 *
 * The component is purely visual (pointer-events-none). It is
 * toggled via the `visible` prop from the parent toolbar.
 * ──────────────────────────────────────────────────────────────*/

interface SectionMarkersProps {
  /** Total timeline width in px (should equal msToPx(project.duration)). */
  totalWidthPx: number;
  /** Total timeline duration in ms. */
  totalMs: number;
  /** Height of the track-rail area (below ruler) in px. */
  trackAreaHeightPx: number;
  /** Intro section duration in ms. Default 3000. */
  introDurationMs?: number;
  /** Outro section duration in ms. Default 3000. */
  outroDurationMs?: number;
  /** Convert ms → px (matches parent's msToPx function). */
  msToPx: (ms: number) => number;
}

const SECTION_COLORS = {
  intro: "rgba(96,165,250,0.12)",    // blue-400 @ 12%
  body:  "rgba(250,204,21,0.06)",    // yellow-400 @ 6%
  outro: "rgba(239,68,68,0.12)",     // red-500 @ 12%
} as const;

const LABEL_COLOR = {
  intro: "rgba(147,197,253,0.7)",    // blue-300
  body:  "rgba(253,224,71,0.5)",     // yellow-300
  outro: "rgba(252,165,165,0.7)",    // red-300
} as const;

export function SectionMarkers({
  totalWidthPx,
  totalMs,
  trackAreaHeightPx,
  introDurationMs = 3000,
  outroDurationMs = 3000,
  msToPx,
}: SectionMarkersProps) {
  if (totalMs <= 0) return null;

  // Clamp so intro+outro never overlap (minimum 1s body).
  const safeTotalMs = Math.max(totalMs, 1000);
  const maxHalf = Math.floor(safeTotalMs / 2) - 500;
  const introMs = Math.min(introDurationMs, maxHalf);
  const outroMs = Math.min(outroDurationMs, maxHalf);
  const bodyStartMs = introMs;
  const bodyEndMs = safeTotalMs - outroMs;

  const sections: Array<{
    key: "intro" | "body" | "outro";
    startMs: number;
    endMs: number;
  }> = [
    { key: "intro", startMs: 0,          endMs: introMs    },
    { key: "body",  startMs: bodyStartMs, endMs: bodyEndMs  },
    { key: "outro", startMs: bodyEndMs,   endMs: safeTotalMs },
  ];

  return (
    <div
      className="absolute inset-0 pointer-events-none z-0"
      aria-hidden="true"
      style={{ width: totalWidthPx, height: trackAreaHeightPx }}
    >
      {sections.map(({ key, startMs, endMs }) => {
        const leftPx = msToPx(startMs);
        const widthPx = Math.max(0, msToPx(endMs) - leftPx);
        if (widthPx <= 0) return null;
        return (
          <div
            key={key}
            className="absolute top-0 bottom-0"
            style={{
              left: leftPx,
              width: widthPx,
              background: SECTION_COLORS[key],
              borderLeft: key !== "body" ? `1.5px dashed ${LABEL_COLOR[key]}` : undefined,
              borderRight: key !== "body" ? `1.5px dashed ${LABEL_COLOR[key]}` : undefined,
            }}
          >
            <span
              className="absolute top-1 left-1 text-[8px] font-semibold uppercase tracking-widest select-none"
              style={{ color: LABEL_COLOR[key], opacity: 0.8 }}
            >
              {key}
            </span>
          </div>
        );
      })}
    </div>
  );
}
