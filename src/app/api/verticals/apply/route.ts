/**
 * POST /api/verticals/apply
 *
 * Body: { vertical: VerticalKey, modules: ModuleKey[] }
 *
 * Creates real DB rows for the selected modules in the caller's tenant.
 * Records the apply in vertical_applies for analytics + UI checkmarks.
 *
 * Returns per-module outcomes so the UI can show which modules succeeded
 * and which (if any) failed without nuking the whole apply.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import {
  getVertical,
  isVerticalKey,
  isModuleKey,
  type ModuleKey,
} from "@/lib/verticals";
import { applyVerticalModules } from "@/lib/verticals/apply";

export const dynamic = "force-dynamic";

interface ApplyBody {
  vertical?: unknown;
  modules?: unknown;
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: ApplyBody;
  try {
    body = (await request.json()) as ApplyBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isVerticalKey(body.vertical)) {
    return NextResponse.json(
      { error: "vertical must be one of: real_estate, coaches, ecommerce" },
      { status: 400 },
    );
  }

  if (!Array.isArray(body.modules) || body.modules.length === 0) {
    return NextResponse.json(
      { error: "modules must be a non-empty array" },
      { status: 400 },
    );
  }

  // Filter to known module keys; reject completely if none are valid.
  const requested: ModuleKey[] = [];
  for (const m of body.modules) {
    if (isModuleKey(m) && !requested.includes(m)) requested.push(m);
  }
  if (requested.length === 0) {
    return NextResponse.json(
      {
        error:
          "no valid modules — allowed: automations, sms, email, scripts, scoring, course, funnel",
      },
      { status: 400 },
    );
  }

  const template = getVertical(body.vertical);
  const result = await applyVerticalModules(supabase, ownerId, template, requested);

  // Best-effort record. If this fails, the modules are still applied — we
  // just lose the analytics row. Don't surface as a fatal error.
  try {
    const counts = result.outcomes.reduce<Record<string, number>>((acc, o) => {
      acc[o.module] = o.count;
      return acc;
    }, {});

    await supabase.from("vertical_applies").insert({
      user_id: ownerId,
      vertical: body.vertical,
      applied_modules: requested,
      applied_counts: counts,
    });
  } catch (err: unknown) {
    console.error(
      "[verticals.apply] failed to record vertical_applies row:",
      err instanceof Error ? err.message : err,
    );
  }

  return NextResponse.json({
    vertical: body.vertical,
    applied: result.outcomes,
    total_created: result.total_created,
  });
}
