/**
 * POST /api/outreach/conversations/[contactId]/mark-read
 *
 * Records that the agency owner has read the thread for this contact, so
 * the conversation list's `unread_count` clears. Stores `last_read_at`
 * (=now) in the `outreach_thread_reads` cache table, scoped to the
 * agency owner.
 *
 * Body: { kind: "lead" | "client" }  (default "lead")
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import type { ContactKind } from "@/lib/outreach/types";

interface RouteContext {
  params: { contactId: string };
}

interface RequestBody {
  kind?: ContactKind;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const contactId = context.params?.contactId;
  if (!contactId) {
    return NextResponse.json({ error: "Missing contact id" }, { status: 400 });
  }

  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: RequestBody = {};
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    body = {};
  }
  const kind: ContactKind = body.kind === "client" ? "client" : "lead";

  const { error } = await supabase
    .from("outreach_thread_reads")
    .upsert(
      {
        agency_owner_id: ownerId,
        contact_kind: kind,
        contact_id: contactId,
        last_read_at: new Date().toISOString(),
      },
      { onConflict: "agency_owner_id,contact_kind,contact_id" },
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
