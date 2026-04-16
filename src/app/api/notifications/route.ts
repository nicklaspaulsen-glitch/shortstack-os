import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/*
  Notifications table schema:

  create table notifications (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references auth.users(id) on delete cascade,
    title       text not null,
    message     text not null,
    type        text not null default 'info',  -- info, warning, success, error, lead, outreach, autopilot, system, alert
    read        boolean not null default false,
    link        text,                           -- optional navigation link
    created_at  timestamptz not null default now()
  );

  create index idx_notifications_user on notifications(user_id, created_at desc);
  create index idx_notifications_unread on notifications(user_id) where read = false;
  alter table notifications enable row level security;
  create policy "Users see own notifications" on notifications
    for select using (auth.uid() = user_id);
  create policy "Users update own notifications" on notifications
    for update using (auth.uid() = user_id);
*/

/* Map trinity_log action_type to notification type */
function mapActionToNotifType(actionType: string): string {
  if (/scraper|lead_gen|lead/i.test(actionType)) return "lead";
  if (/outreach|email|sms|send/i.test(actionType)) return "outreach";
  if (/autopilot|auto_pilot/i.test(actionType)) return "autopilot";
  if (/system|cron|backup|deploy/i.test(actionType)) return "system";
  return "system";
}

/* Map trinity_log action_type to a human-readable title */
function actionToTitle(actionType: string, description: string): string {
  // Use description if it's short enough; otherwise generate from action_type
  if (description && description.length <= 120) return description;
  const cleaned = actionType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return cleaned;
}

/* Map action_type to a relevant link */
function actionToLink(actionType: string): string | null {
  if (/scraper|lead_gen|lead/i.test(actionType)) return "/dashboard/scraper";
  if (/outreach|email/i.test(actionType)) return "/dashboard/outreach-hub";
  if (/sms/i.test(actionType)) return "/dashboard/outreach-hub";
  if (/autopilot/i.test(actionType)) return "/dashboard/services";
  if (/social/i.test(actionType)) return "/dashboard/social-manager";
  if (/content/i.test(actionType)) return "/dashboard/content-library";
  return null;
}

// GET /api/notifications — fetch notifications + enriched from trinity_log & system_health
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const includeLogs = request.nextUrl.searchParams.get("include_logs") !== "false";

  // Parallel fetch: user notifications + trinity_log + system_health alerts
  const [notifResult, logsResult, healthResult] = await Promise.all([
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    includeLogs
      ? supabase
          .from("trinity_log")
          .select("id, action_type, description, status, created_at")
          .order("created_at", { ascending: false })
          .limit(50)
      : Promise.resolve({ data: null, error: null }),
    includeLogs
      ? supabase
          .from("system_health")
          .select("id, integration_name, status, error_message, updated_at")
          .neq("status", "active")
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (notifResult.error)
    return NextResponse.json({ error: notifResult.error.message }, { status: 500 });

  const notifications = notifResult.data || [];

  // Convert trinity_log entries to notification-shaped objects (synthetic, non-persisted)
  const logNotifs = (logsResult.data || []).map((log: any) => ({
    id: `log_${log.id}`,
    user_id: user.id,
    title: actionToTitle(log.action_type, log.description),
    message: log.status === "failed" ? `Action failed: ${log.description}` : log.description,
    type: log.status === "failed" ? "alert" : mapActionToNotifType(log.action_type),
    read: true,  // synthetic entries are always "read"
    link: actionToLink(log.action_type),
    created_at: log.created_at,
    _synthetic: true,
  }));

  // Convert unhealthy system_health entries to alert notifications
  const healthNotifs = (healthResult.data || []).map((h: any) => ({
    id: `health_${h.id}`,
    user_id: user.id,
    title: `${h.integration_name.replace(/_/g, " ")} — ${h.status}`,
    message: h.error_message || `Integration ${h.integration_name} is ${h.status}`,
    type: "alert",
    read: false,
    link: "/dashboard/monitor",
    created_at: h.updated_at,
    _synthetic: true,
  }));

  // Merge: real notifications first, then synthetic, all sorted by date
  const existingIds = new Set(notifications.map((n: any) => n.id));
  const all = [
    ...notifications,
    ...logNotifs.filter((ln: any) => !existingIds.has(ln.id)),
    ...healthNotifs,
  ].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return NextResponse.json({ notifications: all });
}

// PATCH /api/notifications — mark notification(s) as read
// Body: { id: string }          — mark single notification as read
// Body: { all: true }           — mark all as read for current user
export async function PATCH(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  if (body.all) {
    // Mark all unread notifications as read
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, marked: "all" });
  }

  if (body.id) {
    // Mark single notification as read
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", body.id)
      .eq("user_id", user.id);

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, marked: body.id });
  }

  return NextResponse.json(
    { error: "Provide { id } or { all: true }" },
    { status: 400 }
  );
}
