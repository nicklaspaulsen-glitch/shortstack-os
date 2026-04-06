import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import PDFDocument from "pdfkit";

// Generate weekly performance report for a client
// Can be triggered manually or by cron
export async function POST(request: NextRequest) {
  const { client_id } = await request.json();
  if (!client_id) return NextResponse.json({ error: "client_id required" }, { status: 400 });

  const supabase = createServiceClient();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  // Get client + all weekly data
  const [
    { data: client },
    { count: leadsGenerated },
    { count: dmsSent },
    { count: replies },
    { count: contentPublished },
    { data: campaigns },
    { data: tasks },
    { data: activity },
  ] = await Promise.all([
    supabase.from("clients").select("*").eq("id", client_id).single(),
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("client_id", client_id).gte("scraped_at", weekAgo),
    supabase.from("outreach_log").select("*", { count: "exact", head: true }).eq("status", "sent").gte("sent_at", weekAgo),
    supabase.from("outreach_log").select("*", { count: "exact", head: true }).eq("status", "replied").gte("sent_at", weekAgo),
    supabase.from("content_calendar").select("*", { count: "exact", head: true }).eq("client_id", client_id).eq("status", "published").gte("scheduled_at", weekAgo),
    supabase.from("campaigns").select("name, spend, roas, conversions, status").eq("client_id", client_id).eq("status", "active"),
    supabase.from("client_tasks").select("title, is_completed").eq("client_id", client_id),
    supabase.from("trinity_log").select("description, action_type, created_at").eq("client_id", client_id).gte("created_at", weekAgo).order("created_at", { ascending: false }).limit(10),
  ]);

  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const completedTasks = (tasks || []).filter(t => t.is_completed).length;
  const totalTasks = (tasks || []).length;
  const totalSpend = (campaigns || []).reduce((s, c) => s + (c.spend || 0), 0);
  const avgRoas = (campaigns || []).length > 0 ? (campaigns || []).reduce((s, c) => s + (c.roas || 0), 0) / (campaigns || []).length : 0;

  // Generate AI summary
  let aiSummary = "";
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 300,
          messages: [{
            role: "user",
            content: `Write a 3-sentence weekly performance summary for ${client.business_name} (${client.industry}). This week: ${leadsGenerated || 0} leads, ${dmsSent || 0} DMs sent, ${replies || 0} replies, ${contentPublished || 0} content published, ${completedTasks}/${totalTasks} tasks done, $${totalSpend.toFixed(0)} ad spend, ${avgRoas.toFixed(1)}x ROAS. Be positive and actionable.`,
          }],
        }),
      });
      const data = await res.json();
      aiSummary = data.content?.[0]?.text || "";
    } catch {}
  }

  // Build PDF
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  // Header
  doc.fontSize(24).fillColor("#C9A84C").text("ShortStack", 50, 50);
  doc.fontSize(9).fillColor("#64748b").text("WEEKLY PERFORMANCE REPORT", 50, 78);
  doc.moveDown(1.5);

  // Client info
  doc.fontSize(16).fillColor("#e2e8f0").text(client.business_name);
  doc.fontSize(10).fillColor("#64748b").text(`${client.industry} | Week of ${new Date(weekAgo).toLocaleDateString()} - ${new Date().toLocaleDateString()}`);
  doc.moveDown(1);

  // Divider
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#1e2a3a").stroke();
  doc.moveDown(1);

  // AI Summary
  if (aiSummary) {
    doc.fontSize(11).fillColor("#C9A84C").text("AI Summary");
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor("#94a3b8").text(aiSummary);
    doc.moveDown(1);
  }

  // Key Metrics
  doc.fontSize(11).fillColor("#C9A84C").text("Key Metrics");
  doc.moveDown(0.3);
  const metrics = [
    ["Leads Generated", String(leadsGenerated || 0)],
    ["DMs Sent", String(dmsSent || 0)],
    ["Replies Received", String(replies || 0)],
    ["Reply Rate", `${dmsSent ? Math.round(((replies || 0) / dmsSent) * 100) : 0}%`],
    ["Content Published", String(contentPublished || 0)],
    ["Tasks Completed", `${completedTasks}/${totalTasks}`],
    ["Ad Spend", `$${totalSpend.toFixed(2)}`],
    ["Average ROAS", `${avgRoas.toFixed(1)}x`],
  ];
  for (const [label, value] of metrics) {
    doc.fontSize(10).fillColor("#94a3b8").text(`${label}: `, { continued: true });
    doc.fillColor("#e2e8f0").text(value);
  }
  doc.moveDown(1);

  // Activity log
  if (activity && activity.length > 0) {
    doc.fontSize(11).fillColor("#C9A84C").text("AI Activity This Week");
    doc.moveDown(0.3);
    for (const a of activity.slice(0, 8)) {
      doc.fontSize(9).fillColor("#94a3b8").text(`• ${a.description}`);
    }
    doc.moveDown(1);
  }

  // Footer
  doc.fontSize(8).fillColor("#64748b").text("Generated by ShortStack OS | shortstack.work", 50, 770, { align: "center" });

  doc.end();

  // Save report reference
  await supabase.from("trinity_log").insert({
    action_type: "custom",
    description: `Weekly report generated for ${client.business_name}`,
    client_id,
    status: "completed",
    result: { leads: leadsGenerated, dms: dmsSent, replies, content: contentPublished },
  });

  return new Promise<NextResponse>((resolve) => {
    doc.on("end", () => {
      const pdfBuffer = Buffer.concat(chunks);
      resolve(new NextResponse(pdfBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${client.business_name}_weekly_report.pdf"`,
        },
      }));
    });
  });
}
