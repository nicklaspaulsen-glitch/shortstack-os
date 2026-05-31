import { NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { syncCallOutcomes } from "@/lib/services/eleven-agents";

const AGENCY_MUTATE_ROLES = ["admin", "founder", "agency", "team_member"];

// POST /api/eleven-agents/sync
// Fetches completed ElevenAgent conversations, detects outcomes (interested /
// not_interested / voicemail / no_answer), updates outreach_log and lead rows.
// Agency staff only — touches multiple tenants' lead records via service client.
export async function POST() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = (profile?.role as string | null) ?? null;
  if (!role || !AGENCY_MUTATE_ROLES.includes(role)) {
    return NextResponse.json(
      { error: "Only agency staff can sync AI call outcomes" },
      { status: 403 },
    );
  }

  const apiKey = process.env.ELEVENLABS_API_KEY ?? "";
  if (!apiKey) {
    return NextResponse.json({ error: "ELEVENLABS_API_KEY not configured" }, { status: 503 });
  }

  const service = createServiceClient();
  const result = await syncCallOutcomes(service);
  return NextResponse.json({ ok: true, ...result });
}
