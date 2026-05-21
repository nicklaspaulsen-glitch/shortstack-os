/**
 * GET /api/portal/[clientId]/announcements
 *
 * Returns agency announcements visible to this client:
 *   • Rows with client_id = this client
 *   • Rows with client_id = NULL (broadcast to all)
 * Ordered by published_at DESC. Public — no JWT required,
 * scoped via client_id param and owner_id join.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { clientId: string } },
) {
  const { clientId } = params;
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
