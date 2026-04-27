/**
 * POST /api/sequences/enroll
 *
 * Bulk enroll contacts into a multi-channel sequence. Creates one
 * sequence_runs row per contact (idempotent — already-active runs skipped).
 *
 * Body: { sequence_id: string, contact_ids: string[], metadata?: object }
 *
 * Aliases accepted on the input for forward-compat with the prompt's
 * original spec (which used `automation_id`):
 *   - automation_id → sequence_id
 *   - contact_ids   → contact_ids
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { enrollContacts } from "@/lib/sequences/engine";

interface EnrollInput {
  sequence_id?: string;
  automation_id?: string;
  contact_ids?: unknown;
  metadata?: Record<string, unknown>;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: EnrollInput;
  try {
    body = (await request.json()) as EnrollInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const sequenceId = body.sequence_id || body.automation_id;
  if (!sequenceId || typeof sequenceId !== "string") {
    return NextResponse.json(
      { error: "sequence_id (or automation_id) is required" },
      { status: 400 },
    );
  }

  const contactIds = Array.isArray(body.contact_ids)
    ? (body.contact_ids as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  if (contactIds.length === 0) {
    return NextResponse.json(
      { error: "contact_ids must be a non-empty array of strings" },
      { status: 400 },
    );
  }
  if (contactIds.length > 5000) {
    // Single-request cap. The cron runner will spread the work over time.
    return NextResponse.json(
      { error: "Max 5000 contacts per enroll request" },
      { status: 400 },
    );
  }

  // Verify sequence ownership.
  const { data: seq } = await supabase
    .from("sequences")
    .select("id, profile_id, is_active")
    .eq("id", sequenceId)
    .eq("profile_id", ownerId)
    .single();
  if (!seq) return NextResponse.json({ error: "Sequence not found" }, { status: 404 });

  // Verify contact ownership (leads.user_id == ownerId). Drop unauthorized IDs.
  const { data: ownedLeads } = await supabase
    .from("leads")
    .select("id")
    .eq("user_id", ownerId)
    .in("id", contactIds);
  const allowed = new Set((ownedLeads || []).map((l) => l.id));
  const validContactIds = contactIds.filter((id) => allowed.has(id));
  if (validContactIds.length === 0) {
    return NextResponse.json(
      { error: "No valid contacts found for this owner" },
      { status: 400 },
    );
  }

  const result = await enrollContacts(supabase, {
    userId: ownerId,
    sequenceId,
    contactIds: validContactIds,
    options: { metadata: body.metadata || {} },
  });

  return NextResponse.json({
    sequence_id: sequenceId,
    enrolled: result.enrolled,
    skipped_already_enrolled: result.skipped,
    skipped_unauthorized: contactIds.length - validContactIds.length,
    run_ids: result.run_ids,
  });
}
