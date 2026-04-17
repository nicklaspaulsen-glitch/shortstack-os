import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * GET /api/dashboard/jump-back-in
 *
 * Returns up to 4 items the user was recently editing — drafts, in-progress
 * generations, or anything saved/edited recently. Reads from `trinity_log`
 * with action_type matching draft|saved|edited patterns.
 */
export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  type Item = {
    id: string;
    type: string;
    title: string;
    href: string;
    updated_at: string;
    status: string;
  };

  const items: Item[] = [];

  try {
    const { data: logs } = await supabase
      .from("trinity_log")
      .select("id, action_type, description, status, created_at, metadata")
      .or(
        "action_type.like.%_draft,action_type.like.%_saved,action_type.like.%_edited,action_type.like.%_in_progress"
      )
      .order("created_at", { ascending: false })
      .limit(20);

    if (logs) {
      const seen = new Set<string>();
      for (const l of logs) {
        const meta = (l.metadata || {}) as Record<string, unknown>;
        const type = inferType(l.action_type as string);
        // Dedupe by type+title so we don't show the same draft twice
        const titleRaw =
          (typeof meta.title === "string" && meta.title) ||
          (l.description as string) ||
          "Untitled";
        const title = titleRaw.slice(0, 60);
        const key = `${type}:${title}`;
        if (seen.has(key)) continue;
        seen.add(key);

        items.push({
          id: String(l.id),
          type,
          title,
          href: hrefFor(type, String(l.id), meta),
          updated_at: l.created_at as string,
          status: (l.status as string) || "in_progress",
        });

        if (items.length >= 4) break;
      }
    }
  } catch {
    // ignore — return empty list
  }

  return NextResponse.json({ items });
}

function inferType(action: string): string {
  const a = (action || "").toLowerCase();
  if (a.includes("video")) return "video";
  if (a.includes("thumb")) return "thumbnail";
  if (a.includes("email")) return "email";
  if (a.includes("landing") || a.includes("page")) return "landing_page";
  if (a.includes("script")) return "script";
  if (a.includes("post") || a.includes("social")) return "social_post";
  if (a.includes("form")) return "form";
  if (a.includes("sequence")) return "sequence";
  if (a.includes("proposal")) return "proposal";
  return "other";
}

function hrefFor(type: string, id: string, meta: Record<string, unknown>): string {
  if (typeof meta.href === "string") return meta.href;
  switch (type) {
    case "video":
      return `/dashboard/production?id=${id}`;
    case "thumbnail":
      return `/dashboard/thumbnail-generator?id=${id}`;
    case "email":
      return `/dashboard/email-templates?id=${id}`;
    case "landing_page":
      return `/dashboard/landing-pages?id=${id}`;
    case "script":
      return `/dashboard/script-lab?id=${id}`;
    case "social_post":
      return `/dashboard/content?id=${id}`;
    case "form":
      return `/dashboard/forms?id=${id}`;
    case "sequence":
      return `/dashboard/sequences?id=${id}`;
    case "proposal":
      return `/dashboard/proposals?id=${id}`;
    default:
      return `/dashboard/generations?id=${id}`;
  }
}
