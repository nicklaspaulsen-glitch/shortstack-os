import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";

// Native sequences cron runner.
// Replaces the GHL-hosted drip scheduler we sunset Apr 21.
//
// Every hour we:
//   1. Find active enrollments whose current step's delay_days has elapsed
//      since enrolled_at.
//   2. Fire the step's channel action (email / sms / call / dm / wait).
//   3. Advance current_step; mark enrollment completed if we ran off the end.
//   4. Log every execution to trinity_log (action_type=automation) so the
//      dashboard "Recent activity" panel has something to render.
//
// Guard:  `x-vercel-cron` header (auto-injected by Vercel Cron) OR
//         Authorization: Bearer ${CRON_SECRET} for manual runs.

export const maxDuration = 300;

type StepChannel = "email" | "sms" | "call" | "dm" | "wait";

interface StepRow {
  id: string;
  step_order: number;
  delay_days: number;
  channel: StepChannel;
  template_body: string | null;
  template_subject: string | null;
}

interface EnrollmentRow {
  id: string;
  sequence_id: string;
  lead_id: string;
  current_step: number;
  enrolled_at: string;
}

interface SequenceRow {
  id: string;
  profile_id: string;
  name: string;
  is_active: boolean;
}

interface LeadRow {
  id: string;
  business_name: string | null;
  email: string | null;
  phone: string | null;
  instagram_url: string | null;
}

function renderTemplate(raw: string | null, lead: LeadRow): string {
  if (!raw) return "";
  return raw
    .replace(/\{name\}/gi, lead.business_name || "there")
    .replace(/\{business_name\}/gi, lead.business_name || "there")
    .replace(/\{email\}/gi, lead.email || "");
}

export async function GET(request: NextRequest) {
  // Auth: Vercel Cron sets x-vercel-cron. Manual runs use CRON_SECRET.
  const isVercelCron = request.headers.get("x-vercel-cron") !== null;
  const authHeader = request.headers.get("authorization");
  const hasBearer = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  if (!isVercelCron && !hasBearer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const now = new Date();
  const nowMs = now.getTime();

  // Pull active enrollments on active sequences. We filter by elapsed time
  // in app code because Supabase can't express "step delay relative to
  // step_order = current_step" in a single WHERE clause.
  const { data: enrollmentsRaw, error: enrErr } = await supabase
    .from("sequence_enrollments")
    .select("id, sequence_id, lead_id, current_step, enrolled_at")
    .eq("status", "active");
  if (enrErr) {
    return NextResponse.json({ error: enrErr.message }, { status: 500 });
  }
  const enrollments = (enrollmentsRaw || []) as EnrollmentRow[];
  if (enrollments.length === 0) {
    return NextResponse.json({ success: true, processed: 0, executed: 0 });
  }

  const sequenceIds = Array.from(new Set(enrollments.map(e => e.sequence_id)));
  const leadIds = Array.from(new Set(enrollments.map(e => e.lead_id)));

  const [{ data: sequencesRaw }, { data: stepsRaw }, { data: leadsRaw }] =
    await Promise.all([
      supabase
        .from("sequences")
        .select("id, profile_id, name, is_active")
        .in("id", sequenceIds),
      supabase
        .from("sequence_steps")
        .select("id, sequence_id, step_order, delay_days, channel, template_body, template_subject")
        .in("sequence_id", sequenceIds)
        .order("step_order", { ascending: true }),
      supabase
        .from("leads")
        .select("id, business_name, email, phone, instagram_url")
        .in("id", leadIds),
    ]);

  const sequencesById = new Map<string, SequenceRow>(
    ((sequencesRaw || []) as SequenceRow[]).map(s => [s.id, s]),
  );
  const stepsBySequence = new Map<string, StepRow[]>();
  for (const row of (stepsRaw || []) as (StepRow & { sequence_id: string })[]) {
    const list = stepsBySequence.get(row.sequence_id) || [];
    list.push(row);
    stepsBySequence.set(row.sequence_id, list);
  }
  const leadsById = new Map<string, LeadRow>(
    ((leadsRaw || []) as LeadRow[]).map(l => [l.id, l]),
  );

  let executed = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const enr of enrollments) {
    const seq = sequencesById.get(enr.sequence_id);
    if (!seq || !seq.is_active) {
      skipped++;
      continue;
    }
    const steps = (stepsBySequence.get(enr.sequence_id) || []).slice().sort(
      (a, b) => a.step_order - b.step_order,
    );
    if (steps.length === 0) {
      // No steps to run — mark completed so we stop looking at this row
      await supabase
        .from("sequence_enrollments")
        .update({ status: "completed", completed_at: now.toISOString() })
        .eq("id", enr.id);
      continue;
    }

    // Off-the-end already? Mark completed.
    if (enr.current_step >= steps.length) {
      await supabase
        .from("sequence_enrollments")
        .update({ status: "completed", completed_at: now.toISOString() })
        .eq("id", enr.id);
      continue;
    }

    const step = steps[enr.current_step];
    const enrolledMs = new Date(enr.enrolled_at).getTime();
    const dueAt = enrolledMs + step.delay_days * 86400 * 1000;
    if (dueAt > nowMs) {
      // Not yet due
      skipped++;
      continue;
    }

    const lead = leadsById.get(enr.lead_id);
    if (!lead) {
      // Lead vanished (deleted). Stop this enrollment.
      await supabase
        .from("sequence_enrollments")
        .update({ status: "stopped", completed_at: now.toISOString() })
        .eq("id", enr.id);
      skipped++;
      continue;
    }

    const subject = renderTemplate(step.template_subject, lead);
    const bodyText = renderTemplate(step.template_body, lead);
    let actionStatus: "completed" | "failed" | "skipped" = "completed";
    let actionNote = "";

    try {
      if (step.channel === "email") {
        if (!lead.email) {
          actionStatus = "skipped";
          actionNote = "lead has no email";
        } else {
          const delivered = await sendEmail({
            to: lead.email,
            subject: subject || "Following up",
            html: `<p>${bodyText.replace(/\n/g, "<br>")}</p>`,
          });
          if (!delivered) {
            actionStatus = "failed";
            actionNote = "sendEmail returned false (SMTP/Resend not configured?)";
          }
        }
      } else if (step.channel === "sms") {
        if (!lead.phone) {
          actionStatus = "skipped";
          actionNote = "lead has no phone";
        } else {
          const twilioSid = process.env.TWILIO_ACCOUNT_SID;
          const twilioToken = process.env.TWILIO_AUTH_TOKEN;
          const twilioFrom = process.env.TWILIO_DEFAULT_NUMBER;
          if (!twilioSid || !twilioToken || !twilioFrom) {
            actionStatus = "failed";
            actionNote = "Twilio not configured";
          } else {
            const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64");
            const res = await fetch(
              `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
              {
                method: "POST",
                headers: {
                  Authorization: `Basic ${auth}`,
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                  To: lead.phone,
                  From: twilioFrom,
                  Body: bodyText || "Following up",
                }),
              },
            );
            if (!res.ok) {
              actionStatus = "failed";
              actionNote = `Twilio ${res.status}`;
            }
          }
        }
      } else if (step.channel === "call") {
        // Voice actions need a human/receptionist trigger — log the intent.
        actionNote = "call task queued for human trigger";
      } else if (step.channel === "dm") {
        // Match the browser-extension DM flow: log an outreach_log row as
        // queued. We map `dm` → instagram_dm when we have a handle, else
        // just log to trinity_log. outreach_log status enum only accepts
        // sent|delivered|replied|etc, so we mark `sent` + metadata.queued.
        const handle = lead.instagram_url || null;
        await supabase.from("outreach_log").insert({
          lead_id: lead.id,
          platform: handle ? "instagram_dm" : "instagram",
          business_name: lead.business_name,
          recipient_handle: handle,
          message_text: bodyText || "DM queued by sequence",
          status: "sent",
          source: "sequence_cron",
          metadata: { queued: true, sequence_id: enr.sequence_id, step_order: step.step_order },
        });
      } else if (step.channel === "wait") {
        // No action — just advance. (delay_days is the wait.)
      } else {
        actionStatus = "skipped";
        actionNote = `unknown channel: ${step.channel}`;
      }
    } catch (err) {
      actionStatus = "failed";
      actionNote = err instanceof Error ? err.message : "unknown error";
      errors.push(`enr=${enr.id}: ${actionNote}`);
    }

    // Log the step execution
    await supabase.from("trinity_log").insert({
      action_type: "automation",
      description: `Sequence "${seq.name}" → step ${step.step_order + 1} (${step.channel}) for ${lead.business_name || lead.email || lead.phone || lead.id}`,
      profile_id: seq.profile_id,
      status: actionStatus,
      result: {
        sequence_id: enr.sequence_id,
        sequence_name: seq.name,
        enrollment_id: enr.id,
        lead_id: lead.id,
        step_order: step.step_order,
        channel: step.channel,
        note: actionNote || null,
        executed_at: now.toISOString(),
      },
      completed_at: now.toISOString(),
    });

    // Advance. If we just ran the last step, mark completed.
    const nextStep = enr.current_step + 1;
    if (nextStep >= steps.length) {
      await supabase
        .from("sequence_enrollments")
        .update({
          current_step: nextStep,
          status: "completed",
          completed_at: now.toISOString(),
        })
        .eq("id", enr.id);
    } else {
      await supabase
        .from("sequence_enrollments")
        .update({ current_step: nextStep })
        .eq("id", enr.id);
    }

    executed++;
  }

  return NextResponse.json({
    success: true,
    processed: enrollments.length,
    executed,
    skipped,
    errors,
    timestamp: now.toISOString(),
  });
}
