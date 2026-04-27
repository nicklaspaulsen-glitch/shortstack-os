import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { upsertInboundMessage, findContactByIdentifier, resolveUserIdForChannel } from "@/lib/conversations";
import { exitRunsForContact } from "@/lib/sequences/engine";

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
//
// AUTH (defense-in-depth, Apr 27 2026)
// Provider-agnostic shared-secret check, since this route can sit behind any
// of Postmark / CloudMailin / Resend-future inbound. Configure the upstream
// to send `Authorization: Bearer <WEBHOOK_SECRET>`, and set `WEBHOOK_SECRET`
// in Vercel env. Reuses the existing generic `WEBHOOK_SECRET` (already in
// `.env.example`, already used by `/api/webhooks/inbound` and the GHL route)
// so Nicklas doesn't need to manage another secret.
// Without the env var the route falls open in dev / preview deploys
// (logs a warning) and fails closed in production with 503 — same pattern
// as the main Resend webhook.

export const runtime = "nodejs";
export const maxDuration = 30;

// Constant-time comparison of two strings. Returns false on length mismatch
// (timingSafeEqual throws otherwise) and on any allocation/timing error.
function timingSafeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

// Verify the shared-secret bearer token in the Authorization header.
// Returns:
//   "ok"        — secret configured + matched, proceed
//   "missing"   — env var missing → behavior depends on NODE_ENV
//   "invalid"   — env var set but Authorization header doesn't match
function verifyInboundAuth(request: NextRequest): "ok" | "missing" | "invalid" {
  const expected = process.env.WEBHOOK_SECRET || "";
  if (!expected) return "missing";

  const auth = request.headers.get("authorization") || "";
  // Accept both "Bearer <token>" and bare "<token>" — some MX providers
  // (cough CloudMailin) don't prefix.
  const provided = auth.startsWith("Bearer ") ? auth.slice(7).trim() : auth.trim();
  return timingSafeStringEqual(provided, expected) ? "ok" : "invalid";
}

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
  // Auth gate — verify shared-secret bearer token before doing any work.
  const authResult = verifyInboundAuth(request);
  if (authResult === "invalid") {
    console.warn("[inbound-webhook] bearer token mismatch — rejecting");
    return NextResponse.json({ error: "Invalid bearer token" }, { status: 401 });
  }
  if (authResult === "missing") {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[inbound-webhook] WEBHOOK_SECRET missing in development — accepting unsigned post.",
      );
    } else {
      console.error(
        "[inbound-webhook] WEBHOOK_SECRET missing in production — rejecting request.",
      );
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 503 },
      );
    }
  }

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

  // Multi-channel sequences: a reply on email exits all active/paused runs
  // for this contact. Soft-fail — never block the inbound message pipeline.
  if (contactId) {
    await exitRunsForContact(supabase, contactId, "replied_email").catch((err) => {
      console.warn("[resend/inbound] exitRunsForContact failed:", err);
    });
  }

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
