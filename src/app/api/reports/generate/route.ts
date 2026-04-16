import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";

export const maxDuration = 60;

/* ── Report type labels ──────────────────────────────────────── */

const REPORT_TYPE_LABELS: Record<string, string> = {
  weekly: "Weekly Performance",
  monthly: "Monthly Performance",
  ad_spend: "Ad Spend Analysis",
  social_media: "Social Media Growth",
  seo: "SEO Progress",
  lead_gen: "Lead Generation",
  revenue: "Revenue Summary",
};

/* ── Section-specific prompt fragments ───────────────────────── */

function buildSectionInstructions(sections: string[], includeAI: boolean): string {
  const sectionMap: Record<string, string> = {
    cover: "", // No AI content needed for cover
    executive_summary: "Executive Summary: Write a 2-3 sentence overview of the period's performance, highlighting the most significant wins and any concerns.",
    key_metrics: "Key Metrics: Present the top 6 KPIs with values, percentage changes, and brief context for each number.",
    charts: "Charts Data Summary: Describe trends in the data that would be visualized — monthly lead progression, traffic sources breakdown, and revenue trajectory.",
    campaign_table: "Campaign Performance: Analyze each campaign's spend efficiency, ROAS, and conversion rates. Note the top performer and any underperformers.",
    ai_insights: includeAI
      ? "AI-Generated Insights: Provide 3-4 data-driven strategic insights. Identify hidden patterns, cross-channel opportunities, and actionable optimizations with estimated impact."
      : "",
    recommendations: "Next Steps & Recommendations: List 5 specific, prioritized action items with expected outcomes. Include timeline suggestions where relevant.",
  };

  const instructions = sections
    .map(s => sectionMap[s])
    .filter(Boolean)
    .map((s, i) => `${i + 1}. ${s}`)
    .join("\n");

  return instructions || "Write a general performance summary.";
}

/* ── POST: Generate a report ─────────────────────────────────── */

export async function POST(request: NextRequest) {
  // Auth check
  const authSupabase = createServerSupabase();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await authSupabase.from("profiles").select("plan_tier").eq("id", user.id).single();
  const limited = checkAiRateLimit(user.id, profile?.plan_tier);
  if (limited) return limited;

  const supabase = createServiceClient();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  let body: {
    client_id?: string;
    report_type?: string;
    date_range?: string;
    sections?: string[];
    include_ai_insights?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    client_id,
    report_type = "weekly",
    date_range = "this_month",
    sections = ["executive_summary", "key_metrics", "charts", "campaign_table", "ai_insights", "recommendations"],
    include_ai_insights = true,
  } = body;

  if (!client_id) return NextResponse.json({ error: "client_id required" }, { status: 400 });

  // Fetch client
  const { data: client } = await supabase
    .from("clients")
    .select("id, business_name, contact_name, email, mrr, package_tier, health_score, industry, services, onboarded_at")
    .eq("id", client_id)
    .single();

  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  // Determine date boundaries from date_range
  let days: number;
  switch (date_range) {
    case "last_month": days = 30; break;
    case "last_quarter": days = 90; break;
    case "this_month":
    default: days = new Date().getDate(); break; // Days elapsed this month
  }
  // Fallback for legacy report_type values
  if (report_type === "weekly") days = 7;
  if (report_type === "monthly" && date_range === "this_month") days = 30;

  const since = new Date(Date.now() - days * 86400000).toISOString();
  const prevSince = new Date(Date.now() - days * 2 * 86400000).toISOString();

  // Fetch metrics in parallel
  const [
    { count: leadsCount },
    { count: prevLeadsCount },
    { count: outreachCount },
    { count: repliesCount },
    { data: deals },
    { data: invoices },
    { data: aiActions },
    { data: content },
  ] = await Promise.all([
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("client_id", client_id).gte("scraped_at", since),
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("client_id", client_id).gte("scraped_at", prevSince).lt("scraped_at", since),
    supabase.from("outreach_log").select("*", { count: "exact", head: true }).gte("sent_at", since),
    supabase.from("outreach_log").select("*", { count: "exact", head: true }).eq("status", "replied").gte("sent_at", since),
    supabase.from("deals").select("amount, status").eq("client_id", client_id).gte("created_at", since),
    supabase.from("invoices").select("amount, status").eq("client_id", client_id).gte("created_at", since),
    supabase.from("trinity_log").select("description, action_type, created_at").eq("client_id", client_id).gte("created_at", since).order("created_at", { ascending: false }).limit(10),
    supabase.from("content_calendar").select("title, status, platform").eq("client_id", client_id).gte("created_at", since).limit(10),
  ]);

  const dealsWon = deals?.filter(d => d.status === "won") || [];
  const dealsRevenue = dealsWon.reduce((s, d) => s + (d.amount || 0), 0);
  const invoicesPaid = invoices?.filter(i => i.status === "paid") || [];
  const invoiceTotal = invoicesPaid.reduce((s, i) => s + (i.amount || 0), 0);
  const leadsTrend = (prevLeadsCount || 0) > 0
    ? (((leadsCount || 0) - (prevLeadsCount || 0)) / (prevLeadsCount || 1) * 100).toFixed(0)
    : "N/A";

  // Build the prompt with requested sections
  const typeLabel = REPORT_TYPE_LABELS[report_type] || "Performance";
  const sectionInstructions = buildSectionInstructions(sections, include_ai_insights);

  const prompt = `You are an AI account manager for ShortStack, a digital marketing agency. Generate a professional ${typeLabel} report for our client.

CLIENT INFO:
- Business: ${client.business_name}
- Contact: ${client.contact_name}
- Industry: ${client.industry || "General"}
- Package: ${client.package_tier || "Standard"}
- MRR: $${client.mrr}
- Health Score: ${client.health_score}%
- Services: ${client.services?.join(", ") || "Full service"}

PERIOD: ${date_range === "last_quarter" ? "Last 90 days" : date_range === "last_month" ? "Last 30 days" : `Last ${days} days`}

METRICS:
- New leads generated: ${leadsCount || 0} (${leadsTrend}% vs previous period)
- Outreach messages sent: ${outreachCount || 0}
- Replies received: ${repliesCount || 0}
- Deals closed: ${dealsWon.length} ($${dealsRevenue.toLocaleString()})
- Invoices collected: ${invoicesPaid.length} ($${invoiceTotal.toLocaleString()})

RECENT AI ACTIONS:
${(aiActions || []).map(a => `- ${a.description}`).join("\n") || "- Routine maintenance and monitoring"}

CONTENT ACTIVITY:
${(content || []).map(c => `- ${c.title} (${c.platform}) — ${c.status}`).join("\n") || "- No content tracked this period"}

Write the report with ONLY the following sections:
${sectionInstructions}

Format each section with a clear header line (## Section Name). Keep it professional, data-driven, and actionable. Under 600 words total. Use plain text formatting.`;

  try {
    const anthropic = new Anthropic({ apiKey });

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    });

    const reportText = response.content[0].type === "text" ? response.content[0].text : "";

    if (!reportText) {
      return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
    }

    // Parse report text into sections
    const reportSections: Record<string, string> = {};
    const sectionRegex = /##\s+(.+?)(?:\n)([\s\S]*?)(?=##\s+|\s*$)/g;
    let match;
    while ((match = sectionRegex.exec(reportText)) !== null) {
      const sectionName = match[1].trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
      reportSections[sectionName] = match[2].trim();
    }

    // If no sections parsed, put everything in executive_summary
    if (Object.keys(reportSections).length === 0) {
      reportSections.executive_summary = reportText;
    }

    const metrics = {
      leads: leadsCount || 0,
      leads_trend: leadsTrend,
      outreach: outreachCount || 0,
      replies: repliesCount || 0,
      deals_won: dealsWon.length,
      deals_revenue: dealsRevenue,
      invoices_paid: invoicesPaid.length,
      invoice_total: invoiceTotal,
      health_score: client.health_score,
      mrr: client.mrr,
    };

    // Save to trinity_log
    await supabase.from("trinity_log").insert({
      agent: "analytics",
      action_type: "content",
      description: `${typeLabel} report generated for ${client.business_name}`,
      client_id: client.id,
      status: "completed",
      result: {
        type: `${report_type}_report`,
        report: reportText,
        sections: reportSections,
        metrics,
        requested_sections: sections,
        include_ai_insights,
      },
    });

    return NextResponse.json({
      success: true,
      report: reportText,
      sections: reportSections,
      client: client.business_name,
      type: report_type,
      metrics,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Report generation error:", message);
    return NextResponse.json({ error: "Failed to generate report", details: message }, { status: 500 });
  }
}

/* ── GET: Fetch previously generated reports ─────────────────── */

export async function GET(request: NextRequest) {
  const supabase = createServiceClient();
  const url = new URL(request.url);
  const clientId = url.searchParams.get("client_id");
  const limit = parseInt(url.searchParams.get("limit") || "20");

  let query = supabase
    .from("trinity_log")
    .select("id, description, client_id, created_at, result")
    .in("result->>type", ["weekly_report", "monthly_report", "ad_spend_report", "social_media_report", "seo_report", "lead_gen_report", "revenue_report"])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (clientId) {
    query = query.eq("client_id", clientId);
  }

  const { data: reports } = await query;

  return NextResponse.json({ success: true, reports: reports || [] });
}
