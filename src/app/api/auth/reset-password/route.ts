import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

function clientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown"
  );
}

export async function POST(request: NextRequest) {
  const { email } = await request.json();
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  // Per-email: 3/hour. Per-IP: 10/hour. Either limit trips → 429.
  const normalizedEmail = String(email).trim().toLowerCase();
  const ip = clientIp(request);
  const perEmail = rateLimit(`pwdreset:email:${normalizedEmail}`, 3, 60 * 60 * 1000);
  const perIp = rateLimit(`pwdreset:ip:${ip}`, 10, 60 * 60 * 1000);
  if (!perEmail.allowed || !perIp.allowed) {
    return NextResponse.json(
      { error: "Too many password reset requests. Try again in an hour." },
      { status: 429 },
    );
  }

  const supabase = createServiceClient();

  // Fire-and-forget: never leak whether the email exists in the user table.
  await supabase.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "https://app.shortstack.work"}/login?reset=true`,
  });

  // Always return a generic success so callers can't enumerate valid emails.
  return NextResponse.json({ success: true });
}
