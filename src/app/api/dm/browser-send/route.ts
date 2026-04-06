import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

// Browser-based DM sender — coordinates with Claude in Chrome
// Generates personalized messages and stores the DM queue
// The actual browser automation is triggered from the frontend
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { platforms, dmsPerPlatform, niches, services, messageStyle, customMessage } = await request.json();

  const serviceSupabase = createServiceClient();
  const apiKey = process.env.ANTHROPIC_API_KEY;

  // Get leads with social profiles for each platform
  const dmQueue: Array<{
    platform: string;
    handle: string;
    businessName: string;
    industry: string;
    message: string;
  }> = [];

  for (const platform of (platforms || ["instagram"])) {
    const urlField = `${platform}_url`;
    const { data: leads } = await serviceSupabase
      .from("leads")
      .select("id, business_name, industry, instagram_url, facebook_url, linkedin_url, tiktok_url")
      .not(urlField, "is", null)
      .eq("status", "new")
      .limit(dmsPerPlatform || 20);

    if (!leads) continue;

    for (const lead of leads) {
      const handle = (lead as Record<string, string>)[urlField] || "";
      let message = customMessage || "";

      // Generate AI message if no custom template
      if (!message && apiKey) {
        try {
          const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
            body: JSON.stringify({
              model: "claude-haiku-4-5-20251001",
              max_tokens: 150,
              messages: [{
                role: "user",
                content: `Write a ${messageStyle || "friendly"} cold DM for ${platform} to the owner of "${lead.business_name}" (${lead.industry || niches?.[0] || "business"}). You're pitching ${services?.[0] || "digital marketing"} services. Max 100 words. No hashtags. Be natural. Don't use quotes around the message.`,
              }],
            }),
          });
          const data = await res.json();
          message = data.content?.[0]?.text || "";
        } catch {}
      }

      // Fill custom message variables
      if (customMessage) {
        message = customMessage
          .replace(/\{business_name\}/g, lead.business_name)
          .replace(/\{industry\}/g, lead.industry || "business")
          .replace(/\{name\}/g, lead.business_name.split(" ")[0]);
      }

      if (!message) {
        message = `Hey! I came across ${lead.business_name} and love what you're doing. We help ${lead.industry || "local"} businesses get more clients through ${services?.[0] || "digital marketing"}. Would you be open to a quick chat?`;
      }

      dmQueue.push({ platform, handle, businessName: lead.business_name, industry: lead.industry || "", message });
    }
  }

  // Save DM queue to database for the browser automation to pick up
  for (const dm of dmQueue) {
    await serviceSupabase.from("outreach_log").insert({
      platform: dm.platform as never,
      business_name: dm.businessName,
      recipient_handle: dm.handle,
      message_text: dm.message,
      status: "pending",
      metadata: { source: "browser_dm", style: messageStyle },
    });
  }

  // Notify
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (chatId && dmQueue.length > 0) {
    const { sendTelegramMessage } = await import("@/lib/services/trinity");
    await sendTelegramMessage(chatId,
      `💬 DM Queue Ready\n\n${dmQueue.length} DMs prepared across ${platforms?.length || 1} platforms\nNiches: ${niches?.join(", ") || "mixed"}\n\nOpen Chrome and start the DM Controller to send.`
    );
  }

  return NextResponse.json({
    success: true,
    queued: dmQueue.length,
    platforms: platforms?.length || 0,
    logs: dmQueue.slice(0, 20).map(d => ({
      platform: d.platform,
      target: d.businessName,
      status: "queued",
      time: new Date().toLocaleTimeString(),
    })),
  });
}
