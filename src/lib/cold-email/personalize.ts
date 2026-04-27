/**
 * Cold-email personalization via Claude (through llm-router).
 *
 * Given a template seed and lead research, generate a unique opening line +
 * subject line + body. We use the cheap-tier Haiku-class model via
 * `taskType: "generation_short"` so 1000s of personalizations stay inside
 * a few-dollar budget.
 *
 * Template tokens supported:
 *   {{first_name}}      - parsed from the lead's contact name (best-effort)
 *   {{business_name}}   - lead.business_name
 *   {{industry}}        - lead.industry
 *   {{location}}        - "City, State"
 *   {{personal_hook}}   - LLM-generated, 1-2 sentence personal observation
 */
import { callLLMHumanized } from "@/lib/ai/call-llm-humanized";
import { preHumanize } from "@/lib/ai/humanizer";
import { callLLMTraced } from "@/lib/ai/llm-router";
import { safeJsonParse } from "@/lib/ai/claude-helpers";
import type { ResearchResult } from "./researcher";

export interface PersonalizeInput {
  templateSeed: string;
  research: ResearchResult;
  leadEmail?: string | null;
  leadContactName?: string | null;
  /** Owner's user id (for usage tracking). Optional. */
  userId?: string;
  /** Lead UUID — when present, enables per-lead memory + traces. */
  leadId?: string;
}

export interface PersonalizeOutput {
  subject: string;
  opener: string;
  body: string;
  costUsd: number;
}

const SYSTEM_PROMPT = `You are an expert B2B SDR copywriter. Given research about a lead and a template seed, produce a SHORT, HUMAN, NON-SALESY personalized cold email.

Rules:
- The personal_hook must be 1-2 sentences, specific to the research, and feel natural.
- NEVER fabricate facts. If research is thin, keep the hook generic but warm.
- Subject line: under 60 characters, no clickbait, no all caps.
- Body: under 120 words. Conversational. End with a soft, low-friction ask.

Return strict JSON: {"subject": "...", "opener": "...", "body": "..."}.
NO markdown fences. NO commentary outside the JSON.`;

function firstNameFromContact(name: string | null | undefined): string {
  if (!name || !name.trim()) return "there";
  const first = name.trim().split(/\s+/)[0];
  return first || "there";
}

/**
 * Replace deterministic template tokens (the ones we know up-front).
 * The {{personal_hook}} token is left for the LLM to fill in via a
 * dedicated request — we then re-replace it in the final body.
 */
function applyDeterministicTokens(template: string, ctx: {
  firstName: string;
  businessName: string;
  industry: string;
  location: string;
}): string {
  return template
    .replace(/\{\{\s*first_name\s*\}\}/gi, ctx.firstName)
    .replace(/\{\{\s*business_name\s*\}\}/gi, ctx.businessName)
    .replace(/\{\{\s*industry\s*\}\}/gi, ctx.industry)
    .replace(/\{\{\s*location\s*\}\}/gi, ctx.location);
}

/**
 * Generate a personalized email. Throws on hard LLM failure (caller should
 * mark the personalization row as failed and continue).
 */
export async function personalizeEmail(
  input: PersonalizeInput,
): Promise<PersonalizeOutput> {
  const firstName = firstNameFromContact(input.leadContactName);
  const businessName = input.research.business_name || "your team";
  const industry = input.research.industry || "your space";
  const location = input.research.location || "";

  const userPrompt = [
    "Template seed (use as guidance, but rewrite naturally):",
    input.templateSeed,
    "",
    "Lead research:",
    ...input.research.highlights.map((h) => `- ${h}`),
    "",
    `Recipient first name: ${firstName}`,
    `Business name: ${businessName}`,
    "",
    "Generate the JSON now.",
  ].join("\n");

  // Memory + trace are enabled per-call. Both soft-fail when env keys are
  // unset, so this stays a drop-in replacement for the previous callLLM.
  const subject =
    input.userId && input.leadId
      ? {
          kind: "lead" as const,
          id: input.leadId,
          agencyOwnerId: input.userId,
        }
      : undefined;
  const result = await callLLMTraced({
    taskType: "generation_short",
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    maxTokens: 600,
    temperature: 0.7,
    userId: input.userId,
    context: "/api/cold-email/personalize",
    surface: "cold_email",
    subject,
    withMemory: Boolean(subject),
    storeMemory: Boolean(subject),
    agentKey: "lyra",
  });

  type LLMShape = { subject?: string; opener?: string; body?: string };
  const parsed = safeJsonParse<LLMShape>(result.text);
  if (!parsed || !parsed.subject || !parsed.body) {
    throw new Error(
      `[cold-email] LLM returned unparseable response: ${result.text.slice(0, 200)}`,
    );
  }

  const opener = preHumanize((parsed.opener ?? "").trim());
  // Apply deterministic tokens to the LLM body too (in case the model echoed
  // the template structure).
  let finalBody = parsed.body.trim();
  finalBody = applyDeterministicTokens(finalBody, {
    firstName,
    businessName,
    industry,
    location,
  });
  finalBody = finalBody.replace(/\{\{\s*personal_hook\s*\}\}/gi, opener);
  // Run the deterministic AI-tell pass on the assembled body. The LLM call
  // is JSON-mode so we can't humanize the whole response, but a regex pass
  // on the final body still strips "delve into", "leverage", etc.
  finalBody = preHumanize(finalBody);

  return {
    subject: preHumanize(parsed.subject.trim()).slice(0, 200),
    opener,
    body: finalBody,
    costUsd: result.costUsd,
  };
}
