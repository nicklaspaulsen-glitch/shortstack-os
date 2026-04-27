/**
 * Affiliates — list and invite.
 *
 * GET: returns affiliates the caller owns (across all their programs), with
 * optional ?program_id filter.
 * POST: creates a new affiliate row (manual invite). The agency owner enters
 * email + name; we generate a ref_code and put status='pending' (or
 * 'approved' if approve=true). Status can be moved to 'approved' later via
 * PATCH on the per-affiliate route.
 *
 * The affiliate themselves connects their Stripe account from the portal
 * page — that's a separate flow, not gated by this endpoint.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { generateAffiliateRefCode } from "@/lib/affiliate";

export const dynamic = "force-dynamic";

interface CreateInput {
  program_id?: string;
  email?: string;
  name?: string;
  approve?: boolean;
}

const ALLOWED_STATUS = new Set(["pending", "approved", "suspended", "rejected"]);

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const programId = url.searchParams.get("program_id");
  const status = url.searchParams.get("status");

  // Use a join through the program ownership. This relies on the foreign-key
  // relationship between affiliates.program_id → affiliate_programs.id and
  // a LEFT-side filter on user_id. Supabase's `inner` join keyword guarantees
  // we only return affiliates whose program belongs to the caller.
  let query = supabase
    .from("affiliates")
    .select(`
      id,
      program_id,
      user_id,
      email,
      name,
      ref_code,
      stripe_account_id,
      status,
      total_earned_cents,
      pending_cents,
      paid_cents,
      joined_at,
      approved_at,
      affiliate_programs!inner ( id, name, user_id, commission_type, commission_value )
    `)
    .eq("affiliate_programs.user_id", ownerId)
    .order("joined_at", { ascending: false });

  if (programId) query = query.eq("program_id", programId);
  if (status && ALLOWED_STATUS.has(status)) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ affiliates: data || [] });
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: CreateInput;
  try {
    body = (await request.json()) as CreateInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const program_id = body.program_id?.trim();
  const email = body.email?.trim().toLowerCase();
  const name = body.name?.trim();

  if (!program_id) return NextResponse.json({ error: "program_id is required" }, { status: 400 });
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "valid email is required" }, { status: 400 });
  }
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  // Verify the program belongs to the caller — required because the affiliates
  // table itself only constrains by program ownership through a join.
  const { data: program } = await supabase
    .from("affiliate_programs")
    .select("id")
    .eq("id", program_id)
    .eq("user_id", ownerId)
    .maybeSingle();
  if (!program) return NextResponse.json({ error: "Program not found" }, { status: 404 });

  // Generate a unique ref_code with retry on collision (UNIQUE constraint).
  // We store one row per affiliate per program; the same person can have
  // multiple rows across different programs, so we don't dedupe by email.
  let refCode: string | null = null;
  let lastError: string | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateAffiliateRefCode();
    const { data, error } = await supabase
      .from("affiliates")
      .insert({
        program_id,
        email,
        name,
        ref_code: candidate,
        status: body.approve ? "approved" : "pending",
        approved_at: body.approve ? new Date().toISOString() : null,
      })
      .select("id, program_id, email, name, ref_code, status, total_earned_cents, pending_cents, paid_cents, joined_at, approved_at")
      .single();
    if (!error && data) {
      return NextResponse.json({ affiliate: data });
    }
    if (error && /duplicate|unique/i.test(error.message)) {
      // collision on ref_code — try again
      lastError = error.message;
      continue;
    }
    // other error — bubble up
    return NextResponse.json({ error: error?.message ?? "Failed to create affiliate" }, { status: 500 });
  }

  void refCode; // eslint suppression — refCode is unused once a row inserts successfully
  return NextResponse.json(
    { error: `Could not allocate ref_code after 5 tries (${lastError ?? "unknown"})` },
    { status: 500 },
  );
}
