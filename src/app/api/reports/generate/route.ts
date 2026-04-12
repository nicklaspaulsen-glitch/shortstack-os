import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const maxDuration = 60;

// On-demand AI report generation for a specific client
export async function POST(request: NextRequest) {
  const supabase = createServiceClient();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  const { client_id, report_type = "weekly" } = await request.json();
  if (!client_id) return NextResponse.json({ error: "client_id required" }, { status: 400 });

  // Fetch client
  const { data: client } = await supabase
    .from("clients")
    .select("id, business_name, contact_name, email, mrr, package_tier, health_score, industry, services, onboarded_at")
    .eq("id", client_id)
    .single();

  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  // Fetch metrics based on report type
  const days = report_type === "monthly" ? 30 : 7;
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const prevSince = new Date(Date.now() - days * 2 * 86400000).toISOString();

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

  const period = report_type === "monthly" ? "month" : "week";
  const prompt = `You are an AI account manager for ShortStack, a digital marketing agency. Generate a professional ${period}ly performance report for our client.

CLIENT INFO:
- Business: ${client.business_name}
- Contact: ${client.contact_name}
- Industry: ${client.industry || "General"}
- Package: ${client.package_tier || "Standard"}
- MRR: $${client.mrr}
- Health Score: ${client.health_score}%
- Services: ${client.services?.join(", ") || "Full service"}

THIS ${period.toUpperCase()}'S METRICS:
- New leads generated: ${leadsCount || 0} (${leadsTrend}% vs previous ${period})
- Outreach messages sent: ${outreachCount || 0}
- Replies received: ${repliesCount || 0}
- Deals closed: ${dealsWon.length} ($${dealsRevenue.toLocaleString()})
- Invoices collected: ${invoicesPaid.length} ($${invoiceTotal.toLocaleString()})

RECENT AI ACTIONS:
${(aiActions || []).map(a => `- ${a.description}`).join("\n") || "- Routine maintenance and monitoring"}

CONTENT ACTIVITY:
${(content || []).map(c => `- ${c.title} (${c.platform}) — ${c.status}`).join("\n") || "- No content tracked this period"}

Write the report with these sections:
1. Executive Summary (2-3 sentences)
2. Key Metrics (formatted with numbers)
3. Highlights & Wins
4. Areas for Improvement
5. Next Steps & Recommendations

Keep it professional, data-driven, and actionable. Under 400 words. Use plain text formatting with clear section headers.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await res.json();
  const reportText = data.content?.[0]?.text || "";

  if (!reportText) {
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }

  // Save to trinity_log
  await supabase.from("trinity_log").insert({
    agent: "analytics",
    action_type: "content",
    description: `${report_type === "monthly" ? "Monthly" : "Weekly"} report generated for ${client.business_name}`,
    client_id: client.id,
    status: "completed",
    result: {
      type: `${report_type}_report`,
      report: reportText,
      metrics: {
        leads: leadsCount || 0,
        leads_trend: leadsTrend,
        outreach: outreachCount || 0,
        replies: repliesCount || 0,
        deals_won: dealsWon.length,
        deals_revenue: dealsRevenue,
        invoices_paid: invoicesPaid.length,
        invoice_total: invoiceTotal,
      },
    },
  });

  return NextResponse.json({
    success: true,
    report: reportText,
    client: client.business_name,
    type: report_type,
    metrics: {
      leads: leadsCount || 0,
      leads_trend: leadsTrend,
      outreach: outreachCount || 0,
      replies: repliesCount || 0,
      deals_won: dealsWon.length,
      deals_revenue: dealsRevenue,
      health_score: client.health_score,
      mrr: client.mrr,
    },
  });
}

// GET — fetch previously generated reports from trinity_log
export async function GET(request: NextRequest) {
  const supabase = createServiceClient();
  const url = new URL(request.url);
  const clientId = url.searchParams.get("client_id");
  const limit = parseInt(url.searchParams.get("limit") || "20");

  let query = supabase
    .from("trinity_log")
    .select("id, description, client_id, created_at, result")
    .in("result->>type", ["weekly_report", "monthly_report"])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (clientId) {
    query = query.eq("client_id", clientId);
  }

  const { data: reports } = await query;

  return NextResponse.json({ success: true, reports: reports || [] });
}
