import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { checkLimit, recordUsage } from "@/lib/usage-limits";

interface BulkRecipient {
  to: string;
  first_name?: string;
  company?: string;
  custom?: Record<string, string>;
}

interface BulkRequest {
  recipients: BulkRecipient[];
  template: string;
  from?: string;
  throttle_ms?: number;
  template_id?: string;
}

function toE164(raw: string): string | null {
  const cleaned = (raw || "").replace(/[^\d+]/g, "");
  if (cleaned.length < 7 || cleaned.length > 16) return null;
  return cleaned.startsWith("+") ? cleaned : `+1${cleaned}`;
}

// Personalisation: simple {{var}} substitution. Empty/missing values
// fall back to a sensible default. Doesn't allow nested expressions —
// keep behaviour predictable and easy to QA.
function personalise(template: string, recipient: BulkRecipient): string {
  return template
    .replace(/\{\{first_name\}\}/g, recipient.first_name || "there")
    .replace(/\{\{company\}\}/g, recipient.company || "your company")
    .replace(/\{\{(\w+)\}\}/g, (_, key) => recipient.custom?.[key] || "");
}

// Hard ceiling — even Pro plans probably don't want 1000-recipient blasts
// from a single click without a queue + worker. We surface a clean 413
// instead of running for 17 minutes.
const MAX_BULK_RECIPIENTS = 250;

// Throttle semantics: minimum 100ms (10/sec ceiling) so we don't burst
// past Twilio's per-second limit. Default 1000ms = 1 SMS/sec.
const MIN_THROTTLE_MS = 100;
const DEFAULT_THROTTLE_MS = 1000;

// POST /api/sms/send-bulk
// Throttled bulk SMS. Runs in-process (no worker) — safe up to ~250
// recipients within Vercel's per-request execution window. Larger lists
// should ship as a queued job (sms_bulk_jobs row + cron worker).
//
// Returns { job_id, sent, failed, results } when complete. Each recipient
// is personalised via {{first_name}} / {{company}} and any custom fields.
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as Partial<BulkRequest>;
  if (!Array.isArray(body.recipients) || body.recipients.length === 0) {
    return NextResponse.json({ error: "Missing recipients[]" }, { status: 400 });
  }
  if (!body.template || !body.template.trim()) {
    return NextResponse.json({ error: "Missing template" }, { status: 400 });
  }
  if (body.recipients.length > MAX_BULK_RECIPIENTS) {
    return NextResponse.json(
      {
        error: `Too many recipients. Max ${MAX_BULK_RECIPIENTS} per bulk send.`,
        received: body.recipients.length,
      },
      { status: 413 },
    );
  }

  const throttleMs = Math.max(
    MIN_THROTTLE_MS,
    typeof body.throttle_ms === "number" ? body.throttle_ms : DEFAULT_THROTTLE_MS,
  );

  // Validate + normalise all recipients up front so a malformed entry
  // halts the run before any SMS go out.
  const normalised: { to: string; raw: BulkRecipient }[] = [];
  for (const r of body.recipients) {
    const e164 = toE164(r.to);
    if (!e164) {
      return NextResponse.json(
        { error: `Invalid phone number: ${r.to}` },
        { status: 400 },
      );
    }
    normalised.push({ to: e164, raw: r });
  }

  // Plan-tier meter check — block the whole batch if it would exceed.
  const gate = await checkLimit(ownerId, "sms", normalised.length);
  if (!gate.allowed) {
    return NextResponse.json(
      {
        error: gate.reason || "Monthly SMS limit reached for your plan.",
        current: gate.current,
        limit: gate.limit,
        plan_tier: gate.plan_tier,
        remaining: gate.remaining,
      },
      { status: 402 },
    );
  }

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    return NextResponse.json({ error: "Twilio not configured" }, { status: 503 });
  }

  const fromNumber =
    (body.from && toE164(body.from)) ||
    process.env.TWILIO_DEFAULT_NUMBER ||
    "";
  if (!fromNumber) {
    return NextResponse.json({ error: "No 'from' number configured" }, { status: 400 });
  }

  const service = createServiceClient();

  // Create the bulk job row up front so the UI can poll progress (future).
  const { data: jobRow, error: jobError } = await service
    .from("sms_bulk_jobs")
    .insert({
      user_id: ownerId,
      template_id: body.template_id || null,
      recipients: normalised.map((n) => ({ to: n.to, ...n.raw })),
      total_count: normalised.length,
      throttle_ms: throttleMs,
      status: "running",
    })
    .select("id")
    .single();

  if (jobError || !jobRow) {
    console.error("[sms/send-bulk] failed to insert job row:", jobError);
    return NextResponse.json({ error: "Failed to create job" }, { status: 500 });
  }

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const results: { to: string; ok: boolean; sid?: string; error?: string }[] = [];
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < normalised.length; i++) {
    const { to, raw } = normalised[i];
    const message = personalise(body.template, raw);

    try {
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ To: to, From: fromNumber, Body: message }),
        },
      );

      if (res.ok) {
        const data = (await res.json()) as { sid?: string };
        sent++;
        results.push({ to, ok: true, sid: data.sid });
        await recordUsage(ownerId, "sms", 1, {
          platform: "sms",
          twilio_sid: data.sid,
          bulk_job_id: jobRow.id,
        });
        await service.from("outreach_log").insert({
          platform: "sms",
          business_name: raw.company || null,
          recipient_handle: to,
          message_text: message,
          status: "sent",
          sent_at: new Date().toISOString(),
          metadata: {
            direction: "outbound",
            via: "dialer-bulk",
            twilio_sid: data.sid,
            bulk_job_id: jobRow.id,
          },
        });
      } else {
        failed++;
        const errText = await res.text().catch(() => "");
        results.push({ to, ok: false, error: `${res.status}: ${errText.slice(0, 200)}` });
      }
    } catch (err) {
      failed++;
      results.push({ to, ok: false, error: String(err).slice(0, 200) });
    }

    // Throttle between sends — skip on the last iteration.
    if (i < normalised.length - 1) {
      await new Promise((r) => setTimeout(r, throttleMs));
    }
  }

  await service
    .from("sms_bulk_jobs")
    .update({
      sent_count: sent,
      failed_count: failed,
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", jobRow.id)
    .eq("user_id", ownerId);

  return NextResponse.json({
    success: true,
    job_id: jobRow.id,
    sent,
    failed,
    total: normalised.length,
    results,
  });
}
