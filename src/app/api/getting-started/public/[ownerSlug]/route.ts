/**
 * GET /api/getting-started/public/[ownerSlug]
 *
 * Public read for the getting-started doc page. Uses an anon-key Supabase
 * client so it doesn't require a session — the RLS policy
 * `getting_started_public_read` filters to is_public=true rows.
 *
 * Returns the doc + the agency's white-label branding so the page can
 * render with the agency's logo/color/contact info without an extra round
 * trip.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { loadPublicGettingStartedDoc } from "@/lib/email-templates/getting-started";

interface BrandingPayload {
  agency_name: string;
  brand_color: string | null;
  logo_url: string | null;
  support_email: string | null;
  custom_domain: string | null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { ownerSlug: string } },
) {
  const ownerId = params.ownerSlug;
  if (!ownerId || typeof ownerId !== "string") {
    return NextResponse.json({ error: "Invalid owner slug" }, { status: 400 });
  }

  // Anon client — bypasses cookies, gets only the rows public-readable via RLS.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  const anon = createClient(url, anonKey, { auth: { persistSession: false } });

  const doc = await loadPublicGettingStartedDoc(anon, ownerId);
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Pull the agency's branding so the public page can render their logo/
  // color. white_label_config has no public RLS yet, so the Apr 27 brand
  // metadata stays private — fall back to safe defaults if the row isn't
  // exposed. (Future: dedicated brand_public view.)
  const { data: wl } = await anon
    .from("white_label_config")
    .select("brand_name, company_name, logo_url, primary_color, support_email, custom_domain")
    .eq("user_id", ownerId)
    .maybeSingle();

  const branding: BrandingPayload = {
    agency_name: wl?.brand_name || wl?.company_name || "Your Agency",
    brand_color: wl?.primary_color || null,
    logo_url: wl?.logo_url || null,
    support_email: wl?.support_email || null,
    custom_domain: wl?.custom_domain || null,
  };

  return NextResponse.json({ doc, branding });
}
