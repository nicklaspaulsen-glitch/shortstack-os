import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createSupabaseFromToken } from "@/lib/supabase/server";

/**
 * Mobile push token registration.
 *
 * POST /api/mobile/push-tokens
 *   Body: { token, platform, device_name?, os_version?, app_version? }
 *   Auth: Supabase JWT — either via cookie (web) or Bearer (native shell).
 *   Behaviour: upsert on (user_id, token). Touches last_seen_at on
 *   re-registration so we can prune stale tokens later.
 *
 * DELETE /api/mobile/push-tokens
 *   Auth: same as POST.
 *   Behaviour: marks every active token for the caller as dead. The
 *   row stays for audit; failure counters in the notify path will
 *   eventually purge it.
 *
 * GET /api/mobile/push-tokens
 *   Auth: same.
 *   Returns: { tokens: [...] } — the caller's own active tokens.
 */

const PLATFORMS = new Set(["ios", "android", "web"]);
const TOKEN_PATTERN = /^(ExponentPushToken\[[^\]]+\]|ExpoPushToken\[[^\]]+\])$/;

interface PushTokenBody {
  token?: unknown;
  platform?: unknown;
  device_name?: unknown;
  os_version?: unknown;
  app_version?: unknown;
}

async function resolveUser(req: NextRequest) {
  // Native clients can't always send cookies, so we accept a Bearer
  // token (same pattern the Electron agent routes use).
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const accessToken = authHeader.slice(7).trim();
    if (accessToken) {
      const supa = createSupabaseFromToken(accessToken);
      const { data, error } = await supa.auth.getUser();
      if (!error && data.user) {
        return { user: data.user, supa };
      }
    }
  }
  // Fall back to cookie-based auth.
  const cookieSupa = createServerSupabase();
  const { data, error } = await cookieSupa.auth.getUser();
  if (!error && data.user) {
    return { user: data.user, supa: cookieSupa };
  }
  return null;
}

export async function POST(req: NextRequest) {
  const session = await resolveUser(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: PushTokenBody;
  try {
    body = (await req.json()) as PushTokenBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  const platform = typeof body.platform === "string" ? body.platform.toLowerCase() : "";

  if (!token || token.length > 256 || !TOKEN_PATTERN.test(token)) {
    return NextResponse.json(
      { error: "Invalid Expo push token format." },
      { status: 400 }
    );
  }
  if (!PLATFORMS.has(platform)) {
    return NextResponse.json(
      { error: "platform must be one of: ios, android, web" },
      { status: 400 }
    );
  }

  const deviceName =
    typeof body.device_name === "string" ? body.device_name.slice(0, 120) : null;
  const osVersion =
    typeof body.os_version === "string" ? body.os_version.slice(0, 32) : null;
  const appVersion =
    typeof body.app_version === "string" ? body.app_version.slice(0, 32) : null;

  const { error } = await session.supa
    .from("mobile_push_tokens")
    .upsert(
      {
        user_id: session.user.id,
        token,
        platform,
        device_name: deviceName,
        os_version: osVersion,
        app_version: appVersion,
        last_seen_at: new Date().toISOString(),
        failure_count: 0,
        is_dead: false,
      },
      { onConflict: "user_id,token" }
    );

  if (error) {
    console.error("[mobile/push-tokens] upsert failed:", error.message);
    return NextResponse.json({ error: "Could not register token" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await resolveUser(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await session.supa
    .from("mobile_push_tokens")
    .update({ is_dead: true })
    .eq("user_id", session.user.id);

  if (error) {
    console.error("[mobile/push-tokens] disable failed:", error.message);
    return NextResponse.json({ error: "Could not disable tokens" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const session = await resolveUser(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await session.supa
    .from("mobile_push_tokens")
    .select("id, platform, device_name, app_version, last_seen_at, is_dead")
    .eq("user_id", session.user.id)
    .order("last_seen_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ tokens: data ?? [] });
}
