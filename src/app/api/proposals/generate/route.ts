import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";

// AI Sales Proposal Generator — Creates premium proposal PDFs for prospects
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("plan_tier").eq("id", user.id).single();
  const limited = checkAiRateLimit(user.id, profile?.plan_tier);
  if (limited) return limited;

  const body = await request.json();
  const { prospect_name, business_name, industry, services, package_tier, mrr, pain_points, goals } = body;

  // Minimum required fields — we render the PDF even without Claude.
  if (!prospect_name || !business_name) {
    return NextResponse.json({ error: "prospect_name and business_name are required" }, { status: 400 });
  }
  const servicesList: string[] = Array.isArray(services) ? services : [];

  // Generate proposal content with Claude
  const apiKey = process.env.ANTHROPIC_API_KEY;
  let proposalContent = "";

  if (apiKey) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4000,
        system: `You are a sales strategist for ShortStack digital marketing agency. Write a compelling, personalized business proposal. Be specific about ROI projections and deliverables. Write in sections with clear headers.`,
        messages: [{ role: "user", content: `Write a sales proposal for:
Prospect: ${prospect_name} at ${business_name}
Industry: ${industry}
Proposed services: ${servicesList.join(", ")}
Package: ${package_tier}
Monthly investment: $${mrr}
Their pain points: ${pain_points || "Need more clients and online visibility"}
Their goals: ${goals || "Grow revenue and brand awareness"}

Sections:
1. Executive Summary (why they need this)
2. The Problem (specific to their industry)
3. Our Solution (what ShortStack will do)
4. Service Breakdown (detailed deliverables per service)
5. Projected Results (realistic ROI with numbers)
6. Timeline (month-by-month plan)
7. Investment (pricing breakdown)
8. Why ShortStack (social proof, differentiators)
9. Next Steps (clear CTA)` }],
      }),
    });
    const data = await res.json();
    proposalContent = data.content?.[0]?.text || "";
  }

  // Generate PDF
  const PDFDocument = (await import("pdfkit")).default;

  const pdfBuffer: Buffer = await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margins: { top: 60, bottom: 60, left: 55, right: 55 } });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const gold = "#C9A84C";
    const dark = "#0a0a0a";
    const white = "#FFFFFF";
    const gray = "#888888";
    const pw = doc.page.width - 110;

    // Cover page
    doc.rect(0, 0, doc.page.width, doc.page.height).fill(dark);
    doc.rect(0, 0, doc.page.width, 6).fill(gold);
    doc.fontSize(14).fillColor(gold).text("SHORTSTACK", 55, 80);
    doc.fontSize(8).fillColor(gray).text("DIGITAL MARKETING AGENCY", 55, 98);
    doc.fontSize(10).fillColor(gray).text("PROPOSAL", 55, 130);
    doc.fontSize(36).fillColor(white).text("Growth", 55, 200, { width: pw });
    doc.fontSize(36).fillColor(gold).text("Partnership", 55, doc.y + 5, { width: pw });
    const dy = doc.y + 30;
    doc.moveTo(55, dy).lineTo(220, dy).strokeColor(gold).lineWidth(2).stroke();
    doc.fontSize(16).fillColor(white).text(business_name, 55, dy + 25);
    doc.fontSize(11).fillColor(gray).text(`Prepared for ${prospect_name}`, 55, doc.y + 5);
    doc.fontSize(11).fillColor(gray).text(new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), 55, doc.y + 5);
    doc.fontSize(11).fillColor(gold).text(`${package_tier} Package — $${mrr?.toLocaleString()}/month`, 55, doc.y + 15);
    doc.rect(0, doc.page.height - 6, doc.page.width, 6).fill(gold);

    // Content pages
    const sections = proposalContent.split(/\n(?=#{1,3}\s|\d+\.\s+[A-Z])/);
    for (const section of sections) {
      if (!section.trim()) continue;
      if (doc.y > doc.page.height - 120) {
        doc.addPage();
        doc.rect(0, 0, doc.page.width, doc.page.height).fill(dark);
        doc.rect(0, 0, doc.page.width, 3).fill(gold);
        doc.rect(0, doc.page.height - 3, doc.page.width, 3).fill(gold);
        doc.fontSize(7).fillColor(gray).text("SHORTSTACK", 55, 15);
        doc.fontSize(7).fillColor(gray).text(`Proposal — ${business_name}`, 55, 15, { width: pw, align: "right" });
        doc.y = 40;
      }
      const lines = section.trim().split("\n");
      const first = lines[0].trim();
      if (first.match(/^#{1,3}\s/) || first.match(/^\d+\.\s+[A-Z]/)) {
        const header = first.replace(/^#+\s*/, "").replace(/^\d+\.\s*/, "");
        doc.fontSize(15).fillColor(gold).text(header.toUpperCase(), 55, doc.y + 18, { width: pw });
        doc.moveTo(55, doc.y + 5).lineTo(160, doc.y + 5).strokeColor(gold).lineWidth(0.5).stroke();
        doc.moveDown(0.5);
        const bodyText = lines.slice(1).join("\n").trim();
        if (bodyText) doc.fontSize(9.5).fillColor("#e0e0e0").text(bodyText, 55, doc.y + 5, { width: pw, lineGap: 4 });
      } else {
        doc.fontSize(9.5).fillColor("#e0e0e0").text(section.trim(), 55, doc.y + 5, { width: pw, lineGap: 4 });
      }
    }

    doc.end();
  });

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${business_name.replace(/[^a-zA-Z0-9]/g, "_")}_proposal.pdf"`,
    },
  });
}
