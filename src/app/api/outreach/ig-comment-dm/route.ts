import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Instagram Comment-to-DM Automation
// When someone comments a trigger keyword on your post, auto-send them a DM
// This is the same approach ManyChat uses — fully compliant with Meta's API
export async function POST(request: NextRequest) {
  const { action, client_id, trigger_keyword, dm_message, post_id } = await request.json();

  const supabase = createServiceClient();

  if (action === "setup") {
    // Save the automation config
    await supabase.from("social_accounts").upsert({
      client_id,
      platform: "ig_comment_dm",
      account_name: `Trigger: ${trigger_keyword}`,
      is_active: true,
      metadata: {
        trigger_keyword: trigger_keyword.toLowerCase(),
        dm_message,
        post_id,
        created_at: new Date().toISOString(),
      },
    });

    return NextResponse.json({ success: true, message: "Comment-to-DM automation set up" });
  }

  if (action === "process_comment") {
    // This would be called by a Meta webhook when a comment is received
    const { comment_text, commenter_id, commenter_name } = await request.json();

    // Get all active automations for this client
    const { data: automations } = await supabase
      .from("social_accounts")
      .select("metadata")
      .eq("client_id", client_id)
      .eq("platform", "ig_comment_dm")
      .eq("is_active", true);

    if (!automations) return NextResponse.json({ processed: false });

    for (const auto of automations) {
      const meta = auto.metadata as Record<string, string>;
      const keyword = meta.trigger_keyword?.toLowerCase();

      if (keyword && comment_text.toLowerCase().includes(keyword)) {
        // Get client's Instagram access token
        const { data: igAccount } = await supabase
          .from("social_accounts")
          .select("access_token, account_id")
          .eq("client_id", client_id)
          .eq("platform", "instagram")
          .eq("is_active", true)
          .single();

        if (igAccount?.access_token) {
          // Personalize message
          let message = meta.dm_message || "Thanks for your comment! Here's more info.";
          message = message.replace("{name}", commenter_name || "there");

          // Send DM via Instagram API (only works for users who commented = they initiated interaction)
          try {
            await fetch(`https://graph.facebook.com/v18.0/${igAccount.account_id}/messages`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                recipient: { id: commenter_id },
                message: { text: message },
                access_token: igAccount.access_token,
              }),
            });

            // Log it
            await supabase.from("outreach_log").insert({
              platform: "instagram",
              business_name: commenter_name,
              recipient_handle: commenter_id,
              message_text: message,
              status: "sent",
              metadata: { type: "comment_to_dm", trigger: keyword, comment: comment_text },
            });

            return NextResponse.json({ processed: true, dm_sent: true });
          } catch (err) {
            return NextResponse.json({ processed: true, dm_sent: false, error: String(err) });
          }
        }
      }
    }

    return NextResponse.json({ processed: true, dm_sent: false, reason: "no matching keyword" });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
