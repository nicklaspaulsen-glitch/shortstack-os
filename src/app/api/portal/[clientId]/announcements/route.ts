/**
 * GET /api/portal/[clientId]/announcements
 *
 * Returns agency announcements visible to this client:
 *   • Rows with client_id = this client
 *   • Rows with client_id = NULL (broadcast to all)
 * Ordered by published_at DESC.
 *
 * Auth: session cookie required. verifyClientAccess confirms the caller
 * is the client, their agency owner, or an authorized team member. The
 * original "Public — no JWT required" comment was incorrect — unauthenticated
 * callers with any clientId UUID could enumerate announcement data for any
 * tenant. Fixed Apr 27 sec audit.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { verifyClientAccess } from "@/lib/verify-client-access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { clientId: string } },
) {
  const { clientId } = params;

  // Auth gate — must be authenticated and authorized for this clientId.
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const access = await verifyClientAccess(supabase, user.id, clientId);
  if (access.denied) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const svc = createServiceClient();

  // Resolve owner from client row
  const { data: clientRow } = await svc
    .from("clients")
    .select("agency_id")
    .eq("id", clientId)
    .single();

  if (!clientRow) {
    return NextResponse.json({ announcements: [] });
  }

  const ownerId = clientRow.agency_id as string;

  const { data, error } = await svc
    .from("client_announcements")
    .select("id, title, body, type, cta_label, cta_url, image_url, pinned, published_at, created_at")
    .eq("owner_id", ownerId)
    .or(`client_id.is.null,client_id.eq.${clientId}`)
    .order("pinned", { ascending: false })
    .order("published_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("[portal/announcements] GET failed", error);
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }

  return NextResponse.json({ announcements: data ?? [] });
}
