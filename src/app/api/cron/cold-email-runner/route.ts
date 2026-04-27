/**
 * Cold-email runner cron.
 *
 * Every 2 minutes:
 *   1. Find cold_email_jobs in 'researching' or 'generating' state.
 *      Process up to 50 pending personalizations per tick (research +
 *      generate). When a job has no more pending personalizations, advance
 *      its status to 'generating' (still has unsent generations).
 *   2. Find jobs in 'sending' state. Send up to 50 generated personalizations
 *      per tick (respecting per-job throttle_per_hour).
 *   3. When all personalizations are sent (or terminal), mark job 'completed'.
 *
 * Auth: x-vercel-cron header or Authorization: Bearer ${CRON_SECRET}.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { fireWebhookEvent } from "@/lib/api/webhook-events";
import { researchLead, type LeadInput, type ResearchDepth } from "@/lib/cold-email/researcher";
import { personalizeEmail } from "@/lib/cold-email/personalize";

export const maxDuration = 300;

const RESEARCH_BATCH = 50;
const SEND_BATCH = 50;

interface JobRow {
  id: string;
  user_id: string;
  status: string;
  template_seed: string;
  research_depth: ResearchDepth;
  throttle_per_hour: number;
  generated_count: number;
  sent_count: number;
  failed_count: number;
  cost_usd: number;
}

interface PersonalizationRow {
  id: string;
  lead_id: string | null;
  status: string;
  generated_subject: string | null;
  generated_body: string | null;
}

interface LeadRow extends LeadInput {
  contact_name?: string | null;
}

export async function GET(request: NextRequest) {
  const isVercelCron = request.headers.get("x-vercel-cron") !== null;
  const auth = request.headers.get("authorization");
  const hasBearer = auth === `Bearer ${process.env.CRON_SECRET}`;
  if (!isVercelCron && !hasBearer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: jobs, error: jobsErr } = await supabase
    .from("cold_email_jobs")
    .select("*")
    .in("status", ["researching", "generating", "sending"])
    .order("started_at", { ascending: true })
    .limit(20);

  if (jobsErr) {
    console.error("[cold-email-runner] job fetch failed", jobsErr);
    return NextResponse.json({ error: jobsErr.message }, { status: 500 });
  }

  if (!jobs || jobs.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  let researched = 0;
  let sent = 0;
  let failed = 0;
  let completed = 0;

  for (const j of jobs as JobRow[]) {
    if (j.status === "researching" || j.status === "generating") {
      const r = await runResearchBatch(supabase, j);
      researched += r.processed;
      failed += r.failed;
      if (r.completedAll) {
        await supabase
          .from("cold_email_jobs")
          .update({ status: "generating" })
          .eq("id", j.id);
      }
    } else if (j.status === "sending") {
      const s = await runSendBatch(supabase, j);
      sent += s.sent;
      failed += s.failed;
      if (s.completedAll) {
        await supabase
          .from("cold_email_jobs")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", j.id);
        completed++;
      }
    }
  }

  return NextResponse.json({
    processed: jobs.length,
    researched,
    sent,
    failed,
    completed,
  });
}

async function runResearchBatch(
  supabase: ReturnType<typeof createServiceClient>,
  job: JobRow,
): Promise<{ processed: number; failed: number; completedAll: boolean }> {
  const { data: pendings, error } = await supabase
    .from("cold_email_personalizations")
    .select("id, lead_id, status, generated_subject, generated_body")
    .eq("job_id", job.id)
    .eq("status", "pending")
    .limit(RESEARCH_BATCH);

  if (error) {
    console.error("[cold-email-runner] pending fetch failed", error);
    return { processed: 0, failed: 0, completedAll: false };
  }

  const candidates = (pendings as PersonalizationRow[] | null) ?? [];
  if (candidates.length === 0) {
    return { processed: 0, failed: 0, completedAll: true };
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

  let processed = 0;
  let failed = 0;
  let totalCost = 0;

  for (const c of candidates) {
    const lead = c.lead_id ? leadMap.get(c.lead_id) : undefined;
    if (!lead || !lead.email) {
      await supabase
        .from("cold_email_personalizations")
        .update({
          status: "skipped",
          error_message: lead ? "lead has no email" : "lead missing",
        })
        .eq("id", c.id);
      failed++;
      continue;
    }

    try {
      const research = await researchLead(lead, job.research_depth);
      const result = await personalizeEmail({
        templateSeed: job.template_seed,
        research,
        leadEmail: lead.email,
        leadContactName: lead.contact_name,
        userId: job.user_id,
      });
      await supabase
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
      totalCost += result.costUsd;
      processed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[cold-email-runner] generation failed", message);
      await supabase
        .from("cold_email_personalizations")
        .update({
          status: "failed",
          error_message: message.slice(0, 500),
        })
        .eq("id", c.id);
      failed++;
    }
  }

  if (processed > 0 || totalCost > 0) {
    await supabase
      .from("cold_email_jobs")
      .update({
        generated_count: job.generated_count + processed,
        cost_usd: Number(job.cost_usd) + totalCost,
      })
      .eq("id", job.id);
  }
  if (failed > 0) {
    await supabase
      .from("cold_email_jobs")
      .update({ failed_count: job.failed_count + failed })
      .eq("id", job.id);
  }

  // Whether there are still pending rows
  const { count } = await supabase
    .from("cold_email_personalizations")
    .select("*", { count: "exact", head: true })
    .eq("job_id", job.id)
    .eq("status", "pending");

  return {
    processed,
    failed,
    completedAll: (count ?? 0) === 0,
  };
}

async function runSendBatch(
  supabase: ReturnType<typeof createServiceClient>,
  job: JobRow,
): Promise<{ sent: number; failed: number; completedAll: boolean }> {
  // Throttle: hourly cap → per-2-min cap. Each cron tick covers 2 minutes.
  const perTickCap = Math.max(1, Math.ceil(job.throttle_per_hour / 30));
  const batchSize = Math.min(SEND_BATCH, perTickCap);

  const { data: ready, error } = await supabase
    .from("cold_email_personalizations")
    .select("id, lead_id, status, generated_subject, generated_body")
    .eq("job_id", job.id)
    .eq("status", "generated")
    .limit(batchSize);

  if (error) {
    console.error("[cold-email-runner] send fetch failed", error);
    return { sent: 0, failed: 0, completedAll: false };
  }

  const candidates = (ready as PersonalizationRow[] | null) ?? [];
  if (candidates.length === 0) {
    // Maybe nothing left to send. Check whether everything is terminal.
    const { count: outstanding } = await supabase
      .from("cold_email_personalizations")
      .select("*", { count: "exact", head: true })
      .eq("job_id", job.id)
      .in("status", ["pending", "researched", "generated"]);
    return {
      sent: 0,
      failed: 0,
      completedAll: (outstanding ?? 0) === 0,
    };
  }

  // Resolve recipient emails
  const leadIds = candidates
    .map((p) => p.lead_id)
    .filter((id): id is string => Boolean(id));
  const { data: leads } = await supabase
    .from("leads")
    .select("id, email, business_name")
    .in("id", leadIds);
  const leadMap = new Map<string, { email: string | null; business_name: string | null }>(
    (leads ?? []).map((l) => [l.id as string, l as { email: string | null; business_name: string | null }]),
  );

  let sent = 0;
  let failed = 0;

  for (const c of candidates) {
    const lead = c.lead_id ? leadMap.get(c.lead_id) : undefined;
    if (!lead?.email || !c.generated_subject || !c.generated_body) {
      await supabase
        .from("cold_email_personalizations")
        .update({
          status: "skipped",
          error_message: "missing email or content",
        })
        .eq("id", c.id);
      failed++;
      continue;
    }

    try {
      const ok = await sendEmail({
        to: lead.email,
        subject: c.generated_subject,
        html: htmlEscapeBody(c.generated_body),
        text: c.generated_body,
      });
      if (!ok) throw new Error("provider returned false");
      await supabase
        .from("cold_email_personalizations")
        .update({ status: "sent" })
        .eq("id", c.id);
      sent++;

      void fireWebhookEvent({
        supabase,
        userId: job.user_id,
        event: "email.sent",
        payload: {
          job_id: job.id,
          personalization_id: c.id,
          lead_id: c.lead_id,
          subject: c.generated_subject,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[cold-email-runner] send failed", message);
      await supabase
        .from("cold_email_personalizations")
        .update({
          status: "failed",
          error_message: message.slice(0, 500),
        })
        .eq("id", c.id);
      failed++;
    }
  }

  if (sent > 0 || failed > 0) {
    await supabase
      .from("cold_email_jobs")
      .update({
        sent_count: job.sent_count + sent,
        failed_count: job.failed_count + failed,
      })
      .eq("id", job.id);
  }

  // Done?
  const { count: outstanding } = await supabase
    .from("cold_email_personalizations")
    .select("*", { count: "exact", head: true })
    .eq("job_id", job.id)
    .in("status", ["pending", "researched", "generated"]);

  return {
    sent,
    failed,
    completedAll: (outstanding ?? 0) === 0,
  };
}

function htmlEscapeBody(plain: string): string {
  // Minimal: turn into <p> blocks, escape unsafe chars.
  const escaped = plain
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const paragraphs = escaped
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 12px 0;line-height:1.5;">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");
  return `<div style="font-family:-apple-system,Helvetica,sans-serif;font-size:14px;color:#111;">${paragraphs}</div>`;
}
