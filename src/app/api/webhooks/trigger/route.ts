import { NextRequest, NextResponse } from "next/server";
import dns from "dns";
import https from "https";
import type { LookupFunction } from "net";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { isPrivateOrInternal, isValidExternalHttpsUrl } from "@/lib/security/ssrf-guard";
import { rateLimit } from "@/lib/rate-limit";

// Webhook Trigger System — sends events to Zapier/Make.com/custom URLs
// Triggered internally when events happen (new lead, deal closed, etc.)
// Rate limited: 20 dispatches/min per user to prevent flood abuse.
export async function POST(request: NextRequest) {
  // Auth check — only authenticated users can trigger outbound webhooks
  const authSupabase = createServerSupabase();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Per-user rate limit: 20 webhook dispatches per minute.
  const rl = rateLimit(`webhook:${user.id}`, 20);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please wait before triggering more webhooks." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      },
    );
  }

  const { event, data, webhook_url } = await request.json();

  if (!event || typeof event !== "string") return NextResponse.json({ error: "event required" }, { status: 400 });

  const supabase = createServiceClient();

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
      const resolved = await resolveAndCheck(parsed.hostname);
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
    } catch {
      results.push({ url: target.url.substring(0, 50) + "...", status: 0, ok: false });
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

/** Resolved, safe address ready for connection pinning. */
interface SafeAddress {
  address: string;
  family: 4 | 6;
}

/**
 * Resolve `hostname` to ALL its addresses (both IPv4 and IPv6) and check
 * whether any of them fall in a private/loopback/link-local range.
 * Returns:
 *   - `SafeAddress`  — ALL resolved addresses are safe; use this for IP pinning
 *   - `"PRIVATE"`    — at least one address is blocked (reject the URL)
 *   - `null`         — hostname could not be resolved at all (reject the URL)
 *
 * Uses resolve4/resolve6 (not lookup) so we see every A/AAAA record.
 * dns.promises.lookup only returns one address, which means a host with
 * both a public IP and a private IP in its DNS records could bypass the
 * check if the OS resolver returns the public one during validation but
 * the private one during the actual connection. resolve4/resolve6 return
 * the full record set so we can reject if ANY address is private.
 */
/** Race a promise against a fixed timeout; throws on timeout. */
function withDnsTimeout<T>(p: Promise<T>, ms = 5000): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`DNS lookup timed out after ${ms}ms`)), ms)
    ),
  ]);
}

async function resolveAndCheck(hostname: string): Promise<SafeAddress | "PRIVATE" | null> {
  let v4addrs: string[] = [];
  let v6addrs: string[] = [];

  try {
    v4addrs = await withDnsTimeout(dns.promises.resolve4(hostname));
  } catch { /* no A record, timed out, or network error — may still have AAAA */ }

  try {
    v6addrs = await withDnsTimeout(dns.promises.resolve6(hostname));
  } catch { /* no AAAA record */ }

  // Must resolve to at least one address; fail closed otherwise.
  if (v4addrs.length === 0 && v6addrs.length === 0) return null;

  // Reject if ANY resolved address across BOTH families is private.
  for (const addr of v4addrs) {
    if (isPrivateOrInternal(addr)) {
      console.warn(`[webhooks/trigger] SSRF: resolved IPv4 for "${hostname}" (${addr}) is private — rejecting`);
      return "PRIVATE";
    }
  }
  for (const addr of v6addrs) {
    if (isPrivateOrInternal(addr)) {
      console.warn(`[webhooks/trigger] SSRF: resolved IPv6 for "${hostname}" (${addr}) is private — rejecting`);
      return "PRIVATE";
    }
  }

  // Prefer IPv4 for the pinned connection; use first address in each family.
  const v4addr = v4addrs[0] ?? null;
  const v6addr = v6addrs[0] ?? null;
  return v4addr ? { address: v4addr, family: 4 } : { address: v6addr!, family: 6 };
}

/**
 * POST JSON payload to a pre-validated webhook URL with IP pinning.
 *
 * Uses Node's `https.request()` with a custom `lookup` function that
 * returns the pre-verified IP directly, bypassing the OS DNS resolver
 * entirely. This closes the TOCTOU DNS-rebinding window: no matter how
 * quickly an attacker flips their DNS record after passing the validation
 * check, the outgoing TCP connection always goes to the same IP that was
 * verified.
 */
async function pinnedPost(
  url: string,
  pinnedIp: string,
  pinnedFamily: 4 | 6,
  payload: string,
  timeoutMs = 8000,
): Promise<{ status: number; ok: boolean }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const port = parsed.port ? Number(parsed.port) : 443;

    const lookup: LookupFunction = (_host, _opts, callback) => {
      // Return the pre-verified IP — bypasses OS DNS entirely.
      callback(null, pinnedIp, pinnedFamily);
    };

    const req = https.request(
      {
        hostname: parsed.hostname,
        port,
        path: (parsed.pathname || "/") + parsed.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
        lookup,
        timeout: timeoutMs,
      },
      (res) => {
        res.resume(); // drain response so socket is released promptly
        const status = res.statusCode ?? 0;
        resolve({ status, ok: status >= 200 && status < 300 });
      },
    );

    req.on("timeout", () => req.destroy(new Error(`webhook timed out after ${timeoutMs}ms`)));
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}


