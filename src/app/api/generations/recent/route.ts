import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * GET /api/generations/recent — Recent AI generations across all tools.
 *
 * Pulls from the `generations` table when present and falls back to
 * `trinity_log` entries with action_type starting with `ai_` so the
 * dashboard always has something to show.
 */
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limit = Math.min(parseInt(request.nextUrl.searchParams.get("limit") || "8", 10), 24);

  type Item = {
    id: string;
    type: string;
    title: string;
    source_tool: string | null;
    thumbnail_url: string | null;
    created_at: string;
    href: string;
  };

  const items: Item[] = [];

  // 1) Try the generations table first
  try {
    const { data: gens } = await supabase
      .from("generations")
      .select("id, category, title, source_tool, content_preview, metadata, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (gens && gens.length > 0) {
      for (const g of gens) {
        const meta = (g.metadata || {}) as Record<string, unknown>;
        const thumb =
          (typeof meta.thumbnail_url === "string" && meta.thumbnail_url) ||
          (typeof meta.image_url === "string" && meta.image_url) ||
          null;
        items.push({
          id: g.id as string,
          type: (g.category as string) || "other",
          title: (g.title as string) || "Untitled",
          source_tool: (g.source_tool as string) || null,
          thumbnail_url: thumb,
          created_at: g.created_at as string,
          href: hrefForCategory(g.category as string, g.id as string),
        });
      }
    }
  } catch {
    // table may not exist — keep going to the fallback
  }

  // 2) Fallback / supplement with trinity_log entries
  if (items.length < limit) {
    try {
      const remaining = limit - items.length;
      const { data: logs } = await supabase
        .from("trinity_log")
        .select("id, action_type, description, created_at, metadata")
        .or("action_type.like.ai_%,action_type.like.%_generated,action_type.like.content_%")
        .order("created_at", { ascending: false })
        .limit(remaining);

      if (logs) {
        for (const l of logs) {
          const meta = (l.metadata || {}) as Record<string, unknown>;
          const inferred = inferTypeFromAction(l.action_type as string);
          items.push({
            id: String(l.id),
            type: inferred,
            title:
              (typeof meta.title === "string" && meta.title) ||
              (l.description as string)?.slice(0, 80) ||
              "Untitled",
            source_tool: (l.action_type as string) || null,
            thumbnail_url:
              (typeof meta.thumbnail_url === "string" && meta.thumbnail_url) ||
              (typeof meta.image_url === "string" && meta.image_url) ||
              null,
            created_at: l.created_at as string,
            href: hrefForCategory(inferred, String(l.id)),
          });
        }
      }
    } catch {
      // ignore — return whatever we have
    }
  }

  return NextResponse.json({ items });
}

function inferTypeFromAction(action: string | null | undefined): string {
  if (!action) return "other";
  const a = action.toLowerCase();
  if (a.includes("email")) return "email";
  if (a.includes("social") || a.includes("post")) return "social_post";
  if (a.includes("video")) return "video";
  if (a.includes("thumb") || a.includes("image")) return "thumbnail";
  if (a.includes("script")) return "script";
  if (a.includes("landing") || a.includes("page")) return "landing_page";
  if (a.includes("form")) return "form";
  if (a.includes("sequence")) return "sequence";
  if (a.includes("blog")) return "blog";
  return "other";
}

function hrefForCategory(category: string, id: string): string {
  switch (category) {
    case "email":
      return `/dashboard/email-templates?id=${id}`;
    case "social_post":
      return `/dashboard/content?id=${id}`;
    case "video":
      return `/dashboard/production?id=${id}`;
    case "thumbnail":
      return `/dashboard/thumbnail-generator?id=${id}`;
    case "script":
      return `/dashboard/script-lab?id=${id}`;
    case "landing_page":
      return `/dashboard/landing-pages?id=${id}`;
    case "form":
      return `/dashboard/forms?id=${id}`;
    case "sequence":
      return `/dashboard/sequences?id=${id}`;
    case "blog":
      return `/dashboard/content?id=${id}`;
    default:
      return `/dashboard/generations?id=${id}`;
  }
}
