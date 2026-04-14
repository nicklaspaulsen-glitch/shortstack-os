import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { verifyClientAccess } from "@/lib/verify-client-access";

// Post content to a client's connected social media account
export async function POST(request: NextRequest) {
  const { client_id, platform, caption, media_url } = await request.json();
  if (!client_id || !platform || !caption) {
    return NextResponse.json({ error: "Missing client_id, platform, or caption" }, { status: 400 });
  }

  // Auth + ownership check
  const authSupabase = createServerSupabase();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await verifyClientAccess(authSupabase, user.id, client_id);
  if (access.denied) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = createServiceClient();

  // Get the client's access token for this platform
  const { data: account } = await supabase
    .from("social_accounts")
    .select("access_token, account_id, metadata")
    .eq("client_id", client_id)
    .eq("platform", platform)
    .eq("is_active", true)
    .single();

  if (!account?.access_token) {
    return NextResponse.json({ error: `No connected ${platform} account with access token` }, { status: 400 });
  }

  try {
    let result: Record<string, unknown> = {};

    if (platform === "facebook") {
      // Post to Facebook Page
      const pageId = account.account_id;
      const res = await fetch(`https://graph.facebook.com/v18.0/${pageId}/feed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: caption,
          access_token: account.access_token,
          ...(media_url ? { link: media_url } : {}),
        }),
      });
      result = await res.json();
    }

    if (platform === "instagram") {
      // Instagram requires a 2-step process: create media container, then publish
      const igAccountId = account.account_id;
      if (media_url) {
        // Step 1: Create media container
        const createRes = await fetch(`https://graph.facebook.com/v18.0/${igAccountId}/media`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_url: media_url,
            caption,
            access_token: account.access_token,
          }),
        });
        const createData = await createRes.json();

        if (createData.id) {
          // Step 2: Publish
          const publishRes = await fetch(`https://graph.facebook.com/v18.0/${igAccountId}/media_publish`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              creation_id: createData.id,
              access_token: account.access_token,
            }),
          });
          result = await publishRes.json();
        } else {
          result = createData;
        }
      } else {
        result = { error: "Instagram requires a media_url (image or video)" };
      }
    }

    if (platform === "linkedin") {
      const personId = account.account_id;
      const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${account.access_token}`,
          "Content-Type": "application/json",
          "X-Restli-Protocol-Version": "2.0.0",
        },
        body: JSON.stringify({
          author: `urn:li:person:${personId}`,
          lifecycleState: "PUBLISHED",
          specificContent: {
            "com.linkedin.ugc.ShareContent": {
              shareCommentary: { text: caption },
              shareMediaCategory: "NONE",
            },
          },
          visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
        }),
      });
      result = await res.json();
    }

    // Log the post
    await supabase.from("content_calendar").insert({
      client_id,
      title: caption.substring(0, 100),
      platform,
      content_type: "post",
      status: "published",
      scheduled_at: new Date().toISOString(),
      metadata: { posted_by: "ai_manager", result, media_url },
    });

    // Log to trinity
    await supabase.from("trinity_log").insert({
      action_type: "automation",
      description: `AI posted to ${platform}: "${caption.substring(0, 60)}..."`,
      client_id,
      status: "completed",
      result,
    });

    return NextResponse.json({ success: true, platform, result });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
