import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// AI Brand Audit — Complete analysis of a prospect/client's online presence
// Use this in sales calls to show value before they sign
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { business_name, website, industry, location } = await request.json();

  // Scrape their website
  let siteContent = "";
  if (website) {
    try {
      const res = await fetch(website, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; ShortStackBot/1.0)" },
        signal: AbortSignal.timeout(8000),
      });
      const html = await res.text();
      siteContent = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().substring(0, 3000);
    } catch { /* ignore */ }
  }

  // Check Google Places
  let googleData: Record<string, unknown> = {};
  const placesKey = process.env.GOOGLE_PLACES_API_KEY;
  if (placesKey) {
    try {
      const searchRes = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(business_name + " " + (location || ""))}&key=${placesKey}`);
      const searchData = await searchRes.json();
      if (searchData.results?.[0]) {
        const detailRes = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${searchData.results[0].place_id}&fields=name,rating,user_ratings_total,formatted_phone_number,website,opening_hours,reviews&key=${placesKey}`);
        const detailData = await detailRes.json();
        googleData = detailData.result || {};
      }
    } catch { /* ignore */ }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system: "You are a brand strategist conducting a comprehensive brand audit. Be thorough, specific, and actionable. This audit is used to sell agency services — highlight problems that the agency can fix. Return valid JSON only.",
      messages: [{ role: "user", content: `Complete brand audit for: ${business_name}
Industry: ${industry || "business"}
Location: ${location || "N/A"}
Website: ${website || "none"}
Website content: ${siteContent || "not available"}
Google Business data: ${JSON.stringify(googleData).substring(0, 1500)}

Return JSON with:
- overall_grade: letter grade (A-F)
- overall_score: number (1-100)
- executive_summary: 3 sentences on their current state and biggest opportunity

- website_audit: { score, design_quality, mobile_estimate, load_speed_estimate, seo_basics, missing_elements: array, recommendations: array }
- google_presence: { rating, reviews, profile_completeness, recommendations: array }
- social_media_estimate: { platforms_likely_active: array, estimated_followers, content_quality_estimate, posting_frequency_estimate, recommendations: array }
- content_marketing: { blog_exists, content_quality, seo_content_score, recommendations: array }
- paid_advertising: { likely_running_ads, ad_platform_estimate, recommendations: array }
- brand_consistency: { logo_quality_estimate, messaging_clarity, unique_value_proposition, recommendations: array }
- local_seo: { score, map_pack_likelihood, citation_estimate, recommendations: array }
- reputation: { online_sentiment, review_response_rate_estimate, recommendations: array }

- top_3_problems: array of { problem, impact, solution_we_offer }
- revenue_opportunity: estimated monthly revenue they're leaving on the table
- recommended_package: which ShortStack package would help most (Starter/Growth/Enterprise)
- recommended_services: array of specific services they need
- conversation_starters: array of 5 things to say on a sales call based on this audit` }],
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text || "{}";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    const audit = JSON.parse(cleaned);

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

      // Cover
      doc.rect(0, 0, doc.page.width, doc.page.height).fill(dark);
      doc.rect(0, 0, doc.page.width, 6).fill(gold);
      doc.fontSize(14).fillColor(gold).text("SHORTSTACK", 55, 80);
      doc.fontSize(8).fillColor(gray).text("DIGITAL MARKETING AGENCY", 55, 98);
      doc.fontSize(10).fillColor(gray).text("BRAND AUDIT REPORT", 55, 130);
      doc.fontSize(34).fillColor(white).text("Digital", 55, 200, { width: pw });
      doc.fontSize(34).fillColor(gold).text("Brand Audit", 55, doc.y + 5, { width: pw });
      const dy = doc.y + 25;
      doc.moveTo(55, dy).lineTo(200, dy).strokeColor(gold).lineWidth(2).stroke();
      doc.fontSize(18).fillColor(white).text(business_name, 55, dy + 20);
      doc.fontSize(11).fillColor(gray).text(industry || "", 55, doc.y + 5);

      // Score
      doc.fontSize(60).fillColor(gold).text(audit.overall_grade || "?", 55, doc.y + 30);
      doc.fontSize(12).fillColor(gray).text(`Overall Score: ${audit.overall_score || "?"}/100`, 55, doc.y + 5);
      doc.rect(0, doc.page.height - 6, doc.page.width, 6).fill(gold);

      // Summary page
      doc.addPage();
      doc.rect(0, 0, doc.page.width, doc.page.height).fill(dark);
      doc.rect(0, 0, doc.page.width, 3).fill(gold);
      doc.rect(0, doc.page.height - 3, doc.page.width, 3).fill(gold);
      doc.fontSize(16).fillColor(gold).text("EXECUTIVE SUMMARY", 55, 50);
      doc.moveTo(55, doc.y + 5).lineTo(200, doc.y + 5).strokeColor(gold).lineWidth(1).stroke();
      doc.fontSize(10).fillColor("#e0e0e0").text(audit.executive_summary || "", 55, doc.y + 15, { width: pw, lineGap: 5 });

      // Top 3 problems
      if (audit.top_3_problems) {
        doc.fontSize(14).fillColor(gold).text("TOP 3 PROBLEMS WE FOUND", 55, doc.y + 25);
        for (const p of audit.top_3_problems) {
          doc.fontSize(11).fillColor(white).text(p.problem, 55, doc.y + 12);
          doc.fontSize(9).fillColor(gray).text(`Impact: ${p.impact}`, 70, doc.y + 3);
          doc.fontSize(9).fillColor(gold).text(`Solution: ${p.solution_we_offer}`, 70, doc.y + 3);
        }
      }

      // Revenue opportunity
      if (audit.revenue_opportunity) {
        doc.fontSize(14).fillColor(gold).text("REVENUE OPPORTUNITY", 55, doc.y + 25);
        doc.fontSize(11).fillColor(white).text(audit.revenue_opportunity, 55, doc.y + 8, { width: pw });
      }

      // Recommendation
      if (audit.recommended_package) {
        doc.fontSize(14).fillColor(gold).text("OUR RECOMMENDATION", 55, doc.y + 25);
        doc.fontSize(11).fillColor(white).text(`${audit.recommended_package} Package`, 55, doc.y + 8);
        if (audit.recommended_services) {
          for (const s of audit.recommended_services) {
            doc.fontSize(9).fillColor("#cccccc").text(`  •  ${s}`, 65, doc.y + 3);
          }
        }
      }

      doc.end();
    });

    // Return based on format param
    const format = request.nextUrl.searchParams.get("format");
    if (format === "pdf") {
      return new NextResponse(new Uint8Array(pdfBuffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${business_name.replace(/[^a-zA-Z0-9]/g, "_")}_brand_audit.pdf"`,
        },
      });
    }

    return NextResponse.json({ success: true, audit });
  } catch {
    return NextResponse.json({ success: true, audit: { raw: text } });
  }
}
