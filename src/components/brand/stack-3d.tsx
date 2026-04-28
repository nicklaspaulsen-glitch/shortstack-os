"use client";

/**
 * Stack3D — the signature ShortStack brand mark.
 *
 * Apr 28 v4: rewired to render the new MandalaMark internally. Previously
 * this component R3F-rendered three offset rectangular slabs (the
 * "purple block stack" the user flagged as the OLD logo). All 10 call
 * sites now automatically pick up the new 3-tier stacked-shape glyph
 * via the same `<Stack3D size="..." rotating />` API — no per-page
 * refactor needed.
 *
 * Sizes map straight to MandalaMark:
 *   sm (64px)  → MandalaMark sm  (32px)
 *   md (128px) → MandalaMark md  (64px)
 *   lg (256px) → MandalaMark lg  (128px)
 *
 * The R3F + three.js canvas (stack-3d-canvas.tsx) is no longer used by
 * this wrapper but kept on disk in case any direct importer references
 * it. New code should not import the canvas directly.
 */

import MandalaMark, { type MandalaMarkSize } from "./mandala-mark";

export type Stack3DSize = "sm" | "md" | "lg";

interface Stack3DProps {
  /** Visual size — sm=64px, md=128px, lg=256px. */
  size?: Stack3DSize;
  /** Whether the mark slowly rotates around Y. Defaults to true. */
  rotating?: boolean;
  /** Additional className applied to the wrapping element. */
  className?: string;
}

const STACK_TO_MANDALA: Record<Stack3DSize, MandalaMarkSize> = {
  sm: "sm",
  md: "md",
  lg: "lg",
};

export default function Stack3D({
  size = "md",
  rotating = true,
  className = "",
}: Stack3DProps) {
  return (
    <MandalaMark
      size={STACK_TO_MANDALA[size]}
      spinning={rotating}
      className={className}
    />
  );
}
