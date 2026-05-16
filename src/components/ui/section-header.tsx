"use client";

/**
 * SectionHeader — editorial heading with optional Bodoni Moda italic accent.
 *
 * Design reference: PrimeStay (memory/design_references_may8.md).
 * One italic serif word per section header creates the "magazine editorial"
 * tension between the Satoshi sans-serif body and a warm old-style accent.
 *
 * Usage:
 *   // One italic accent word inline with the rest of the heading
 *   <SectionHeader heading="Revenue" accent="Performance" />
 *   // → "Revenue *Performance*"  (Performance in Bodoni Moda italic)
 *
 *   // Accent word BEFORE the main heading
 *   <SectionHeader heading="Pipeline" accent="Active" accentPosition="before" />
 *   // → "*Active* Pipeline"
 *
 *   // No accent — plain Satoshi heading
 *   <SectionHeader heading="Settings" />
 *
 *   // With subtitle and eyebrow
 *   <SectionHeader
 *     eyebrow="May 2026"
 *     heading="Client Health"
 *     accent="Scores"
 *     subtitle="Aggregate health across your entire book of business."
 *   />
 *
 * NOTE: font-editorial was retired (Apr 28) and now maps to Satoshi.
 * The .section-header-italic class in globals.css carries the explicit
 * font-family override that brings Bodoni Moda back for accent words only.
 * The class is scoped — it never leaks into other heading elements.
 */

import type { ReactNode } from "react";

type HeadingLevel = "h1" | "h2" | "h3" | "h4";

interface SectionHeaderProps {
  /** The primary heading text. If `accent` is set, this is the non-italic portion. */
  heading: string;
  /**
   * The one italic-serif accent word. Rendered in Bodoni Moda italic.
   * Keep this to ONE word or a very short phrase — more than ~3 words
   * breaks the visual rhythm. If omitted, heading renders as plain Satoshi.
   */
  accent?: string;
  /**
   * Where the accent word appears relative to `heading`.
   * - "after"  (default): heading then italic accent  → "Revenue *Performance*"
   * - "before": italic accent then heading             → "*Active* Pipeline"
   */
  accentPosition?: "before" | "after";
  /** Small label above the heading (e.g. "May 2026" or "Phase 1"). Satoshi mono. */
  eyebrow?: string;
  /** Subtitle / supporting sentence below the heading. */
  subtitle?: string;
  /** HTML heading element level. Defaults to h2. */
  as?: HeadingLevel;
  /** Extra class names on the wrapper div. */
  className?: string;
  /** Rendered after the heading+subtitle block — use for action buttons. */
  actions?: ReactNode;
  /** When true, the bottom border separator is shown (default: false). */
  divider?: boolean;
}

export function SectionHeader({
  heading,
  accent,
  accentPosition = "after",
  eyebrow,
  subtitle,
  as: Tag = "h2",
  className = "",
  actions,
  divider = false,
}: SectionHeaderProps) {
  const headingContent = accent ? (
    accentPosition === "before" ? (
      <>
        <em className="section-header-italic not-italic">{accent}</em>
        {" "}
        {heading}
      </>
    ) : (
      <>
        {heading}
        {" "}
        <em className="section-header-italic not-italic">{accent}</em>
      </>
    )
  ) : (
    heading
  );

  return (
    <div
      className={[
        "flex items-end justify-between gap-4",
        divider ? "pb-4 border-b border-border-subtle" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="font-mono text-[10px] uppercase tracking-[0.8px] text-text-muted mb-1.5">
            {eyebrow}
          </p>
        )}
        <Tag className="font-display text-xl font-semibold tracking-[-0.02em] text-text-primary leading-snug">
          {headingContent}
        </Tag>
        {subtitle && (
          <p className="text-sm text-text-secondary leading-relaxed mt-1 max-w-2xl">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  );
}

export default SectionHeader;
