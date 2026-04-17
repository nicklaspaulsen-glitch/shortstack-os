import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * GET /api/dashboard/today-priority
 *
 * Returns the single most important thing for the user to do today,
 * picked from (in order):
 *  1. Hottest lead needing follow-up
 *  2. Client at risk (low health score)
 *  3. Stalled sequence
 *  4. "All caught up" fallback
 */
export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 1) Hottest lead — high score and not contacted recently
  try {
    const { data: hotLead } = await supabase
      .from("leads")
      .select("id, business_name, lead_score, status, last_contacted_at")
      .gte("lead_score", 70)
      .in("status", ["new", "contacted", "replied"])
      .order("lead_score", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (hotLead) {
      return NextResponse.json({
        priority: {
          kind: "hot_lead",
          title: hotLead.business_name as string,
          subtitle: `Hot lead • Score ${hotLead.lead_score} • ${hotLead.status}`,
          accent: "danger",
          href: `/dashboard/leads?id=${hotLead.id}`,
          ctaLabel: "Follow up now",
        },
      });
    }
  } catch {
    // ignore
  }

  // 2) Client at risk — low health score
  try {
    const { data: atRisk } = await supabase
      .from("clients")
      .select("id, business_name, health_score, mrr")
      .eq("is_active", true)
      .lt("health_score", 50)
      .order("health_score", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (atRisk) {
      return NextResponse.json({
        priority: {
          kind: "client_risk",
          title: atRisk.business_name as string,
          subtitle: `At risk • Health ${atRisk.health_score}% • $${atRisk.mrr || 0}/mo`,
          accent: "warning",
          href: `/dashboard/clients/${atRisk.id}`,
          ctaLabel: "Save this client",
        },
      });
    }
  } catch {
    // ignore
  }

  // 3) Stalled sequence — last sent > 3 days ago and still active
  try {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
    const { data: stalled } = await supabase
      .from("sequences")
      .select("id, name, last_sent_at, status")
      .eq("status", "active")
      .lt("last_sent_at", threeDaysAgo)
      .order("last_sent_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (stalled) {
      return NextResponse.json({
        priority: {
          kind: "stalled_sequence",
          title: stalled.name as string,
          subtitle: "Sequence has stalled • No sends in 3+ days",
          accent: "info",
          href: `/dashboard/sequences/${stalled.id}`,
          ctaLabel: "Resume sequence",
        },
      });
    }
  } catch {
    // ignore
  }

  // 4) All caught up
  return NextResponse.json({
    priority: {
      kind: "all_clear",
      title: "You're all caught up",
      subtitle: "No urgent items right now — go build something great.",
      accent: "success",
      href: "/dashboard/ai-studio",
      ctaLabel: "Open AI Studio",
    },
  });
}
