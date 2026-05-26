/**
 * Public conversion tracking — increment `conversions` for a variant.
 *
 * Body: { variant_key: string }
 *
 * Security notes:
 * - This endpoint is intentionally unauthenticated (client-side pixel tracking).
 * - Counter update uses an atomic SQL function (ab_increment_conversions) to avoid
 *   the read-then-write TOCTOU race that would lose events under concurrent requests.
 * - FIXME: no per-IP rate limiting. An attacker can inflate conversion counts by
 *   bulk-POSTing. Acceptable risk while tests drive only UI decisions; escalate to
 *   Vercel WAF / Upstash rate-limiting if conversion data is ever used for billing
 *   or external reporting.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Maximum variant_key length — prevents oversized inputs from hitting the DB.
const MAX_VARIANT_KEY_LEN = 64;

type Params = { params: { id: string } };

export async function POST(req: NextRequest, { params }: Params) {
  const supabase = createServiceClient();

  let body: { variant_key?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const variantKey = (body.variant_key ?? "").trim();
  if (!variantKey) {
    return NextResponse.json({ error: "variant_key is required" }, { status: 400 });
  }
  if (variantKey.length > MAX_VARIANT_KEY_LEN) {
    return NextResponse.json({ error: "variant_key too long" }, { status: 400 });
  }

  const { data: test } = await supabase
    .from("ab_tests")
    .select("id, status")
    .eq("id", params.id)
    .maybeSingle();

  if (!test || (test as { status: string }).status !== "running") {
    return NextResponse.json({ error: "Test not active" }, { status: 404 });
  }

  // Resolve variant id without fetching the current count — the atomic
  // increment below does not need the prior value.
  const { data: variant } = await supabase
    .from("ab_variants")
    .select("id")
    .eq("test_id", params.id)
    .eq("variant_key", variantKey)
    .maybeSingle();

  if (!variant) return NextResponse.json({ error: "Variant not found" }, { status: 404 });
  const v = variant as { id: string };

  // Atomic increment — single UPDATE, no read-modify-write race.
  // Function defined in migration 20260526_ab_atomic_increment.sql.
  const { error } = await supabase.rpc("ab_increment_conversions", { p_variant_id: v.id });

  if (error) {
    console.error("[ab-track-conversion] increment failed", { error: error.message });
    return NextResponse.json({ error: "Tracking failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
