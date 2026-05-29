// ──────────────────────────────────────────────────────────────────────
// Shared types for the editing style + caption systems.
// Split out so both editing-styles.ts and the captions route can import
// without circular deps.
// ──────────────────────────────────────────────────────────────────────

/** The 6 caption style ids supported by the captions route. */
export type CaptionStyleId =
  | "hormozi-bounce"
  | "mrbeast-pop"
  | "clean-sans"
  | "kinetic-colour"
  | "subtle-lower-third"
  | "vlog-handwritten";

/** All valid caption style ids as a runtime array (for validation). */
export const CAPTION_STYLE_IDS: CaptionStyleId[] = [
  "hormozi-bounce",
  "mrbeast-pop",
  "clean-sans",
  "kinetic-colour",
  "subtle-lower-third",
  "vlog-handwritten",
];
