import { NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

/**
 * GET /api/referrals/leaderboard
 *
 * Aggregates total paid earnings per referrer. Admins see the full top
 * list; regular users see the top 3 + their own rank (if outside top 3).
 * All identifying details are masked to first-name-initial for privacy
 * — this is a gamification signal, not a directory.
 *
 * Aggregation uses the service client to bypass the own-rows-only RLS on
 * referral_payouts; we only ever return ranked counts, never row-level
 * data belonging to other users.
 */
export async function GET() {
  const sb = createServerSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: meProfile } = await sb
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdmin = meProfile?.role === "admin";

  // Pull all paid payouts (summed in memory — at the scale we'll see for
  // the foreseeable future this is cheaper than a group-by SQL call that
  // needs an RPC).
  const svc = createServiceClient();
  const { data: payouts, error } = await svc
    .from("referral_payouts")
    .select("referrer_user_id, amount_cents, paid_at");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const totals = new Map<string, number>();
  for (const p of payouts ?? []) {
    if (!p.paid_at) continue;
    totals.set(p.referrer_user_id, (totals.get(p.referrer_user_id) ?? 0) + (p.amount_cents ?? 0));
  }

  const ranked = Array.from(totals.entries())
    .map(([id, cents]) => ({ id, total_cents: cents }))
    .sort((a, b) => b.total_cents - a.total_cents);

  // Attach names for top N (enough for either view)
  const topIds = ranked.slice(0, isAdmin ? 50 : 10).map(r => r.id);
  if (!topIds.includes(user.id)) topIds.push(user.id);

  const { data: nameRows } = await svc
    .from("profiles")
    .select("id, full_name, email")
    .in("id", topIds);

  const nameMap = new Map<string, { name: string; email: string }>();
  for (const row of nameRows ?? []) {
    nameMap.set(row.id, { name: row.full_name || "Anonymous", email: row.email || "" });
  }

  function maskName(raw: string): string {
    const parts = raw.trim().split(/\s+/);
    const first = parts[0] || "User";
    const lastInitial = parts[1]?.[0] ?? "";
    return lastInitial ? `${first} ${lastInitial}.` : first;
  }

  const publicList = isAdmin ? ranked.slice(0, 10) : ranked.slice(0, 3);
  const formatted = publicList.map((row, idx) => ({
    rank: idx + 1,
    display_name: maskName(nameMap.get(row.id)?.name ?? "Anonymous"),
    total_cents: row.total_cents,
    is_you: row.id === user.id,
  }));

  // Own rank (if not already in the visible list)
  const ownRankIdx = ranked.findIndex(r => r.id === user.id);
  const ownRank = ownRankIdx === -1 ? null : ownRankIdx + 1;
  const ownTotal = totals.get(user.id) ?? 0;

  return NextResponse.json({
    is_admin_view: isAdmin,
    top: formatted,
    own_rank: ownRank,
    own_total_cents: ownTotal,
    total_referrers: ranked.length,
  });
}
