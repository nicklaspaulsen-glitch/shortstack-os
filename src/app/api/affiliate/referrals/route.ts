/**
 * Affiliate referrals list — flat feed across all of the caller's programs.
 * Filterable by ?affiliate_id=... and ?status=... so the dashboard kanban
 * can scope to a single affiliate or status pipeline.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

export const dynamic = "force-dynamic";

const ALLOWED_STATUS = new Set(["clicked", "signed_up", "subscribed", "cancelled", "refunded"]);

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const affiliateId = url.searchParams.get("affiliate_id");
  const status = url.searchParams.get("status");
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit")) || 100));

  // Inner-join through programs.user_id ensures we only return referrals for
  // affiliates whose program this caller owns.
  let query = supabase
    .from("affiliate_referrals")
    .select(`
      id,
      affiliate_id,
      referred_user_id,
      referred_email,
      click_id,
      source,
      status,
      conversion_at,
      metadata,
      created_at,
      affiliates!inner (
        id, name, email, ref_code, program_id,
        affiliate_programs!inner ( id, user_id, name )
      )
    `)
    .eq("affiliates.affiliate_programs.user_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (affiliateId) query = query.eq("affiliate_id", affiliateId);
  if (status && ALLOWED_STATUS.has(status)) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ referrals: data ?? [] });
}
