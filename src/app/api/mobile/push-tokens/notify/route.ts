import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, createServerSupabase } from "@/lib/supabase/server";

/**
 * Admin trigger for sending an Expo push notification to one user.
 *
 * POST /api/mobile/push-tokens/notify
 *   Body: { profile_id, title, body, data? }
 *   Auth: either
 *     - Bearer <CRON_SECRET>  (server-to-server / cron use)
 *     - Cookie session of an admin profile
 *
 * Fan-out: looks up every alive token for the target profile and
 * batches a single POST to https://exp.host/--/api/v2/push/send.
 *
 * Failure handling: increments `failure_count` per token on
 * DeviceNotRegistered tickets; sets `is_dead = true` once we hit 5
 * consecutive failures. We do not retry — Expo's push service handles
 * its own retries before reporting back.
 */

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const DEAD_AFTER = 5;
const MAX_BATCH = 100;

interface NotifyBody {
  profile_id?: unknown;
  title?: unknown;
  body?: unknown;
  data?: unknown;
}

interface PushTokenRow {
  id: string;
  token: string;
  failure_count: number;
}

interface ExpoTicket {
  status?: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

interface ExpoSendResponse {
  data?: ExpoTicket[];
  errors?: Array<{ code: string; message: string }>;
}

async function authorize(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return true;
  }
  // Fall back to admin-cookie path so we can manually trigger from the
  // dashboard later without exposing CRON_SECRET to the browser.
  const supabase = createServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return false;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();
  return profile?.role === "admin";
}

export async function POST(req: NextRequest) {
  if (!(await authorize(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: NotifyBody;
  try {
    body = (await req.json()) as NotifyBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const profileId = typeof body.profile_id === "string" ? body.profile_id.trim() : "";
  const title = typeof body.title === "string" ? body.title.slice(0, 80) : "";
  const text = typeof body.body === "string" ? body.body.slice(0, 240) : "";
  const data =
    body.data && typeof body.data === "object" && !Array.isArray(body.data)
      ? (body.data as Record<string, unknown>)
      : undefined;

  if (!profileId || !title) {
    return NextResponse.json(
      { error: "profile_id and title are required" },
      { status: 400 }
    );
  }

  const service = createServiceClient();
  const { data: tokens, error: dbError } = await service
    .from("mobile_push_tokens")
    .select("id, token, failure_count")
    .eq("user_id", profileId)
    .eq("is_dead", false);

  if (dbError) {
    console.error("[mobile/push-tokens/notify] lookup failed:", dbError.message);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
  if (!tokens || tokens.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, reason: "no-tokens" });
  }

  const messages = (tokens as PushTokenRow[]).map((row) => ({
    to: row.token,
    sound: "default" as const,
    title,
    body: text,
    data,
  }));

  // Expo accepts up to 100 messages per request. We chunk just in case.
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < messages.length; i += MAX_BATCH) {
    const batch = messages.slice(i, i + MAX_BATCH);
    const tokenSlice = (tokens as PushTokenRow[]).slice(i, i + MAX_BATCH);
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
        },
        body: JSON.stringify(batch),
      });
      const json = (await response.json()) as ExpoSendResponse;
      const tickets = json.data ?? [];
      for (let j = 0; j < tokenSlice.length; j++) {
        const ticket = tickets[j];
        const row = tokenSlice[j];
        if (ticket?.status === "ok") {
          sent++;
          if (row.failure_count > 0) {
            await service
              .from("mobile_push_tokens")
              .update({ failure_count: 0, last_seen_at: new Date().toISOString() })
              .eq("id", row.id);
          }
          continue;
        }
        failed++;
        const nextFailures = row.failure_count + 1;
        const isDead =
          nextFailures >= DEAD_AFTER ||
          ticket?.details?.error === "DeviceNotRegistered";
        await service
          .from("mobile_push_tokens")
          .update({
            failure_count: nextFailures,
            is_dead: isDead,
          })
          .eq("id", row.id);
      }
    } catch (err) {
      console.error("[mobile/push-tokens/notify] HTTP failed:", err);
      failed += batch.length;
    }
  }

  return NextResponse.json({ ok: true, sent, failed });
}
