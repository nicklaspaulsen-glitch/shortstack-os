/**
 * POST /api/outreach/reply
 *
 * Sends a reply on the appropriate channel (email/sms/dm) and writes a
 * matching `outreach_log` row so the new event appears in the thread on
 * the next render.
 *
 * Body:
 *   {
 *     contact_id:   string,             // lead.id (preferred) or client.id
 *     contact_kind: "lead" | "client",  // defaults to "lead"
 *     channel:      "email" | "sms" | "dm",
 *     body:         string,             // message text
 *     subject?:     string              // email-only
 *   }
 *
 * Channel routing:
 *   email -> @/lib/email sendMessage()
 *   sms   -> Twilio (POST to /Messages.json)
 *   dm    -> placeholder; logs the row but skips an actual provider call.
 *            (Zernio integration deferred per scope.)
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { sendMessage } from "@/lib/email";
import { reportError } from "@/lib/observability/error-reporter";
import type { ContactKind, OutreachChannel } from "@/lib/outreach/types";

const REPLY_CHANNELS = new Set(["email", "sms", "dm"]);

interface ReplyBody {
  contact_id?: string;
  contact_kind?: ContactKind;
  channel?: OutreachChannel;
  body?: string;
  subject?: string;
}

interface ContactResolved {
  email: string | null;
  phone: string | null;
  name: string;
  lead_id: string | null;
}

async function resolveContact(
  serviceSupabase: ReturnType<typeof createServiceClient>,
  ownerId: string,
  contactKind: ContactKind,
  contactId: string,
): Promise<ContactResolved | null> {
  if (contactKind === "lead") {
    const { data } = await serviceSupabase
      .from("leads")
      .select("id, email, phone, business_name, owner_name")
      .eq("id", contactId)
      .eq("user_id", ownerId)
      .single();
    if (!data) return null;
    return {
      email: data.email,
      phone: data.phone,
      name: data.business_name || data.owner_name || "Lead",
      lead_id: data.id,
    };
  }
  const { data } = await serviceSupabase
    .from("clients")
    .select("id, email, phone, business_name, contact_name")
    .eq("id", contactId)
    .eq("profile_id", ownerId)
    .single();
  if (!data) return null;
  return {
    email: data.email,
    phone: data.phone,
    name: data.business_name || data.contact_name || "Client",
    lead_id: null,
  };
}

async function sendViaTwilio(toPhone: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_DEFAULT_NUMBER;
  if (!sid || !token || !fromNumber) {
    return { ok: false, error: "Twilio not configured" };
  }
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const cleaned = toPhone.replace(/[^\d+]/g, "");
  if (cleaned.length < 7) return { ok: false, error: "Invalid phone" };
  const to = cleaned.startsWith("+") ? cleaned : `+1${cleaned}`;

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: to,
        From: fromNumber,
        Body: body,
      }),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, error: text.slice(0, 200) || `Twilio ${res.status}` };
  }
  return { ok: true };
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: ReplyBody;
  try {
    body = (await request.json()) as ReplyBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const channel = body.channel;
  const text = (body.body || "").trim();
  const contactId = body.contact_id;
  const contactKind: ContactKind = body.contact_kind === "client" ? "client" : "lead";

  if (!channel || !REPLY_CHANNELS.has(channel)) {
    return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
  }
  if (!text) return NextResponse.json({ error: "Empty message" }, { status: 400 });
  if (!contactId) return NextResponse.json({ error: "Missing contact_id" }, { status: 400 });

  const serviceSupabase = createServiceClient();
  const contact = await resolveContact(serviceSupabase, ownerId, contactKind, contactId);
  if (!contact) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  let recipient = "";
  let providerStatus: "sent" | "failed" = "sent";
  let providerError: string | undefined;

  try {
    if (channel === "email") {
      if (!contact.email) {
        return NextResponse.json({ error: "Contact has no email" }, { status: 400 });
      }
      recipient = contact.email;
      const fromAddress =
        process.env.SMTP_FROM || "growth@mail.shortstack.work";
      await sendMessage({
        to: contact.email,
        from: fromAddress,
        subject: body.subject || `Following up`,
        text: text,
        html: `<p>${text.replace(/\n/g, "<br/>")}</p>`,
      });
    } else if (channel === "sms") {
      if (!contact.phone) {
        return NextResponse.json({ error: "Contact has no phone" }, { status: 400 });
      }
      recipient = contact.phone;
      const result = await sendViaTwilio(contact.phone, text);
      if (!result.ok) {
        providerStatus = "failed";
        providerError = result.error;
      }
    } else {
      // dm — full provider integration deferred. Log the row anyway so the
      // thread reflects the user's intent; the operator can route it
      // manually until Zernio/Meta DM is wired.
      recipient = contact.email || contact.phone || "dm";
    }
  } catch (err) {
    providerStatus = "failed";
    providerError = err instanceof Error ? err.message : "Send failed";
    reportError(err, {
      route: "outreach-reply",
      component: "POST",
      reason: "provider-send",
    });
  }

  const platform =
    channel === "email" ? "email" : channel === "sms" ? "sms" : "instagram_dm";

  // Always log the row — failures are recorded with status='no_reply' and
  // a metadata.error so the UI can surface them.
  const { data: logRow, error: logErr } = await serviceSupabase
    .from("outreach_log")
    .insert({
      lead_id: contact.lead_id,
      platform,
      business_name: contact.name,
      recipient_handle: recipient,
      message_text: text,
      status: providerStatus === "sent" ? "sent" : "no_reply",
      sent_at: new Date().toISOString(),
      metadata: {
        direction: "outbound",
        manual_reply: true,
        sent_by_user_id: user.id,
        ...(providerError ? { error: providerError.slice(0, 200) } : {}),
      },
    })
    .select("id")
    .single();

  if (logErr) {
    return NextResponse.json(
      { error: `Logged send failed: ${logErr.message}` },
      { status: 500 },
    );
  }

  if (providerStatus === "failed") {
    return NextResponse.json(
      {
        success: false,
        error: providerError || "Provider send failed",
        log_id: logRow?.id ?? null,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ success: true, log_id: logRow?.id ?? null });
}
