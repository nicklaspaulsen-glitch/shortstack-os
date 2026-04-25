import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Simple in-memory rate limiter mirroring the funnels/analytics pattern
// (IP -> [timestamps] sliding window). Public endpoint, so this caps the
// damage from a flood of forged survey submissions trying to spam the
// trinity_log activity feed.
const rateLimitMap = new Map<string, number[]>();
const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 20;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (rateLimitMap.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);
  return timestamps.length > MAX_REQUESTS;
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const { score, feedback, client_id } = await request.json();

  // Validate NPS score is a number between 0-10
  if (score === undefined || score === null || typeof score !== "number" || score < 0 || score > 10 || !Number.isInteger(score)) {
    return NextResponse.json({ error: "Score must be an integer between 0 and 10" }, { status: 400 });
  }

  // Sanitize feedback length
  const sanitizedFeedback = typeof feedback === "string" ? feedback.substring(0, 2000) : null;

  const supabase = createServiceClient();

  // If client_id is supplied, verify the client actually exists. Without
  // this an attacker can spam trinity_log with NPS rows pointing at any
  // arbitrary UUID, polluting the activity feed of unrelated tenants.
  // Anonymous submissions (no client_id) still allowed for public NPS forms.
  if (client_id) {
    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("id", client_id)
      .maybeSingle();
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }
  }

  await supabase.from("trinity_log").insert({
    agent: "analytics",
    action_type: "custom",
    description: `NPS Survey: ${score}/10${sanitizedFeedback ? ` — "${sanitizedFeedback.substring(0, 100)}"` : ""}`,
    client_id: client_id || null,
    status: "completed",
    result: { type: "nps_survey", score, feedback: sanitizedFeedback, submitted_at: new Date().toISOString() },
  });

  // Notify on Telegram
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (chatId && botToken) {
    const emoji = score >= 9 ? "🟢" : score >= 7 ? "🟡" : "🔴";
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `${emoji} NPS Survey Response\n\nScore: ${score}/10\n${sanitizedFeedback ? `Feedback: "${sanitizedFeedback}"` : "No feedback provided"}`,
      }),
    });
  }

  return NextResponse.json({ success: true });
}
