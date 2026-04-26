import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";
import { anthropic, MODEL_HAIKU, getResponseText } from "@/lib/ai/claude-helpers";
import { ALL_PLATFORMS } from "@/lib/social-studio/constants";
import type { SocialPlatform, TopCommenter } from "@/lib/social-studio/types";

/**
 * GET /api/social/top-commenters
 *
 * Returns top commenters from social_comments over the last 30 days,
 * ordered by total comment count desc.
 *
 * POST /api/social/top-commenters
 * Body: { handle: string, platform: string, last_comment: string }
 * Drafts an AI reply to the commenter using Claude Haiku. Returns
 * { reply: string }.
 *
 * Note: Zernio webhooks dropping into social_comments aren't wired yet
 * — see TODO. The route still works against a manually-populated table
 * and is shape-stable for the UI.
 */

interface CommentRow {
  commenter_handle: string;
  platform: string;
  text: string;
  created_at: string;
}

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sinceParam = new URL(request.url).searchParams.get("since");
  const since = sinceParam
    ? new Date(sinceParam)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from("social_comments")
    .select("commenter_handle, platform, text, created_at")
    .eq("user_id", user.id)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(2000);

  if (error) {
    console.error("[social-studio/top-commenters] supabase error", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  // Group by (handle, platform). Track total + most recent comment.
  type Aggregate = {
    handle: string;
    platform: SocialPlatform;
    total: number;
    most_recent_text: string;
    most_recent_at: string;
  };
  const byKey = new Map<string, Aggregate>();

  for (const row of (data ?? []) as CommentRow[]) {
    const platform = ALL_PLATFORMS.includes(row.platform as SocialPlatform)
      ? (row.platform as SocialPlatform)
      : null;
    if (!platform) continue;
    const key = `${platform}:${row.commenter_handle}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.total += 1;
      // We pre-sorted desc by created_at, so the first hit wins.
      if (!existing.most_recent_at || row.created_at > existing.most_recent_at) {
        existing.most_recent_text = row.text;
        existing.most_recent_at = row.created_at;
      }
    } else {
      byKey.set(key, {
        handle: row.commenter_handle,
        platform,
        total: 1,
        most_recent_text: row.text,
        most_recent_at: row.created_at,
      });
    }
  }

  const top: TopCommenter[] = Array.from(byKey.values())
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      return b.most_recent_at.localeCompare(a.most_recent_at);
    })
    .slice(0, 50)
    .map((agg) => ({
      commenter_handle: agg.handle,
      platform: agg.platform,
      total_comments: agg.total,
      most_recent_comment: agg.most_recent_text,
      most_recent_at: agg.most_recent_at,
    }));

  return NextResponse.json({ commenters: top });
}

const REPLY_SYSTEM = `You are an agency owner replying to a comment on social media. Reply with the brand voice (warm, knowledgeable, briefly direct). Keep replies under 220 chars unless context demands more. Do not start with the commenter's handle. Do NOT include hashtags.`;

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_tier")
    .eq("id", user.id)
    .single();
  const limited = checkAiRateLimit(user.id, profile?.plan_tier);
  if (limited) return limited;

  let body: { handle?: string; platform?: string; last_comment?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.handle || !body.last_comment) {
    return NextResponse.json(
      { error: "handle and last_comment are required" },
      { status: 400 },
    );
  }

  const platform =
    body.platform && ALL_PLATFORMS.includes(body.platform as SocialPlatform)
      ? body.platform
      : "instagram";

  try {
    const response = await anthropic.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 400,
      system: REPLY_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Platform: ${platform}\nCommenter: ${body.handle}\nTheir comment: "${body.last_comment}"\n\nDraft my reply.`,
        },
      ],
    });
    const reply = getResponseText(response).trim();
    return NextResponse.json({ reply });
  } catch (err) {
    console.error("[social-studio/top-commenters] claude error", err);
    return NextResponse.json({ error: "AI unavailable" }, { status: 503 });
  }
}
