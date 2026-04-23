import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { upsertInboundMessage, findContactByIdentifier, resolveUserIdForChannel } from "@/lib/conversations";

// Inbound email → Conversations.
//
// Resend doesn't natively forward inbound email yet — this endpoint is
// shaped to accept BOTH:
//   1. A Resend-shaped event (type='email.inbound') if/when that rolls out.
//   2. A generic inbound-email adapter payload (Postmark / CloudMailin /
//      custom MX pipe) with fields { from, to, subject, text, html, message_id,
//      in_reply_to, references }. This is the "belt and braces" route.
//
// The `to` address's domain is matched against agency_mail_domains to
// figure out which agency owns the mailbox.
//
// Register a catch-all in the MX provider and point it at:
//   POST https://app.shortstack.work/api/webhooks/resend/inbound
//
// Or configure Resend's inbound-email webhook (when available) to the
// same URL — we accept both shapes below.

export const runtime = "nodejs";
export const maxDuration = 30;

interface InboundEmail {
  from?: string;
  to?: string | string[];
  subject?: string;
  text?: string;
  html?: string;
  message_id?: string;
  in_reply_to?: string | null;
  references?: string | string[] | null;
  attachments?: Array<{ filename?: string; contentType?: string; url?: string }>;
}

export async function POST(request: NextRequest) {
  const supabase = createServiceClient();
  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Normalize both shapes — if Resend ships it as a wrapped event, unwrap.
  const email: InboundEmail =
    payload.data && typeof payload.data === "object"
      ? (payload.data as InboundEmail)
      : (payload as InboundEmail);

  const fromRaw = (email.from || "").toString();
  const toRaw = Array.isArray(email.to) ? email.to[0] : email.to;
  const to = (toRaw || "").toString();
  if (!fromRaw || !to) {
    return NextResponse.json({ error: "from/to required" }, { status: 400 });
  }

  // Strip "Name <addr@domain>" wrapping to bare addresses.
  const fromAddress = extractAddress(fromRaw);
  const toAddress = extractAddress(to);
  const toDomain = toAddress.split("@")[1]?.toLowerCase();

  const ownerId = await resolveUserIdForChannel(supabase, "email", { domain: toDomain });
  if (!ownerId) {
    // No owner — log and drop silently (could be a catch-all for a
    // non-configured domain).
    return NextResponse.json({ ok: true, skipped: "no_owner" });
  }

  const contactId = await findContactByIdentifier(supabase, ownerId, fromAddress);

  // Use in_reply_to / references for threading when available; else hash
  // by (from + subject) so same-thread replies cluster.
  const refs = Array.isArray(email.references) ? email.references.join(" ") : email.references || "";
  const externalThreadId =
    email.in_reply_to || firstReference(refs) || `${fromAddress}|${(email.subject || "").trim()}`;

  await upsertInboundMessage({
    supabase,
    userId: ownerId,
    channel: "email",
    externalThreadId,
    fromIdentifier: fromAddress,
    toIdentifier: toAddress,
    subject: email.subject,
    body: email.text || stripHtml(email.html || ""),
    externalMessageId: email.message_id,
    attachments: (email.attachments || []).map((a) => ({
      url: a.url || "",
      filename: a.filename,
      mimetype: a.contentType,
    })),
    contactId,
  });

  return NextResponse.json({ ok: true });
}

function extractAddress(raw: string): string {
  const m = raw.match(/<([^>]+)>/);
  return (m ? m[1] : raw).trim().toLowerCase();
}

function firstReference(s: string): string | null {
  const m = s.match(/<([^>]+)>/);
  return m ? m[1] : null;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
