import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Action types relevant to an audit trail. Mapped onto the existing
// trinity_action_type enum. Additional client-side action labels
// (login, permission_change, export, delete, admin_action) are surfaced
// via metadata.label when present.
const AUDIT_ACTION_TYPES = [
  "website", "ai_receptionist", "chatbot", "automation", "discord",
  "social_setup", "email_campaign", "sms_campaign", "lead_gen", "custom",
] as const;

// Client-side filter keys we accept
const AUDIT_FILTER_KEYS = new Set([
  "login", "permission_change", "export", "delete", "admin_action",
  "create", "update", "send", "config",
]);

// GET — paginated audit log for caller
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSizeRaw = Number(searchParams.get("page_size") ?? 50);
  const pageSize = Math.min(Math.max(1, Number.isFinite(pageSizeRaw) ? pageSizeRaw : 50), 200);
  const actionFilter = searchParams.get("action");

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("trinity_log")
    .select("id, action_type, description, status, agent, created_at, metadata", { count: "exact" })
    .eq("profile_id", user.id)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (actionFilter && AUDIT_FILTER_KEYS.has(actionFilter)) {
    if ((AUDIT_ACTION_TYPES as readonly string[]).includes(actionFilter)) {
      query = query.eq("action_type", actionFilter);
    } else {
      query = query.filter("metadata->>label", "eq", actionFilter);
    }
  }

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const entries = (data ?? []).map(r => {
    const meta = (r.metadata ?? {}) as {
      label?: string;
      resource?: string;
      ip?: string;
      user_agent?: string;
      sensitive?: boolean;
      user_email?: string;
    };
    return {
      id: r.id,
      timestamp: r.created_at,
      action: meta.label || r.action_type || "custom",
      action_type: r.action_type,
      description: r.description,
      resource: meta.resource || r.agent || "trinity",
      status: r.status ?? "success",
      ip: meta.ip || null,
      user_agent: meta.user_agent || null,
      sensitive: Boolean(meta.sensitive),
      user_email: meta.user_email || null,
    };
  });

  return NextResponse.json({
    entries,
    page,
    page_size: pageSize,
    total: count ?? entries.length,
  });
}
