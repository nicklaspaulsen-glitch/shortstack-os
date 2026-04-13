import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

// Webhook Trigger System — sends events to Zapier/Make.com/custom URLs
// Triggered internally when events happen (new lead, deal closed, etc.)
// TODO: Add rate limiting in production to prevent webhook flood abuse
export async function POST(request: NextRequest) {
  // Auth check — only authenticated users can trigger outbound webhooks
  const authSupabase = createServerSupabase();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { event, data, webhook_url } = await request.json();

  if (!event || typeof event !== "string") return NextResponse.json({ error: "event required" }, { status: 400 });

  const supabase = createServiceClient();

  // Get all configured webhook URLs for this event
  const urls: string[] = [];

  // Validate webhook_url to prevent SSRF — only allow HTTPS URLs to external services
  if (webhook_url) {
    try {
      const parsed = new URL(webhook_url);
      if (parsed.protocol !== "https:") {
        return NextResponse.json({ error: "webhook_url must use HTTPS" }, { status: 400 });
      }
      // Block internal/private network URLs
      const blockedHosts = ["localhost", "127.0.0.1", "0.0.0.0", "169.254.169.254", "[::1]"];
      if (blockedHosts.some(h => parsed.hostname === h || parsed.hostname.endsWith(".internal"))) {
        return NextResponse.json({ error: "Invalid webhook_url target" }, { status: 400 });
      }
      urls.push(webhook_url);
    } catch {
      return NextResponse.json({ error: "Invalid webhook_url" }, { status: 400 });
    }
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

