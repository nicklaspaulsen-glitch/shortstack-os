import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

// Social Profile Enricher — scans lead websites to find Instagram, Facebook, LinkedIn, TikTok
export async function POST(request: NextRequest) {
  // Auth check — only authenticated users can enrich leads
  const authSupabase = createServerSupabase();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { lead_ids, batch_size } = await request.json();
  const supabase = createServiceClient();

  let leads;
  if (lead_ids?.length > 0) {
    const { data } = await supabase.from("leads").select("id, website, business_name").in("id", lead_ids);
    leads = data;
  } else {
    const { data } = await supabase.from("leads").select("id, website, business_name")
      .not("website", "is", null).is("instagram_url", null).is("facebook_url", null).limit(batch_size || 10);
    leads = data;
  }

  if (!leads || leads.length === 0) return NextResponse.json({ enriched: 0 });

  let enriched = 0;
  const results: Array<Record<string, string>> = [];

  for (const lead of leads) {
    if (!lead.website) continue;
    try {
      const res = await fetch(lead.website, { headers: { "User-Agent": "Mozilla/5.0 (compatible; ShortStackBot/1.0)" }, signal: AbortSignal.timeout(5000) });
      const html = await res.text();
      const updates: Record<string, string> = {};
      const r: Record<string, string> = { business: lead.business_name };

      const igM = html.match(/instagram\.com\/([a-zA-Z0-9_.]{2,30})/i);
      if (igM && !["p","reel","stories","explore","accounts"].includes(igM[1])) { updates.instagram_url = `https://instagram.com/${igM[1]}`; r.ig = igM[1]; }

      const fbM = html.match(/facebook\.com\/([a-zA-Z0-9.]{2,50})/i);
      if (fbM && !["sharer","share","dialog","plugins","tr"].includes(fbM[1])) { updates.facebook_url = `https://facebook.com/${fbM[1]}`; r.fb = fbM[1]; }

      const liM = html.match(/linkedin\.com\/(?:company|in)\/([a-zA-Z0-9-]+)/i);
      if (liM) { updates.linkedin_url = `https://linkedin.com/company/${liM[1]}`; r.li = liM[1]; }

      const ttM = html.match(/tiktok\.com\/@([a-zA-Z0-9_.]+)/i);
      if (ttM) { updates.tiktok_url = `https://tiktok.com/@${ttM[1]}`; r.tt = ttM[1]; }

      if (Object.keys(updates).length > 0) { await supabase.from("leads").update(updates).eq("id", lead.id); enriched++; results.push(r); }
    } catch {}
  }

  if (enriched > 0) {
    try {
      const { sendTelegramMessage } = await import("@/lib/services/trinity");
      const chatId = process.env.TELEGRAM_CHAT_ID;
      if (chatId) await sendTelegramMessage(chatId, `🔍 *Enricher*\n${enriched}/${leads.length} leads got social profiles`);
    } catch {}
  }

  return NextResponse.json({ success: true, enriched, total: leads.length, results });
}
