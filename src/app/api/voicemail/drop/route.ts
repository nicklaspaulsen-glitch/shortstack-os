import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

// POST /api/voicemail/drop
//
// Initiates a Twilio call that immediately plays a pre-recorded voicemail
// when the recipient picks up (or, more typically, when their voicemail
// inbox catches the call). This is "ringless voicemail" via the standard
// TwiML <Play> directive — no need for a special carrier integration.
//
// Body:
//   { template_id: string, to_number: string, from_number?: string,
//     lead_id?: string, client_id?: string }
//
// Returns: { ok: true, drop_id, twilio_call_sid } on success.

interface DropBody {
  template_id?: string;
  to_number?: string;
  from_number?: string;
  lead_id?: string;
  client_id?: string;
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  let body: DropBody;
  try {
    body = (await request.json()) as DropBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { template_id, to_number, from_number } = body;
  if (!template_id) return NextResponse.json({ ok: false, error: "template_id required" }, { status: 400 });
  if (!to_number) return NextResponse.json({ ok: false, error: "to_number required" }, { status: 400 });

  // Verify the template belongs to the caller
  const service = createServiceClient();
  const { data: tpl } = await service
    .from("voicemail_templates")
    .select("id, audio_url")
    .eq("id", template_id)
    .eq("user_id", ownerId)
    .maybeSingle();

  if (!tpl?.audio_url) {
    return NextResponse.json(
      { ok: false, error: "template not found or access denied" },
      { status: 404 },
    );
  }

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    return NextResponse.json(
      { ok: false, error: "Twilio not configured" },
      { status: 500 },
    );
  }

  const fromNumber = from_number || process.env.TWILIO_DEFAULT_NUMBER || "";
  if (!fromNumber) {
    return NextResponse.json(
      { ok: false, error: "from_number required (or set TWILIO_DEFAULT_NUMBER)" },
      { status: 400 },
    );
  }

  // Build inline TwiML — Twilio fetches this when the call connects.
  // We pass the audio_url so Twilio plays it as soon as anyone picks up.
  // Easiest path: Twilio supports passing TwiML directly via the Twiml
  // body parameter on the create-call API, no extra hosted endpoint required.
  const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Play>${escapeXml(tpl.audio_url)}</Play></Response>`;

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const params = new URLSearchParams({
    From: fromNumber,
    To: to_number,
    Twiml: twiml,
  });

  // Insert drop row up-front (status: queued) so we have a record even on
  // Twilio failure.
  const { data: drop } = await service
    .from("voicemail_drops")
    .insert({
      user_id: ownerId,
      template_id,
      to_number,
      from_number: fromNumber,
      status: "queued",
    })
    .select("id")
    .single();
  const dropId = drop?.id as string | undefined;

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
      },
    );
    const json = await res.json();

    if (!res.ok) {
      if (dropId) {
        await service
          .from("voicemail_drops")
          .update({ status: "failed", error: json.message || `twilio ${res.status}` })
          .eq("id", dropId);
      }
      return NextResponse.json(
        { ok: false, error: json.message || "Twilio error", detail: json },
        { status: 500 },
      );
    }

    if (dropId) {
      await service
        .from("voicemail_drops")
        .update({ status: "initiated", twilio_call_sid: json.sid })
        .eq("id", dropId);
    }

    return NextResponse.json({
      ok: true,
      drop_id: dropId,
      twilio_call_sid: json.sid,
    });
  } catch (err) {
    if (dropId) {
      await service
        .from("voicemail_drops")
        .update({ status: "failed", error: err instanceof Error ? err.message : "drop error" })
        .eq("id", dropId);
    }
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "drop error" },
      { status: 500 },
    );
  }
}

function escapeXml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
