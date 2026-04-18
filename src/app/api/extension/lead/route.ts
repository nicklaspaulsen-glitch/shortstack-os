import { NextRequest, NextResponse } from "next/server";
import { requireExtensionUser } from "@/lib/extension/auth";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

export async function POST(req: NextRequest) {
  try {
    // SECURITY: real token validation (previous build was a stub that
    // accepted anything matching "Bearer ").
    const auth = await requireExtensionUser(req);
    if (auth.error) return auth.error;
    const { supabase, user } = auth;

    const ownerId = await getEffectiveOwnerId(supabase, user.id);
    if (!ownerId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const {
      name,
      business_name,
      email,
      phone,
      website,
      industry,
      notes,
      source,
      sourceUrl,
      detectedFrom,
      ...rest
    } = body ?? {};

    // Extension clients send either `name` (legacy popup form) or
    // `business_name` — normalize to the DB column.
    const businessName = (business_name || name || "").trim();
    if (!businessName) {
      return NextResponse.json(
        { error: "business_name (or name) is required" },
        { status: 400 },
      );
    }

    // Preserve anything caller sent that isn't a first-class column inside
    // `metadata` so we don't lose context from the page (e.g. selection text,
    // detected page title, ld+json fields from content script).
    const metadata: Record<string, unknown> = {};
    if (detectedFrom) metadata.detected_from = detectedFrom;
    if (notes) metadata.notes = notes;
    if (sourceUrl && sourceUrl !== source) metadata.source_url = sourceUrl;
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined && v !== null && v !== "") metadata[k] = v;
    }

    const insertRow = {
      user_id: ownerId,
      business_name: businessName,
      email: email || null,
      phone: phone || null,
      website: website || null,
      industry: industry || null,
      source: "chrome_extension",
      source_url: sourceUrl || (typeof source === "string" ? source : null),
      status: "new" as const,
      metadata: Object.keys(metadata).length ? metadata : {},
    };

    const { data: lead, error } = await supabase
      .from("leads")
      .insert(insertRow)
      .select()
      .single();

    if (error) {
      console.error("[Extension Lead] Insert failed:", error);
      return NextResponse.json(
        { error: error.message || "Failed to save lead" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, lead });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
