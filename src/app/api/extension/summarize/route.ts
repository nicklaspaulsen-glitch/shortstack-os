import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { url } = await req.json();
    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Fetch page content
    let pageText = "";
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "ShortStackBot/1.0" },
        signal: AbortSignal.timeout(10000),
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
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
