import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  generatePersonalizedMessage,
  generateFollowUpMessage,
  sendInstagramDM,
  sendLinkedInMessage,
  sendFacebookMessage,
  sendTikTokMessage,
  DAILY_LIMITS,
} from "@/lib/services/outreach";
import { OutreachPlatform } from "@/lib/types";

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const today = new Date().toISOString().split("T")[0];
  const results: Record<string, { sent: number; failed: number }> = {};
  const platforms: OutreachPlatform[] = ["instagram", "linkedin", "facebook", "tiktok"];

  for (const platform of platforms) {
    results[platform] = { sent: 0, failed: 0 };

    // Check how many DMs sent today
    const { count } = await supabase
      .from("outreach_log")
      .select("*", { count: "exact", head: true })
      .eq("platform", platform)
      .gte("sent_at", today);

    const remaining = DAILY_LIMITS[platform] - (count || 0);
    if (remaining <= 0) continue;

    // Get leads with social profiles for this platform
    const socialField = `${platform === "instagram" ? "instagram" : platform === "facebook" ? "facebook" : platform === "linkedin" ? "linkedin" : "tiktok"}_url`;

    const { data: leads } = await supabase
      .from("leads")
      .select("*")
      .not(socialField, "is", null)
      .eq("status", "new")
      .limit(remaining);

    if (!leads) continue;

    for (const lead of leads) {
      const message = await generatePersonalizedMessage(
        platform,
        lead.business_name,
        lead.industry || "business",
        lead.owner_name
      );

      const handle = lead[`${platform === "instagram" ? "instagram" : platform === "facebook" ? "facebook" : platform === "linkedin" ? "linkedin" : "tiktok"}_url` as keyof typeof lead] as string;

      // Send via platform API
      let sendResult;
      switch (platform) {
        case "instagram":
          sendResult = await sendInstagramDM(handle, message);
          break;
        case "linkedin":
          sendResult = await sendLinkedInMessage(handle, message);
          break;
        case "facebook":
          sendResult = await sendFacebookMessage(handle, message);
          break;
        case "tiktok":
          sendResult = await sendTikTokMessage(handle, message);
          break;
      }

      // Log outreach
      const { data: outreachEntry } = await supabase
        .from("outreach_log")
        .insert({
          lead_id: lead.id,
          platform,
          business_name: lead.business_name,
          recipient_handle: handle,
          message_text: message,
          status: sendResult.success ? "sent" : "bounced",
        })
        .select("id")
        .single();

      if (sendResult.success && outreachEntry) {
        results[platform].sent++;

        // Schedule follow-ups: Day 3 and Day 7
        const day3 = new Date();
        day3.setDate(day3.getDate() + 3);
        const day7 = new Date();
        day7.setDate(day7.getDate() + 7);

        await supabase.from("follow_up_queue").insert([
          {
            outreach_id: outreachEntry.id,
            lead_id: lead.id,
            platform,
            followup_number: 1,
            scheduled_date: day3.toISOString().split("T")[0],
            status: "pending",
          },
          {
            outreach_id: outreachEntry.id,
            lead_id: lead.id,
            platform,
            followup_number: 2,
            scheduled_date: day7.toISOString().split("T")[0],
            status: "pending",
          },
        ]);
      } else {
        results[platform].failed++;
      }

      await new Promise((r) => setTimeout(r, 500)); // Rate limit
    }
  }

  // Process follow-ups due today
  const { data: dueFollowUps } = await supabase
    .from("follow_up_queue")
    .select("*, outreach_log(*)")
    .eq("status", "pending")
    .lte("scheduled_date", today)
    .limit(50);

  let followUpsSent = 0;

  if (dueFollowUps) {
    for (const fu of dueFollowUps) {
      // Check if lead already replied
      const { data: outreach } = await supabase
        .from("outreach_log")
        .select("status, message_text, business_name")
        .eq("id", fu.outreach_id)
        .single();

      if (outreach?.status === "replied") {
        await supabase.from("follow_up_queue").update({ status: "cancelled" }).eq("id", fu.id);
        continue;
      }

      const message = await generateFollowUpMessage(
        fu.platform,
        outreach?.business_name || "your business",
        fu.followup_number,
        outreach?.message_text || ""
      );

      await supabase.from("follow_up_queue").update({
        status: "sent",
        message_text: message,
        sent_at: new Date().toISOString(),
      }).eq("id", fu.id);

      followUpsSent++;
    }
  }

  return NextResponse.json({
    success: true,
    results,
    followUpsSent,
    timestamp: new Date().toISOString(),
  });
}
