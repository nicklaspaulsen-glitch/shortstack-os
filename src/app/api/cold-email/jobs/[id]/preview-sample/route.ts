/**
 * POST /api/cold-email/jobs/{id}/preview-sample
 *
 * Generate up to 3 sample personalizations synchronously so the user can
 * sanity-check the output BEFORE committing to send. Does not advance the
 * job's lifecycle; previews are just stored on the personalization rows
 * the user can choose to send or regenerate later.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { researchLead, type LeadInput, type ResearchDepth } from "@/lib/cold-email/researcher";
import { personalizeEmail } from "@/lib/cold-email/personalize";

const MAX_SAMPLES = 3;

interface JobRow {
  id: string;
  user_id: string;
  template_seed: string;
  research_depth: ResearchDepth;
}

interface PersonalizationRow {
  id: string;
  lead_id: string | null;
}

interface LeadRow extends LeadInput {
  contact_name?: string | null;
}

export async function POST(
  _req: NextRequest,
  ctx: { params: { id: string } },
) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) ?? user.id;

  const { data: job, error: jobErr } = await supabase
    .from("cold_email_jobs")
    .select("id, user_id, template_seed, research_depth")
    .eq("id", ctx.params.id)
    .eq("user_id", ownerId)
    .maybeSingle<JobRow>();

  if (jobErr) return NextResponse.json({ error: jobErr.message }, { status: 500 });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const { data: pendings } = await supabase
    .from("cold_email_personalizations")
    .select("id, lead_id")
    .eq("job_id", job.id)
    .eq("status", "pending")
    .limit(MAX_SAMPLES);

  const candidates = (pendings as PersonalizationRow[] | null) ?? [];
  if (candidates.length === 0) {
    return NextResponse.json(
      { error: "No pending personalizations available for preview" },
      { status: 400 },
    );
  }

  const leadIds = candidates
    .map((p) => p.lead_id)
    .filter((id): id is string => Boolean(id));
  const { data: leads } = await supabase
    .from("leads")
    .select("id, business_name, email, contact_name, industry, city, state, website, notes")
    .in("id", leadIds);
  const leadMap = new Map<string, LeadRow>(
    (leads ?? []).map((l) => [l.id as string, l as LeadRow]),
  );

  const service = createServiceClient();
  const samples: Array<{
    personalization_id: string;
    lead_id: string | null;
    subject: string;
    opener: string;
    body: string;
    cost_usd: number;
    error?: string;
  }> = [];

  for (const c of candidates) {
    const lead = c.lead_id ? leadMap.get(c.lead_id) : undefined;
    if (!lead) {
      samples.push({
        personalization_id: c.id,
        lead_id: c.lead_id,
        subject: "",
        opener: "",
        body: "",
        cost_usd: 0,
        error: "lead missing",
      });
      continue;
    }

    try {
      const research = await researchLead(lead, job.research_depth);
      const result = await personalizeEmail({
        templateSeed: job.template_seed,
        research,
        leadEmail: lead.email,
        leadContactName: lead.contact_name,
        userId: ownerId,
      });

      // Store on the personalization row so the UI can show + reuse it.
      await service
        .from("cold_email_personalizations")
        .update({
          status: "generated",
          research_data: research,
          generated_subject: result.subject,
          generated_opener: result.opener,
          generated_body: result.body,
          cost_usd: result.costUsd,
        })
        .eq("id", c.id);

      samples.push({
        personalization_id: c.id,
        lead_id: c.lead_id,
        subject: result.subject,
        opener: result.opener,
        body: result.body,
        cost_usd: result.costUsd,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[cold-email/preview] generation failed", message);
      samples.push({
        personalization_id: c.id,
        lead_id: c.lead_id,
        subject: "",
        opener: "",
        body: "",
        cost_usd: 0,
        error: message,
      });
    }
  }

  return NextResponse.json({ samples });
}
