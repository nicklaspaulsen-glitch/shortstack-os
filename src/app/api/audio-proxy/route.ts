import { NextRequest, NextResponse } from "next/server";

// CORS-safe audio proxy for the Preset Library preview page.
// Many external audio CDNs (SoundJay, archive.org, etc.) don't set
// Access-Control-Allow-Origin, so browsers reject the <audio> request
// with a CORS error. We proxy the stream through our domain and add the
// headers so previews actually play.
//
// Usage: <audio src="/api/audio-proxy?url=https%3A%2F%2Fwww.soundjay.com%2F..."/>
//
// Limitations:
// - Only allows a small whitelist of known-safe hosts (no open SSRF).
// - Uses Range forwarding so the browser can seek/scrub.
// - Caches the remote response for 1 hour so repeat previews don't hammer
//   the source CDN.

export const runtime = "nodejs";
export const maxDuration = 30;

const ALLOWED_HOSTS = new Set([
  "www.soundjay.com",
  "soundjay.com",
  "archive.org",
  "ia800200.us.archive.org",
  "ia801901.us.archive.org",
  "ia802500.us.archive.org",
  "ia902504.us.archive.org",
  "cdn.pixabay.com",
  "assets.mixkit.co",
  "freesound.org",
  "cdn.freesound.org",
  "www.bensound.com",
  "bensound.com",
  "incompetech.com",
  "cdn.uppbeat.io",
]);

export async function GET(request: NextRequest) {
  const urlParam = request.nextUrl.searchParams.get("url");
  if (!urlParam) {
    return NextResponse.json({ error: "url required" }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(urlParam);
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }

  // Block anything that isn't http/https or not in the whitelist — prevents
  // SSRF into internal services.
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return NextResponse.json({ error: "unsupported protocol" }, { status: 400 });
  }
  // Allow archive.org subdomains generically (too many to whitelist individually)
  const isArchiveOrg = target.hostname.endsWith(".archive.org") || target.hostname === "archive.org";
  if (!ALLOWED_HOSTS.has(target.hostname) && !isArchiveOrg) {
    return NextResponse.json(
      { error: `host not allowed: ${target.hostname}` },
      { status: 403 },
    );
  }

  // Forward Range header so HTML5 audio seeking works.
  const forwardHeaders: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (ShortStack audio-proxy)",
  };
  const range = request.headers.get("range");
  if (range) forwardHeaders.Range = range;

  try {
    const upstream = await fetch(target.toString(), {
      method: "GET",
      headers: forwardHeaders,
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
    });

    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json(
        { error: `upstream ${upstream.status}`, url: target.toString() },
        { status: upstream.status },
      );
    }

    const contentType =
      upstream.headers.get("content-type") ||
      (target.pathname.endsWith(".wav") ? "audio/wav" : "audio/mpeg");
    const contentLength = upstream.headers.get("content-length");
    const contentRange = upstream.headers.get("content-range");
    const acceptRanges = upstream.headers.get("accept-ranges");

    const respHeaders: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Range",
      "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
    };
    if (contentLength) respHeaders["Content-Length"] = contentLength;
    if (contentRange) respHeaders["Content-Range"] = contentRange;
    if (acceptRanges) respHeaders["Accept-Ranges"] = acceptRanges;

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: respHeaders,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "fetch failed" },
      { status: 502 },
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Range",
    },
  });
}
