/**
 * Declare a winner for an A/B test.
 *
 * Body: { variant_id: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

export async function POST(req: NextRequest, { params }: Params) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) ?? user.id;

  const body = (await req.json()) as { variant_id?: string };
  const variantId = body.variant_id?.trim();
  if (!variantId) {
    return NextResponse.json({ error: "variant_id is required" }, { status: 400 });
  }

  const { data: variant } = await supabase
    .from("ab_variants")
    .select("id, test_id")
    .eq("id", variantId)
    .eq("test_id", params.id)
    .maybeSingle();

  if (!variant) {
    return NextResponse.json({ error: "Variant not in this test" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("ab_tests")
    .update({
      winner_variant_id: variantId,
      status: "completed",
      ended_at: new Date().toISOString(),
    })
    .eq("id", params.id)
    .eq("user_id", ownerId)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ test: data });
}
