import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

// POST /api/whatsapp/send-bulk
//
// Bulk WhatsApp send to a list of clients. Uses Meta Cloud API directly when
// configured (WHATSAPP_ACCESS_TOKEN + phone_number_id), otherwise falls back
// to Twilio's WhatsApp sandbox/business sender. Throttled at 1 message/sec
// to stay safely under Meta's per-second cap.
//
// Body: { campaign_id?, client_ids: string[], message: string, dry_run?: boolean }
// Returns: { sent, failed, errors[], duration_ms }

const SEND_DELAY_MS = 1000; // 1 msg/sec

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function renderTemplate(template: string, vars: Record<string, string>): string {
  // Simple {{var}} substitution. Unknown vars left as-is.
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  let body: {
    campaign_id?: string;
    client_ids?: string[];
    message?: string;
    dry_run?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { campaign_id, client_ids, message, dry_run } = body;
  if (!Array.isArray(client_ids) || client_ids.length === 0) {
    return NextResponse.json({ ok: false, error: "client_ids required" }, { status: 400 });
  }
  if (!message || typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ ok: false, error: "message required" }, { status: 400 });
  }

  // Cap batch — sanity guard against accidental 10k sends
  if (client_ids.length > 200) {
    return NextResponse.json(
      { ok: false, error: "Max 200 recipients per batch" },
      { status: 400 },
    );
  }

  const service = createServiceClient();

  // Pull recipients — scoped to owner
  const { data: clients, error: clientsErr } = await service
    .from("clients")
    .select("id, business_name, owner_name, phone")
    .eq("profile_id", ownerId)
    .in("id", client_ids);

  if (clientsErr) {
    return NextResponse.json({ ok: false, error: clientsErr.message }, { status: 500 });
  }
  if (!clients || clients.length === 0) {
    return NextResponse.json({ ok: false, error: "No accessible clients in selection" }, { status: 400 });
  }

  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN || "";
  const envPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
  // Account row override (if a tenant has their own phone_number_id)
  const { data: account } = await service
    .from("messaging_accounts")
    .select("phone_number_id")
    .eq("user_id", ownerId)
    .eq("provider", "whatsapp")
    .maybeSingle();
  const phoneNumberId = (account?.phone_number_id as string | undefined) || envPhoneId;

  const useMetaCloud = Boolean(accessToken && phoneNumberId);
  const twilioSid = process.env.TWILIO_ACCOUNT_SID || "";
  const twilioToken = process.env.TWILIO_AUTH_TOKEN || "";
  const twilioWhatsAppFrom = process.env.TWILIO_WHATSAPP_NUMBER || "";
  const useTwilio = !useMetaCloud && Boolean(twilioSid && twilioToken && twilioWhatsAppFrom);

  if (!useMetaCloud && !useTwilio) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "WhatsApp not configured. Set WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID (Meta) or TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_WHATSAPP_NUMBER.",
      },
      { status: 500 },
    );
  }

  if (dry_run) {
    return NextResponse.json({
      ok: true,
      dry_run: true,
      provider: useMetaCloud ? "meta-cloud" : "twilio",
      eligible: clients.filter((c) => c.phone).length,
      missing_phone: clients.filter((c) => !c.phone).length,
    });
  }

  const startedAt = Date.now();
  const errors: Array<{ client_id: string; reason: string }> = [];
  let sent = 0;
  let failed = 0;

  for (const c of clients) {
    if (!c.phone) {
      failed += 1;
      errors.push({ client_id: c.id as string, reason: "no phone number" });
      continue;
    }

    const rendered = renderTemplate(message, {
      name: (c.owner_name as string) || (c.business_name as string) || "",
      business: (c.business_name as string) || "",
    });

    try {
      let ok = false;
      if (useMetaCloud) {
        const res = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: c.phone,
            type: "text",
            text: { body: rendered },
          }),
        });
        ok = res.ok;
        if (!ok) {
          const json = await res.json().catch(() => ({}));
          errors.push({
            client_id: c.id as string,
            reason: (json as { error?: { message?: string } })?.error?.message || `meta ${res.status}`,
          });
        }
      } else if (useTwilio) {
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
              From: `whatsapp:${twilioWhatsAppFrom}`,
              To: `whatsapp:${c.phone}`,
              Body: rendered,
            }),
          },
        );
        ok = res.ok;
        if (!ok) {
          const json = await res.json().catch(() => ({}));
          errors.push({
            client_id: c.id as string,
            reason: (json as { message?: string })?.message || `twilio ${res.status}`,
          });
        }
      }

      if (ok) sent += 1;
      else failed += 1;
    } catch (err) {
      failed += 1;
      errors.push({
        client_id: c.id as string,
        reason: err instanceof Error ? err.message : "send error",
      });
    }

    // Throttle — 1 msg/sec (skip on the last iteration to avoid trailing wait)
    if (c !== clients[clients.length - 1]) {
      await sleep(SEND_DELAY_MS);
    }
  }

  // Update campaign row if linked
  if (campaign_id) {
    await service
      .from("whatsapp_campaigns")
      .update({
        status: failed === 0 ? "sent" : sent > 0 ? "sent" : "failed",
        sent_at: new Date().toISOString(),
      })
      .eq("id", campaign_id)
      .eq("profile_id", ownerId);
  }

  return NextResponse.json({
    ok: true,
    provider: useMetaCloud ? "meta-cloud" : "twilio",
    sent,
    failed,
    errors: errors.slice(0, 25), // cap response size
    duration_ms: Date.now() - startedAt,
  });
}
