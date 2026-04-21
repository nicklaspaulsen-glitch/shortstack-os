import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { requireOwnedClient } from "@/lib/security/require-owned-client";

/**
 * POST — Update a client's contact info (email, phone, name).
 *
 * GHL sync removed Apr 21 per MEMORY migration plan — clients live in the
 * native `clients` table only. The `sync_to_ghl` flag is accepted for
 * backwards compatibility but is now a no-op.
 *
 * Body: { client_id, email?, phone?, first_name?, last_name?, sync_to_ghl? }
 */
export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { client_id, email, phone, first_name, last_name } = body;

  if (!client_id) return NextResponse.json({ error: "client_id required" }, { status: 400 });

  // Verify the caller owns this client
  const ctx = await requireOwnedClient(supabase, user.id, client_id);
  if (!ctx) return NextResponse.json({ error: "Forbidden — not your client" }, { status: 403 });

  const service = createServiceClient();

  // Get current client state
  const { data: existing, error: fetchErr } = await service
    .from("clients")
    .select("id, business_name, email, phone, first_name, last_name")
    .eq("id", client_id)
    .single();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  // Build update payload — only include fields explicitly provided
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (email !== undefined) updates.email = email;
  if (phone !== undefined) updates.phone = phone;
  if (first_name !== undefined) updates.first_name = first_name;
  if (last_name !== undefined) updates.last_name = last_name;

  const { error: updateErr } = await service
    .from("clients")
    .update(updates)
    .eq("id", client_id);

  if (updateErr) {
    return NextResponse.json({ error: "Failed to update client", detail: updateErr.message }, { status: 500 });
  }

  // Log
  try {
    await service.from("trinity_log").insert({
      user_id: user.id,
      action_type: "client_contact_updated",
      description: `Updated contact for ${existing.business_name}`,
      status: "completed",
      metadata: { client_id },
    });
  } catch (err) { console.error("[clients/update-contact] trinity_log insert failed:", err); }

  return NextResponse.json({
    success: true,
    ghl_synced: false,
  });
}
