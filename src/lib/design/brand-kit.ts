/**
 * Design Studio — Brand Kit helpers.
 *
 * Pulls white_label_config for the authenticated user and returns a
 * BrandKit object that the editor can apply to layers in one shot.
 * Server-side only (uses createServerSupabase).
 */

import { createServerSupabase } from "@/lib/supabase/server";

export interface BrandKit {
  companyName: string | null;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  /** Preferred heading font — falls back to Inter */
  headingFont: string;
  /** Preferred body font — falls back to Inter */
  bodyFont: string;
}

const DEFAULT_PRIMARY = "#C9A84C";
const DEFAULT_ACCENT = "#8B6FCF";
const DEFAULT_FONT = "Inter";

/**
 * Fetch the brand kit for the currently authenticated user.
 * Returns sensible defaults when no config is found.
 */
export async function getBrandKit(): Promise<BrandKit> {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return buildDefaults();
  }

  const { data: config } = await supabase
    .from("white_label_config")
    .select("company_name, logo_url, primary_color, accent_color")
    .eq("user_id", user.id)
    .single();

  if (!config) return buildDefaults();

  return {
    companyName: config.company_name ?? null,
    logoUrl: config.logo_url ?? null,
    primaryColor: config.primary_color || DEFAULT_PRIMARY,
    accentColor: config.accent_color || DEFAULT_ACCENT,
    headingFont: DEFAULT_FONT,
    bodyFont: DEFAULT_FONT,
  };
}

function buildDefaults(): BrandKit {
  return {
    companyName: null,
    logoUrl: null,
    primaryColor: DEFAULT_PRIMARY,
    accentColor: DEFAULT_ACCENT,
    headingFont: DEFAULT_FONT,
    bodyFont: DEFAULT_FONT,
  };
}

/** Client-side helper: apply brand kit colors to a hex string map. */
export function applyBrandColors(
  kit: BrandKit,
): { primary: string; accent: string } {
  return {
    primary: kit.primaryColor,
    accent: kit.accentColor,
  };
}
