import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

// Content Production Pipeline — client submits footage, notifies editors on Slack
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { client_id, script_id, title, edit_type, notes, footage_url, deadline } = await request.json();

  const serviceSupabase = createServiceClient();

  // Get client info
  let clientName = "Client";
  if (client_id) {
    const { data: client } = await serviceSupabase.from("clients").select("business_name").eq("id", client_id).single();
    if (client) clientName = client.business_name;
  }

  // Save production request
  const { data: production, error } = await serviceSupabase.from("trinity_log").insert({
    action_type: "custom",
    description: `Production request: ${title} (${edit_type}) for ${clientName}`,
    client_id: client_id || null,
    status: "in_progress",
    result: {
      type: "production_request",
      title,
      edit_type,
      notes,
      footage_url,
      deadline,
      script_id,
      client_name: clientName,
      submitted_at: new Date().toISOString(),
      submitted_by: user.id,
    },
  }).select("id").single();

  if (error) return NextResponse.json({ error: String(error) }, { status: 500 });

  // Send Slack notification to editors channel
  const slackToken = process.env.SLACK_BOT_TOKEN;
  if (slackToken) {
    try {
      await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: { Authorization: `Bearer ${slackToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: process.env.SLACK_EDITORS_CHANNEL || "#editors",
          blocks: [
            {
              type: "header",
              text: { type: "plain_text", text: `New Edit Request: ${title}` },
            },
            {
              type: "section",
              fields: [
                { type: "mrkdwn", text: `*Client:*\n${clientName}` },
                { type: "mrkdwn", text: `*Type:*\n${edit_type}` },
                { type: "mrkdwn", text: `*Deadline:*\n${deadline || "ASAP"}` },
                { type: "mrkdwn", text: `*Request ID:*\n${production?.id?.substring(0, 8) || "N/A"}` },
              ],
            },
            ...(notes ? [{
              type: "section",
              text: { type: "mrkdwn", text: `*Notes:*\n${notes}` },
            }] : []),
            ...(footage_url ? [{
              type: "section",
              text: { type: "mrkdwn", text: `*Footage:*\n<${footage_url}|Download footage>` },
            }] : []),
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: { type: "plain_text", text: "Claim This Edit" },
                  style: "primary",
                  value: production?.id || "",
                },
              ],
            },
          ],
        }),
      });
    } catch {}
  }

  // Also send Telegram notification
  try {
    const { sendTelegramMessage } = await import("@/lib/services/trinity");
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (chatId) {
      await sendTelegramMessage(chatId, `🎬 *New Edit Request*\n\nClient: ${clientName}\nTitle: ${title}\nType: ${edit_type}\nDeadline: ${deadline || "ASAP"}\n${notes ? `Notes: ${notes}` : ""}`);
    }
  } catch {}

  return NextResponse.json({ success: true, production_id: production?.id });
}
