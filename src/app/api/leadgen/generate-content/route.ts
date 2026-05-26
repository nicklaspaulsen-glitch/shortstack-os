import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { callLLMTraced } from "@/lib/ai/llm-router";
import { secureCompare } from "@/lib/security/ssrf-guard";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/leadgen/generate-content
 *
 * Triggered automatically when a lead reaches stage=qualified, or manually
 * from the dashboard. Uses the lead's collected info + any uploaded files
 * to generate a content package:
 *   - Content brief (summary of the brand/offer)
 *   - 5 Instagram captions (3 educational + 2 promotional)
 *   - 1 Facebook/Instagram ad copy (with hook + body + CTA)
 *   - 5 short-form video hook ideas
 *   - 1 email subject line + preview text
 *
 * Auth: WEBHOOK_SECRET (internal call from qualify route or dashboard).
 */
interface GenerateContentBody {
  lead_id: string;
}

interface LeadInfo {
  name?: string;
  business_type?: string;
  niche?: string;
  challenge?: string;
  budget?: string;
  goals?: string;
  contact_email?: string;
}

interface GeneratedContent {
  brief: string;
  captions: string[];
  ad_copy: string;
  hook_ideas: string[];
  email_subject: string;
  generated_at: string;
}

export async function POST(request: NextRequest) {
  // Auth
  const key =
    request.headers.get("x-webhook-key") ||
    new URL(request.url).searchParams.get("key");
  const expectedKey = process.env.WEBHOOK_SECRET;
  if (!expectedKey) {
    return NextResponse.json({ error: "WEBHOOK_SECRET not configured" }, { status: 503 });
  }
  if (!key || !secureCompare(key, expectedKey)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: GenerateContentBody;
  try {
    body = (await request.json()) as GenerateContentBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.lead_id) {
    return NextResponse.json({ error: "lead_id required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: lead } = await supabase
    .from("lead_pipeline")
    .select("id, owner_id, platform, handle, display_name, lead_info, files, stage")
    .eq("id", body.lead_id)
    .maybeSingle();

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  // Already has content?
  const { data: existing } = await supabase
    .from("lead_pipeline")
    .select("generated_content")
    .eq("id", body.lead_id)
    .maybeSingle();
  if ((existing?.generated_content as GeneratedContent)?.generated_at) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "content_already_generated",
      content: existing?.generated_content,
    });
  }

  const info: LeadInfo =
    typeof lead.lead_info === "object" && lead.lead_info !== null
      ? (lead.lead_info as LeadInfo)
      : {};

  const files: Array<{ url: string; filename?: string; type?: string }> = Array.isArray(lead.files)
    ? (lead.files as Array<{ url: string; filename?: string; type?: string }>)
    : [];

  // Get owner's agency info + voice profile
  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("full_name, agency_name")
    .eq("id", lead.owner_id)
    .maybeSingle();

  const agencyName = ownerProfile?.agency_name || ownerProfile?.full_name || "the agency";
  const leadName = info.name || lead.display_name || lead.handle;
  const businessType = info.business_type || info.niche || "business";
  const challenge = info.challenge || info.goals || "growing their brand";
  const fileContext =
    files.length > 0
      ? `The lead has shared ${files.length} file(s): ${files.map((f) => f.filename || f.url).join(", ")}.`
      : "No files have been shared yet.";

  const systemPrompt = `You are a world-class content strategist and copywriter working for ${agencyName}.
A potential client has been qualified and we need to create a sample content package to demonstrate our value.
Write in an engaging, conversational style that works on social media. Be specific, not generic.
Output valid JSON only — no markdown, no explanation, no code fences.`;

  const userPrompt = `Create a content package for this lead:

Name: ${leadName}
Business type: ${businessType}
Main challenge: ${challenge}
Budget: ${info.budget || "unknown"}
Goals: ${info.goals || "grow their brand and get more clients"}
${fileContext}

Output this exact JSON structure:
{
  "brief": "2-3 sentence summary of their business and content strategy opportunity",
  "captions": [
    "Instagram caption 1 (educational, about their niche, no direct promotion, 150-200 chars)",
    "Instagram caption 2 (educational, tip or insight, 150-200 chars)",
    "Instagram caption 3 (educational, behind-the-scenes or story, 150-200 chars)",
    "Instagram caption 4 (promotional, soft CTA, 150-200 chars)",
    "Instagram caption 5 (promotional, stronger CTA, 150-200 chars)"
  ],
  "ad_copy": "Facebook/Instagram ad. Hook line (first 3 words grab attention). Body (2-3 sentences about their pain point + solution). CTA. Under 200 words total.",
  "hook_ideas": [
    "TikTok/Reel hook 1 (controversial opinion about their niche)",
    "TikTok/Reel hook 2 (surprising statistic)",
    "TikTok/Reel hook 3 (day-in-the-life angle)",
    "TikTok/Reel hook 4 (myth-busting format)",
    "TikTok/Reel hook 5 (transformation story angle)"
  ],
  "email_subject": "Cold email subject line that would work for this business (max 60 chars)"
}`;

  let generated: GeneratedContent;
  try {
    const result = await callLLMTraced({
      taskType: "generation_long",
      systemPrompt,
      userPrompt,
      maxTokens: 2000,
      forceModel: "claude-sonnet-4-5",
      surface: "leadgen_content",
      subject: { kind: "lead", id: body.lead_id, agencyOwnerId: lead.owner_id },
      humanize: false,
    });

    const raw = typeof result === "string" ? result : (result.text || "");
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("AI did not return valid JSON");
    }
    const parsed = JSON.parse(jsonMatch[0]) as Partial<GeneratedContent>;
    generated = {
      brief: parsed.brief || "",
      captions: parsed.captions || [],
      ad_copy: parsed.ad_copy || "",
      hook_ideas: parsed.hook_ideas || [],
      email_subject: parsed.email_subject || "",
      generated_at: new Date().toISOString(),
    };
  } catch (err) {
    const reason = "ai_error";
    console.error("[leadgen/generate-content] AI call failed:", reason);
    return NextResponse.json({ error: `Content generation failed: ${reason}` }, { status: 500 });
  }

  // Save generated content and update stage
  await supabase
    .from("lead_pipeline")
    .update({
      generated_content: generated,
      stage: "content_ready",
    })
    .eq("id", body.lead_id);

  return NextResponse.json({
    ok: true,
    lead_id: body.lead_id,
    content: generated,
  });
}
