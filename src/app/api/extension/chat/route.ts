import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `You are ShortStack AI assistant embedded in a Chrome extension. Help users with marketing, lead generation, content creation, SEO analysis, and competitor intelligence.

Guidelines:
- Be concise and actionable — users want quick, useful answers
- When analyzing a page, focus on business-relevant insights
- For lead generation, suggest specific extraction strategies
- For content creation, provide ready-to-use drafts
- For SEO, give concrete fixes with priority levels
- Format responses clearly with bullet points when listing items
- Keep responses under 300 words unless the user asks for detail`;

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const auth = req.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { message, url, pageContext } = body;

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Anthropic API key not configured" },
        { status: 500 }
      );
    }

    const client = new Anthropic({ apiKey });

    const contextLine = url
      ? `The user is currently viewing: ${url}${pageContext ? ` (page context: ${pageContext})` : ""}.`
      : "The user is not on a specific page.";

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: `${SYSTEM_PROMPT}\n\n${contextLine}`,
      messages: [{ role: "user", content: message }],
    });

    // Extract text from response
    const text =
      response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("\n") || "I could not generate a response.";

    return NextResponse.json({ response: text });
  } catch (e: any) {
    console.error("[Extension Chat] Error:", e.message);
    return NextResponse.json(
      { error: e.message || "Internal server error" },
      { status: 500 }
    );
  }
}
