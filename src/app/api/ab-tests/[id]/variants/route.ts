/**
 * A/B Test variants — list and create.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

async function verifyTestOwnership(supabase: ReturnType<typeof createServerSupabase>, testId: string, ownerId: string) {
  const { data } = await supabase
    .from("ab_tests")
    .select("id")
    .eq("id", testId)
    .eq("user_id", ownerId)
    .maybeSingle();
  return Boolean(data);
}

export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) ?? user.id;

  if (!(await verifyTestOwnership(supabase, params.id, ownerId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("ab_variants")
    .select("*")
    .eq("test_id", params.id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ variants: data ?? [] });
}

export async function POST(req: NextRequest, { params }: Params) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) ?? user.id;

  if (!(await verifyTestOwnership(supabase, params.id, ownerId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await req.json()) as { variant_key?: string; content?: Record<string, unknown> };
  const variantKey = (body.variant_key ?? "").trim();
  if (!variantKey) {
    return NextResponse.json({ error: "variant_key is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("ab_variants")
    .insert({
      test_id: params.id,
      variant_key: variantKey,
      content: body.content ?? {},
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ variant: data }, { status: 201 });
}
