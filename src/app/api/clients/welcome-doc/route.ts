import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = request.nextUrl.searchParams.get("id");
  if (!clientId) return NextResponse.json({ error: "Client ID required" }, { status: 400 });

  const { data: client } = await supabase.from("clients").select("*").eq("id", clientId).single();
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const PDFDocument = (await import("pdfkit")).default;

  // Generate personalized welcome content with Claude
  let welcomeContent = getDefaultWelcomeContent(client);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 3000,
          system: "You are writing a premium welcome document for a new client of ShortStack digital marketing agency. Be warm, professional, and specific about what they're getting. Write in clear sections.",
          messages: [{ role: "user", content: `Write a personalized welcome document for:
Client: ${client.contact_name} at ${client.business_name}
Package: ${client.package_tier || "Growth"}
Monthly Investment: $${client.mrr}
Services: ${(client.services || []).join(", ")}
Industry: ${client.industry || "Business"}

Include these sections:
1. Welcome message (warm, personal)
2. What You Paid For (breakdown of services with descriptions)
3. How We Plan to Help (strategy overview specific to their industry)
4. What to Expect (timeline, milestones, deliverables)
5. Your Client Portal (how to access and what they can see)
6. Communication (how and when we communicate)
7. FAQ (8-10 common questions with answers)
8. Your Team (who they'll be working with)
9. Next Steps (immediate action items)` }],
        }),
      });
      const data = await res.json();
      welcomeContent = data.content?.[0]?.text || welcomeContent;
    } catch { /* use default */ }
  }

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

    // Cover
    doc.rect(0, 0, doc.page.width, doc.page.height).fill(dark);
    doc.rect(0, 0, doc.page.width, 6).fill(gold);
    doc.fontSize(14).fillColor(gold).text("SHORTSTACK", 55, 80);
    doc.fontSize(8).fillColor(gray).text("DIGITAL MARKETING AGENCY", 55, 98);
    doc.fontSize(36).fillColor(white).text("Welcome", 55, 200, { width: pw });
    doc.fontSize(36).fillColor(gold).text(client.contact_name, 55, doc.y + 5, { width: pw });
    const dy = doc.y + 30;
    doc.moveTo(55, dy).lineTo(220, dy).strokeColor(gold).lineWidth(2).stroke();
    doc.fontSize(14).fillColor(white).text(client.business_name, 55, dy + 25);
    doc.fontSize(11).fillColor(gray).text(`${client.package_tier || "Growth"} Package`, 55, doc.y + 5);
    doc.fontSize(11).fillColor(gray).text(`$${client.mrr?.toLocaleString()}/month`, 55, doc.y + 3);
    doc.fontSize(11).fillColor(gray).text(new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), 55, doc.y + 3);
    doc.rect(0, doc.page.height - 6, doc.page.width, 6).fill(gold);

    // Content pages
    const sections = welcomeContent.split(/\n(?=#{1,3}\s|\d+\.\s+[A-Z])/);
    for (const section of sections) {
      if (!section.trim()) continue;
      if (doc.y > doc.page.height - 120) {
        doc.addPage();
        doc.rect(0, 0, doc.page.width, doc.page.height).fill(dark);
        doc.rect(0, 0, doc.page.width, 3).fill(gold);
        doc.rect(0, doc.page.height - 3, doc.page.width, 3).fill(gold);
        doc.fontSize(7).fillColor(gray).text("SHORTSTACK", 55, 15);
        doc.y = 40;
      }

      const lines = section.trim().split("\n");
      const first = lines[0].trim();
      if (first.match(/^#{1,3}\s/) || first.match(/^\d+\.\s+[A-Z]/)) {
        const header = first.replace(/^#+\s*/, "").replace(/^\d+\.\s*/, "");
        doc.fontSize(14).fillColor(gold).text(header.toUpperCase(), 55, doc.y + 18, { width: pw });
        doc.moveTo(55, doc.y + 4).lineTo(150, doc.y + 4).strokeColor(gold).lineWidth(0.5).stroke();
        doc.moveDown(0.5);
        const body = lines.slice(1).join("\n").trim();
        if (body) {
          doc.fontSize(9.5).fillColor("#e0e0e0").text(body, 55, doc.y + 5, { width: pw, lineGap: 4 });
        }
      } else {
        doc.fontSize(9.5).fillColor("#e0e0e0").text(section.trim(), 55, doc.y + 5, { width: pw, lineGap: 4 });
      }
    }

    doc.end();
  });

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${client.business_name.replace(/[^a-zA-Z0-9]/g, "_")}_welcome.pdf"`,
    },
  });
}

function getDefaultWelcomeContent(client: Record<string, unknown>): string {
  return `# Welcome to ShortStack
We're thrilled to have ${client.contact_name} and ${client.business_name} on board. This document outlines everything you need to know about working with us.

# What You Paid For
Your ${client.package_tier || "Growth"} package at $${(client.mrr as number)?.toLocaleString()}/month includes:
${((client.services as string[]) || []).map((s: string) => `- ${s}`).join("\n")}

# How We Plan to Help
Our strategy is tailored to your ${client.industry || "business"} industry. We'll focus on generating leads, building your online presence, and converting prospects into paying customers.

# What to Expect
Week 1-2: Onboarding, account setup, strategy development
Week 3-4: Content creation begins, ad campaigns launch
Month 2+: Optimization, scaling, and regular reporting

# Your Client Portal
Access your personalized dashboard at shortstack.work where you can track tasks, view invoices, and monitor progress.

# FAQ
Q: How often will I receive updates?
A: Weekly progress reports and monthly strategy reviews.

Q: Can I request changes to my campaign?
A: Absolutely. Use the client portal or contact your account manager directly.

Q: What if I need to pause services?
A: Contact us with 30 days notice as outlined in your contract.`;
}
