import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Webhook Trigger System — sends events to Zapier/Make.com/custom URLs
// Triggered internally when events happen (new lead, deal closed, etc.)
export async function POST(request: NextRequest) {
  const { event, data, webhook_url } = await request.json();

  if (!event) return NextResponse.json({ error: "event required" }, { status: 400 });

  const supabase = createServiceClient();

  // Get all configured webhook URLs for this event
  const urls: string[] = [];

  if (webhook_url) {
    urls.push(webhook_url);
  }

  // Check for Zapier/Make.com URLs in env
  const zapierUrl = process.env.ZAPIER_WEBHOOK_URL;
  const makeUrl = process.env.MAKE_API_KEY; // Make.com webhook

  if (zapierUrl) urls.push(zapierUrl);
  if (makeUrl && makeUrl.startsWith("https://")) urls.push(makeUrl);

  const results: Array<{ url: string; status: number; ok: boolean }> = [];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event,
          timestamp: new Date().toISOString(),
          source: "shortstack_os",
          data,
        }),
      });
      results.push({ url: url.substring(0, 50) + "...", status: res.status, ok: res.ok });
    } catch {
      results.push({ url: url.substring(0, 50) + "...", status: 0, ok: false });
    }
  }

  // Log
  await supabase.from("trinity_log").insert({
    action_type: "automation",
    description: `Webhook: ${event} → ${results.length} endpoints`,
    status: results.every(r => r.ok) ? "completed" : "failed",
    result: { event, endpoints: results.length, results },
  });

  return NextResponse.json({ success: true, event, triggered: results.length, results });
}

// Helper: trigger webhook from other API routes
export async function triggerWebhook(event: string, data: Record<string, unknown>) {
  const urls = [process.env.ZAPIER_WEBHOOK_URL, process.env.MAKE_API_KEY].filter(Boolean);
  for (const url of urls) {
    if (!url) continue;
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, timestamp: new Date().toISOString(), source: "shortstack_os", data }),
    }).catch(() => {});
  }
}
