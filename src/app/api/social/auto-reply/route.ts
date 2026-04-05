import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// AI Auto-Reply Bot — Automatically replies to social media comments for clients
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { client_id, comments, tone } = await request.json();

  let clientName = "the business";
  if (client_id) {
    const { data: client } = await supabase.from("clients").select("business_name").eq("id", client_id).single();
    if (client) clientName = client.business_name;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      system: `You manage social media for ${clientName}. Reply to comments naturally. Tone: ${tone || "friendly, professional"}. For negative: empathize and offer help. For positive: thank warmly. For questions: answer helpfully. Return JSON array only.`,
      messages: [{ role: "user", content: `Reply to these comments:\n${(Array.isArray(comments) ? comments : [comments]).map((c: string, i: number) => `${i + 1}. "${c}"`).join("\n")}\n\nReturn JSON array: [{comment, reply, should_like, sentiment}]` }],
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text || "[]";
  try {
    return NextResponse.json({ success: true, replies: JSON.parse(text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()) });
  } catch {
    return NextResponse.json({ success: true, replies: [{ comment: comments, reply: text }] });
  }
}
