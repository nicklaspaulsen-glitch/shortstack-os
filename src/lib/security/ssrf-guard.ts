/**
 * SSRF Guard — shared helpers for blocking requests to private/internal network targets.
 *
 * Used by any route that accepts a user-supplied URL and forwards it to an
 * external service (RunPod, outbound webhooks, etc.).
 */

/**
 * Reject hostnames that resolve to private / link-local / loopback /
 * reserved networks. Block list covers RFC1918 IPv4, CGNAT, TEST-NETs
 * (RFC 5737), benchmarking (RFC 2544), IANA special-purpose, class E,
 * broadcast, IPv6 ULA, link-local, loopback, IPv4-mapped, Teredo,
 * 6to4, NAT64, and the cloud metadata endpoint. Pure string matching —
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
export function isPrivateOrInternal(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".localhost")) return true;

  // IPv4 literal (always dotted-decimal at this point — see note above)
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b, c] = ipv4.slice(1).map(Number);
    if (a === 10) return true;                                    // 10.0.0.0/8
    if (a === 127) return true;                                   // loopback
    if (a === 0) return true;                                     // 0.0.0.0/8 (this network)
    if (a === 169 && b === 254) return true;                      // link-local + cloud meta
    if (a === 172 && b >= 16 && b <= 31) return true;             // 172.16.0.0/12
    if (a === 192 && b === 168) return true;                      // 192.168.0.0/16
    if (a === 192 && b === 0 && c <= 1) return true;              // 192.0.0.0/24 IANA (incl. DS-Lite 192.0.0.0/29)
    if (a === 192 && b === 0 && c === 2) return true;             // 192.0.2.0/24 TEST-NET-1 (RFC 5737)
    if (a === 198 && (b === 18 || b === 19)) return true;         // 198.18.0.0/15 benchmarking (RFC 2544)
    if (a === 198 && b === 51 && c === 100) return true;          // 198.51.100.0/24 TEST-NET-2 (RFC 5737)
    if (a === 203 && b === 0 && c === 113) return true;           // 203.0.113.0/24 TEST-NET-3 (RFC 5737)
    if (a === 100 && b >= 64 && b <= 127) return true;            // CGNAT 100.64.0.0/10
    if (a >= 224) return true;                                    // 224.0.0.0/4 multicast + 240.0.0.0/4 class E + 255.255.255.255 broadcast
  }

  // IPv6 — strip optional brackets so both literals and DNS results match.
  const bare = host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
  if (bare === "::1") return true;                                    // loopback
  if (bare === "::") return true;                                     // unspecified
  if (bare.startsWith("fc") || bare.startsWith("fd")) return true;   // ULA fc00::/7
  // Link-local fe80::/10 covers fe80–febf. Checking only "fe80" misses fe81–febf.
  if (/^fe[89ab]/i.test(bare)) return true;                          // link-local fe80::/10 (full range)
  if (bare.startsWith("::ffff:")) return true;                        // IPv4-mapped IPv6
  // Teredo 2001::/32 — check both expanded and compressed forms (WHATWG URL
  // normalises to compact so 2001:0000::1 → 2001::1, hence the bare "2001::" check).
  if (bare.startsWith("2001:0000:") || bare.startsWith("2001:0:") || bare.startsWith("2001::")) return true;
  if (bare.startsWith("2001:db8:")) return true;                      // 2001:db8::/32 documentation (RFC 3849) — not globally routable
  if (bare.startsWith("2002:")) return true;                          // 6to4 — encodes IPv4 in bits [16:47]; e.g. 2002:7f00:1:: → 127.0.0.1
  if (bare.startsWith("64:ff9b:")) return true;                       // NAT64 IANA well-known prefix (RFC 6052) — maps to IPv4
  if (bare.startsWith("64:ff9b:1:")) return true;                     // NAT64 RFC 8215 local-use prefix — maps to IPv4
  if (bare.startsWith("100::")) return true;                          // 100::/64 discard-only prefix (RFC 6666)

  // Cloud metadata services (covered by IPv4 169.254 check above, but
  // explicit hostname matches for defence-in-depth)
  if (host === "metadata.google.internal") return true;
  if (host === "metadata.aws.internal") return true;

  return false;
}

/**
 * Returns true if the given URL string targets a private/internal host.
 * Safe to call with untrusted input — returns true (blocked) on parse errors.
 */
export function isPrivateUrl(urlString: string): boolean {
  try {
    const u = new URL(urlString);
    if (u.protocol !== "https:" && u.protocol !== "http:") return true; // block non-HTTP
    return isPrivateOrInternal(u.hostname);
  } catch {
    return true; // unparseable URL → block it
  }
}

/**
 * Returns true if `url` is a valid HTTPS URL pointing to a non-private host.
 * Safe to call with untrusted input — returns false on parse errors.
 */
export function isValidExternalHttpsUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && !isPrivateOrInternal(u.hostname);
  } catch {
    return false;
  }
}
