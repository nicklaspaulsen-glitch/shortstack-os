import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// General-purpose AI agent — uses Haiku (fast) with OpenAI fallback
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { prompt, agent_name } = await request.json();
  if (!prompt) return NextResponse.json({ error: "Prompt required" }, { status: 400 });

  const systemPrompt = `You are ${agent_name || "an AI agent"} at ShortStack digital marketing agency. Give detailed, actionable, professional output. No markdown formatting. Plain text with clear sections.`;

  // Try Claude Haiku first (fast — ~4 seconds)
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": anthropicKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 2000,
          system: systemPrompt,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await res.json();
      const reply = data.content?.[0]?.text;
      if (reply) return NextResponse.json({ success: true, result: reply, model: "claude-haiku" });
    } catch {}
  }

  // Fallback to OpenAI GPT-4
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: 2000,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
          ],
        }),
      });
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content;
      if (reply) return NextResponse.json({ success: true, result: reply, model: "gpt-4o-mini" });
    } catch {}
  }

  return NextResponse.json({ error: "No AI service available" }, { status: 500 });
}
