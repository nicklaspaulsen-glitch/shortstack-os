import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// AI Growth Plan Generator — Creates a personalized 90-day growth plan for each client
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { client_id } = await request.json();

  const { data: client } = await supabase.from("clients").select("*").eq("id", client_id).single();
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system: "You are a growth strategist for a digital marketing agency. Create detailed, actionable 90-day growth plans. Return valid JSON only.",
      messages: [{ role: "user", content: `Create a 90-day growth plan for:
Business: ${client.business_name}
Industry: ${client.industry || "business"}
Package: ${client.package_tier}
Services: ${(client.services || []).join(", ")}
Current MRR invested: $${client.mrr}

Return JSON with:
- executive_summary: 2-3 sentence overview of the plan
- goals: array of { goal, metric, target_value, current_value_estimate }
- month_1: { theme, weeks: array of { week_number, focus, tasks: array of strings, deliverables: array, kpis: array } }
- month_2: { theme, weeks: same structure }
- month_3: { theme, weeks: same structure }
- milestones: array of { day, milestone, description }
- success_metrics: array of { metric, baseline_estimate, day_30_target, day_60_target, day_90_target }
- tools_and_resources: array of tools we'll use for them
- risks_and_mitigations: array of { risk, mitigation }
- expected_roi: { investment, projected_return, roi_percentage }` }],
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text || "{}";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    const plan = JSON.parse(cleaned);

    // Generate PDF version
    const PDFDocument = (await import("pdfkit")).default;
    const pdfBuffer: Buffer = await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: "A4", margins: { top: 60, bottom: 60, left: 55, right: 55 } });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const gold = "#C9A84C"; const dark = "#0a0a0a"; const white = "#FFFFFF"; const gray = "#888888";
      const pw = doc.page.width - 110;

      // Cover
      doc.rect(0, 0, doc.page.width, doc.page.height).fill(dark);
      doc.rect(0, 0, doc.page.width, 6).fill(gold);
      doc.fontSize(14).fillColor(gold).text("SHORTSTACK", 55, 80);
      doc.fontSize(8).fillColor(gray).text("DIGITAL MARKETING AGENCY", 55, 98);
      doc.fontSize(32).fillColor(white).text("90-Day", 55, 200, { width: pw });
      doc.fontSize(32).fillColor(gold).text("Growth Plan", 55, doc.y + 5, { width: pw });
      const dy = doc.y + 25;
      doc.moveTo(55, dy).lineTo(200, dy).strokeColor(gold).lineWidth(2).stroke();
      doc.fontSize(16).fillColor(white).text(client.business_name, 55, dy + 20);
      doc.fontSize(11).fillColor(gray).text(`${client.package_tier || "Growth"} Package`, 55, doc.y + 5);
      doc.fontSize(11).fillColor(gray).text(new Date().toLocaleDateString("en-US", { year: "numeric", month: "long" }), 55, doc.y + 5);
      doc.rect(0, doc.page.height - 6, doc.page.width, 6).fill(gold);

      // Summary page
      doc.addPage();
      doc.rect(0, 0, doc.page.width, doc.page.height).fill(dark);
      doc.rect(0, 0, doc.page.width, 3).fill(gold);
      doc.rect(0, doc.page.height - 3, doc.page.width, 3).fill(gold);

      doc.fontSize(18).fillColor(gold).text("EXECUTIVE SUMMARY", 55, 50);
      doc.moveTo(55, doc.y + 5).lineTo(200, doc.y + 5).strokeColor(gold).lineWidth(1).stroke();
      doc.fontSize(10).fillColor("#e0e0e0").text(plan.executive_summary || "", 55, doc.y + 15, { width: pw, lineGap: 5 });

      if (plan.goals) {
        doc.fontSize(14).fillColor(gold).text("GOALS", 55, doc.y + 25);
        for (const g of plan.goals) {
          doc.fontSize(10).fillColor(white).text(`${g.goal}`, 55, doc.y + 8);
          doc.fontSize(9).fillColor(gray).text(`Target: ${g.target_value} | Current: ${g.current_value_estimate || "TBD"}`, 70, doc.y + 3);
        }
      }

      // Month pages
      for (const monthKey of ["month_1", "month_2", "month_3"]) {
        const month = plan[monthKey];
        if (!month) continue;

        doc.addPage();
        doc.rect(0, 0, doc.page.width, doc.page.height).fill(dark);
        doc.rect(0, 0, doc.page.width, 3).fill(gold);
        doc.rect(0, doc.page.height - 3, doc.page.width, 3).fill(gold);

        const monthNum = monthKey.replace("month_", "");
        doc.fontSize(18).fillColor(gold).text(`MONTH ${monthNum}: ${(month.theme || "").toUpperCase()}`, 55, 50);
        doc.moveTo(55, doc.y + 5).lineTo(250, doc.y + 5).strokeColor(gold).lineWidth(1).stroke();

        if (month.weeks) {
          for (const week of month.weeks) {
            if (doc.y > doc.page.height - 100) {
              doc.addPage();
              doc.rect(0, 0, doc.page.width, doc.page.height).fill(dark);
              doc.rect(0, 0, doc.page.width, 3).fill(gold);
              doc.rect(0, doc.page.height - 3, doc.page.width, 3).fill(gold);
            }
            doc.fontSize(11).fillColor(gold).text(`Week ${week.week_number}: ${week.focus || ""}`, 55, doc.y + 12);
            if (week.tasks) {
              for (const task of week.tasks) {
                doc.fontSize(9).fillColor("#cccccc").text(`  •  ${task}`, 65, doc.y + 3);
              }
            }
          }
        }
      }

      doc.end();
    });

    // Return PDF if requested, otherwise JSON
    const format = request.nextUrl.searchParams.get("format");
    if (format === "pdf") {
      return new NextResponse(new Uint8Array(pdfBuffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${client.business_name.replace(/[^a-zA-Z0-9]/g, "_")}_90day_plan.pdf"`,
        },
      });
    }

    return NextResponse.json({ success: true, plan });
  } catch {
    return NextResponse.json({ success: true, plan: { raw: text } });
  }
}
