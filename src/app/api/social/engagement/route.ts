import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { verifyClientAccess } from "@/lib/verify-client-access";
import { checkAiRateLimit } from "@/lib/api-rate-limit";

// Get engagement data + AI-suggested replies for comments
export async function POST(request: NextRequest) {
  const authSupabase = createServerSupabase();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await authSupabase.from("profiles").select("plan_tier").eq("id", user.id).single();
  const limited = checkAiRateLimit(user.id, profile?.plan_tier);
  if (limited) return limited;

  const { client_id, action } = await request.json();
  if (!client_id) return NextResponse.json({ error: "client_id required" }, { status: 400 });

  const access = await verifyClientAccess(authSupabase, user.id, client_id);
  if (access.denied) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = createServiceClient();

  // Get client's connected accounts
  const { data: accounts } = await supabase
    .from("social_accounts")
    .select("platform, account_id, access_token")
    .eq("client_id", client_id)
    .eq("is_active", true);

  if (!accounts || accounts.length === 0) {
    return NextResponse.json({ error: "No connected accounts" }, { status: 400 });
  }

  const results: Record<string, unknown>[] = [];

  if (action === "fetch_comments") {
    // Fetch recent comments from connected platforms
    for (const account of accounts) {
      if (account.platform === "facebook" && account.access_token) {
        try {
          const postsRes = await fetch(
            `https://graph.facebook.com/v18.0/${account.account_id}/posts?fields=id,message,created_time,comments.limit(5){message,from,created_time}&limit=5&access_token=${account.access_token}`
          );
          const postsData = await postsRes.json();
          for (const post of (postsData.data || [])) {
            for (const comment of (post.comments?.data || [])) {
              results.push({
                platform: "facebook",
                post_id: post.id,
                comment_id: comment.id,
                author: comment.from?.name || "Unknown",
                text: comment.message,
                created_at: comment.created_time,
              });
            }
          }
        } catch {}
      }

      if (account.platform === "instagram" && account.access_token) {
        try {
          const mediaRes = await fetch(
            `https://graph.facebook.com/v18.0/${account.account_id}/media?fields=id,caption,timestamp,comments.limit(5){text,username,timestamp}&limit=5&access_token=${account.access_token}`
          );
          const mediaData = await mediaRes.json();
          for (const media of (mediaData.data || [])) {
            for (const comment of (media.comments?.data || [])) {
              results.push({
                platform: "instagram",
                post_id: media.id,
                comment_id: comment.id,
                author: comment.username,
                text: comment.text,
                created_at: comment.timestamp,
              });
            }
          }
        } catch {}
      }
    }
  }

  if (action === "suggest_reply") {
    const { comment_text, platform } = await request.json();
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey && comment_text) {
      const { data: client } = await supabase.from("clients").select("business_name, industry").eq("id", client_id).single();
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 200,
          messages: [{
            role: "user",
            content: `You are the social media manager for ${client?.business_name || "a business"} (${client?.industry || "service business"}). Write a friendly, professional reply to this ${platform} comment: "${comment_text}". Keep it short (1-2 sentences), genuine, and on-brand.`,
          }],
        }),
      });
      const data = await res.json();
      return NextResponse.json({ reply: data.content?.[0]?.text || "" });
    }
  }

  return NextResponse.json({ comments: results });
}
