/**
 * SSRF Guard — shared helpers for blocking requests to private/internal network targets.
 *
 * Used by any route that accepts a user-supplied URL and forwards it to an
 * external service (RunPod, outbound webhooks, etc.).
 */

/**
 * Returns true if `hostname` (or IPv4/IPv6 literal) resolves to a
 * private/loopback/link-local address that should never be reachable
 * from user-supplied URLs.
 *
 * Intentionally synchronous — call this on the hostname before any network
 * request. For defence-in-depth, also do DNS resolution if the URL will be
 * fetched server-side (see resolveAndCheck in webhooks/trigger/route.ts).
 */
export function isPrivateOrInternal(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, ""); // strip IPv6 brackets

  if (
    host === "localhost"
    || host.endsWith(".local")
    || host.endsWith(".internal")
    || host.endsWith(".localhost")
  ) return true;

  // IPv4 literals
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [, a, b, c, d] = ipv4.map(Number);
    if (a === 10) return true;                               // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true;       // 172.16.0.0/12
    if (a === 192 && b === 168) return true;                 // 192.168.0.0/16
    if (a === 127) return true;                              // 127.0.0.0/8 loopback
    if (a === 169 && b === 254) return true;                 // 169.254.0.0/16 link-local
    if (a === 100 && b >= 64 && b <= 127) return true;      // 100.64.0.0/10 CGNAT
    if (a === 0) return true;                                // 0.0.0.0/8
    if (a === 255) return true;                              // broadcast
    if (a === 198 && (b === 18 || b === 19)) return true;   // benchmarking
    if (a === 192 && b === 0 && c === 2) return true;       // TEST-NET-1
  }

  // IPv6 loopback / link-local / ULA
  if (host === "::1") return true;
  if (host.startsWith("fe80:")) return true;   // link-local
  if (host.startsWith("fc") || host.startsWith("fd")) return true; // ULA

  // Cloud metadata services
  if (host === "169.254.169.254") return true; // AWS/GCP/Azure IMDS
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
