import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

// GET /api/clients — list the CALLER's clients only (scoped by agency owner)
//
// Returns the full client shape needed by /dashboard/clients so the page
// can render revenue, contract status, Stripe state, onboarding progress,
// etc. without a second round-trip.
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
      .select(
        "id, profile_id, business_name, contact_name, email, phone, website, industry, " +
        "package_tier, services, mrr, contract_status, pandadoc_contract_id, " +
        "ghl_contact_id, stripe_customer_id, stripe_subscription_id, health_score, " +
        "notes, is_active, onboarded_at, created_at, updated_at, " +
        "twilio_phone_number, twilio_phone_sid, eleven_agent_id, eleven_phone_number_id, " +
        "ghl_subaccount_id, zernio_profile_id, metadata, cancelled_at, cancellation_reason"
      )
      .eq("profile_id", ownerId)
      .order("business_name", { ascending: true });

    if (error) {
      console.error("Error fetching clients:", error);
      return NextResponse.json({ error: "Failed to fetch clients" }, { status: 500 });
    }

    return NextResponse.json({ clients: clients ?? [], total: clients?.length ?? 0 });
  } catch (err) {
    console.error("Unexpected error in GET /api/clients:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
