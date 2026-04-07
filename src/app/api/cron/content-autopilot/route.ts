import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const maxDuration = 60;

// Runs Monday at 7 AM — auto-generates the week's social content for all active clients
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  // Get all active clients
  const { data: clients } = await supabase
    .from("clients")
    .select("id, business_name, industry, services")
    .eq("is_active", true);

  if (!clients || clients.length === 0) {
    return NextResponse.json({ success: true, message: "No active clients" });
  }

  let generated = 0;

  for (const client of clients.slice(0, 10)) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 800,
          messages: [{
            role: "user",
            content: `Generate 5 social media post ideas for this week for ${client.business_name} (${client.industry || "business"}). For each post include: platform (Instagram/TikTok/LinkedIn), topic, caption (under 150 words), and 5 hashtags. Focus on engagement and lead generation. Plain text, no markdown.`,
          }],
        }),
      });
      const data = await res.json();
      const content = data.content?.[0]?.text || "";

      if (content) {
        await supabase.from("trinity_log").insert({
          agent: "content",
          action_type: "content",
          description: `Weekly content generated for ${client.business_name}: 5 posts`,
          client_id: client.id,
          status: "completed",
          result: { posts: content, week: new Date().toISOString().split("T")[0] },
        });
        generated++;
      }
    } catch {}
  }

  // Notify
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (chatId && botToken) {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: `📝 Content Autopilot\n\nGenerated weekly content for ${generated}/${clients.length} clients.` }),
    });
  }

  return NextResponse.json({ success: true, generated, total: clients.length });
}
