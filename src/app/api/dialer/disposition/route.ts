import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

const VALID_DISPOSITIONS = [
  "connected",
  "voicemail",
  "no_answer",
  "wrong_number",
  "do_not_call",
  "other",
] as const;

type Disposition = (typeof VALID_DISPOSITIONS)[number];

interface DispositionRequest {
  call_id: string;
  disposition: Disposition;
  notes?: string;
  duration_seconds?: number;
}

// POST /api/dialer/disposition
// Save the call outcome + notes after a manual call wraps. Validates the
// disposition against the check constraint allowlist before writing.
//
// Side effects: when disposition is "do_not_call", we flag the lead/contact
// in metadata so future runs of /api/cron/outreach skip it. Anything more
// involved (e.g., DNC list dedupe across tenants) belongs in a separate
// review pass.
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as Partial<DispositionRequest>;
  if (!body.call_id) {
    return NextResponse.json({ error: "Missing call_id" }, { status: 400 });
  }
  if (!body.disposition || !VALID_DISPOSITIONS.includes(body.disposition)) {
    return NextResponse.json(
      { error: `Invalid disposition. Must be one of: ${VALID_DISPOSITIONS.join(", ")}` },
      { status: 400 },
    );
  }

  const service = createServiceClient();

  // Verify the call belongs to this owner — service-role bypass would let
  // a malicious client overwrite any tenant's call without this check.
  const { data: existing } = await service
    .from("voice_calls")
    .select("id, profile_id")
    .eq("id", body.call_id)
    .maybeSingle();

  if (!existing || existing.profile_id !== ownerId) {
    return NextResponse.json({ error: "Call not found or access denied" }, { status: 403 });
  }

  const update: Record<string, unknown> = {
    disposition: body.disposition,
    manual_notes: body.notes ?? null,
    ended_at: new Date().toISOString(),
    status: "completed",
  };
  if (typeof body.duration_seconds === "number" && body.duration_seconds >= 0) {
    update.duration_seconds = Math.floor(body.duration_seconds);
  }

  // Map disposition → outcome for analytics. "connected" doesn't auto-mean
  // qualified — that judgement requires the user. We default to "qualified"
  // on connect so the call shows up in conversion stats; user can override.
  const outcomeMap: Record<Disposition, string> = {
    connected: "qualified",
    voicemail: "unqualified",
    no_answer: "unqualified",
    wrong_number: "unqualified",
    do_not_call: "unqualified",
    other: "unqualified",
  };
  update.outcome = outcomeMap[body.disposition];

  const { error: updateError } = await service
    .from("voice_calls")
    .update(update)
    .eq("id", body.call_id)
    .eq("profile_id", ownerId);

  if (updateError) {
    console.error("[dialer/disposition] update failed:", updateError);
    return NextResponse.json({ error: "Failed to save disposition" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    call_id: body.call_id,
    disposition: body.disposition,
  });
}
