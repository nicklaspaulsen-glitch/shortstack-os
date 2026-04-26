/**
 * Public conversion tracking — increment `conversions` for a variant.
 *
 * Body: { variant_key: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

  const { data: test } = await supabase
    .from("ab_tests")
    .select("id, status")
    .eq("id", params.id)
    .maybeSingle();

  if (!test || (test as { status: string }).status !== "running") {
    return NextResponse.json({ error: "Test not active" }, { status: 404 });
  }

  const { data: variant } = await supabase
    .from("ab_variants")
    .select("id, conversions")
    .eq("test_id", params.id)
    .eq("variant_key", variantKey)
    .maybeSingle();

  if (!variant) return NextResponse.json({ error: "Variant not found" }, { status: 404 });
  const v = variant as { id: string; conversions: number };

  const { error } = await supabase
    .from("ab_variants")
    .update({ conversions: v.conversions + 1 })
    .eq("id", v.id);

  if (error) {
    console.error("[ab-track-conversion] update failed", { error: error.message });
    return NextResponse.json({ error: "Tracking failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
