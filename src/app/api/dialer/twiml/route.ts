import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// POST /api/dialer/twiml
//
// TwiML webhook called by Twilio when the browser Voice SDK places an outbound
// call via our TwiML Application (TWILIO_TWIML_APP_SID).
//
// Flow:
//   1. Browser SDK calls twilio.connect({ params: { To: "+1..." } })
//   2. Twilio POSTs here with To, From (client identity = user UUID), CallSid
//   3. We validate the Twilio HMAC-SHA1 signature (fail-closed)
//   4. We validate the To number is a well-formed E.164 phone number
//   5. We return <Dial> TwiML that connects the call
//
// Required env: TWILIO_AUTH_TOKEN (sig validation), TWILIO_PHONE_NUMBER (callerId)
// Optional env: TWILIO_ACCOUNT_SID (logged only — not strictly needed here)
//
// Security: this endpoint is public (Twilio can't send a JWT), so HMAC
// validation is the only authentication. Fail-closed when TWILIO_AUTH_TOKEN
// is unset rather than letting unauthenticated requests through.

// ── Twilio signature validation ──────────────────────────────────────────────

function validateTwilioSignature(
  request: NextRequest,
  body: URLSearchParams,
): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    console.error("[dialer/twiml] TWILIO_AUTH_TOKEN not set — rejecting all requests fail-closed");
    return false;
  }

  const signature = request.headers.get("x-twilio-signature");
  if (!signature) return false;

  // Reconstruct the signed string: full URL + sorted POST params concatenated
  const url = request.url;
  const sorted = Array.from(body.entries()).sort(([a], [b]) => a.localeCompare(b));
  let data = url;
  for (const [key, val] of sorted) data += key + val;

  const expected = crypto
    .createHmac("sha1", authToken)
    .update(Buffer.from(data, "utf-8"))
    .digest("base64");

  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

// ── E.164 validation ─────────────────────────────────────────────────────────

function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(phone);
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ── POST: return dial TwiML ───────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const text = await request.text();
  const params = new URLSearchParams(text);

  // Signature validation — fail-closed
  if (!validateTwilioSignature(request, params)) {
    console.warn("[dialer/twiml] Twilio signature validation failed — 403");
    return new NextResponse("Forbidden", { status: 403 });
  }

  const to = params.get("To") ?? "";
  const callSid = params.get("CallSid") ?? "";
  const identity = params.get("From") ?? ""; // "client:<user_uuid>" when from browser SDK

  // Validate destination is a real E.164 phone number.
  // The Voice SDK passes whatever the browser sent as `To`; we must not
  // blindly dial arbitrary strings (conference names, SIP URIs, etc.).
  if (!isValidE164(to)) {
    console.warn(`[dialer/twiml] Invalid To param "${to}" — 400`);
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>The number you dialed is invalid. Please try again.</Say>
  <Hangup/>
</Response>`;
    return new NextResponse(errorTwiml, {
      status: 400,
      headers: { "Content-Type": "text/xml" },
    });
  }

  const callerId = process.env.TWILIO_PHONE_NUMBER ?? "";
  if (!callerId) {
    console.error("[dialer/twiml] TWILIO_PHONE_NUMBER not set — cannot set callerId");
  }

  console.info(
    `[dialer/twiml] sid=${callSid} identity=${identity} to=${to} callerId=${callerId}`,
  );

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${escapeXml(callerId)}" timeout="30" record="record-from-ringing-dual" recordingStatusCallback="/api/dialer/recording-status">
    <Number>${escapeXml(to)}</Number>
  </Dial>
</Response>`;

  return new NextResponse(twiml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

// ── GET: health check ─────────────────────────────────────────────────────────

export async function GET() {
  return NextResponse.json({ status: "ok", route: "dialer/twiml" });
}
