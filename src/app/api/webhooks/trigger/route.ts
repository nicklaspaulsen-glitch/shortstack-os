import { NextRequest, NextResponse } from "next/server";
import dns from "dns";
import https from "https";
import type { LookupFunction } from "net";
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
        const res = await fetch(target.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payloadStr,
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
async function resolveAndCheck(hostname: string): Promise<SafeAddress | "PRIVATE" | null> {
  let v4addrs: string[] = [];
  let v6addrs: string[] = [];

  try {
    v4addrs = await dns.promises.resolve4(hostname);
  } catch { /* no A record — may still have AAAA */ }

  try {
    v6addrs = await dns.promises.resolve6(hostname);
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

/**
 * Reject hostnames that resolve to private / link-local / loopback
 * networks. Block list covers RFC1918 IPv4, IPv6 ULA, link-local,
 * loopback, and the cloud metadata endpoint. Pure string matching —
 * used as layer 1; resolveAndCheck() is layer 2 (DNS rebinding defense).
 *
 * Non-dotted IPv4 encodings (decimal-int 2130706433, hex 0x7f000001,
 * octal 0177.0.0.1, short-form 127.1) are handled before this function
 * is called: Node's WHATWG `URL` constructor normalises them all to
 * standard dotted-decimal notation as required by the URL spec, so
 * `parsed.hostname` is always canonical by the time we reach here.
 *
 * IPv6 addresses from DNS resolution arrive without brackets; the bare-
 * form checks below handle both the bracketed literal and the bare form.
 */
function isPrivateOrInternal(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return true;
  // IPv4 literal (always dotted-decimal at this point — see note above)
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
  // IPv6 — strip optional brackets so both literals and DNS results match.
  const bare = host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
  if (bare === "::1") return true;                                    // loopback
  if (bare === "::") return true;                                     // unspecified
  if (bare.startsWith("fc") || bare.startsWith("fd")) return true;   // ULA fc00::/7
  if (bare.startsWith("fe80")) return true;                           // link-local
  if (bare.startsWith("::ffff:")) return true;                        // IPv4-mapped IPv6
  if (bare.startsWith("2002:")) return true;                          // 6to4 — encodes IPv4 in bits [16:47]; e.g. 2002:7f00:1:: → 127.0.0.1
  if (bare.startsWith("64:ff9b:")) return true;                       // NAT64 IANA well-known prefix (RFC 6052) — maps to IPv4
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

