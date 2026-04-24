/**
 * SSRF-hardening helper for server-side `fetch()` calls that take a URL
 * from user input (webhooks, image_url, face_image_url, etc.).
 *
 * Without this, a POST like { image_url: "http://169.254.169.254/…" }
 * would let an attacker reach AWS / GCP metadata endpoints, loopback
 * services, or anything else in the serverless function's network
 * reach. The bug-hunt pass on Apr 24 flagged the thumbnail routes as
 * the easiest exposure: they accept a URL and fetch it blindly.
 *
 * Usage:
 *   const safe = assertSafeFetchUrl(userUrl);   // throws on bad input
 *   const res  = await fetch(safe);
 *
 * Or for the "return an error response, don't throw" variant:
 *   const err = checkFetchUrl(userUrl);
 *   if (err) return NextResponse.json({ error: err }, { status: 400 });
 */
export class SsrfBlockedError extends Error {
  constructor(public reason: string) {
    super(`SSRF-blocked URL: ${reason}`);
    this.name = "SsrfBlockedError";
  }
}

/**
 * Blocked hostnames + hostname patterns. Kept broad because serverless
 * functions can hit internal load balancers, cloud metadata endpoints,
 * link-local IPs, etc. Add to this list, never subtract.
 */
const BLOCKED_HOSTS = new Set<string>([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "169.254.169.254",   // AWS / GCP / Azure IMDS
  "metadata.google.internal",
  "[::1]",             // IPv6 loopback
  "::1",
  "[::]",
  "::",
]);

const BLOCKED_SUFFIXES = [
  ".internal",         // GCP / Cloudflare internal
  ".local",            // mDNS
  ".localhost",
];

/**
 * Return null if the URL is safe to fetch, otherwise a short reason string.
 * Does NOT throw — call sites can convert to 400/502 as they prefer.
 */
export function checkFetchUrl(
  input: string,
  opts: { allowDataUrls?: boolean; allowHttp?: boolean } = {},
): string | null {
  if (typeof input !== "string" || input.length === 0) {
    return "URL is empty";
  }

  // `data:image/…;base64,…` is fine — it's not a network fetch.
  if (input.startsWith("data:")) {
    return opts.allowDataUrls === false ? "data URLs not allowed" : null;
  }

  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return "URL is not parseable";
  }

  if (parsed.protocol !== "https:" && !(opts.allowHttp && parsed.protocol === "http:")) {
    return "protocol must be https";
  }

  const host = parsed.hostname.toLowerCase();

  if (BLOCKED_HOSTS.has(host) || BLOCKED_HOSTS.has(`[${host}]`)) {
    return `host "${host}" is blocked`;
  }
  if (BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) {
    return `host suffix blocked`;
  }

  // Numeric IPv4: block private + reserved ranges.
  //   10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16,
  //   127.0.0.0/8, 169.254.0.0/16, 0.0.0.0/8,
  //   100.64.0.0/10 (CGNAT), 224.0.0.0/4 (multicast).
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    ) {
      return `private/reserved IPv4 "${host}" blocked`;
    }
  }

  // IPv6 in bracketed form — block loopback, link-local, IPv4-mapped loopback.
  // Keep this simple: reject any address starting with fe80, fc, fd, ::, 0:,
  // or ::ffff:127. For everything else the presence check above catches
  // the literal loopback forms.
  const ipv6 = host.startsWith("[") && host.endsWith("]")
    ? host.slice(1, -1).toLowerCase()
    : null;
  if (ipv6) {
    if (
      ipv6 === "::1" ||
      ipv6 === "::" ||
      ipv6.startsWith("fe80:") ||
      ipv6.startsWith("fc") ||
      ipv6.startsWith("fd") ||
      ipv6.startsWith("::ffff:127.") ||
      ipv6.startsWith("::ffff:10.") ||
      ipv6.startsWith("::ffff:192.168.") ||
      ipv6.startsWith("::ffff:169.254.")
    ) {
      return `private/reserved IPv6 "${host}" blocked`;
    }
  }

  return null;
}

/**
 * Throws SsrfBlockedError if the URL is unsafe. Returns the parsed URL
 * string (same as input) on success so call sites can inline it:
 *
 *   const res = await fetch(assertSafeFetchUrl(userUrl));
 */
export function assertSafeFetchUrl(
  input: string,
  opts?: { allowDataUrls?: boolean; allowHttp?: boolean },
): string {
  const err = checkFetchUrl(input, opts);
  if (err) throw new SsrfBlockedError(err);
  return input;
}
