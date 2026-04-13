import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Cron: Monitor new Google Business reviews and notify
// Vercel Cron: 0 */6 * * * (every 6 hours)
// Checks all connected GBP accounts for new reviews and sends Telegram alerts

export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized triggering
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createServiceClient();

  // Get all active Google Business accounts
  const { data: accounts } = await supabase
    .from("social_accounts")
    .select("id, client_id, access_token, account_id, account_name, metadata")
    .eq("platform", "google_business")
    .eq("is_active", true)
    .not("access_token", "is", null);

  if (!accounts || accounts.length === 0) {
    return NextResponse.json({ success: true, message: "No GBP accounts connected" });
  }

  let newReviews = 0;
  const alerts: string[] = [];

  for (const account of accounts) {
    try {
      // Get client name
      const { data: client } = await supabase.from("clients").select("business_name").eq("id", account.client_id).single();
      const bizName = client?.business_name || account.account_name || "Unknown";

      // Fetch locations
      const locRes = await fetch(
        `https://mybusiness.googleapis.com/v4/accounts/${account.account_id}/locations?readMask=name,title`,
        { headers: { Authorization: `Bearer ${account.access_token}` } }
      );
      const locData = await locRes.json();

      if (locData.locations?.[0]) {
        const locationName = locData.locations[0].name;

        // Fetch recent reviews
        const revRes = await fetch(
          `https://mybusiness.googleapis.com/v4/${locationName}/reviews?pageSize=5`,
          { headers: { Authorization: `Bearer ${account.access_token}` } }
        );
        const revData = await revRes.json();
        const reviews = revData.reviews || [];

        // Check for reviews in the last 6 hours
        const sixHoursAgo = Date.now() - 6 * 3600000;
        const recentReviews = reviews.filter((r: { createTime: string }) =>
          new Date(r.createTime).getTime() > sixHoursAgo
        );

        if (recentReviews.length > 0) {
          newReviews += recentReviews.length;
          const starMap: Record<string, string> = {
            ONE: "1", TWO: "2", THREE: "3", FOUR: "4", FIVE: "5"
          };

          for (const review of recentReviews) {
            const stars = starMap[review.starRating] || "?";
            const reviewer = review.reviewer?.displayName || "Anonymous";
            const snippet = review.comment ? review.comment.slice(0, 80) + (review.comment.length > 80 ? "..." : "") : "(no text)";

            alerts.push(`${bizName}: ${stars}⭐ by ${reviewer} — "${snippet}"`);

            // Log to trinity
            await supabase.from("trinity_log").insert({
              action_type: "custom",
              description: `New ${stars}⭐ review for ${bizName} by ${reviewer}`,
              client_id: account.client_id,
              status: "completed",
              result: {
                type: "new_review",
                stars: parseInt(stars),
                reviewer,
                comment: review.comment,
                review_name: review.name,
              },
            });
          }
        }
      }
    } catch {
      // Silently continue — token may be expired
    }
  }

  // Send Telegram notification
  if (alerts.length > 0) {
    const chatId = process.env.TELEGRAM_CHAT_ID;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (chatId && botToken) {
      const text = `⭐ New Google Reviews (${newReviews})\n\n${alerts.join("\n\n")}`;
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
      }).catch(() => {});
    }
  }

  return NextResponse.json({ success: true, new_reviews: newReviews, accounts_checked: accounts.length });
}
