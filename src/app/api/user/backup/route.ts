import { NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

export const maxDuration = 30;

/**
 * GET /api/user/backup
 * Returns a JSON export of the user's data:
 *   - profile
 *   - sidebar preferences
 *   - clients they own
 *   - leads
 *   - content_calendar
 *   - video_projects
 *
 * Each array may be empty if the corresponding table doesn't exist yet
 * (the helper below catches PGRST* errors and returns []).
 */
export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();

  async function safeSelect<T = Record<string, unknown>>(
    table: string,
    filter: { column: string; value: string | number } | null
  ): Promise<T[]> {
    try {
      let q = service.from(table).select("*");
      if (filter) q = q.eq(filter.column, filter.value);
      const { data, error } = await q;
      if (error) return [];
      return (data as T[]) || [];
    } catch {
      return [];
    }
  }

  const [profile, sidebar, clients, leads, content, videos] = await Promise.all([
    safeSelect<Record<string, unknown>>("profiles", { column: "id", value: user.id }),
    safeSelect<Record<string, unknown>>("user_sidebar_preferences", { column: "user_id", value: user.id }),
    safeSelect<Record<string, unknown>>("clients", { column: "owner_id", value: user.id }),
    safeSelect<Record<string, unknown>>("leads", { column: "owner_id", value: user.id }),
    safeSelect<Record<string, unknown>>("content_calendar", { column: "user_id", value: user.id }),
    safeSelect<Record<string, unknown>>("video_projects", { column: "user_id", value: user.id }),
  ]);

  const backup = {
    backup_version: 1,
    exported_at: new Date().toISOString(),
    user_id: user.id,
    user_email: user.email,
    profile: profile[0] || null,
    sidebar_preferences: sidebar[0] || null,
    clients,
    leads,
    content_calendar: content,
    video_projects: videos,
  };

  const date = new Date().toISOString().slice(0, 10);
  const filename = `shortstack-backup-${date}.json`;

  return NextResponse.json(backup, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
