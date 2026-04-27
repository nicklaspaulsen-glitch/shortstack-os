import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireExtensionUser } from "@/lib/extension/auth";
import { checkRateLimit } from "@/lib/extension/rate-limit";
import { callLLM } from "@/lib/ai/llm-router";
import { safeJsonParse } from "@/lib/ai/claude-helpers";

// ─── Research Prospect Endpoint ─────────────────────────────────────
// Powers the "Run AI research" button in the ShortStack Prospector
// browser extension. Given a LinkedIn URL + name + company, returns
// structured company info, recent news bullets, a suggested cold-email
// opener, and a heuristic "best time to reach out".
//
// Auth: requires a valid Supabase Bearer token (matches every other
// /api/extension route — uses requireExtensionUser).
// Rate limit: 20 calls per minute per user.
//
// LLM: routes via callLLM with `taskType: "complex_analysis"` (Opus
// primary, Sonnet fallback). The opener and best-time output is
// expected to be a small JSON object — we strip code fences and parse
// defensively.

const RESEARCH_LIMIT_PER_MIN = 20;
const RESEARCH_WINDOW_MS = 60_000;

const RequestSchema = z.object({
  linkedin_url: z.string().url(),
  name: z.string().min(1).max(200),
  company: z.string().max(200).optional().default(""),
});

interface LLMResearchOutput {
  company_data: {
    name: string;
    description?: string;
    industry?: string;
    size?: string;
    website?: string;
  } | null;
  recent_news: string[];
  suggested_opener: string;
  best_time: string;
}

const SYSTEM_PROMPT = `You are an outbound sales researcher embedded in the ShortStack agency CRM.

Given a prospect's LinkedIn URL, full name, and current company, produce a JSON research brief that an account executive can use to send a thoughtful first-touch email.

Output STRICT JSON matching this schema (no markdown, no commentary):
{
  "company_data": {
    "name": string,
    "description": string,        // 1-2 sentences
    "industry": string,           // single phrase
    "size": string,               // e.g. "11-50 employees" or "Unknown"
    "website": string             // best guess root URL or "Unknown"
  } | null,
  "recent_news": string[],        // 0-3 short bullets, factual or "" if uncertain
  "suggested_opener": string,     // 2-3 sentence cold-email opener referencing the prospect's role + company. Friendly, specific, not generic.
  "best_time": string             // e.g. "Tuesday 10:00 AM local time" — pick a realistic weekday morning slot
}

Rules:
- If you don't know something, say so honestly (use "Unknown" or omit). Do NOT fabricate news headlines or numbers.
- The opener must reference the prospect's role and the company, but stay generic enough that hallucinated specifics don't appear.
- Output ONLY the JSON object, no surrounding text.`;

function buildUserPrompt(payload: {
  name: string;
  company: string;
  linkedin_url: string;
}): string {
  return `Prospect:
- Name: ${payload.name}
- Company: ${payload.company || "(unknown — infer from LinkedIn URL handle if obvious)"}
- LinkedIn: ${payload.linkedin_url}

Produce the JSON research brief now.`;
}

function pickBestTimeFallback(): string {
  // Heuristic — the LLM is instructed to override this, but if parsing
  // fails we still want a sensible default for the popup to render.
  // Outbound conventional wisdom: Tue/Wed mornings convert best.
  const days = ["Tuesday", "Wednesday", "Thursday"];
  const day = days[Math.floor(Math.random() * days.length)] ?? "Tuesday";
  return `${day} 10:00 AM local time`;
}

function coerceResult(parsed: unknown): LLMResearchOutput {
  if (!parsed || typeof parsed !== "object") {
    return {
      company_data: null,
      recent_news: [],
      suggested_opener: "",
      best_time: pickBestTimeFallback(),
    };
  }

  const obj = parsed as Record<string, unknown>;
  const companyData =
    obj.company_data && typeof obj.company_data === "object"
      ? (obj.company_data as Record<string, unknown>)
      : null;

  return {
    company_data: companyData
      ? {
          name: typeof companyData.name === "string" ? companyData.name : "",
          description:
            typeof companyData.description === "string"
              ? companyData.description
              : undefined,
          industry:
            typeof companyData.industry === "string"
              ? companyData.industry
              : undefined,
          size:
            typeof companyData.size === "string"
              ? companyData.size
              : undefined,
          website:
            typeof companyData.website === "string" &&
            /^https?:\/\//.test(companyData.website)
              ? companyData.website
              : undefined,
        }
      : null,
    recent_news: Array.isArray(obj.recent_news)
      ? obj.recent_news.filter((x): x is string => typeof x === "string").slice(0, 3)
      : [],
    suggested_opener:
      typeof obj.suggested_opener === "string" ? obj.suggested_opener : "",
    best_time:
      typeof obj.best_time === "string" && obj.best_time.trim() !== ""
        ? obj.best_time
        : pickBestTimeFallback(),
  };
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireExtensionUser(req);
    if (auth.error) return auth.error;
    const { user } = auth;

    const rl = checkRateLimit(
      `research:${user.id}`,
      RESEARCH_LIMIT_PER_MIN,
      RESEARCH_WINDOW_MS,
    );
    if (!rl.ok) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded. Try again in a minute.",
          retryAfterSec: rl.retryAfterSec,
        },
        {
          status: 429,
          headers: { "Retry-After": String(rl.retryAfterSec) },
        },
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid request" },
        { status: 400 },
      );
    }

    const { linkedin_url, name, company } = parsed.data;

    const llmRes = await callLLM({
      taskType: "complex_analysis",
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: buildUserPrompt({ name, company, linkedin_url }),
      maxTokens: 800,
      temperature: 0.4,
      userId: user.id,
      context: "/api/ai/research-prospect",
    });

    const parsedJson = safeJsonParse<unknown>(llmRes.text);
    const result = coerceResult(parsedJson);

    return NextResponse.json({
      ...result,
      generated_at: Date.now(),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Internal server error";
    console.error("[research-prospect] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
