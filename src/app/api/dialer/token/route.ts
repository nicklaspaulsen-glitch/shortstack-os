import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

// POST /api/dialer/token
// Mints a short-lived (1h) Twilio Voice JWT capability token so the browser
// SDK can register as a Voice client and place outbound calls through our
// TwiML application.
//
// Required env (Vercel): TWILIO_ACCOUNT_SID, TWILIO_API_KEY, TWILIO_API_SECRET,
// TWILIO_TWIML_APP_SID. Returns 503 with `configured: false` when any are
// missing — UI shows a helpful "configure Twilio" banner instead of a hard
// error so the rest of the dialer surface still works for SMS/DM.
//
// Token identity is the user's UUID, scoped to that profile only — server-
// side TwiML application logic uses this identity for outbound dial billing
// + audit trail.
export async function POST() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const apiKey = process.env.TWILIO_API_KEY;
  const apiSecret = process.env.TWILIO_API_SECRET;
  const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;

  if (!accountSid || !apiKey || !apiSecret || !twimlAppSid) {
    return NextResponse.json(
      {
        configured: false,
        error:
          "Twilio Voice SDK not configured. Set TWILIO_API_KEY, TWILIO_API_SECRET, and TWILIO_TWIML_APP_SID in Vercel env.",
      },
      { status: 503 },
    );
  }

  // Lazy-import twilio to avoid module-level SDK init breaking the Vercel
  // build during page-data collection (project convention — see CLAUDE.md).
  // Importing the JWT helper directly skips the REST client init.
  const twilio = await import("twilio");
  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;

  // Identity = caller's user id. The TwiML app handler can use this for
  // per-tenant call routing and disposition writes.
  const identity = user.id;

  const token = new AccessToken(accountSid, apiKey, apiSecret, {
    identity,
    ttl: 3600, // 1 hour
  });

  token.addGrant(
    new VoiceGrant({
      outgoingApplicationSid: twimlAppSid,
      incomingAllow: true,
    }),
  );

  return NextResponse.json({
    configured: true,
    identity,
    token: token.toJwt(),
    expires_in: 3600,
  });
}
