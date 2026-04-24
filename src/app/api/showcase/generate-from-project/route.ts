import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { anthropic, MODEL_SONNET, getResponseText, safeJsonParse } from "@/lib/ai/claude-helpers";
import type { GeneratedCaseStudyDraft } from "@/lib/showcase/types";

// POST /api/showcase/generate-from-project
// Body: { project_id: string }
// Returns: { draft: GeneratedCaseStudyDraft, sources: {...} }  — NOT persisted.
//
// Project context is pulled best-effort from a handful of project-like tables
// (video_projects, website_projects, project_tasks). Post-mortem + weekly
// reports are not yet first-class tables in this repo — when they appear, add
// the queries here. The AI is instructed to produce a ~500w Challenge →
// Approach → Results → Reflection body.
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  let body: { project_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const projectId = typeof body.project_id === "string" ? body.project_id : "";
  if (!projectId) return NextResponse.json({ error: "project_id is required" }, { status: 400 });

  // ── Gather project context (best-effort across known project tables) ──
  const sources: Record<string, unknown> = { project_id: projectId };

  // video_projects
  const { data: videoProj } = await supabase
    .from("video_projects")
    .select("*")
    .eq("id", projectId)
    .eq("profile_id", ownerId)
    .maybeSingle();
  if (videoProj) sources.video_project = videoProj;

  // website_projects
  const { data: websiteProj } = await supabase
    .from("website_projects")
    .select("*")
    .eq("id", projectId)
    .eq("profile_id", ownerId)
    .maybeSingle();
  if (websiteProj) sources.website_project = websiteProj;

  // project_tasks (treat projectId as a board id; task-board hierarchy lives here)
  const { data: tasks } = await supabase
    .from("project_tasks")
    .select("title, description, status, priority")
    .eq("board_id", projectId)
    .limit(50);
  if (tasks && tasks.length) sources.tasks = tasks;

  // generated_images with matching project tag (fallback visual reference)
  const { data: assets } = await supabase
    .from("generated_images")
    .select("prompt, image_url")
    .eq("profile_id", ownerId)
    .limit(10);
  if (assets && assets.length) sources.assets_sample = assets;

  if (!videoProj && !websiteProj && (!tasks || !tasks.length)) {
    return NextResponse.json(
      { error: "Project not found or not accessible" },
      { status: 404 },
    );
  }

  // ── Prompt Claude for a structured draft ──
  const systemPrompt = `You are a senior brand storyteller writing a client case study for a marketing agency's public portfolio. Output valid JSON only — no prose, no markdown fences.

Return ONE JSON object with these fields:
{
  "title": string (under 80 chars, punchy),
  "subtitle": string (one line, under 120 chars),
  "summary": string (2-3 sentences, 280-400 chars),
  "body_markdown": string (~500 words, markdown, with 4 H2 sections exactly: "## Challenge", "## Approach", "## Results", "## Reflection"),
  "metrics": array of 2-4 objects { "label": string, "value": string, "delta": string } — delta is optional growth/change (e.g. "+210%"),
  "industry_tags": array of 2-4 lowercase slugs,
  "service_tags": array of 2-5 lowercase slugs,
  "seo_title": string (under 60 chars, with "| Case Study" suffix),
  "seo_description": string (under 160 chars)
}

Write in confident, specific language. No hype. Prefer concrete numbers when available. If a fact isn't in the context, don't invent it — generalize sensibly or omit.`;

  const userPrompt = `PROJECT CONTEXT (JSON):
${JSON.stringify(sources, null, 2)}

Produce the case-study draft now as a single JSON object. Do not include anything except the JSON.`;

  let draft: GeneratedCaseStudyDraft | null = null;
  try {
    const resp = await anthropic.messages.create({
      model: MODEL_SONNET,
      max_tokens: 3000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    const text = getResponseText(resp);
    draft = safeJsonParse<GeneratedCaseStudyDraft>(text);
  } catch (err) {
    return NextResponse.json(
      { error: "AI generation failed", detail: (err as Error).message },
      { status: 502 },
    );
  }

  if (!draft || typeof draft.title !== "string") {
    return NextResponse.json(
      { error: "AI returned an unparseable response" },
      { status: 502 },
    );
  }

  // Defensive shape normalization.
  const normalized: GeneratedCaseStudyDraft = {
    title: String(draft.title || "Untitled case study").slice(0, 200),
    subtitle: String(draft.subtitle || "").slice(0, 200),
    summary: String(draft.summary || ""),
    body_markdown: String(draft.body_markdown || ""),
    metrics: Array.isArray(draft.metrics)
      ? draft.metrics
          .filter((m) => m && typeof m === "object")
          .slice(0, 6)
          .map((m) => ({
            label: String(m.label || ""),
            value: String(m.value || ""),
            delta: m.delta ? String(m.delta) : null,
          }))
      : [],
    industry_tags: Array.isArray(draft.industry_tags)
      ? draft.industry_tags.filter((t) => typeof t === "string").slice(0, 6)
      : [],
    service_tags: Array.isArray(draft.service_tags)
      ? draft.service_tags.filter((t) => typeof t === "string").slice(0, 8)
      : [],
    seo_title: String(draft.seo_title || "").slice(0, 70),
    seo_description: String(draft.seo_description || "").slice(0, 200),
  };

  return NextResponse.json({ draft: normalized, project_id: projectId });
}
