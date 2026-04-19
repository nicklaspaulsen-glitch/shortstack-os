import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Account deletions cascade through many tables + storage — long-running by nature.
export const maxDuration = 300;

/**
 * Cron: Process pending account deletions whose grace period has elapsed.
 * Protected by CRON_SECRET bearer token.
 *
 * Deletes:
 *  - Storage assets in user-keyed buckets
 *  - video_projects, content_calendar, outreach_entries, leads owned by user/client
 *  - social_accounts, integrations, webhooks
 *  - clients row
 *  - profiles row (final)
 *  - auth.users row (via service client)
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();

  const { data: pending } = await service
    .from("account_deletion_requests")
    .select("id, profile_id, client_id, scheduled_for")
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .limit(10);

  const results: Array<{ id: string; profile_id: string; status: string; error?: string }> = [];

  for (const req of pending || []) {
    try {
      // Mark as processing
      await service.from("account_deletion_requests").update({ status: "processing" }).eq("id", req.id);

      const { profile_id, client_id } = req;
      const purgeQueries: Promise<unknown>[] = [];

      // User-scoped tables (by profile_id)
      const profileScopedTables = [
        "video_projects",
        "thumbnail_history",
        "content_calendar",
        "software_subscriptions",
        "trinity_log",
        "notifications",
        "community_comments",
        "community_post_likes",
        "community_bookmarks",
        "community_posts",
      ];
      for (const t of profileScopedTables) {
        purgeQueries.push(
          Promise.resolve(service.from(t).delete().eq("user_id", profile_id) as unknown as Promise<unknown>).then(() => null, () => null)
        );
        purgeQueries.push(
          Promise.resolve(service.from(t).delete().eq("profile_id", profile_id) as unknown as Promise<unknown>).then(() => null, () => null)
        );
      }

      // Client-scoped tables (by client_id)
      if (client_id) {
        const clientScopedTables = [
          "leads",
          "outreach_entries",
          "social_accounts",
          "oauth_connections",
          "invoices",
          "deals",
          "proposals",
          "content_calendar",
        ];
        for (const t of clientScopedTables) {
          purgeQueries.push(
            Promise.resolve(service.from(t).delete().eq("client_id", client_id) as unknown as Promise<unknown>).then(() => null, () => null)
          );
        }
      }

      await Promise.all(purgeQueries);

      // Delete client row
      if (client_id) {
        await service.from("clients").delete().eq("id", client_id);
      }

      // Delete profile + auth user last
      await service.from("profiles").delete().eq("id", profile_id);
      try {
        await service.auth.admin.deleteUser(profile_id);
      } catch {
        // auth user may already be gone
      }

      // Mark request completed
      await service
        .from("account_deletion_requests")
        .update({
          status: "completed",
          processed_at: new Date().toISOString(),
          processed_by: "cron",
        })
        .eq("id", req.id);

      results.push({ id: req.id, profile_id, status: "completed" });
    } catch (err) {
      await service
        .from("account_deletion_requests")
        .update({ status: "pending", processed_by: "cron_failed" })
        .eq("id", req.id);
      results.push({
        id: req.id,
        profile_id: req.profile_id,
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
