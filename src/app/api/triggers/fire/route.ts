import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { fireTrigger, type TriggerType } from "@/lib/workflows/trigger-dispatch";

// POST /api/triggers/fire
//
// Internal + external endpoint for firing workflow triggers manually or
// from external webhooks. For internal routes that already have event
// context, PREFER importing `fireTrigger` directly — this route is the
// escape hatch for cases where no existing integration point exists.
//
// Body:
//   { trigger_type, payload?, user_id? }
//
// Auth modes:
//   1. Cookie auth (default) — uses session user, scopes to effectiveOwnerId
//   2. Webhook token auth — pass `Authorization: Bearer <CRON_SECRET>` header
//      and include an explicit `user_id` in the body. Used for external
//      webhook receivers that need to fire a trigger on behalf of a user.

const VALID_TRIGGER_TYPES: TriggerType[] = [
  "form_submitted",
  "email_opened",
  "email_clicked",
  "email_replied",
  "link_clicked",
  "tag_added",
  "tag_removed",
  "appointment_booked",
  "pipeline_stage_changed",
  "webhook_received",
  "schedule",
  "manual",
];

function isValidType(t: unknown): t is TriggerType {
  return typeof t === "string" && (VALID_TRIGGER_TYPES as string[]).includes(t);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const {
    trigger_type,
    payload,
    user_id: bodyUserId,
  } = body as { trigger_type?: string; payload?: Record<string, unknown>; user_id?: string };

  if (!isValidType(trigger_type)) {
    return NextResponse.json(
      { error: `Invalid trigger_type. Must be one of: ${VALID_TRIGGER_TYPES.join(", ")}` },
      { status: 400 },
    );
  }

  // Auth: either cookie session OR bearer-token for webhook callers
  const bearer = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || "";
  const isWebhookAuth = bearer === `Bearer ${cronSecret}` && cronSecret.length > 10;

  let userId: string | null = null;
  if (isWebhookAuth) {
    if (!bodyUserId) {
      return NextResponse.json(
        { error: "user_id required when using bearer-token auth" },
        { status: 400 },
      );
    }
    userId = bodyUserId;
  } else {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // Resolve to the effective owner so team_members fire triggers under
    // their parent agency's scope.
    userId = await getEffectiveOwnerId(supabase, user.id);
    if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const service = createServiceClient();
  const result = await fireTrigger({
    supabase: service,
    userId: userId!,
    triggerType: trigger_type as TriggerType,
    payload: (payload || {}) as Record<string, unknown>,
  });

  return NextResponse.json({ ok: true, ...result });
}
