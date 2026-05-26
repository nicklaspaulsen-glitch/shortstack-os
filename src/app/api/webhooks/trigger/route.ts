import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { isPrivateOrInternal, isValidExternalHttpsUrl } from "@/lib/security/ssrf-guard";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { resolveAndPin, pinnedPost } from "@/lib/security/pinned-fetch";

// Webhook Trigger System — sends events to Zapier/Make.com/custom URLs
// Triggered internally when events happen (new lead, deal closed, etc.)
// Rate limited: 20 dispatches/min per user to prevent flood abuse.
export async function POST(request: NextRequest) {
  // Auth check — only authenticated users can trigger outbound webhooks
  const authSupabase = createServerSupabase();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createServiceClient();

  // Per-user distributed rate limit: 20 webhook dispatches per minute.
  // Uses Supabase-backed atomic bucket — persists across Vercel cold starts
  // unlike src/lib/rate-limit (in-memory) which resets on every new instance.
  const rl = await checkRateLimit(supabase, user.id, "webhook_trigger", 20);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please wait before triggering more webhooks." },
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSec) },
      },
    );
  }

  const { event, data, webhook_url } = await request.json();

  if (!event || typeof event !== "string") return NextResponse.json({ error: "event required" }, { status: 400 });

  // Each entry is either a user-supplied URL (pinned to its pre-verified IP)
  // or an env-configured URL (trusted operator config, uses regular fetch).
  interface PinnedTarget { url: string; pinnedIp: string; pinnedFamily: 4 | 6 }
  interface TrustedTarget { url: string }
  type WebhookTarget = { kind: "pinned" } & PinnedTarget | { kind: "trusted" } & TrustedTarget;
  const targets: WebhookTarget[] = [];

  // ── User-supplied webhook_url ──────────────────────────────────────────
  // Three-layer SSRF defence:
  //   Layer 1 — reject IP literals and obvious private hostnames
  //   Layer 2 — DNS resolve + verify every resolved address is public
  //   Layer 3 — IP pinning: the TCP connection goes to the pre-verified IP,
  //             bypassing OS DNS entirely so DNS-rebinding is impossible
  //             even if the attacker flips their record between check & send
  if (webhook_url) {
    try {
      const parsed = new URL(webhook_url);
      if (parsed.protocol !== "https:") {
        return NextResponse.json({ error: "webhook_url must use HTTPS" }, { status: 400 });
      }
      // Reject credentials in the URL — they leak to the destination server and
      // could be used to reach auth-protected internal endpoints (e.g.
      // https://admin:secret@internal.corp/). Zero legitimate webhooks need them.
      if (parsed.username || parsed.password) {
        return NextResponse.json({ error: "webhook_url must not include credentials" }, { status: 400 });
      }
      // Layer 1: reject IP literals and obvious private hostnames.
      if (isPrivateOrInternal(parsed.hostname)) {
        return NextResponse.json({ error: "Invalid webhook_url target" }, { status: 400 });
      }
      // Layer 2: DNS resolution — verify the hostname doesn't point private.
      const resolved = await resolveAndPin(parsed.hostname);
      if (resolved === null) {
        console.warn(`[webhooks/trigger] SSRF: DNS lookup returned no address for "${parsed.hostname}" — rejecting`);
        return NextResponse.json({ error: "Invalid webhook_url: hostname could not be resolved" }, { status: 400 });
      }
      if (resolved === "PRIVATE") {
        // Detailed log already emitted inside resolveAndCheck.
        return NextResponse.json({ error: "Invalid webhook_url target" }, { status: 400 });
      }
      // Layer 3: store the pre-verified IP so pinnedPost can bypass DNS.
      targets.push({ kind: "pinned", url: webhook_url, pinnedIp: resolved.address, pinnedFamily: resolved.family });
    } catch (err) {
      if ((err as { status?: number }).status) throw err; // re-throw NextResponse-shaped errors
      return NextResponse.json({ error: "Invalid webhook_url" }, { status: 400 });
    }
  }

  // ── Env-configured Zapier / Make.com URLs ─────────────────────────────
  // These are set by operators, not end-users, so they are trusted.
  // We still validate format + layer-1 hostname check; no DNS pinning needed.
  const zapierUrl = process.env.ZAPIER_WEBHOOK_URL;
  const makeUrl = process.env.MAKE_WEBHOOK_URL || process.env.MAKE_API_KEY;
  if (zapierUrl && isValidExternalHttpsUrl(zapierUrl)) targets.push({ kind: "trusted", url: zapierUrl });
  if (makeUrl && isValidExternalHttpsUrl(makeUrl)) targets.push({ kind: "trusted", url: makeUrl });

  const results: Array<{ url: string; status: number; ok: boolean }> = [];
  const payloadStr = JSON.stringify({
    event,
    timestamp: new Date().toISOString(),
    source: "shortstack_os",
    data,
  });

  for (const target of targets) {
    try {
      let status: number;
      let ok: boolean;
      if (target.kind === "pinned") {
        // IP-pinned dispatch — closes the DNS-rebinding TOCTOU window.
        const r = await pinnedPost(target.url, target.pinnedIp, target.pinnedFamily, payloadStr);
        status = r.status;
        ok = r.ok;
      } else {
        // Operator-configured URL — trusted, use built-in fetch.
        // redirect: "error" prevents a redirect to a private/internal IP
        // from being silently followed (SSRF via open redirect).
        const res = await fetch(target.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payloadStr,
          redirect: "error",
        });
        status = res.status;
        ok = res.ok;
      }
      results.push({ url: target.url.substring(0, 50) + "...", status, ok });
    } catch (err) {
      console.error("[webhooks/trigger] dispatch failed for target", target.url.substring(0, 50), err);
      results.push({ url: target.url.substring(0, 50) + "...", status: 0, ok: false });
    }
  }

  // Log — non-fatal; wrap so a log failure doesn't fail the dispatch response.
  try {
    await supabase.from("trinity_log").insert({
      user_id: user.id,
      action_type: "automation",
      description: `Webhook: ${event} → ${results.length} endpoints`,
      status: results.every(r => r.ok) ? "completed" : "failed",
      result: { event, endpoints: results.length, results },
    });
  } catch (logErr) {
    console.error("[webhooks/trigger] trinity_log insert failed:", logErr);
  }

  return NextResponse.json({ success: true, event, triggered: results.length, results });
}


