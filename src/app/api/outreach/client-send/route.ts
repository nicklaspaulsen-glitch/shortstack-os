import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

// Client Cold Outreach — Sends DMs and emails FROM client's connected accounts
// Like Instantly.ai but built into ShortStack OS
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const {
    client_id,
    lead_ids,
    channels, // ["email", "instagram_dm", "facebook_dm", "linkedin_dm", "sms"]
    message_template,
    daily_limit,
    personalize, // use AI to personalize each message
  } = await request.json();

  // Verify ownership of client_id
  const { verifyClientAccess } = await import("@/lib/verify-client-access");
  const access = await verifyClientAccess(supabase, user.id, client_id);
  if (access.denied) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: client } = await supabase.from("clients").select("*").eq("id", client_id).single();
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  // Get client's connected social accounts from Zernio
  const { data: socialAccounts } = await supabase
    .from("social_accounts")
    .select("*")
    .eq("client_id", client_id)
    .eq("is_active", true);

  const connectedPlatforms = (socialAccounts || []).map(a => a.platform);

  // Get leads to contact — all queries scoped to caller's owned leads.
  const { data: leads } = lead_ids
    ? await supabase.from("leads").select("*").eq("user_id", ownerId).in("id", lead_ids).limit(daily_limit || 20)
    : await supabase.from("leads").select("*").eq("user_id", ownerId).eq("status", "new").limit(daily_limit || 20);

  if (!leads || leads.length === 0) return NextResponse.json({ error: "No leads to contact" }, { status: 400 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const ghlKey = process.env.GHL_API_KEY;
  const results = { emails_sent: 0, dms_queued: 0, sms_sent: 0, errors: [] as string[] };

  for (const lead of leads) {
    // Generate personalized message
    let message = message_template || `Hi! I'm reaching out from ${client.business_name}. We noticed you might benefit from our services. Would you be interested in learning more?`;

    if (personalize && apiKey) {
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 150,
            system: `You write cold outreach messages on behalf of ${client.business_name} (${client.industry}). Be brief, friendly, and relevant. Max 3 sentences with a soft CTA.`,
            messages: [{ role: "user", content: `Personalize this outreach for ${lead.business_name} (${lead.industry}): ${message_template || "We help businesses grow online."}` }],
          }),
        });
        const data = await res.json();
        message = data.content?.[0]?.text || message;
      } catch (err) { console.error("[outreach/client-send] Claude personalization failed:", err); }
    }

    // Send via each requested channel
    for (const channel of (channels || ["email"])) {
      try {
        if (channel === "email" && lead.email && ghlKey) {
          // Send cold email via GHL on behalf of client
          if (lead.ghl_contact_id || client.ghl_contact_id) {
            await fetch("https://services.leadconnectorhq.com/conversations/messages", {
              method: "POST",
              headers: { Authorization: `Bearer ${ghlKey}`, "Content-Type": "application/json", Version: "2021-07-28" },
              body: JSON.stringify({
                type: "Email",
                contactId: lead.ghl_contact_id || "",
                subject: `${client.business_name} — Quick question`,
                html: `<p>${message.replace(/\n/g, "<br>")}</p>`,
                emailFrom: client.email || "growth@shortstack.work",
              }),
            });
            results.emails_sent++;
          }
        }

        if (channel === "sms" && lead.phone && ghlKey && lead.ghl_contact_id) {
          await fetch("https://services.leadconnectorhq.com/conversations/messages", {
            method: "POST",
            headers: { Authorization: `Bearer ${ghlKey}`, "Content-Type": "application/json", Version: "2021-07-28" },
            body: JSON.stringify({ type: "SMS", contactId: lead.ghl_contact_id, message }),
          });
          results.sms_sent++;
        }

        if ((channel === "instagram_dm" || channel === "facebook_dm") && connectedPlatforms.includes("zernio")) {
          // Queue DM via Zernio/social platform connection
          await supabase.from("outreach_log").insert({
            lead_id: lead.id,
            platform: channel.replace("_dm", "") as "instagram" | "facebook" | "linkedin" | "tiktok",
            business_name: lead.business_name,
            recipient_handle: lead[`${channel.replace("_dm", "")}_url` as keyof typeof lead] as string || "",
            message_text: message,
            status: "sent",
          });
          results.dms_queued++;
        }

      } catch (err) {
        results.errors.push(`${channel}/${lead.business_name}: ${err}`);
      }
    }

    // Update lead status — owner-scoped (ownership already verified above).
    await supabase.from("leads").update({ status: "called" }).eq("id", lead.id).eq("user_id", ownerId);

    // Schedule follow-ups
    const day3 = new Date(); day3.setDate(day3.getDate() + 3);
    const day7 = new Date(); day7.setDate(day7.getDate() + 7);
    const { data: outreachEntry } = await supabase.from("outreach_log")
      .select("id").eq("lead_id", lead.id).order("created_at", { ascending: false }).limit(1).single();

    if (outreachEntry) {
      await supabase.from("follow_up_queue").insert([
        { outreach_id: outreachEntry.id, lead_id: lead.id, platform: "instagram", followup_number: 1, scheduled_date: day3.toISOString().split("T")[0], status: "pending" },
        { outreach_id: outreachEntry.id, lead_id: lead.id, platform: "instagram", followup_number: 2, scheduled_date: day7.toISOString().split("T")[0], status: "pending" },
      ]);
    }

    await new Promise(r => setTimeout(r, 300));
  }

  // Log
  await supabase.from("trinity_log").insert({
    action_type: "email_campaign",
    description: `Client outreach for ${client.business_name}: ${results.emails_sent} emails, ${results.dms_queued} DMs, ${results.sms_sent} SMS`,
    client_id,
    status: "completed",
    result: results,
    completed_at: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, results, leads_contacted: leads.length });
}
