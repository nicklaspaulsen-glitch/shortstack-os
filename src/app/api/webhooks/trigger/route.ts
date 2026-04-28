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

  // Validate webhook_url to prevent SSRF — Apr 28 audit hardened the
  // allowlist. Previously only blocked an explicit list of hostnames
  // (`localhost`, `127.0.0.1`, `[::1]`, `*.internal`) — left RFC1918
  // private ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16) and
  // IPv6 ULA wide open. An authenticated user could POST a webhook
  // pointing at any internal/private network address.
  if (webhook_url) {
    try {
      const parsed = new URL(webhook_url);
      if (parsed.protocol !== "https:") {
        return NextResponse.json({ error: "webhook_url must use HTTPS" }, { status: 400 });
      }
      if (isPrivateOrInternal(parsed.hostname)) {
        return NextResponse.json({ error: "Invalid webhook_url target" }, { status: 400 });
      }
      urls.push(webhook_url);
    } catch {
      return NextResponse.json({ error: "Invalid webhook_url" }, { status: 400 });
    }
  }

  // Check for env-configured Zapier/Make.com webhook URLs. Apr 28 audit:
  // the previous code treated MAKE_API_KEY (a misnomer — it was actually
  // expected to hold a webhook URL) as a fetch target via a fragile
  // `startsWith("https://")` check. If anyone ever set an actual API
  // key in that var, fetches would silently skip; if a misconfig set it
  // to a URL, fanouts would fire there. Renamed to MAKE_WEBHOOK_URL with
  // back-compat for the legacy var, and validate as a URL.
  const zapierUrl = process.env.ZAPIER_WEBHOOK_URL;
  const makeUrl = process.env.MAKE_WEBHOOK_URL || process.env.MAKE_API_KEY;
  if (zapierUrl && isValidExternalHttpsUrl(zapierUrl)) urls.push(zapierUrl);
  if (makeUrl && isValidExternalHttpsUrl(makeUrl)) urls.push(makeUrl);

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

/**
 * Reject hostnames that resolve to private / link-local / loopback
 * networks. Block list covers RFC1918 IPv4, IPv6 ULA, link-local,
 * loopback, and the cloud metadata endpoint. Pure string matching —
 * does NOT do DNS resolution, so a hostname that resolves to a private
 * IP via DNS rebinding can still bypass this. For full rebinding
 * defense we'd need to resolve + check at fetch time.
 */
function isPrivateOrInternal(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return true;
  // IPv4 literal
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = ipv4.slice(1).map(Number);
    if (a === 10) return true;                                    // 10.0.0.0/8
    if (a === 127) return true;                                   // loopback
    if (a === 0) return true;                                     // 0.0.0.0
    if (a === 169 && b === 254) return true;                      // link-local + cloud meta
    if (a === 172 && b >= 16 && b <= 31) return true;             // 172.16.0.0/12
    if (a === 192 && b === 168) return true;                      // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true;            // CGNAT 100.64.0.0/10
  }
  // IPv6 — bracketed or bare
  if (host === "[::1]" || host === "::1") return true;
  if (host.startsWith("[fc") || host.startsWith("[fd")) return true; // ULA fc00::/7
  if (host.startsWith("[fe80")) return true;                          // link-local
  return false;
}

function isValidExternalHttpsUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && !isPrivateOrInternal(u.hostname);
  } catch {
    return false;
  }
}

