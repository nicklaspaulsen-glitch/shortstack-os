import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// GET — Last 50 trinity_log entries for history tab.
// Query params:
//   agent=<name>      — optional filter by agent column
//   action_type=<val> — optional filter by action_type enum value
//   limit=<n>         — optional, defaults to 50, capped at 200
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const agent = searchParams.get("agent");
  const actionType = searchParams.get("action_type");
  const limitRaw = Number(searchParams.get("limit") ?? 50);
  const limit = Math.min(Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 50), 200);

  let query = supabase
    .from("trinity_log")
    .select("id, action_type, description, status, agent, started_at, completed_at, created_at, error_message")
    .eq("profile_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (agent) query = query.eq("agent", agent);
  if (actionType) {
    const allowed = [
      "website", "ai_receptionist", "chatbot", "automation", "discord",
      "social_setup", "email_campaign", "sms_campaign", "lead_gen", "custom",
    ];
    if (allowed.includes(actionType)) {
      query = query.eq("action_type", actionType);
    }
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []).map(r => ({
    id: r.id,
    action_type: r.action_type,
    description: r.description,
    status: r.status ?? "completed",
    agent: r.agent ?? "trinity",
    started_at: r.started_at,
    completed_at: r.completed_at,
    created_at: r.created_at,
    error_message: r.error_message,
  }));

  return NextResponse.json({ history: rows, total: rows.length });
}
