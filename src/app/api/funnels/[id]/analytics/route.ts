import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = { params: { id: string } };

// GET /api/funnels/[id]/analytics — get funnel analytics (authenticated)
export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify ownership
  const { data: funnel } = await supabase
    .from("funnels")
    .select("id, name")
    .eq("id", params.id)
    .eq("profile_id", user.id)
    .single();

  if (!funnel) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Get steps in order
  const { data: steps } = await supabase
    .from("funnel_steps")
    .select("id, title, step_type, sort_order")
    .eq("funnel_id", params.id)
    .order("sort_order", { ascending: true });

  // Get all analytics events for this funnel
  const { data: events } = await supabase
    .from("funnel_analytics")
    .select("step_id, event_type, visitor_id, created_at")
    .eq("funnel_id", params.id);

  const eventsArr = events ?? [];
  const stepsArr = steps ?? [];

  // Build per-step stats
  const stepStats = stepsArr.map((step, idx) => {
    const stepEvents = eventsArr.filter((e) => e.step_id === step.id);
    const views = stepEvents.filter((e) => e.event_type === "view").length;
    const submits = stepEvents.filter((e) => e.event_type === "submit").length;
    const clicks = stepEvents.filter((e) => e.event_type === "click").length;
    const purchases = stepEvents.filter((e) => e.event_type === "purchase").length;

    // Dropoff: compared to previous step's views
    let dropoffPct = 0;
    if (idx > 0) {
      const prevStep = stepsArr[idx - 1];
      const prevViews = eventsArr.filter(
        (e) => e.step_id === prevStep.id && e.event_type === "view"
      ).length;
      dropoffPct = prevViews > 0 ? Math.round(((prevViews - views) / prevViews) * 100) : 0;
    }

    const conversionRate = views > 0 ? Math.round(((submits + purchases) / views) * 100) : 0;

    return {
      step_id: step.id,
      title: step.title,
      step_type: step.step_type,
      sort_order: step.sort_order,
      views,
      clicks,
      submits,
      purchases,
      conversion_rate: conversionRate,
      dropoff_pct: dropoffPct,
    };
  });

  // Overall funnel stats
  const totalViews = eventsArr.filter((e) => e.event_type === "view").length;
  const totalSubmits = eventsArr.filter((e) => e.event_type === "submit").length;
  const totalPurchases = eventsArr.filter((e) => e.event_type === "purchase").length;
  const overallConversion = totalViews > 0
    ? Math.round(((totalSubmits + totalPurchases) / totalViews) * 100)
    : 0;

  // Unique visitors
  const uniqueVisitors = new Set(eventsArr.map((e) => e.visitor_id).filter(Boolean)).size;

  return NextResponse.json({
    funnel_id: params.id,
    funnel_name: funnel.name,
    total_views: totalViews,
    total_submits: totalSubmits,
    total_purchases: totalPurchases,
    overall_conversion_rate: overallConversion,
    unique_visitors: uniqueVisitors,
    steps: stepStats,
  });
}
