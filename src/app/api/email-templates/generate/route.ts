import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";
import {
  anthropic,
  MODEL_HAIKU,
  safeJsonParse,
  getResponseText,
} from "@/lib/ai/claude-helpers";

type TemplateType =
  | "welcome"
  | "nurture"
  | "promo"
  | "winback"
  | "onboarding"
  | "broadcast"
  | "transactional"
  | "custom";

interface TemplateGenerateInput {
  template_type: TemplateType;
  goal?: string;
  audience?: string;
  brand_voice?: string;
  include_merge_tags?: boolean;
}

interface TemplateGenerateOutput {
  name: string;
  subject: string;
  preheader: string;
  body: string;
  html_version?: string;
  merge_tags: string[];
}

const SYSTEM_PROMPT = `You are a senior email template designer who builds reusable templates for lifecycle marketing, transactional flows, and campaigns.

TEMPLATE PRINCIPLES
1. Subject line: under 60 chars, benefit-led, pattern-interrupting
2. Preheader: 80-110 chars, extends or contrasts the subject, never just repeats it
3. Body: scannable, mobile-first, 100-200 words for most types (longer for nurture/onboarding)
4. Merge tags use Handlebars-style double braces: {{first_name}}, {{company}}, {{product}}, {{cta_url}}
5. One primary CTA. Inline link OR button, not both.
6. Brand voice should shape word choice and cadence, not be pasted in verbatim.

TEMPLATE TYPES
- welcome: first touch after signup/purchase, set expectations, give quick win
- nurture: educational value in a sequence, no hard sell
- promo: time-bound offer, urgency without hype
- winback: re-engage lapsed users, acknowledge silence, offer clear reason to return
- onboarding: feature education, usage milestones, progressive disclosure
- broadcast: newsletter / company update to whole list
- transactional: receipts, confirmations, notifications — plain, trustworthy
- custom: follow the goal description literally

HTML_VERSION
Provide a simple responsive HTML version using <p>, <h2>, <a>, <strong>, and <br> only. Inline styles are fine for font-family and color. Include the merge tags inline.

OUTPUT FORMAT
Respond with ONLY raw JSON (no markdown fences, no commentary) matching:
{
  "name": "<short internal name>",
  "subject": "<subject line>",
  "preheader": "<preheader>",
  "body": "<plain text body with double line breaks between paragraphs>",
  "html_version": "<simple HTML>",
  "merge_tags": ["{{first_name}}", ...]
}`;

export async function POST(request: NextRequest) {
  const authSupabase = createServerSupabase();
  const {
    data: { user },
  } = await authSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await authSupabase
    .from("profiles")
    .select("plan_tier")
    .eq("id", user.id)
    .single();
  const limited = checkAiRateLimit(user.id, profile?.plan_tier);
  if (limited) return limited;

  let body: TemplateGenerateInput;
  try {
    body = (await request.json()) as TemplateGenerateInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const allowed: TemplateType[] = [
    "welcome", "nurture", "promo", "winback", "onboarding", "broadcast", "transactional", "custom",
  ];
  if (!allowed.includes(body.template_type)) {
    return NextResponse.json({ error: "Invalid template_type" }, { status: 400 });
  }

  const includeMergeTags = body.include_merge_tags !== false;

  const userPrompt = `Generate an email template.

TYPE: ${body.template_type}
GOAL: ${body.goal ?? "Engage the reader and drive the primary action for this template type"}
AUDIENCE: ${body.audience ?? "general customer audience"}
BRAND VOICE: ${body.brand_voice ?? "professional, warm, direct"}
MERGE TAGS: ${includeMergeTags ? "Include relevant {{handlebars}} merge tags" : "No merge tags — use literal placeholders like [Name]"}

JSON only.`;

  try {
    const response = await anthropic.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 2500,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = getResponseText(response);
    const parsed = safeJsonParse<TemplateGenerateOutput>(text);

    if (!parsed || typeof parsed.subject !== "string" || typeof parsed.body !== "string") {
      return NextResponse.json(
        { error: "Claude returned an invalid response", raw: text.slice(0, 500) },
        { status: 502 }
      );
    }

    const out: TemplateGenerateOutput = {
      name: parsed.name?.trim() || `${body.template_type} template`,
      subject: parsed.subject.trim(),
      preheader: parsed.preheader?.trim() || "",
      body: parsed.body.trim(),
      html_version: parsed.html_version?.trim() || undefined,
      merge_tags: Array.isArray(parsed.merge_tags) ? parsed.merge_tags.slice(0, 40) : [],
    };

    const serviceSupabase = createServiceClient();
    void serviceSupabase.from("trinity_log").insert({
      action_type: "ai_email_template_generate",
      description: `Email template generated: ${out.name}`,
      profile_id: user.id,
      status: "completed",
      result: {
        template_type: body.template_type,
        goal: body.goal,
        audience: body.audience,
        merge_tag_count: out.merge_tags.length,
        generated_at: new Date().toISOString(),
      },
    });

    return NextResponse.json(out);
  } catch (err) {
    console.error("[email-templates/generate] error", err);
    const message = err instanceof Error ? err.message : "Unknown Claude API error";
    return NextResponse.json(
      { error: "Failed to generate template", detail: message },
      { status: 500 }
    );
  }
}
