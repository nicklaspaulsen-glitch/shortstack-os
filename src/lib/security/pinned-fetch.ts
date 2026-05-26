/**
 * Shared IP-pinning utilities for outbound SSRF-safe HTTP POST requests.
 *
 * Provides a two-step pattern that closes the TOCTOU DNS-rebinding window:
 *   1. resolveAndPin(hostname) — resolves ALL A + AAAA records, rejects if
 *      any resolve to a private/internal address, returns the first safe IP.
 *   2. pinnedPost(url, ip, family, payload, ...) — uses Node's https.request()
 *      with a custom `lookup` function that returns the pre-verified IP,
 *      bypassing the OS resolver entirely.  No matter how quickly an attacker
 *      flips their DNS record after passing the validation check, the TCP
 *      connection always goes to the same IP that was verified.
 *
 * Usage pattern:
 *   const resolution = await resolveAndPin(hostname);
 *   if (!resolution || resolution === "PRIVATE") { reject(); }
 *   await pinnedPost(url, resolution.address, resolution.family, body);
 */
import dns from "dns";
import https from "https";
import type { LookupFunction } from "net";
import { isPrivateOrInternal } from "@/lib/security/ssrf-guard";

/** A resolved, public address ready for IP-pinning on the outgoing connection. */
export interface SafeAddress {
  address: string;
  family: 4 | 6;
}

/** Race a promise against a fixed deadline; throws on timeout. */
function withDnsTimeout<T>(p: Promise<T>, ms = 5000): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`DNS lookup timed out after ${ms}ms`)), ms),
    ),
  ]);
}

/**
 * Resolve `hostname` to ALL its A and AAAA records, then verify that none of
 * them fall in a private / loopback / link-local range.
 *
 * Returns:
 *   SafeAddress  — all records are public; use `.address` + `.family` for pinning
 *   "PRIVATE"    — at least one address is private/internal (reject the URL)
 *   null         — hostname could not be resolved at all (reject the URL)
 *
 * Uses resolve4/resolve6 rather than lookup so the full record set is visible.
 * dns.promises.lookup only returns one address, which means a host that
 * advertises both a public IP and a private IP could slip through if the OS
 * resolver returns the public one during validation and the private one on the
 * actual connection.  resolve4/resolve6 return all records so we can reject if
 * ANY address is private.
 */
export async function resolveAndPin(
  hostname: string,
): Promise<SafeAddress | "PRIVATE" | null> {
  let v4addrs: string[] = [];
  let v6addrs: string[] = [];

  try {
    v4addrs = await withDnsTimeout(dns.promises.resolve4(hostname));
  } catch {
    /* no A record, DNS error, or timeout — may still have AAAA */
  }

  try {
    v6addrs = await withDnsTimeout(dns.promises.resolve6(hostname));
  } catch {
    /* no AAAA record */
  }

  // Must resolve to at least one address; fail closed otherwise.
  if (v4addrs.length === 0 && v6addrs.length === 0) return null;

  // Reject if ANY resolved address across both families is private.
  for (const addr of v4addrs) {
    if (isPrivateOrInternal(addr)) {
      console.warn(
        `[pinned-fetch] SSRF: resolved IPv4 "${addr}" for "${hostname}" is private — rejecting`,
      );
      return "PRIVATE";
    }
  }
  for (const addr of v6addrs) {
    if (isPrivateOrInternal(addr)) {
      console.warn(
        `[pinned-fetch] SSRF: resolved IPv6 "${addr}" for "${hostname}" is private — rejecting`,
      );
      return "PRIVATE";
    }
  }

  // Prefer IPv4 for the pinned connection; use the first address in each family.
  const v4addr = v4addrs[0] ?? null;
  const v6addr = v6addrs[0] ?? null;
  return v4addr ? { address: v4addr, family: 4 } : { address: v6addr!, family: 6 };
}

/**
 * POST a JSON payload to a pre-validated webhook URL with IP pinning.
 *
 * The custom `lookup` function supplied to https.request() returns the
 * pre-verified IP directly, bypassing the OS DNS resolver entirely.  This
 * ensures the outgoing TCP SYN packet goes to the IP that was validated by
 * `resolveAndPin`, not to whatever the OS resolver returns at connect time.
 *
 * @param url          Full HTTPS URL (protocol, host, path, query).
 * @param pinnedIp     The IP address validated by resolveAndPin.
 * @param pinnedFamily IP address family (4 = IPv4, 6 = IPv6).
 * @param payload      Serialised JSON string to send as the body.
 * @param extraHeaders Additional headers merged with Content-Type / Content-Length.
 * @param timeoutMs    Socket / request timeout in milliseconds (default 8 s).
 */
export async function pinnedPost(
  url: string,
  pinnedIp: string,
  pinnedFamily: 4 | 6,
  payload: string,
  extraHeaders: Record<string, string> = {},
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
          ...extraHeaders,
        },
        lookup,
        timeout: timeoutMs,
      },
      (res) => {
        res.resume(); // drain response so the socket is released promptly
        const status = res.statusCode ?? 0;
        resolve({ status, ok: status >= 200 && status < 300 });
      },
    );

    req.on("timeout", () =>
      req.destroy(new Error(`pinnedPost timed out after ${timeoutMs}ms`)),
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}
