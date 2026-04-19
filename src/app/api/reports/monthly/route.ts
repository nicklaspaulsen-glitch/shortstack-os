import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Monthly Client Report Generator — Auto-generates premium performance reports
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = request.nextUrl.searchParams.get("client_id");
  if (!clientId) return NextResponse.json({ error: "Client ID required" }, { status: 400 });

  // Scope by profile_id so one user can't download another user's monthly
  // report PDF just by hitting the endpoint with someone else's client_id.
  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!client) return NextResponse.json({ error: "Client not found or forbidden" }, { status: 403 });

  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const since = monthStart.toISOString();

  // Gather all metrics
  const [
    { count: tasksCompleted },
    { count: totalTasks },
    { count: contentPublished },
    { data: campaigns },
    { count: scriptsCreated },
  ] = await Promise.all([
    supabase.from("client_tasks").select("*", { count: "exact", head: true }).eq("client_id", clientId).eq("is_completed", true),
    supabase.from("client_tasks").select("*", { count: "exact", head: true }).eq("client_id", clientId),
    supabase.from("content_calendar").select("*", { count: "exact", head: true }).eq("client_id", clientId).eq("status", "published").gte("published_at", since),
    supabase.from("campaigns").select("*").eq("client_id", clientId),
    supabase.from("content_scripts").select("*", { count: "exact", head: true }).eq("client_id", clientId).gte("created_at", since),
  ]);

  const totalSpend = campaigns?.reduce((s, c) => s + (c.spend || 0), 0) || 0;
  const totalConversions = campaigns?.reduce((s, c) => s + (c.conversions || 0), 0) || 0;
  // Previous expression produced NaN when campaigns was undefined because the
  // left-hand .reduce was `undefined / 1 || 0` — JS evaluates left-to-right and
  // the `|| 0` fallback can't rescue a NaN that entered via a numeric op.
  const roasCampaigns = (campaigns || []).filter((c) => (c.roas ?? 0) > 0);
  const avgRoas = roasCampaigns.length > 0
    ? roasCampaigns.reduce((s, c) => s + (c.roas || 0), 0) / roasCampaigns.length
    : 0;

  // Generate AI summary
  let aiSummary = "";
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        system: "Write a concise monthly performance summary for a client report. Be positive but honest. Highlight wins and areas for improvement.",
        messages: [{ role: "user", content: `Client: ${client.business_name} (${client.industry})\nPackage: ${client.package_tier}\nTasks: ${tasksCompleted}/${totalTasks} completed\nContent published: ${contentPublished}\nScripts created: ${scriptsCreated}\nAd spend: $${totalSpend}\nConversions: ${totalConversions}\nROAS: ${avgRoas.toFixed(1)}x` }],
      }),
    });
    const data = await res.json();
    aiSummary = data.content?.[0]?.text || "";
  }

  // Generate PDF
  const PDFDocument = (await import("pdfkit")).default;
  const pdfBuffer: Buffer = await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margins: { top: 60, bottom: 60, left: 55, right: 55 } });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const gold = "#C9A84C"; const dark = "#0a0a0a"; const white = "#FFFFFF"; const gray = "#888888";
    const pw = doc.page.width - 110;
    const month = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

    // Cover
    doc.rect(0, 0, doc.page.width, doc.page.height).fill(dark);
    doc.rect(0, 0, doc.page.width, 6).fill(gold);
    doc.fontSize(14).fillColor(gold).text("SHORTSTACK", 55, 80);
    doc.fontSize(8).fillColor(gray).text("DIGITAL MARKETING AGENCY", 55, 98);
    doc.fontSize(10).fillColor(gray).text("MONTHLY REPORT", 55, 130);
    doc.fontSize(32).fillColor(white).text(month, 55, 200, { width: pw });
    doc.fontSize(28).fillColor(gold).text("Performance", 55, doc.y + 5);
    doc.fontSize(28).fillColor(gold).text("Report", 55, doc.y + 5);
    const dy = doc.y + 25;
    doc.moveTo(55, dy).lineTo(200, dy).strokeColor(gold).lineWidth(2).stroke();
    doc.fontSize(16).fillColor(white).text(client.business_name, 55, dy + 20);
    doc.fontSize(11).fillColor(gray).text(`${client.package_tier || "Growth"} Package`, 55, doc.y + 5);
    doc.rect(0, doc.page.height - 6, doc.page.width, 6).fill(gold);

    // Stats page
    doc.addPage();
    doc.rect(0, 0, doc.page.width, doc.page.height).fill(dark);
    doc.rect(0, 0, doc.page.width, 3).fill(gold);
    doc.rect(0, doc.page.height - 3, doc.page.width, 3).fill(gold);

    doc.fontSize(18).fillColor(gold).text("KEY METRICS", 55, 50, { width: pw });
    doc.moveTo(55, doc.y + 5).lineTo(180, doc.y + 5).strokeColor(gold).lineWidth(1).stroke();

    const metrics = [
      { label: "Tasks Completed", value: `${tasksCompleted || 0}/${totalTasks || 0}` },
      { label: "Content Published", value: String(contentPublished || 0) },
      { label: "Scripts Created", value: String(scriptsCreated || 0) },
      { label: "Ad Spend", value: `$${totalSpend.toLocaleString()}` },
      { label: "Conversions", value: String(totalConversions) },
      { label: "Average ROAS", value: `${avgRoas.toFixed(1)}x` },
      { label: "Health Score", value: `${client.health_score}%` },
    ];

    let metricY = doc.y + 20;
    for (const m of metrics) {
      doc.fontSize(24).fillColor(gold).text(m.value, 55, metricY);
      doc.fontSize(10).fillColor(gray).text(m.label, 55, doc.y + 2);
      metricY = doc.y + 15;
    }

    // AI Summary page
    if (aiSummary) {
      doc.addPage();
      doc.rect(0, 0, doc.page.width, doc.page.height).fill(dark);
      doc.rect(0, 0, doc.page.width, 3).fill(gold);
      doc.rect(0, doc.page.height - 3, doc.page.width, 3).fill(gold);
      doc.fontSize(18).fillColor(gold).text("EXECUTIVE SUMMARY", 55, 50, { width: pw });
      doc.moveTo(55, doc.y + 5).lineTo(200, doc.y + 5).strokeColor(gold).lineWidth(1).stroke();
      doc.fontSize(10).fillColor("#e0e0e0").text(aiSummary, 55, doc.y + 15, { width: pw, lineGap: 5 });
    }

    doc.end();
  });

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${client.business_name.replace(/[^a-zA-Z0-9]/g, "_")}_report_${new Date().toISOString().slice(0, 7)}.pdf"`,
    },
  });
}
