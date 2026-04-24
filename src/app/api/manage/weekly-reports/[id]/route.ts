/**
 * PATCH /api/manage/weekly-reports/:id
 * Body: { status: 'sent' | 'skipped', content?: string }
 *
 * Lets an owner/lead mark a draft weekly report as sent or skipped, and
 * optionally edit the content before marking sent.
 *
 * NOTE: This does NOT actually send the email — senders are handled by
 * the existing /api/reports infrastructure. This endpoint just records
 * the human decision. A later sprint can hook up a "send now" button.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { canManage, getProjectRole } from "@/lib/manage/access";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { status?: unknown; content?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const status = body.status;
  if (status !== "sent" && status !== "skipped" && status !== "draft") {
    return NextResponse.json({ error: "status must be 'sent', 'skipped', or 'draft'" }, { status: 400 });
  }

  const { data: report } = await supabase
    .from("project_weekly_reports")
    .select("id, project_id")
    .eq("id", params.id)
    .single();
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const role = await getProjectRole(supabase, report.project_id as string, user.id);
  if (!canManage(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const update: Record<string, unknown> = { status };
  if (typeof body.content === "string") update.content = body.content;
  if (status === "sent") {
    update.sent_at = new Date().toISOString();
    update.sent_by = user.id;
  }

  const { error } = await supabase
    .from("project_weekly_reports")
    .update(update)
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
