import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

// Last 10 sequence step executions for the authenticated owner.
// Pulled from trinity_log (action_type='automation', result.sequence_id set
// by the cron runner). Powers the "Recent activity" panel on the sequences
// dashboard page.

interface TrinityResult {
  sequence_id?: string;
  sequence_name?: string;
  enrollment_id?: string;
  lead_id?: string;
  step_order?: number;
  channel?: string;
  note?: string | null;
  executed_at?: string;
}

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // trinity_log is the record-of-truth for step executions. We filter by the
  // owner's profile_id (the cron runner writes seq.profile_id into the row)
  // and only rows that look like sequence runs (result.sequence_id set).
  const { data, error } = await supabase
    .from("trinity_log")
    .select("id, description, status, result, completed_at, created_at")
    .eq("action_type", "automation")
    .eq("profile_id", ownerId)
    .order("completed_at", { ascending: false, nullsFirst: false })
    .limit(30);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const filtered = (data || [])
    .filter(row => {
      const r = (row.result || {}) as TrinityResult;
      return Boolean(r.sequence_id);
    })
    .slice(0, 10)
    .map(row => {
      const r = (row.result || {}) as TrinityResult;
      return {
        id: row.id,
        sequence_id: r.sequence_id,
        sequence_name: r.sequence_name,
        step_order: r.step_order,
        channel: r.channel,
        lead_id: r.lead_id,
        note: r.note ?? null,
        executed_at: r.executed_at || row.completed_at || row.created_at,
        description: row.description,
        status: row.status,
      };
    });

  return NextResponse.json({ activity: filtered });
}
