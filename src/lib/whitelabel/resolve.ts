import { createServiceClient } from "@/lib/supabase/server";

export interface BrandingPublic {
  brand_name: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  support_email: string | null;
  privacy_url: string | null;
  terms_url: string | null;
  show_powered_by: boolean;
}

const SELECT_PUBLIC =
  "brand_name, company_name, logo_url, favicon_url, primary_color, accent_color, support_email, privacy_url, terms_url, show_powered_by";

interface WhiteLabelRow {
  brand_name: string | null;
  company_name: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  support_email: string | null;
  privacy_url: string | null;
  terms_url: string | null;
  show_powered_by: boolean | null;
}

function toBrandingPublic(row: WhiteLabelRow): BrandingPublic {
  return {
    brand_name: row.brand_name || row.company_name || null,
    logo_url: row.logo_url || null,
    favicon_url: row.favicon_url || null,
    primary_color: row.primary_color || null,
    accent_color: row.accent_color || null,
    support_email: row.support_email || null,
    privacy_url: row.privacy_url || null,
    terms_url: row.terms_url || null,
    show_powered_by: row.show_powered_by ?? true,
  };
}

export async function resolveBrandingByHost(host: string): Promise<BrandingPublic | null> {
  if (!host) return null;
  const service = createServiceClient();
  const { data, error } = await service
    .from("white_label_config")
    .select(SELECT_PUBLIC)
    .eq("custom_domain", host)
    .eq("custom_domain_verified", true)
    .maybeSingle();
  if (error || !data) return null;
  return toBrandingPublic(data as WhiteLabelRow);
}

export async function resolveBrandingByUser(userId: string): Promise<BrandingPublic | null> {
  if (!userId) return null;
  const service = createServiceClient();
  const { data, error } = await service
    .from("white_label_config")
    .select(SELECT_PUBLIC)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return toBrandingPublic(data as WhiteLabelRow);
}
