import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "@/lib/ai/claude-helpers";
import { requireExtensionUser } from "@/lib/extension/auth";
import { checkRateLimit } from "@/lib/extension/rate-limit";

const SYSTEM_PROMPT = `You are ShortStack AI assistant embedded in a Chrome extension. Help users with marketing, lead generation, content creation, SEO analysis, and competitor intelligence.

Guidelines:
- Be concise and actionable — users want quick, useful answers
- When analyzing a page, focus on business-relevant insights
- For lead generation, suggest specific extraction strategies
- For content creation, provide ready-to-use drafts
- For SEO, give concrete fixes with priority levels
- Format responses clearly with bullet points when listing items
- Keep responses under 300 words unless the user asks for detail`;

// Rate limit: 30 messages per minute per user. Prevents abuse of the
// Anthropic-proxying endpoint if an extension token is ever leaked.
const CHAT_LIMIT_PER_MIN = 30;
const CHAT_WINDOW_MS = 60_000;

export async function POST(req: NextRequest) {
  try {
    // SECURITY: real Bearer token validation replaces the previous
    // "starts with Bearer " check which never actually verified the token.
    const auth = await requireExtensionUser(req);
    if (auth.error) return auth.error;
    const { user } = auth;

    // Per-user rate limit — see comment above.
    const rl = checkRateLimit(`chat:${user.id}`, CHAT_LIMIT_PER_MIN, CHAT_WINDOW_MS);
    if (!rl.ok) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded. Try again in a minute.",
          retryAfterSec: rl.retryAfterSec,
        },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
      );
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

    // Shared singleton — see CLAUDE.md "Module-level SDK init is BANNED" rule.
    const client = anthropic;

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

    return NextResponse.json({ response: text, remaining: rl.remaining });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Internal server error";
    console.error("[Extension Chat] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
