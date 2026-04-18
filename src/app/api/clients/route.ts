import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

// GET /api/clients — list the CALLER's clients only (scoped by agency owner)
export async function GET(_request: NextRequest) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const ownerId = await getEffectiveOwnerId(supabase, user.id);
    if (!ownerId) return NextResponse.json({ error: "Profile not found" }, { status: 403 });

    const serviceSupabase = createServiceClient();

    // Scope to the caller's agency only
    const { data: clients, error } = await serviceSupabase
      .from("clients")
      .select("id, business_name, twilio_phone_number, email, phone, contact_name, package_tier, logo_url, created_at, health_score, mrr")
      .eq("profile_id", ownerId)
      .order("business_name", { ascending: true });

    if (error) {
      console.error("Error fetching clients:", error);
      return NextResponse.json({ error: "Failed to fetch clients" }, { status: 500 });
    }

    return NextResponse.json({ clients: clients ?? [] });
  } catch (err) {
    console.error("Unexpected error in GET /api/clients:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
