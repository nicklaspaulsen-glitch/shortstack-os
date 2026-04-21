import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// GET — Per-agent token usage cost for the current month.
// Joins `usage_events` to Trinity agent names inferred from event metadata or resource.
export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Start of current UTC month
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const { data, error } = await supabase
    .from("usage_events")
    .select("resource, amount, metadata, created_at")
    .eq("user_id", user.id)
    .gte("created_at", monthStart.toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];

  // Aggregate by category (resource) and agent (metadata.agent or resource fallback)
  const byAgent: Record<string, { amount: number; events: number }> = {};
  const byCategory: Record<string, { amount: number; events: number }> = {};

  let totalAmount = 0;

  for (const row of rows) {
    const amount = Number(row.amount) || 0;
    totalAmount += amount;

    const meta = (row.metadata ?? {}) as { agent?: string; category?: string };
    const agent = meta.agent || row.resource || "unknown";
    const category = meta.category || row.resource || "other";

    if (!byAgent[agent]) byAgent[agent] = { amount: 0, events: 0 };
    byAgent[agent].amount += amount;
    byAgent[agent].events += 1;

    if (!byCategory[category]) byCategory[category] = { amount: 0, events: 0 };
    byCategory[category].amount += amount;
    byCategory[category].events += 1;
  }

  return NextResponse.json({
    month_start: monthStart.toISOString(),
    total_amount: Number(totalAmount.toFixed(4)),
    events: rows.length,
    by_agent: Object.entries(byAgent).map(([name, v]) => ({
      name,
      amount: Number(v.amount.toFixed(4)),
      events: v.events,
    })).sort((a, b) => b.amount - a.amount),
    by_category: Object.entries(byCategory).map(([name, v]) => ({
      name,
      amount: Number(v.amount.toFixed(4)),
      events: v.events,
    })).sort((a, b) => b.amount - a.amount),
  });
}
