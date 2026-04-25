import { NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

// GET /api/calendar/status
//
// Returns whether the authed user has a connected calendar provider.
// Voice Receptionist + a few other surfaces ping this on mount to decide
// whether to show a "Connect calendar" banner or a "✓ Connected" chip.
//
// Existed as a frontend reference for ages but never had a backend route,
// so every consumer fell into its catch path and rendered "disconnected"
// permanently — even when the user had a real OAuth grant. This stub
// resolves that by checking the documented columns:
//
//   profiles.google_oauth_tokens (jsonb, set by /api/oauth/google/callback)
//
// If/when we add Outlook calendar OAuth, plug it into the
// resolveProvider() helper below and the banner code lights up
// without any frontend change.

export const runtime = "nodejs";

export async function GET() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ connected: false, error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("google_oauth_tokens")
    .eq("id", user.id)
    .maybeSingle();

  const tokens = (profile?.google_oauth_tokens as { access_token?: string } | null) ?? null;
  const connected = !!tokens?.access_token;

  return NextResponse.json({
    connected,
    provider: connected ? "Google Calendar" : null,
  });
}
