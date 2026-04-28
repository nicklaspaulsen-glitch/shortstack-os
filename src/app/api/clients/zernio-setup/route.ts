import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { setupClientInZernio } from "@/lib/services/zernio";
import { requireOwnedClient } from "@/lib/security/require-owned-client";

// POST /api/clients/zernio-setup
//
// Apr 28 IDOR fix: previously accepted `client_id` from body, ran a
// SELECT on `clients` with no ownership filter, and called the Zernio
// service with the service client. Any authenticated user could
// provision Zernio profiles against ANY tenant's client_id. Fixed
// with the canonical requireOwnedClient gate.
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { client_id } = await request.json();
  if (!client_id) return NextResponse.json({ error: "client_id required" }, { status: 400 });

  // Verify the caller owns this client before any side-effecting work.
  const ctx = await requireOwnedClient(supabase, user.id, client_id);
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Ownership confirmed — safe to fetch business_name via RLS-honoring client.
  const { data: client } = await supabase
    .from("clients")
    .select("business_name")
    .eq("id", client_id)
    .single();
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const serviceSupabase = createServiceClient();
  const result = await setupClientInZernio(serviceSupabase, client_id, client.business_name);

  return NextResponse.json(result);
}
