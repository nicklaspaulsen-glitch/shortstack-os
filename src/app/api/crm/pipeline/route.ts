import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

// CRM Pipeline — Get deal pipeline data for drag-and-drop board
export async function GET(_request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const stages = ["new", "called", "not_interested", "booked", "converted"];

  const pipeline: Record<string, Array<Record<string, unknown>>> = {};

  for (const stage of stages) {
    const { data } = await supabase
      .from("leads")
      .select("id, business_name, phone, email, industry, google_rating, review_count, source, scraped_at")
      .eq("user_id", ownerId)
      .eq("status", stage)
      .order("scraped_at", { ascending: false })
      .limit(50);
    pipeline[stage] = data || [];
  }

  const { data: deals } = await supabase
    .from("deals")
    .select("*")
    .eq("user_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json({ success: true, pipeline, deals: deals || [], stages });
}

// Move a lead between pipeline stages
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { lead_id, new_status, notes } = await request.json();

  // Scope the update so callers can only mutate leads they own.
  const { error } = await supabase
    .from("leads")
    .update({ status: new_status })
    .eq("id", lead_id)
    .eq("user_id", ownerId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If moved to "converted", create a deal
  if (new_status === "converted") {
    const { data: lead } = await supabase
      .from("leads")
      .select("*")
      .eq("id", lead_id)
      .eq("user_id", ownerId)
      .single();
    if (lead) {
      await supabase.from("deals").insert({
        user_id: ownerId,
        client_name: lead.business_name,
        service: "Digital Marketing",
        amount: 0,
        status: "won",
        closed_at: new Date().toISOString(),
        notes: notes || "Converted from lead pipeline",
      });

      const { sendTelegramMessage } = await import("@/lib/services/trinity");
      const chatId = process.env.TELEGRAM_CHAT_ID;
      if (chatId) {
        await sendTelegramMessage(chatId, `🎉 *Lead Converted!*\n\n${lead.business_name} moved to converted!`);
      }
    }
  }

  return NextResponse.json({ success: true });
}
