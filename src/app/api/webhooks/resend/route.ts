import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { fireTrigger, type TriggerType } from "@/lib/workflows/trigger-dispatch";
import crypto from "crypto";

// ──────────────────────────────────────────────────────────────────────────
// POST /api/webhooks/resend
//
// Resend uses Svix for webhook delivery. Event payload:
// {
//   type: "email.opened" | "email.clicked" | "email.delivered" | "email.bounced"
//          | "email.complained" | "email.failed" | "email.sent",
//   created_at: ISO date,
//   data: {
//     email_id: "...",
//     from: "agency@domain.com",
//     to: ["recipient@..."],
//     subject: "...",
//     tags: [{ name, value }],
//     click?: { link, timestamp },
//     ...
//   }
// }
//
// Register at: https://resend.com/webhooks
// URL: https://app.shortstack.work/api/webhooks/resend
// Save the signing secret to Vercel env as RESEND_WEBHOOK_SECRET.
//
// Maps Resend events → our trigger types:
//   email.opened    → email_opened
//   email.clicked   → email_clicked
//   (email.delivered, .sent, .bounced, .complained, .failed are logged
//    for observability but don't currently have a dedicated trigger type)
//
// User resolution: we look at the `from` address and match against
// `agency_mail_domains` to figure out which agency the email belongs to.
// If no match and the `from` uses the shared SMTP_FROM, we skip firing
// (no clear owner). Every event is still logged to trinity_log for debug.
// ──────────────────────────────────────────────────────────────────────────

export const runtime = "nodejs";
export const maxDuration = 30;

// Svix signature verification. Optional — only enforced if
// RESEND_WEBHOOK_SECRET is set. The secret format is `whsec_<base64>`;
// the content we HMAC is `${svix-id}.${svix-timestamp}.${body}`.
function verifySvixSignature(
  rawBody: string,
  svixId: string | null,
  svixTimestamp: string | null,
  svixSignatureHeader: string | null,
  secret: string,
): boolean {
  if (!svixId || !svixTimestamp || !svixSignatureHeader) return false;
  // Strip whsec_ prefix + base64-decode to get the raw signing key.
  const rawSecret = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  let keyBytes: Buffer;
  try {
    keyBytes = Buffer.from(rawSecret, "base64");
  } catch {
    return false;
  }
  const toSign = `${svixId}.${svixTimestamp}.${rawBody}`;
  const expected = crypto
    .createHmac("sha256", keyBytes)
    .update(toSign)
    .digest("base64");
  // Header can contain multiple signatures separated by spaces:
  // "v1,<sig1> v1,<sig2>"
  const parts = svixSignatureHeader.split(" ");
  for (const part of parts) {
    const [, sig] = part.split(",");
    if (sig && timingSafeEqual(sig, expected)) return true;
  }
  return false;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

interface ResendEvent {
  type: string;
  created_at?: string;
  data: {
    email_id?: string;
    from?: string;
    to?: string[] | string;
    subject?: string;
    tags?: Array<{ name: string; value: string }>;
    click?: { link: string; timestamp: string };
    [key: string]: unknown;
  };
}

/** Look up the agency owner by the `from` address. Uses the domain
 *  portion of the email to match against `agency_mail_domains`. */
async function resolveOwnerFromFrom(
  supabase: ReturnType<typeof createServiceClient>,
  fromAddress: string | undefined,
): Promise<string | null> {
  if (!fromAddress) return null;
  const match = fromAddress.match(/@([^>\s]+)/);
  const domain = match?.[1]?.toLowerCase().trim();
  if (!domain) return null;
  try {
    const { data } = await supabase
      .from("agency_mail_domains")
      .select("profile_id")
      .eq("domain", domain)
      .eq("status", "verified")
      .maybeSingle();
    return (data as { profile_id?: string } | null)?.profile_id ?? null;
  } catch {
    return null;
  }
}

/** Pull our custom `shortstack_user_id` tag if the sender set one when
 *  dispatching the email. Most reliable resolution method. */
function resolveOwnerFromTags(tags: Array<{ name: string; value: string }> | undefined): string | null {
  if (!tags || !Array.isArray(tags)) return null;
  const tag = tags.find((t) => t.name === "shortstack_user_id" || t.name === "user_id");
  return tag?.value || null;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  // Svix signature headers
  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");
  const secret = process.env.RESEND_WEBHOOK_SECRET || "";

  if (secret) {
    const valid = verifySvixSignature(rawBody, svixId, svixTimestamp, svixSignature, secret);
    if (!valid) {
      console.warn("[resend-webhook] signature verification failed");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
  } else {
    console.warn(
      "[resend-webhook] RESEND_WEBHOOK_SECRET not set — accepting unsigned events. " +
        "Add the signing secret from resend.com/webhooks to secure this endpoint.",
    );
  }

  let event: ResendEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Map Resend event types → our trigger types (only the ones we have
  // triggers for). Other event types are logged but don't fire.
  const RESEND_TO_TRIGGER: Record<string, TriggerType> = {
    "email.opened": "email_opened",
    "email.clicked": "email_clicked",
    // Future: email.delivered, .sent, .bounced, .complained, .failed
    // would need their own trigger types added to TriggerType.
  };

  const triggerType = RESEND_TO_TRIGGER[event.type];

  // Resolve the agency owner whose email this was. Try the custom
  // shortstack_user_id tag first (most reliable — our send routes
  // should set it), then fall back to matching the `from` domain
  // against agency_mail_domains.
  const ownerFromTags = resolveOwnerFromTags(event.data.tags);
  const ownerFromDomain = ownerFromTags
    ? null
    : await resolveOwnerFromFrom(supabase, event.data.from);
  const ownerId = ownerFromTags || ownerFromDomain;

  // Audit log — every event, regardless of whether a trigger fires.
  // Lets the user see "email.bounced" events etc. even without a
  // dedicated trigger for them.
  await supabase.from("trinity_log").insert({
    user_id: ownerId,
    agent: "resend-webhook",
    action_type: "email_campaign",
    description: `Resend event: ${event.type}${event.data.email_id ? ` (${event.data.email_id})` : ""}`,
    status: "completed",
    result: {
      event_type: event.type,
      email_id: event.data.email_id,
      from: event.data.from,
      to: event.data.to,
      subject: event.data.subject,
      click: event.data.click,
      owner_resolution: ownerFromTags ? "tag" : ownerFromDomain ? "domain" : "none",
    },
  });

  // Fire the trigger if we have a mapping AND we could resolve an owner.
  if (triggerType && ownerId) {
    fireTrigger({
      supabase,
      userId: ownerId,
      triggerType,
      payload: {
        email_id: event.data.email_id,
        from: event.data.from,
        to: Array.isArray(event.data.to) ? event.data.to[0] : event.data.to,
        subject: event.data.subject,
        click_link: event.data.click?.link,
        click_timestamp: event.data.click?.timestamp,
        // Pass through any `campaign_id` tag so filters can match on it.
        campaign_id: event.data.tags?.find((t) => t.name === "campaign_id")?.value,
      },
    }).catch((err) => console.error("[resend-webhook] fireTrigger failed:", err));
  }

  return NextResponse.json({ ok: true, event_type: event.type, fired: !!(triggerType && ownerId) });
}
