import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { generatePersonalizedMessage } from "@/lib/services/outreach";

// Manual outreach trigger — Send DMs right now with custom settings
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { platforms, count_per_platform, message_style, target_industry } = await request.json();

  const selectedPlatforms = platforms || ["instagram", "linkedin", "facebook", "tiktok"];
  const countPer = count_per_platform || 5;
  const results: Record<string, { sent: number; failed: number }> = {};

  for (const platform of selectedPlatforms) {
    results[platform] = { sent: 0, failed: 0 };

    // Get leads with social profiles for this platform
    const socialField = `${platform}_url`;
    let query = supabase
      .from("leads")
      .select("*")
      .not(socialField, "is", null)
      .eq("status", "new")
      .limit(countPer);

    if (target_industry) {
      query = query.eq("industry", target_industry);
    }

    const { data: leads } = await query;
    if (!leads) continue;

    for (const lead of leads) {
      const message = await generatePersonalizedMessage(
        platform as "instagram" | "linkedin" | "facebook" | "tiktok",
        lead.business_name,
        lead.industry || "business",
        lead.owner_name
      );

      // Log outreach
      const { data: outreachEntry } = await supabase
        .from("outreach_log")
        .insert({
          lead_id: lead.id,
          platform,
          business_name: lead.business_name,
          recipient_handle: lead[socialField as keyof typeof lead] as string || "",
          message_text: message,
          status: "sent",
        })
        .select("id")
        .single();

      if (outreachEntry) {
        results[platform].sent++;

        // Schedule follow-ups
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
    }
  }

  const totalSent = Object.values(results).reduce((s, r) => s + r.sent, 0);

  // Notify on Telegram
  const { sendTelegramMessage } = await import("@/lib/services/trinity");
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (chatId && totalSent > 0) {
    const platformBreakdown = Object.entries(results).map(([p, r]) => `${p}: ${r.sent}`).join(", ");
    await sendTelegramMessage(chatId, `📨 *Manual Outreach Sent*\n\n${totalSent} DMs sent\n${platformBreakdown}`);
  }

  return NextResponse.json({ success: true, results, totalSent });
}
