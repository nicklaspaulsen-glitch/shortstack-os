import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * One-click email unsubscribe endpoint.
 *
 * Usage in email footers:
 *   generateUnsubscribeLink(email) → /api/unsubscribe?email=<encoded>&token=<hmac>
 *
 * GET  /api/unsubscribe?email=&token=   → validates + records → redirect to /unsubscribe
 * POST /api/unsubscribe                 → JSON body { email, token } → { ok: true }
 *
 * Token: HMAC-SHA256(email.toLowerCase(), UNSUBSCRIBE_SECRET) sliced to 32 hex chars.
 * Falls back to CRON_SECRET if UNSUBSCRIBE_SECRET is not set.
 *
 * CAN-SPAM / GDPR requirement: must be honoured within 10 business days.
 * We write synchronously so it's instant.
 */

const SECRET =
  process.env.UNSUBSCRIBE_SECRET || process.env.CRON_SECRET || "dev-unsub-secret";

export function generateUnsubscribeToken(email: string): string {
  return createHmac("sha256", SECRET)
    .update(email.toLowerCase().trim())
    .digest("hex")
    .slice(0, 32);
}

function verifyToken(email: string, token: string): boolean {
  const expected = generateUnsubscribeToken(email);
  // Constant-time compare (prevent timing attacks)
  if (expected.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  }
  return diff === 0;
}

async function recordUnsubscribe(email: string): Promise<void> {
  const supabase = createServiceClient();
  const normalised = email.toLowerCase().trim();

  // 1. Upsert into suppression list (soft-fail if table doesn't exist yet)
  try {
    await supabase
      .from("email_unsubscribes")
      .upsert(
        { email: normalised, unsubscribed_at: new Date().toISOString() },
        { onConflict: "email" }
      );
  } catch {
    // Table may not exist — migration pending
  }

  // 2. Mark all outreach for this address as opted-out
  try {
    await supabase
      .from("outreach_log")
      .update({ status: "opted_out" })
      .eq("to_email", normalised)
      .in("status", ["sent", "delivered", "pending"]);
  } catch {
    // Soft-fail
  }

  // 3. Mark any cold-email personalizations as opted-out
  try {
    await supabase
      .from("cold_email_personalizations")
      .update({ status: "opted_out" })
      .eq("to_email", normalised)
      .neq("status", "opted_out");
  } catch {
    // Soft-fail
  }
}

// ── GET (one-click from email footer link) ────────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const email = searchParams.get("email") ?? "";
  const token = searchParams.get("token") ?? "";

  if (!email || !token || !verifyToken(email, token)) {
    return NextResponse.redirect(
      new URL("/unsubscribe?error=invalid", request.url)
    );
  }

  await recordUnsubscribe(email);

  return NextResponse.redirect(
    new URL(
      `/unsubscribe?success=1&email=${encodeURIComponent(email)}`,
      request.url
    )
  );
}

// ── POST (API-driven unsubscribe, e.g. from in-app settings) ─────────────────
export async function POST(request: NextRequest) {
  let email: string;
  let token: string;

  try {
    const body = await request.json() as { email?: string; token?: string };
    email = body.email ?? "";
    token = body.token ?? "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!email || !token || !verifyToken(email, token)) {
    return NextResponse.json({ error: "Invalid token" }, { status: 403 });
  }

  await recordUnsubscribe(email);
  return NextResponse.json({ ok: true });
}
