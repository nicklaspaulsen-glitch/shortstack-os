/**
 * Central product branding configuration.
 *
 * "Trinity" is the PRODUCT. "ShortStack" is the parent agency that builds and
 * sells Trinity. Agencies that white-label the product override their own
 * visible brand name + logo via `client_portal_config` / white-label settings;
 * this file is the source of truth for the default (non-white-labeled)
 * experience.
 *
 * Import from sidebar, page-hero, login, landing, layout, manifest, etc.
 * whenever you need consistent product naming — swapping this file flips
 * the whole app.
 */

export const BRAND = {
  product_name: "Trinity",
  company_name: "ShortStack",
  tagline: "The AI operating system for modern agencies",
  primary_color: "#C9A84C",
  logo_svg: "/trinity-logo.svg",
  logo_white_svg: "/trinity-logo-white.svg",
  // For future white-label: agencies override this via their own client_portal_config
  white_labeled: false,
} as const;

export type BrandConfig = typeof BRAND;
