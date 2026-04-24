// Mapping between editor BlendMode values, CSS `mix-blend-mode`, and
// canvas `globalCompositeOperation`. The three vocabularies are almost
// identical (CSS spec copied the Porter-Duff + PDF set) but we keep the
// lookup explicit so a typo surfaces as a TS error rather than silently
// falling back to "normal".

import type { BlendMode } from "./types";

export const BLEND_MODE_OPTIONS: { value: BlendMode; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "multiply", label: "Multiply" },
  { value: "screen", label: "Screen" },
  { value: "overlay", label: "Overlay" },
  { value: "darken", label: "Darken" },
  { value: "lighten", label: "Lighten" },
  { value: "color-dodge", label: "Color Dodge" },
  { value: "color-burn", label: "Color Burn" },
  { value: "hard-light", label: "Hard Light" },
  { value: "soft-light", label: "Soft Light" },
  { value: "difference", label: "Difference" },
  { value: "exclusion", label: "Exclusion" },
];

export function blendModeToCSS(mode: BlendMode): string {
  // CSS mix-blend-mode uses the same token set verbatim
  return mode;
}

export function blendModeToCanvas(mode: BlendMode): GlobalCompositeOperation {
  switch (mode) {
    case "normal":
      return "source-over";
    case "multiply":
      return "multiply";
    case "screen":
      return "screen";
    case "overlay":
      return "overlay";
    case "darken":
      return "darken";
    case "lighten":
      return "lighten";
    case "color-dodge":
      return "color-dodge";
    case "color-burn":
      return "color-burn";
    case "hard-light":
      return "hard-light";
    case "soft-light":
      return "soft-light";
    case "difference":
      return "difference";
    case "exclusion":
      return "exclusion";
    default:
      return "source-over";
  }
}
