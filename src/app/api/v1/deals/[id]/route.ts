/**
 * Public API — single deal operations.
 *
 *   GET    /api/v1/deals/{id}
 *   PATCH  /api/v1/deals/{id}
 *   DELETE /api/v1/deals/{id}
 *
 * Stage transitions emit deal.stage_changed plus deal.won / deal.lost when
 * the new stage is closed_won or closed_lost.
 */
import { NextRequest } from "next/server";
import { authenticateApiKey } from "@/lib/api/auth";
import { fail, ok } from "@/lib/api/response";
import { fireWebhookEvent } from "@/lib/api/webhook-events";
import { createServiceClient } from "@/lib/supabase/server";

const UPDATABLE_FIELDS = [
  "title",
  "client_name",
  "value",
  "stage",
  "probability",
  "expected_close_date",
  "contact_email",
  "contact_phone",
  "notes",
  "source",
] as const;

export async function GET(
  req: NextRequest,
  ctx: { params: { id: string } },
) {
  const auth = await authenticateApiKey(req, { requiredScope: "read" });
  if (!auth.ok) return auth.response;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("deals")
    .select("*")
    .eq("id", ctx.params.id)
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (error) return fail(500, error.message);
  if (!data) return fail(404, "Deal not found");
  return ok(data);
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: { id: string } },
) {
  const auth = await authenticateApiKey(req, { requiredScope: "write" });
  if (!auth.ok) return auth.response;

  let raw: Record<string, unknown>;
  try {
    raw = (await req.json()) as Record<string, unknown>;
  } catch {
    return fail(400, "Invalid JSON body");
  }

  const updates: Record<string, unknown> = {};
  for (const k of UPDATABLE_FIELDS) {
    if (k in raw) updates[k] = raw[k];
  }
  if (Object.keys(updates).length === 0) {
    return fail(400, "No updatable fields provided");
  }

  const supabase = createServiceClient();

  // Capture previous stage so we can emit a transition event.
  let prevStage: string | null = null;
  if ("stage" in updates) {
    const { data: existing } = await supabase
      .from("deals")
      .select("stage")
      .eq("id", ctx.params.id)
      .eq("user_id", auth.userId)
      .maybeSingle();
    prevStage = (existing as { stage?: string } | null)?.stage ?? null;
  }

  const { data, error } = await supabase
    .from("deals")
    .update(updates)
    .eq("id", ctx.params.id)
    .eq("user_id", auth.userId)
    .select()
    .single();

  if (error) return fail(500, error.message);
  if (!data) return fail(404, "Deal not found");

  void fireWebhookEvent({
    supabase,
    userId: auth.userId,
    event: "deal.updated",
    payload: { deal: data },
  });

  const newStage = typeof updates.stage === "string" ? updates.stage : null;
  if (newStage && prevStage && prevStage !== newStage) {
    void fireWebhookEvent({
      supabase,
      userId: auth.userId,
      event: "deal.stage_changed",
      payload: { deal: data, from_stage: prevStage, to_stage: newStage },
    });
    if (newStage === "closed_won") {
      void fireWebhookEvent({
        supabase,
        userId: auth.userId,
        event: "deal.won",
        payload: { deal: data },
      });
    } else if (newStage === "closed_lost") {
      void fireWebhookEvent({
        supabase,
        userId: auth.userId,
        event: "deal.lost",
        payload: { deal: data },
      });
    }
  }

  return ok(data);
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: { id: string } },
) {
  const auth = await authenticateApiKey(req, { requiredScope: "write" });
  if (!auth.ok) return auth.response;

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("deals")
    .delete()
    .eq("id", ctx.params.id)
    .eq("user_id", auth.userId);

  if (error) return fail(500, error.message);
  return ok({ id: ctx.params.id, deleted: true });
}
