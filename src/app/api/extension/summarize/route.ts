import { NextRequest, NextResponse } from "next/server";
import { requireExtensionUser } from "@/lib/extension/auth";
import { checkFetchUrl } from "@/lib/security/ssrf";

export async function POST(req: NextRequest) {
  try {
    // SECURITY: real token validation (previous build only checked the
    // "Bearer " prefix and accepted anything).
    const auth = await requireExtensionUser(req);
    if (auth.error) return auth.error;

    const { url } = await req.json();
    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // SSRF guard — only fetch public http(s) URLs. Reject private / loopback
    // / link-local hosts so the endpoint can't be used to probe internal
    // services or the cloud provider metadata endpoint (169.254.169.254).
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return NextResponse.json({ error: "URL must be http or https" }, { status: 400 });
    }
    // SSRF guard — block loopback / private / link-local / cloud-metadata hosts.
    // Uses the shared ssrf library for consistent coverage across all scraping routes.
    const ssrfErr = checkFetchUrl(parsed.toString(), { allowHttp: true });
    if (ssrfErr) {
      return NextResponse.json({ error: `Refusing to fetch: ${ssrfErr}` }, { status: 400 });
    }

    // Fetch page content
    let pageText = "";
    try {
      const res = await fetch(parsed.toString(), {
        headers: { "User-Agent": "ShortStackBot/1.0" },
        signal: AbortSignal.timeout(10000),
        redirect: "follow",
      });
      const html = await res.text();
      // Strip tags for a rough plain-text extraction
      pageText = html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 6000);
    } catch {
      pageText = `(Could not fetch page content for ${url})`;
    }

    // Summarize with Anthropic
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        ok: true,
        summary: `Page fetched (${pageText.length} chars). Configure ANTHROPIC_API_KEY for AI summary.`,
      });
    }

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: `Summarize this webpage content in 2-3 concise sentences. URL: ${url}\n\nContent:\n${pageText}`,
          },
        ],
      }),
    });

    const aiData = await aiRes.json();
    const summary =
      aiData.content?.[0]?.text || "Could not generate summary.";

    return NextResponse.json({ ok: true, summary, url });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
