/**
 * POST /api/portal/[clientId]/files/gdrive/disconnect
 *   Marks the active GDrive token row as revoked (soft delete). Leaves
 *   imported `client_files` rows in place.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { verifyClientAccess } from "@/lib/verify-client-access";

export async function POST(
  _req: NextRequest,
  { params }: { params: { clientId: string } },
) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await verifyClientAccess(supabase, user.id, params.clientId);
  if (access.denied) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const service = createServiceClient();
  const { error } = await service
    .from("client_oauth_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("client_id", params.clientId)
    .eq("provider", "gdrive")
    .is("revoked_at", null);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
