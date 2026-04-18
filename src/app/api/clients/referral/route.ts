import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireOwnedClient } from "@/lib/security/require-owned-client";

// Client Referral System — Track referrals and generate referral program materials
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action, client_id, referred_name, referred_email, referred_phone } = await request.json();

  if (action === "create_referral") {
    // Ownership: the referring client_id must belong to the caller's agency.
    const ctx = await requireOwnedClient(supabase, user.id, client_id);
    if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Log a new referral
    const { data: client } = await supabase.from("clients").select("business_name, contact_name").eq("id", client_id).single();

    await supabase.from("trinity_log").insert({
      action_type: "custom",
      description: `Referral from ${client?.business_name || "client"}: ${referred_name} (${referred_email})`,
      client_id,
      status: "completed",
      result: { referred_name, referred_email, referred_phone, referred_by: client?.contact_name },
      completed_at: new Date().toISOString(),
    });

    // Create as a lead
    await supabase.from("leads").insert({
      business_name: referred_name,
      email: referred_email,
      phone: referred_phone,
      source: "referral",
      status: "new",
      category: `Referred by ${client?.business_name || "client"}`,
    });

    // Notify on Telegram
    const { sendTelegramMessage } = await import("@/lib/services/trinity");
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (chatId) {
      await sendTelegramMessage(chatId, `🎁 *New Referral!*\n\n${client?.business_name} referred:\n*${referred_name}*\n${referred_email}\n${referred_phone || "no phone"}`);
    }

    return NextResponse.json({ success: true });
  }

  if (action === "generate_program") {
    // Generate referral program materials with AI
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        system: "You are designing a client referral program for ShortStack agency. Return valid JSON only.",
        messages: [{ role: "user", content: `Create a referral program for ShortStack clients.

Return JSON with:
- program_name: catchy name
- reward_structure: { referrer_reward, referred_reward }
- email_template: { subject, body } for announcing the program
- social_post: shareable post for clients
- landing_page_copy: headline + 3 bullet points
- terms: array of program rules` }],
      }),
    });

    const data = await res.json();
    const text = data.content?.[0]?.text || "{}";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    try {
      return NextResponse.json({ success: true, program: JSON.parse(cleaned) });
    } catch {
      return NextResponse.json({ success: true, program: { raw: text } });
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
