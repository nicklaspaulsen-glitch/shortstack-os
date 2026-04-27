/**
 * Central registry for vertical SaaS templates.
 *
 * Each template is a complete pre-configured ShortStack OS bundle
 * (automations, content, scripts, scoring, course, funnel) for a
 * specific agency niche. New verticals are added by:
 *   1. creating a new file in src/lib/verticals/<name>.ts
 *   2. adding the slug to VerticalKey in types.ts
 *   3. registering it in VERTICALS below
 *   4. adding a row to vertical_templates via migration
 */

import type { VerticalKey, VerticalTemplate } from "./types";
import { REAL_ESTATE_TEMPLATE } from "./real-estate";
import { COACHES_TEMPLATE } from "./coaches";
import { ECOMMERCE_TEMPLATE } from "./ecommerce";

export const VERTICALS: Record<VerticalKey, VerticalTemplate> = {
  real_estate: REAL_ESTATE_TEMPLATE,
  coaches: COACHES_TEMPLATE,
  ecommerce: ECOMMERCE_TEMPLATE,
};

export function getVertical(key: VerticalKey): VerticalTemplate {
  return VERTICALS[key];
}

export function listVerticals(): VerticalTemplate[] {
  return Object.values(VERTICALS);
}

export type { VerticalKey, VerticalTemplate, ModuleKey, VerticalCounts } from "./types";
export { ALLOWED_MODULES, isModuleKey, isVerticalKey, countVertical } from "./types";
