import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

// Columns we always project for the dashboard clients page. Pulled out so
// admin god-mode and per-agency lookups stay in sync.
const CLIENT_COLS =
  "id, profile_id, business_name, contact_name, email, phone, website, industry, " +
  "package_tier, services, mrr, contract_status, pandadoc_contract_id, " +
  "ghl_contact_id, stripe_customer_id, stripe_subscription_id, health_score, " +
  "notes, is_active, onboarded_at, created_at, updated_at, " +
  "twilio_phone_number, twilio_phone_sid, eleven_agent_id, eleven_phone_number_id, " +
  "ghl_subaccount_id, zernio_profile_id, metadata, cancelled_at, cancellation_reason";

// GET /api/clients — list clients scoped to caller.
//
// Default behaviour: returns only the caller's own agency's clients (scoped
// by `profile_id = effective owner`). Team members resolve to their parent
// agency.
//
// Admin / founder god-mode: when the authenticated profile has
// `role IN ('admin','founder')`, the API returns EVERY client across the
// platform. The previous version filtered by `profile_id = caller.id` even
// for admins, which is why the platform owner couldn't see clients
// belonging to other agencies on /dashboard/clients. (Reported by user
// "i cant find client accounts when im founder i should see all clients".)
//
// To keep the agency view available even for an admin (e.g. when an admin
// also runs their own agency), the caller can pass `?scope=mine` to force
// the per-agency filter regardless of role.
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const role = profile?.role || null;
    const isPlatformAdmin = role === "admin" || role === "founder";
    const scope = request.nextUrl.searchParams.get("scope"); // "mine" | "all" | null

    const serviceSupabase = createServiceClient();

    // ── Admin / founder god-mode ─────────────────────────────────
    // Default for these roles is "see everything" unless caller asks for
    // their own agency view via ?scope=mine. We also accept ?scope=all
    // explicitly for non-admin callers (rejected — they fall through).
    if (isPlatformAdmin && scope !== "mine") {
      const { data: clients, error } = await serviceSupabase
        .from("clients")
        .select(CLIENT_COLS)
        .order("business_name", { ascending: true });
      if (error) {
        console.error("[/api/clients] admin all-clients error:", error.message);
        return NextResponse.json({ error: "Failed to fetch clients" }, { status: 500 });
      }
      return NextResponse.json({
        clients: clients ?? [],
        total: clients?.length ?? 0,
        scope: "all",
        role,
      });
    }

    // ── Per-agency scope (default for everyone, opt-in for admins) ─
    const ownerId = await getEffectiveOwnerId(supabase, user.id);
    if (!ownerId) return NextResponse.json({ error: "Profile not found" }, { status: 403 });

    const { data: clients, error } = await serviceSupabase
      .from("clients")
      .select(CLIENT_COLS)
      .eq("profile_id", ownerId)
      .order("business_name", { ascending: true });

    if (error) {
      console.error("[/api/clients] per-agency error:", error.message);
      return NextResponse.json({ error: "Failed to fetch clients" }, { status: 500 });
    }

    return NextResponse.json({
      clients: clients ?? [],
      total: clients?.length ?? 0,
      scope: "mine",
      role,
    });
  } catch (err) {
    console.error("Unexpected error in GET /api/clients:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
