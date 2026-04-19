import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Budget & Usage Alert Cron — checks API spend and token limits, alerts via Telegram
// Run daily or every 6h. Monitors: Stripe, ElevenLabs, RunPod, Anthropic, SendGrid, Twilio
export const maxDuration = 120;

interface AlertItem {
  service: string;
  metric: string;
  current: number | string;
  limit: number | string;
  severity: "warning" | "critical";
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const alerts: AlertItem[] = [];
  const checks: Record<string, string> = {};

  // ── 1. ElevenLabs Usage ──
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY || "" },
    });
    if (res.ok) {
      const data = await res.json();
      const charUsed = data.character_count || 0;
      const charLimit = data.character_limit || 10000;
      const pct = charLimit > 0 ? Math.round((charUsed / charLimit) * 100) : 0;
      checks.elevenlabs = `${pct}% (${charUsed.toLocaleString()}/${charLimit.toLocaleString()} chars)`;

      if (pct >= 90) alerts.push({ service: "ElevenLabs", metric: "Character usage", current: `${pct}%`, limit: `${charLimit.toLocaleString()} chars`, severity: "critical" });
      else if (pct >= 75) alerts.push({ service: "ElevenLabs", metric: "Character usage", current: `${pct}%`, limit: `${charLimit.toLocaleString()} chars`, severity: "warning" });
    }
  } catch { checks.elevenlabs = "error"; }

  // ── 2. RunPod Balance ──
  try {
    const res = await fetch("https://api.runpod.io/graphql?api_key=" + (process.env.RUNPOD_API_KEY || ""), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "{ myself { currentSpend { amount } creditBalance } }" }),
    });
    if (res.ok) {
      const data = await res.json();
      const balance = data.data?.myself?.creditBalance || 0;
      const spend = data.data?.myself?.currentSpend?.amount || 0;
      checks.runpod = `$${balance.toFixed(2)} balance, $${spend.toFixed(2)} spent`;

      if (balance < 5) alerts.push({ service: "RunPod", metric: "Credit balance", current: `$${balance.toFixed(2)}`, limit: "$5 minimum", severity: "critical" });
      else if (balance < 15) alerts.push({ service: "RunPod", metric: "Credit balance", current: `$${balance.toFixed(2)}`, limit: "$15 warning", severity: "warning" });
    }
  } catch { checks.runpod = "error"; }

  // ── 3. SendGrid Usage ──
  try {
    const today = new Date().toISOString().split("T")[0];
    const monthStart = today.slice(0, 7) + "-01";
    const res = await fetch(`https://api.sendgrid.com/v3/stats?start_date=${monthStart}&end_date=${today}&aggregated_by=month`, {
      headers: { Authorization: `Bearer ${process.env.SENDGRID_API_KEY || ""}` },
    });
    if (res.ok) {
      const data = await res.json();
      const stats = data[0]?.stats?.[0]?.metrics || {};
      const sent = stats.requests || 0;
      const FREE_TIER_LIMIT = 100; // SendGrid free = 100/day
      checks.sendgrid = `${sent} emails this month`;

      if (sent > FREE_TIER_LIMIT * 25) alerts.push({ service: "SendGrid", metric: "Monthly sends", current: sent, limit: "High volume", severity: "warning" });
    }
  } catch { checks.sendgrid = "error"; }

  // ── 4. Anthropic (estimate from logs) ──
  try {
    const supabase = createServiceClient();
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: aiCallsToday } = await supabase
      .from("trinity_log")
      .select("id", { count: "exact", head: true })
      .gte("created_at", dayAgo);

    const calls = aiCallsToday || 0;
    checks.anthropic = `${calls} AI calls in 24h`;

    if (calls > 500) alerts.push({ service: "Anthropic", metric: "Daily API calls", current: calls, limit: "500/day budget", severity: "critical" });
    else if (calls > 200) alerts.push({ service: "Anthropic", metric: "Daily API calls", current: calls, limit: "200/day target", severity: "warning" });
  } catch { checks.anthropic = "error"; }

  // ── 5. Outreach volume check ──
  try {
    const supabase = createServiceClient();
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: outreachToday } = await supabase
      .from("outreach_log")
      .select("id", { count: "exact", head: true })
      .gte("created_at", dayAgo);

    const vol = outreachToday || 0;
    checks.outreach = `${vol} outreach actions in 24h`;

    if (vol > 200) alerts.push({ service: "Outreach", metric: "Daily volume", current: vol, limit: "200/day budget cap", severity: "warning" });
  } catch { checks.outreach = "error"; }

  // ── 6. Stripe MRR (revenue check) ──
  try {
    const supabase = createServiceClient();
    const { count: activeClients } = await supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .gt("mrr", 0);

    checks.stripe = `${activeClients || 0} paying clients`;
  } catch { checks.stripe = "error"; }

  // ── Send Telegram alert if any warnings ──
  if (alerts.length > 0) {
    const chatId = process.env.TELEGRAM_CHAT_ID;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (chatId && botToken) {
      const alertLines = alerts.map(a =>
        `${a.severity === "critical" ? "🔴" : "🟡"} ${a.service}: ${a.metric}\n   Current: ${a.current} | Limit: ${a.limit}`
      ).join("\n\n");

      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `💰 Budget & Usage Alert\n\n${alertLines}\n\n📊 Status: ${Object.entries(checks).map(([k, v]) => `${k}: ${v}`).join(" | ")}`,
        }),
      }).catch(() => {});
    }
  }

  // Store check results
  try {
    const supabase = createServiceClient();
    await supabase.from("trinity_log").insert({
      action_type: "custom",
      description: `Budget check: ${alerts.length} alerts`,
      status: alerts.length > 0 ? "failed" : "completed",
      result: { checks, alerts, timestamp: new Date().toISOString() },
    });
  } catch {}

  return NextResponse.json({ success: true, alerts, checks, alertCount: alerts.length });
}
