import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { syncContactToGhl } from "@/lib/ghl/sync-contact";
import { requireOwnedClient } from "@/lib/security/require-owned-client";

/**
 * POST — Update a client's contact info (email, phone, name)
 * and auto-sync the change to their GHL sub-account contact.
 *
 * Body: { client_id, email?, phone?, first_name?, last_name?, sync_to_ghl? }
 * Defaults sync_to_ghl = true.
 */
export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { client_id, email, phone, first_name, last_name, sync_to_ghl = true } = body;

  if (!client_id) return NextResponse.json({ error: "client_id required" }, { status: 400 });

  // Verify the caller owns this client
  const ctx = await requireOwnedClient(supabase, user.id, client_id);
  if (!ctx) return NextResponse.json({ error: "Forbidden — not your client" }, { status: 403 });

  const service = createServiceClient();

  // Get current client state
  const { data: existing, error: fetchErr } = await service
    .from("clients")
    .select("id, business_name, email, phone, first_name, last_name, ghl_location_id, ghl_contact_id")
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

  // Sync to GHL if enabled and the client has a sub-account
  let ghlResult: { success: boolean; contactId?: string; created?: boolean; error?: string } | null = null;
  if (sync_to_ghl && existing.ghl_location_id) {
    ghlResult = await syncContactToGhl({
      locationId: existing.ghl_location_id,
      contactId: existing.ghl_contact_id,
      email: (email ?? existing.email) as string | null,
      phone: (phone ?? existing.phone) as string | null,
      firstName: (first_name ?? existing.first_name) as string | null,
      lastName: (last_name ?? existing.last_name) as string | null,
      companyName: existing.business_name as string | null,
      tags: ["shortstack-os"],
    });

    // Save new contact ID back to client if created
    if (ghlResult.success && ghlResult.contactId && ghlResult.contactId !== existing.ghl_contact_id) {
      await service.from("clients")
        .update({ ghl_contact_id: ghlResult.contactId })
        .eq("id", client_id);
    }
  }

  // Log
  try {
    await service.from("trinity_log").insert({
      user_id: user.id,
      action_type: "client_contact_updated",
      description: `Updated contact for ${existing.business_name}${ghlResult?.success ? " + synced to GHL" : ""}`,
      status: ghlResult?.success || !sync_to_ghl ? "completed" : "warning",
      metadata: {
        client_id,
        ghl_sync: sync_to_ghl,
        ghl_success: ghlResult?.success ?? null,
        ghl_error: ghlResult?.error ?? null,
      },
    });
  } catch (err) { console.error("[clients/update-contact] trinity_log insert failed:", err); }

  return NextResponse.json({
    success: true,
    ghl_synced: ghlResult?.success ?? false,
    ghl_contact_id: ghlResult?.contactId ?? existing.ghl_contact_id,
    ghl_error: ghlResult?.error,
  });
}
