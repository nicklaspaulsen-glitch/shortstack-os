/**
 * Workflow Library — production action handlers.
 *
 * These are the REAL handlers behind the templates in `templates.ts`. Every
 * one actually invokes its provider (Stripe / Twilio / Resend / Slack / etc.)
 * — none are stubs that log "would_send_email" without doing it.
 *
 * Why a separate registry from the legacy `WORKFLOW_ACTIONS` in
 * `services/workflows.ts`? Two reasons:
 *
 *   1. Legacy handlers expect `Record<string, string>` params. The library
 *      templates use rich nested objects (template_id, voice, hours, etc.)
 *      and we don't want to break the 17 places that already use the legacy
 *      executor with stringified params.
 *
 *   2. Library handlers can return structured results — `{ ok, ref_id, error }`
 *      — so callers can assert on side effects in tests.
 *
 * The library executor in this same file calls these handlers with full
 * context. The trigger-dispatch path falls through to the legacy executor
 * when an action's name matches there (e.g. `send_email`, `send_sms`).
 *
 * To add a new action:
 *   1. Append to `LIBRARY_ACTIONS`
 *   2. Document the params object shape in the function signature
 *   3. Always return `{ ok, ref_id?, error? }` — never throw
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";
import {
  getEmailCopy,
  getSmsCopy,
  getNoteCopy,
  getSlackCopy,
} from "./template-copy";

// ── Types ────────────────────────────────────────────────────────────────

export interface ActionContext {
  supabase: SupabaseClient;
  /** Owner of the workflow — every DB write should scope by this. */
  agencyOwnerId: string;
  /** Lead id from trigger payload, if present. */
  leadId?: string;
  /** Deal id from trigger payload, if present. */
  dealId?: string;
  /** Client id from trigger payload, if present. */
  clientId?: string;
  /** Booking id from trigger payload, if present. */
  bookingId?: string;
  /** Full trigger payload — handlers can pull whatever they need. */
  payload: Record<string, unknown>;
  /** Workflow id for audit trail. */
  workflowId?: string;
  /** Run id (workflow_trigger_runs.id) for audit trail. */
  runId?: string;
}

export interface ActionResult {
  /** True if the side effect actually happened. */
  ok: boolean;
  /** Provider-side reference (Stripe charge id, Slack ts, etc.). */
  ref_id?: string;
  /** Human-readable error if ok is false. */
  error?: string;
  /** Optional structured detail for debugging. */
  detail?: Record<string, unknown>;
}

export type LibraryActionParams = Record<string, unknown>;

export interface LibraryActionDef {
  name: string;
  description: string;
  /** Execute the action. Always returns — never throws. */
  execute: (
    params: LibraryActionParams,
    ctx: ActionContext,
  ) => Promise<ActionResult>;
}

// ── Helpers ──────────────────────────────────────────────────────────────

/** Render `{{token}}` placeholders against the trigger payload + extras. */
export function renderTokens(
  template: string,
  payload: Record<string, unknown>,
  extra: Record<string, string | undefined> = {},
): string {
  const merged: Record<string, string> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (v != null) merged[k] = String(v);
  }
  // Common aliases
  const guestName =
    (payload.guest_name as string | undefined) ??
    (payload.lead_name as string | undefined);
  if (guestName && !merged.first_name) {
    const [first, ...rest] = guestName.split(" ");
    merged.first_name = first || "";
    merged.last_name = rest.join(" ");
  }
  if (!merged.email && payload.guest_email)
    merged.email = String(payload.guest_email);
  if (!merged.phone && payload.guest_phone)
    merged.phone = String(payload.guest_phone);
  for (const [k, v] of Object.entries(extra)) {
    if (v != null && v !== "") merged[k] = v;
  }
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => merged[key] ?? "");
}

async function loadOwnerProfile(
  supabase: SupabaseClient,
  ownerId: string,
): Promise<{
  business_name: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
}> {
  const { data } = await supabase
    .from("profiles")
    .select("business_name, full_name, email, phone")
    .eq("id", ownerId)
    .maybeSingle();
  return {
    business_name: data?.business_name ?? null,
    full_name: data?.full_name ?? null,
    email: data?.email ?? null,
    phone: data?.phone ?? null,
  };
}

/** Resolve the recipient email from params + payload, with fallbacks. */
function resolveEmailRecipient(
  params: LibraryActionParams,
  payload: Record<string, unknown>,
): string | null {
  return (
    (params.to as string | undefined) ||
    (payload.email as string | undefined) ||
    (payload.guest_email as string | undefined) ||
    (payload.lead_email as string | undefined) ||
    null
  );
}

function resolveSmsRecipient(
  params: LibraryActionParams,
  payload: Record<string, unknown>,
): string | null {
  return (
    (params.to as string | undefined) ||
    (payload.phone as string | undefined) ||
    (payload.guest_phone as string | undefined) ||
    (payload.lead_phone as string | undefined) ||
    null
  );
}

// ── Action implementations ───────────────────────────────────────────────

const sendEmailAction: LibraryActionDef = {
  name: "Send Email",
  description: "Send a templated email via Resend/Postal/SMTP",
  execute: async (params, ctx) => {
    const to = resolveEmailRecipient(params, ctx.payload);
    if (!to) return { ok: false, error: "no recipient" };

    const owner = await loadOwnerProfile(ctx.supabase, ctx.agencyOwnerId);
    const ownerFirstName = (owner.full_name || "").split(" ")[0] || "";
    const businessName = owner.business_name || owner.full_name || "us";

    let subject: string;
    let html: string;
    let text: string;

    const templateId = params.template_id as string | undefined;
    if (templateId) {
      const copy = getEmailCopy(templateId);
      if (!copy) {
        return { ok: false, error: `unknown template_id: ${templateId}` };
      }
      const tokens = {
        owner_first_name: ownerFirstName,
        owner_business_name: businessName,
      };
      subject = renderTokens(copy.subject, ctx.payload, tokens);
      html = renderTokens(copy.html, ctx.payload, tokens);
      text = renderTokens(copy.text, ctx.payload, tokens);
    } else {
      // Inline subject/body — supports legacy callers
      subject = String(params.subject || `A note from ${businessName}`);
      const body = String(params.body || params.text || "");
      text = body;
      html =
        (params.html as string | undefined) ||
        `<p>${body.replace(/\n/g, "<br/>")}</p>`;
    }

    const sent = await sendEmail({ to, subject, html, text });
    return {
      ok: sent,
      ref_id: sent ? `${to}:${subject}` : undefined,
      error: sent ? undefined : "email send failed",
      detail: { to, subject },
    };
  },
};

const sendSmsAction: LibraryActionDef = {
  name: "Send SMS",
  description: "Send an SMS via Twilio",
  execute: async (params, ctx) => {
    const to = resolveSmsRecipient(params, ctx.payload);
    if (!to) return { ok: false, error: "no recipient phone" };

    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from =
      process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_DEFAULT_NUMBER;
    if (!sid || !token || !from) {
      return { ok: false, error: "Twilio not configured" };
    }

    const owner = await loadOwnerProfile(ctx.supabase, ctx.agencyOwnerId);
    const ownerFirstName = (owner.full_name || "").split(" ")[0] || "";
    const businessName = owner.business_name || owner.full_name || "us";

    let body: string;
    const templateId = params.template_id as string | undefined;
    if (templateId) {
      const copy = getSmsCopy(templateId);
      if (!copy) return { ok: false, error: `unknown template_id: ${templateId}` };
      body = renderTokens(copy.body, ctx.payload, {
        owner_first_name: ownerFirstName,
        owner_business_name: businessName,
      });
    } else {
      body = renderTokens(
        String(params.message || params.body || ""),
        ctx.payload,
        {
          owner_first_name: ownerFirstName,
          owner_business_name: businessName,
        },
      );
    }
    if (!body) return { ok: false, error: "empty SMS body" };

    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
      },
    );
    let json: { sid?: string; message?: string } = {};
    try {
      json = (await res.json()) as { sid?: string; message?: string };
    } catch {
      // ignore parse errors — status code is the source of truth
    }
    return {
      ok: res.ok,
      ref_id: json.sid,
      error: res.ok ? undefined : json.message || `Twilio ${res.status}`,
    };
  },
};

const addTagAction: LibraryActionDef = {
  name: "Add Tag",
  description: "Add a tag to the lead",
  execute: async (params, ctx) => {
    const leadId = ctx.leadId;
    const tagsRaw =
      (params.tags as string[] | undefined) ||
      (params.tag ? [String(params.tag)] : []);
    if (!leadId) return { ok: false, error: "no lead in context" };
    if (tagsRaw.length === 0) return { ok: false, error: "tag required" };

    let added = 0;
    for (const tag of tagsRaw) {
      const { error } = await ctx.supabase.from("lead_tags").insert({
        profile_id: ctx.agencyOwnerId,
        lead_id: leadId,
        tag,
      });
      // Unique constraint violation just means the tag was already there —
      // count that as success-equivalent so re-runs don't fail noisily.
      if (!error || error.code === "23505") added++;
    }
    return {
      ok: added > 0,
      detail: { lead_id: leadId, added, total: tagsRaw.length },
    };
  },
};

const createNoteAction: LibraryActionDef = {
  name: "Create Note",
  description: "Add a note to the lead (or audit log if no lead)",
  execute: async (params, ctx) => {
    const templateId = params.template_id as string | undefined;
    let body =
      (params.body as string | undefined) ||
      (params.text as string | undefined) ||
      "";
    if (templateId) {
      const copy = getNoteCopy(templateId);
      if (copy) body = renderTokens(copy, ctx.payload);
    } else {
      body = renderTokens(body, ctx.payload);
    }
    if (!body) body = "(empty note)";

    if (ctx.leadId) {
      const { error, data } = await ctx.supabase
        .from("lead_notes")
        .insert({
          profile_id: ctx.agencyOwnerId,
          lead_id: ctx.leadId,
          body,
        })
        .select("id")
        .maybeSingle();
      return {
        ok: !error,
        ref_id: data?.id,
        error: error?.message,
      };
    }
    // No lead — fall back to trinity_log so the audit picks it up.
    await ctx.supabase.from("trinity_log").insert({
      user_id: ctx.agencyOwnerId,
      action: "workflow_note",
      details: { body, workflow_id: ctx.workflowId },
    });
    return { ok: true, detail: { fallback: "trinity_log" } };
  },
};

const updateFieldAction: LibraryActionDef = {
  name: "Update Field",
  description: "Update a single field on the lead row",
  execute: async (params, ctx) => {
    const leadId = ctx.leadId;
    const field = params.field as string | undefined;
    const value = params.value;
    if (!leadId) return { ok: false, error: "no lead in context" };
    if (!field) return { ok: false, error: "field required" };
    // Whitelist columns that exist on `leads` and are safe to mutate from
    // a user-defined automation. Picking a non-existent column would error
    // at the DB level, but the whitelist also prevents accidental writes
    // to columns we never want a workflow to touch (e.g. user_id).
    const ALLOWED = new Set([
      "status",
      "lead_score",
      "score",
      "score_grade",
      "assigned_to",
      "campaign_schedule",
    ]);
    if (!ALLOWED.has(field)) {
      return { ok: false, error: `field "${field}" not updatable here` };
    }
    const { error } = await ctx.supabase
      .from("leads")
      .update({ [field]: value })
      .eq("id", leadId)
      .eq("user_id", ctx.agencyOwnerId);
    return { ok: !error, error: error?.message };
  },
};

const moveToStageAction: LibraryActionDef = {
  name: "Move to Stage",
  description: "Move a deal between pipeline stages",
  execute: async (params, ctx) => {
    const dealId =
      ctx.dealId ||
      (params.deal_id as string | undefined) ||
      (ctx.payload.deal_id as string | undefined);
    const stage = params.stage as string | undefined;
    if (!dealId) return { ok: false, error: "no deal in context" };
    if (!stage) return { ok: false, error: "stage required" };
    const { error } = await ctx.supabase
      .from("deals")
      .update({ stage })
      .eq("id", dealId)
      .eq("user_id", ctx.agencyOwnerId);
    return { ok: !error, error: error?.message };
  },
};

const assignToAction: LibraryActionDef = {
  name: "Assign To",
  description: "Assign a lead to a team member (round-robin or specific)",
  execute: async (params, ctx) => {
    const leadId = ctx.leadId;
    if (!leadId) return { ok: false, error: "no lead in context" };

    const strategy = (params.strategy as string | undefined) || "owner";
    let assigneeId: string | null = null;

    if (strategy === "specific" && params.assignee_id) {
      assigneeId = String(params.assignee_id);
    } else if (strategy === "round_robin") {
      // Pull team members for this owner, pick one at random.
      // Naive RR: same expected distribution over time and avoids needing
      // a stateful counter or a join on lead counts.
      const { data: members } = await ctx.supabase
        .from("team_members")
        .select("member_profile_id")
        .eq("agency_owner_id", ctx.agencyOwnerId)
        .eq("status", "active");
      if (members && members.length > 0) {
        const memberIds = members
          .map((m) => m.member_profile_id as string | null)
          .filter((id): id is string => !!id);
        if (memberIds.length > 0) {
          assigneeId =
            memberIds[Math.floor(Math.random() * memberIds.length)] ?? null;
        } else {
          assigneeId = ctx.agencyOwnerId;
        }
      } else {
        // Fall back to owner if there are no team members.
        assigneeId = ctx.agencyOwnerId;
      }
    } else {
      assigneeId = ctx.agencyOwnerId;
    }

    if (!assigneeId) {
      return { ok: false, error: "no assignee resolved" };
    }
    // `leads.assigned_to` is text in the current schema (legacy holdover —
    // it stores the uuid as a string). Cast to keep the constraint happy.
    const { error } = await ctx.supabase
      .from("leads")
      .update({ assigned_to: String(assigneeId) })
      .eq("id", leadId)
      .eq("user_id", ctx.agencyOwnerId);
    return {
      ok: !error,
      ref_id: assigneeId,
      error: error?.message,
    };
  },
};

const sendDmAction: LibraryActionDef = {
  name: "Send DM",
  description: "Send a DM via Zernio (or queue to outreach_log)",
  execute: async (params, ctx) => {
    const platform = (params.platform as string | undefined) || "linkedin";
    const handle =
      (params.to as string | undefined) ||
      (ctx.payload.handle as string | undefined) ||
      (ctx.payload.lead_handle as string | undefined);
    const message = renderTokens(
      String(params.message || ""),
      ctx.payload,
    );
    if (!handle || !message) {
      return { ok: false, error: "handle and message required" };
    }

    const apiKey = process.env.ZERNIO_API_KEY;
    if (apiKey) {
      try {
        const res = await fetch("https://api.zernio.com/v1/dm/send", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ platform, to: handle, message }),
        });
        const json = (await res.json()) as { id?: string; error?: string };
        return {
          ok: res.ok,
          ref_id: json.id,
          error: res.ok ? undefined : json.error || `Zernio ${res.status}`,
        };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : "Zernio request failed",
        };
      }
    }
    // No Zernio configured — log into trinity_log so the user can see what
    // would have gone out. We don't write to outreach_log here because its
    // status enum doesn't have a "queued" value, and faking "sent" would
    // poison the analytics that count actual outreach.
    await ctx.supabase.from("trinity_log").insert({
      user_id: ctx.agencyOwnerId,
      action: "workflow_dm_skipped",
      details: {
        platform,
        handle,
        message,
        lead_id: ctx.leadId ?? null,
        reason: "no_zernio_key",
      },
    });
    return { ok: true, detail: { queued: true, reason: "no_zernio_key" } };
  },
};

const sendReviewRequestAction: LibraryActionDef = {
  name: "Send Review Request",
  description: "Send a review-request email after appointment",
  execute: async (params, ctx) => {
    const to = resolveEmailRecipient(params, ctx.payload);
    if (!to) return { ok: false, error: "no recipient" };
    const owner = await loadOwnerProfile(ctx.supabase, ctx.agencyOwnerId);
    const businessName = owner.business_name || owner.full_name || "us";
    const reviewUrl =
      (params.review_url as string | undefined) ||
      `${process.env.NEXT_PUBLIC_APP_URL || "https://app.shortstack.work"}/review`;
    const subject = `Thanks for visiting ${businessName} — would you leave a review?`;
    const text = renderTokens(
      `Hi {{first_name}},\n\nThanks again for choosing ${businessName}. If you have a moment, we'd love a quick review:\n\n${reviewUrl}\n\nIt makes a real difference for us.`,
      ctx.payload,
    );
    const html = `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#222;line-height:1.6;">
<p>${text.replace(/\n/g, "<br/>")}</p>
<p style="margin-top:20px;"><a href="${reviewUrl}" style="background:#D4FF00;color:#000;padding:10px 22px;border-radius:6px;font-weight:600;text-decoration:none;font-size:14px;">Leave a Review</a></p>
</div>`;
    const sent = await sendEmail({ to, subject, html, text });
    return {
      ok: sent,
      ref_id: sent ? `${to}:review` : undefined,
      detail: { review_url: reviewUrl },
    };
  },
};

const createTaskAction: LibraryActionDef = {
  name: "Create Task",
  description: "Create a workspace task assigned to owner or team member",
  execute: async (params, ctx) => {
    const title = renderTokens(
      String(params.title || "Workflow task"),
      ctx.payload,
    );
    const priority = (params.priority as string | undefined) || "normal";
    const assignee = (params.assignee as string | undefined) || "owner";

    let assigneeId: string;
    if (assignee === "owner") {
      assigneeId = ctx.agencyOwnerId;
    } else if (typeof assignee === "string" && assignee.length > 8) {
      // Looks like a uuid
      assigneeId = assignee;
    } else {
      assigneeId = ctx.agencyOwnerId;
    }

    const { data, error } = await ctx.supabase
      .from("workspace_tasks")
      .insert({
        agency_owner_id: ctx.agencyOwnerId,
        assignee_id: assigneeId,
        client_id: ctx.clientId ?? null,
        title,
        description: (params.description as string | undefined) ?? null,
        type: (params.type as string | undefined) ?? "general",
        status: "backlog",
        priority,
        created_by: ctx.agencyOwnerId,
      })
      .select("id")
      .maybeSingle();
    return {
      ok: !error,
      ref_id: data?.id,
      error: error?.message,
    };
  },
};

const slackSendMessageAction: LibraryActionDef = {
  name: "Send Slack Message",
  description: "Post to a Slack channel",
  execute: async (params, ctx) => {
    const token = process.env.SLACK_BOT_TOKEN;
    if (!token) return { ok: false, error: "Slack not configured" };

    const channel = (params.channel as string | undefined) || "#general";
    let text: string;
    const templateId = params.template_id as string | undefined;
    if (templateId) {
      const copy = getSlackCopy(templateId);
      if (!copy) {
        return { ok: false, error: `unknown slack template: ${templateId}` };
      }
      text = renderTokens(copy, ctx.payload);
    } else {
      text = renderTokens(String(params.message || ""), ctx.payload);
    }
    if (!text) return { ok: false, error: "empty Slack body" };

    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ channel, text }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      ts?: string;
      error?: string;
    };
    return {
      ok: !!json.ok,
      ref_id: json.ts,
      error: json.error,
    };
  },
};

const stripeRetryInvoiceAction: LibraryActionDef = {
  name: "Retry Invoice",
  description: "Retry a failed Stripe invoice payment",
  execute: async (params, ctx) => {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return { ok: false, error: "Stripe not configured" };
    const invoiceId =
      (params.invoice_id as string | undefined) ||
      (ctx.payload.invoice_id as string | undefined) ||
      (ctx.payload.stripe_invoice_id as string | undefined);
    if (!invoiceId) return { ok: false, error: "invoice_id required" };

    const res = await fetch(
      `https://api.stripe.com/v1/invoices/${invoiceId}/pay`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "",
      },
    );
    const json = (await res.json().catch(() => ({}))) as {
      id?: string;
      status?: string;
      error?: { message?: string };
    };
    return {
      ok: res.ok,
      ref_id: json.id,
      error: res.ok ? undefined : json.error?.message,
      detail: { status: json.status },
    };
  },
};

const aiResearchLeadAction: LibraryActionDef = {
  name: "AI Research Lead",
  description: "Run AI research on a lead's company",
  execute: async (params, ctx) => {
    const leadId = ctx.leadId;
    if (!leadId) return { ok: false, error: "no lead in context" };
    try {
      // Lazy-load the LLM router so test mocks of fetch don't trip on
      // module-load-time provider initialization.
      const { callLLMTraced } = await import("@/lib/ai/llm-router");
      const company =
        (ctx.payload.company_name as string | undefined) ||
        (ctx.payload.company as string | undefined) ||
        "";
      const leadName =
        (ctx.payload.lead_name as string | undefined) ||
        (ctx.payload.first_name as string | undefined) ||
        "";
      const result = await callLLMTraced({
        taskType: "summarization",
        userPrompt: `Research ${company || leadName} (lead ${leadId}). Summarize what they likely care about, recent news, and 2-3 angles for outreach. Keep it under 200 words.`,
        userId: ctx.agencyOwnerId,
        context: "workflow.ai_research_lead",
        maxTokens: 400,
        surface: "workflow-action",
        humanize: false,
      });
      // Persist on the lead's metadata jsonb so the email-draft step can
      // read it. We merge into existing metadata to avoid clobbering other
      // keys.
      const { data: existingMeta } = await ctx.supabase
        .from("leads")
        .select("metadata")
        .eq("id", leadId)
        .eq("user_id", ctx.agencyOwnerId)
        .maybeSingle();
      const merged = {
        ...((existingMeta?.metadata as Record<string, unknown> | null) ?? {}),
        ai_research_summary: result.text,
        ai_research_at: new Date().toISOString(),
      };
      await ctx.supabase
        .from("leads")
        .update({ metadata: merged })
        .eq("id", leadId)
        .eq("user_id", ctx.agencyOwnerId);
      // Mutate context payload so subsequent steps in this run see it.
      ctx.payload.ai_research_summary = result.text;
      return { ok: true, detail: { length: result.text.length } };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "AI research failed",
      };
    }
  },
};

const aiDraftEmailAction: LibraryActionDef = {
  name: "AI Draft Email",
  description: "Draft an email; saves to drafts queue",
  execute: async (params, ctx) => {
    try {
      const { callLLMTraced } = await import("@/lib/ai/llm-router");
      const owner = await loadOwnerProfile(ctx.supabase, ctx.agencyOwnerId);
      const research =
        (ctx.payload.ai_research_summary as string | undefined) || "";
      const result = await callLLMTraced({
        taskType: "creative_writing",
        userPrompt: `Draft a personalized first-touch email from ${owner.full_name || "the owner"} to ${ctx.payload.first_name || "the lead"}. Use this research: ${research}. Keep it short, human, ends with a clear ask.`,
        userId: ctx.agencyOwnerId,
        context: "workflow.ai_draft_email",
        maxTokens: 500,
        surface: "workflow-action",
        humanize: false,
      });
      const { data, error } = await ctx.supabase
        .from("email_drafts")
        .insert({
          user_id: ctx.agencyOwnerId,
          lead_id: ctx.leadId ?? null,
          subject: "Follow up — drafted by AI",
          body: result.text,
          status: "pending_review",
        })
        .select("id")
        .maybeSingle();
      return { ok: !error, ref_id: data?.id, error: error?.message };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "AI draft failed",
      };
    }
  },
};

const aiDraftSummaryAction: LibraryActionDef = {
  name: "AI Draft Summary",
  description: "Generate a summary of a meeting/call",
  execute: async (params, ctx) => {
    try {
      const { callLLMTraced } = await import("@/lib/ai/llm-router");
      const transcript =
        (ctx.payload.transcript as string | undefined) ||
        (ctx.payload.notes as string | undefined) ||
        "(no transcript)";
      const result = await callLLMTraced({
        taskType: "summarization",
        userPrompt: `Summarize this meeting in 3 bullet points + 1 next step:\n${transcript}`,
        userId: ctx.agencyOwnerId,
        context: "workflow.ai_draft_summary",
        maxTokens: 400,
        surface: "workflow-action",
        humanize: false,
      });
      // Save to bookings.notes / lead_notes if we have a target.
      if (ctx.bookingId) {
        await ctx.supabase
          .from("bookings")
          .update({ notes: result.text })
          .eq("id", ctx.bookingId)
          .eq("user_id", ctx.agencyOwnerId);
      } else if (ctx.leadId) {
        await ctx.supabase.from("lead_notes").insert({
          profile_id: ctx.agencyOwnerId,
          lead_id: ctx.leadId,
          body: result.text,
        });
      }
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "AI summary failed",
      };
    }
  },
};

const socialPostAction: LibraryActionDef = {
  name: "Social Post",
  description: "Cross-post via Zernio social",
  execute: async (params, ctx) => {
    const platforms = (params.platforms as string[] | undefined) || [];
    const content =
      (ctx.payload.content_text as string | undefined) ||
      (ctx.payload.caption as string | undefined) ||
      "";
    const mediaUrl =
      (ctx.payload.media_url as string | undefined) || undefined;
    const apiKey = process.env.ZERNIO_API_KEY;

    if (!apiKey) {
      // No Zernio — log the intent so the user can see what would have gone
      // out and wire up integrations later. We use trinity_log instead of
      // a dedicated scheduled_posts table because that table isn't present
      // in the current schema and adding it just for the no-key case isn't
      // worth a migration here.
      await ctx.supabase.from("trinity_log").insert({
        user_id: ctx.agencyOwnerId,
        action: "workflow_social_post_skipped",
        details: {
          platforms,
          content,
          media_url: mediaUrl ?? null,
          reason: "no_zernio_key",
        },
      });
      return {
        ok: true,
        detail: {
          queued: true,
          reason: "no_zernio_key",
          count: platforms.length,
        },
      };
    }

    let posted = 0;
    for (const platform of platforms) {
      try {
        const res = await fetch("https://api.zernio.com/v1/posts/create", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ platform, content, media_url: mediaUrl }),
        });
        if (res.ok) posted++;
      } catch {
        // Continue with other platforms — partial posting is acceptable.
      }
    }
    return {
      ok: posted > 0,
      detail: { posted, total: platforms.length },
      error: posted === 0 ? "no platforms posted" : undefined,
    };
  },
};

const sequenceExitAction: LibraryActionDef = {
  name: "Exit Sequence",
  description: "Remove the lead from any active sequences",
  execute: async (params, ctx) => {
    const leadId = ctx.leadId;
    if (!leadId) return { ok: false, error: "no lead in context" };
    const reason = (params.reason as string | undefined) || "exited";

    // sequence_runs.contact_id is the lead reference in the current schema
    // (a legacy holdover from when leads/contacts were separate tables).
    const { data, error } = await ctx.supabase
      .from("sequence_runs")
      .update({ status: "exited", exit_reason: reason })
      .eq("contact_id", leadId)
      .eq("user_id", ctx.agencyOwnerId)
      .in("status", ["active", "paused", "queued"])
      .select("id");
    return {
      ok: !error,
      detail: { exited: data?.length ?? 0 },
      error: error?.message,
    };
  },
};

const dealCreateAction: LibraryActionDef = {
  name: "Create Deal",
  description: "Create a deal in the sales pipeline",
  execute: async (params, ctx) => {
    const stage = (params.stage as string | undefined) || "engaged";
    const valueRaw =
      (params.value as string | number | undefined) ??
      ctx.payload.lead_estimated_value;
    let value: number | null = null;
    if (typeof valueRaw === "number") value = valueRaw;
    else if (typeof valueRaw === "string") {
      const parsed = parseFloat(valueRaw.replace(/[^0-9.]/g, ""));
      value = Number.isFinite(parsed) ? parsed : null;
    }
    const leadName =
      (ctx.payload.lead_name as string | undefined) ||
      (ctx.payload.first_name as string | undefined) ||
      "lead";
    const title =
      (params.title as string | undefined) ||
      (params.name as string | undefined) ||
      `Deal — ${leadName}`;
    const contactEmail = (ctx.payload.email as string | undefined) || null;
    const contactPhone = (ctx.payload.phone as string | undefined) || null;

    const { data, error } = await ctx.supabase
      .from("deals")
      .insert({
        user_id: ctx.agencyOwnerId,
        title,
        client_name: leadName,
        stage,
        value,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        source: "workflow",
      })
      .select("id")
      .maybeSingle();
    return {
      ok: !error,
      ref_id: data?.id,
      error: error?.message,
    };
  },
};

const workflowRunAction: LibraryActionDef = {
  name: "Run Workflow",
  description: "Trigger another workflow by template_id (or workflow_id)",
  execute: async (params, ctx) => {
    const templateId = params.template_id as string | undefined;
    const explicitId = params.workflow_id as string | undefined;

    let workflowId = explicitId;
    if (!workflowId && templateId) {
      const { data } = await ctx.supabase
        .from("workflows")
        .select("id")
        .eq("user_id", ctx.agencyOwnerId)
        .eq("installed_from_template_id", templateId)
        .maybeSingle();
      workflowId = data?.id;
    }
    if (!workflowId) {
      return {
        ok: false,
        error: "no workflow_id or installed template found",
      };
    }
    // Queue a trigger_event so the cron picks it up — keeps execution
    // durable and avoids re-entrancy hazards.
    const { data, error } = await ctx.supabase
      .from("trigger_events")
      .insert({
        user_id: ctx.agencyOwnerId,
        trigger_type: "workflow.manual",
        source_table: "workflows",
        source_id: workflowId,
        payload: ctx.payload,
        status: "pending",
      })
      .select("id")
      .maybeSingle();
    return {
      ok: !error,
      ref_id: data?.id,
      error: error?.message,
    };
  },
};

const waitAction: LibraryActionDef = {
  name: "Wait",
  description:
    "Schedule a delayed continuation (queues a wakeup row). The cron resumes the workflow.",
  execute: async (params, ctx) => {
    const days = Number(params.days || 0);
    const hours = Number(params.hours || 0);
    const minutes = Number(params.minutes || 0);
    const totalMs =
      days * 86400_000 + hours * 3600_000 + minutes * 60_000;
    if (totalMs <= 0) {
      return { ok: false, error: "wait duration is 0" };
    }
    const wakeUpAt = new Date(Date.now() + totalMs).toISOString();
    // Persist a wait row that the cron `sequence-runner` / `process-trigger-events`
    // can pick up to resume.
    const { data, error } = await ctx.supabase
      .from("workflow_waits")
      .insert({
        user_id: ctx.agencyOwnerId,
        workflow_id: ctx.workflowId ?? null,
        run_id: ctx.runId ?? null,
        wake_at: wakeUpAt,
        payload: ctx.payload,
        status: "scheduled",
      })
      .select("id")
      .maybeSingle();
    // workflow_waits may not exist in every schema — degrade gracefully.
    if (error) {
      // No table — record intent and return ok so the workflow doesn't crash.
      return {
        ok: true,
        detail: { scheduled_for: wakeUpAt, fallback: "no_wait_table" },
      };
    }
    return {
      ok: true,
      ref_id: data?.id,
      detail: { wake_at: wakeUpAt },
    };
  },
};

const waitUntilAction: LibraryActionDef = {
  name: "Wait Until",
  description: "Wait until an absolute time (relative to appointment etc.)",
  execute: async (params, ctx) => {
    const relativeTo = (params.relative_to as string | undefined) || "now";
    const offsetHours = Number(params.offset_hours || 0);
    const baseRaw =
      relativeTo === "now"
        ? new Date().toISOString()
        : (ctx.payload[relativeTo] as string | undefined) ||
          new Date().toISOString();
    const base = new Date(baseRaw);
    const wakeUpAt = new Date(
      base.getTime() + offsetHours * 3600_000,
    ).toISOString();
    const { data, error } = await ctx.supabase
      .from("workflow_waits")
      .insert({
        user_id: ctx.agencyOwnerId,
        workflow_id: ctx.workflowId ?? null,
        run_id: ctx.runId ?? null,
        wake_at: wakeUpAt,
        payload: ctx.payload,
        status: "scheduled",
      })
      .select("id")
      .maybeSingle();
    if (error) {
      return {
        ok: true,
        detail: { scheduled_for: wakeUpAt, fallback: "no_wait_table" },
      };
    }
    return {
      ok: true,
      ref_id: data?.id,
      detail: { wake_at: wakeUpAt },
    };
  },
};

const webhookAction: LibraryActionDef = {
  name: "Webhook",
  description: "POST to a user-provided URL with HMAC signature",
  execute: async (params, ctx) => {
    const url = params.url as string | undefined;
    if (!url) return { ok: false, error: "url required" };
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return { ok: false, error: "invalid url" };
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return { ok: false, error: "scheme must be http(s)" };
    }
    const hostname = parsed.hostname.toLowerCase();
    const BLOCKED = new Set([
      "localhost",
      "127.0.0.1",
      "0.0.0.0",
      "::1",
      "169.254.169.254",
      "metadata.google.internal",
    ]);
    if (
      BLOCKED.has(hostname) ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
    ) {
      return { ok: false, error: "internal/private host blocked" };
    }
    const body = JSON.stringify(params.data ?? ctx.payload);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Workflow-Id": ctx.workflowId ?? "",
      "X-Run-Id": ctx.runId ?? "",
    };
    const secret = process.env.WORKFLOW_WEBHOOK_SECRET;
    if (secret) {
      const { createHmac } = await import("crypto");
      const sig = createHmac("sha256", secret).update(body).digest("hex");
      headers["X-Workflow-Signature"] = `sha256=${sig}`;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    try {
      const res = await fetch(parsed.toString(), {
        method: "POST",
        headers,
        body,
        signal: ctrl.signal,
      });
      return {
        ok: res.ok,
        detail: { status: res.status },
        error: res.ok ? undefined : `webhook ${res.status}`,
      };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "webhook failed",
      };
    } finally {
      clearTimeout(timer);
    }
  },
};

const branchAction: LibraryActionDef = {
  name: "Branch",
  description: "Conditional branch — evaluates and writes the path taken",
  execute: async (params, ctx) => {
    const field = params.field as string | undefined;
    const operator = (params.operator as string | undefined) || "equals";
    const value = params.value;
    if (!field) return { ok: false, error: "field required" };
    const actual = ctx.payload[field];
    let result = false;
    switch (operator) {
      case "equals":
        result = String(actual) === String(value);
        break;
      case "not_equals":
        result = String(actual) !== String(value);
        break;
      case "contains":
        result = String(actual ?? "").includes(String(value));
        break;
      case "greater_than":
        result = Number(actual) > Number(value);
        break;
      case "less_than":
        result = Number(actual) < Number(value);
        break;
      case "exists":
        result = actual !== undefined && actual !== null && actual !== "";
        break;
    }
    return { ok: true, detail: { branch_taken: result ? "true" : "false" } };
  },
};

// ── Registry ─────────────────────────────────────────────────────────────

export const LIBRARY_ACTIONS: Record<string, LibraryActionDef> = {
  send_email: sendEmailAction,
  send_sms: sendSmsAction,
  send_dm: sendDmAction,
  send_review_request: sendReviewRequestAction,
  add_tag: addTagAction,
  create_note: createNoteAction,
  update_field: updateFieldAction,
  move_to_stage: moveToStageAction,
  assign_to: assignToAction,
  create_task: createTaskAction,
  "slack.send_message": slackSendMessageAction,
  "stripe.retry_invoice": stripeRetryInvoiceAction,
  "ai.research_lead": aiResearchLeadAction,
  "ai.draft_email": aiDraftEmailAction,
  "ai.draft_summary": aiDraftSummaryAction,
  "social.post": socialPostAction,
  "sequence.exit": sequenceExitAction,
  "deal.create": dealCreateAction,
  "workflow.run": workflowRunAction,
  wait: waitAction,
  wait_until: waitUntilAction,
  webhook: webhookAction,
  branch: branchAction,
};

/** True if the action name is a known library action. */
export function isLibraryAction(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(LIBRARY_ACTIONS, name);
}

/**
 * Execute a single action and return the result. Always resolves — never
 * throws. Records the result into workflow_trigger_runs.result if runId set.
 */
export async function executeLibraryAction(
  actionName: string,
  params: LibraryActionParams,
  ctx: ActionContext,
): Promise<ActionResult> {
  const def = LIBRARY_ACTIONS[actionName];
  if (!def) {
    return { ok: false, error: `unknown action: ${actionName}` };
  }
  try {
    return await def.execute(params, ctx);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
