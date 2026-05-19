/**
 * Video Template Registry
 *
 * HyperFrames-style HTML template system for short-form video generation.
 * Each template is a pure TypeScript function that accepts props and returns
 * a self-contained HTML string (1080×1920 9:16, CSS-animated, 5–6 seconds).
 *
 * The HTML is rendered frame-by-frame by a headless browser on a self-hosted
 * worker (Hetzner / Fly.io) and encoded to MP4 via FFmpeg. The `/api/video/templates`
 * routes expose the registry over HTTP so any client can list templates and
 * render previews without needing the Node.js runtime directly.
 *
 * Usage:
 *   import { templateRegistry, getTemplate, renderTemplate } from "@/lib/video-templates";
 *
 *   const html = renderTemplate("headline", { headline: "Hello world", cta: "#mytag" });
 */

import { headlineTemplate } from "./templates/headline";
import { listicleTemplate } from "./templates/listicle";
import { quoteCardTemplate } from "./templates/quote-card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VideoTemplate<TProps extends Record<string, unknown> = Record<string, unknown>> {
  /** Stable identifier used in API routes */
  id: string;
  /** Human-readable display name */
  name: string;
  /** Short description shown in the picker */
  description: string;
  /** Visual category for grouping in the picker */
  category: "text" | "product" | "social" | "announcement";
  /** Output aspect ratio */
  aspectRatio: "9:16" | "16:9" | "1:1";
  /** Recommended total duration in seconds */
  durationSeconds: number;
  /** CSS gradient string used as a placeholder preview swatch */
  previewGradient: string;
  /** Props with default values — used to render the picker thumbnail */
  defaultProps: TProps;
  /** Render function — returns a complete HTML string */
  render: (props: TProps) => string;
}

// A looser type for the registry (erases the generic so all templates can
// live in a single Record without forcing a union).
export type AnyVideoTemplate = VideoTemplate<Record<string, unknown>>;

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const templates: AnyVideoTemplate[] = [
  headlineTemplate as unknown as AnyVideoTemplate,
  listicleTemplate as unknown as AnyVideoTemplate,
  quoteCardTemplate as unknown as AnyVideoTemplate,
];

/** Flat lookup by template id */
export const templateRegistry: Record<string, AnyVideoTemplate> = Object.fromEntries(
  templates.map((t) => [t.id, t]),
);

/** All templates as an ordered array (registry order = picker order) */
export const templateList: AnyVideoTemplate[] = templates;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Look up a template by id. Returns `undefined` if not found — callers
 * should handle that as a 404.
 */
export function getTemplate(id: string): AnyVideoTemplate | undefined {
  return templateRegistry[id];
}

/**
 * Render a template with the provided props merged over `defaultProps`.
 * This is the safe public API — it always falls back to defaults so partial
 * prop objects (e.g. from a REST body) don't produce blank frames.
 */
export function renderTemplate(
  id: string,
  overrides: Record<string, unknown> = {},
): { html: string; template: AnyVideoTemplate } | null {
  const template = getTemplate(id);
  if (!template) return null;

  const merged = { ...template.defaultProps, ...overrides };
  const html = template.render(merged);
  return { html, template };
}

// Re-export individual templates for direct import where needed
export { headlineTemplate } from "./templates/headline";
export { listicleTemplate } from "./templates/listicle";
export { quoteCardTemplate } from "./templates/quote-card";

// Re-export prop types
export type { HeadlineProps } from "./templates/headline";
export type { ListicleProps } from "./templates/listicle";
export type { QuoteCardProps } from "./templates/quote-card";
