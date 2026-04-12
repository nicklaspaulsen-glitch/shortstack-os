import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Google Business Profile API — manage business listings, reviews, posts
// Requires: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (shared with YouTube OAuth)
// Scopes added in /api/oauth/google when platform=google_business

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = request.nextUrl.searchParams.get("client_id");
  if (!clientId) return NextResponse.json({ error: "client_id required" }, { status: 400 });

  // Get the Google Business account for this client
  const { data: account } = await supabase
    .from("social_accounts")
    .select("*")
    .eq("client_id", clientId)
    .eq("platform", "google_business")
    .eq("is_active", true)
    .single();

  if (!account?.access_token) {
    return NextResponse.json({ error: "Google Business not connected", connected: false }, { status: 404 });
  }

  const action = request.nextUrl.searchParams.get("action") || "reviews";

  try {
    if (action === "reviews") {
      // Fetch recent reviews
      const accountId = account.account_id;
      const res = await fetch(
        `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations?readMask=name,title`,
        { headers: { Authorization: `Bearer ${account.access_token}` } }
      );
      const data = await res.json();

      if (data.locations?.[0]) {
        const locationName = data.locations[0].name;
        const reviewsRes = await fetch(
          `https://mybusiness.googleapis.com/v4/${locationName}/reviews?pageSize=20`,
          { headers: { Authorization: `Bearer ${account.access_token}` } }
        );
        const reviewsData = await reviewsRes.json();
        return NextResponse.json({ success: true, reviews: reviewsData.reviews || [], total: reviewsData.totalReviewCount });
      }
      return NextResponse.json({ success: true, reviews: [], total: 0 });
    }

    if (action === "locations") {
      const accountId = account.account_id;
      const res = await fetch(
        `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations?readMask=name,title,storefrontAddress,websiteUri,regularHours,phoneNumbers`,
        { headers: { Authorization: `Bearer ${account.access_token}` } }
      );
      const data = await res.json();
      return NextResponse.json({ success: true, locations: data.locations || [] });
    }

    if (action === "insights") {
      const accountId = account.account_id;
      const res = await fetch(
        `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations:reportInsights`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${account.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            locationNames: [`accounts/${accountId}/locations/${account.metadata?.location_id || ""}`],
            basicRequest: {
              metricRequests: [
                { metric: "ALL" },
              ],
              timeRange: {
                startTime: new Date(Date.now() - 30 * 86400000).toISOString(),
                endTime: new Date().toISOString(),
              },
            },
          }),
        }
      );
      const data = await res.json();
      return NextResponse.json({ success: true, insights: data.locationMetrics || [] });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: `Google Business API error: ${err}` }, { status: 500 });
  }
}

// Create a Google Business post or reply to a review
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { client_id, action, ...params } = await request.json();
  if (!client_id) return NextResponse.json({ error: "client_id required" }, { status: 400 });

  const { data: account } = await supabase
    .from("social_accounts")
    .select("*")
    .eq("client_id", client_id)
    .eq("platform", "google_business")
    .eq("is_active", true)
    .single();

  if (!account?.access_token) {
    return NextResponse.json({ error: "Google Business not connected" }, { status: 404 });
  }

  try {
    if (action === "reply_review") {
      const { review_name, comment } = params;
      const res = await fetch(
        `https://mybusiness.googleapis.com/v4/${review_name}/reply`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${account.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ comment }),
        }
      );
      const data = await res.json();
      return NextResponse.json({ success: true, reply: data });
    }

    if (action === "create_post") {
      const { location_name, summary, call_to_action } = params;
      const res = await fetch(
        `https://mybusiness.googleapis.com/v4/${location_name}/localPosts`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${account.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            languageCode: "en",
            summary,
            callToAction: call_to_action ? { actionType: call_to_action.type, url: call_to_action.url } : undefined,
            topicType: "STANDARD",
          }),
        }
      );
      const data = await res.json();

      // Log to trinity
      await supabase.from("trinity_log").insert({
        action_type: "custom",
        description: `Google Business post created for client`,
        client_id,
        status: "completed",
        result: { type: "gbp_post", post_id: data.name },
      });

      return NextResponse.json({ success: true, post: data });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: `Google Business API error: ${err}` }, { status: 500 });
  }
}
