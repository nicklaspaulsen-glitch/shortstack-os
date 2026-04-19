// Custom Contract PDF Generator — Replaces PandaDoc
// Generates premium-looking contracts with ShortStack branding

export async function generateContractPDF(params: {
  clientName: string;
  clientEmail: string;
  clientBusiness: string;
  services: string[];
  packageTier: string;
  mrr: number;
  startDate: string;
  contractLength?: string;
  customTerms?: string;
}): Promise<Buffer> {
  const PDFDocument = (await import("pdfkit")).default;

  // Generate contract terms using Claude
  let contractBody = getDefaultContractBody(params);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 3000,
          system: "You are a legal document specialist for ShortStack digital marketing agency. Write professional, clear contract terms. Be specific about deliverables and payment terms. Do not include signatures — those are handled separately.",
          messages: [{
            role: "user",
            content: `Write a professional service agreement for:
Client: ${params.clientName} (${params.clientBusiness})
Services: ${params.services.join(", ")}
Package: ${params.packageTier}
Monthly Fee: $${params.mrr}
Start Date: ${params.startDate}
Duration: ${params.contractLength || "12 months"}
${params.customTerms ? `Additional Terms: ${params.customTerms}` : ""}

Include sections: Scope of Work, Deliverables, Payment Terms, Term & Termination, Confidentiality, Limitation of Liability, General Provisions.`,
          }],
        }),
      });
      const data = await res.json();
      contractBody = data.content?.[0]?.text || contractBody;
    } catch {
      // Use default
    }
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 60, bottom: 60, left: 55, right: 55 },
      info: {
        Title: `Service Agreement — ${params.clientBusiness}`,
        Author: "ShortStack Digital Marketing Agency",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const gold = "#C9A84C";
    const dark = "#0a0a0a";
    const white = "#FFFFFF";
    const gray = "#888888";
    const lightGray = "#cccccc";
    const pageWidth = doc.page.width - 110;

    // === COVER PAGE ===
    doc.rect(0, 0, doc.page.width, doc.page.height).fill(dark);
    doc.rect(0, 0, doc.page.width, 6).fill(gold);

    // Logo
    doc.fontSize(16).fillColor(gold).text("SHORTSTACK", 55, 80);
    doc.fontSize(8).fillColor(gray).text("DIGITAL MARKETING AGENCY", 55, 100);

    // Title
    doc.fontSize(36).fillColor(white).text("Service", 55, 220, { width: pageWidth });
    doc.fontSize(36).fillColor(gold).text("Agreement", 55, doc.y + 5, { width: pageWidth });

    // Divider
    const divY = doc.y + 30;
    doc.moveTo(55, divY).lineTo(220, divY).strokeColor(gold).lineWidth(2).stroke();

    // Client info
    doc.fontSize(12).fillColor(gray).text("Prepared for", 55, divY + 30);
    doc.fontSize(18).fillColor(white).text(params.clientBusiness, 55, doc.y + 5);
    doc.fontSize(11).fillColor(lightGray).text(params.clientName, 55, doc.y + 5);
    doc.fontSize(11).fillColor(lightGray).text(params.clientEmail, 55, doc.y + 3);

    // Contract meta
    doc.fontSize(10).fillColor(gray).text(`Package: ${params.packageTier}`, 55, doc.y + 25);
    doc.fontSize(10).fillColor(gray).text(`Monthly Investment: $${params.mrr.toLocaleString()}`, 55, doc.y + 5);
    doc.fontSize(10).fillColor(gray).text(`Start Date: ${params.startDate}`, 55, doc.y + 5);
    doc.fontSize(10).fillColor(gray).text(`Duration: ${params.contractLength || "12 months"}`, 55, doc.y + 5);

    // Services list
    doc.fontSize(10).fillColor(gray).text("Services Included:", 55, doc.y + 20);
    for (const service of params.services) {
      doc.fontSize(10).fillColor(gold).text(`  •  ${service}`, 55, doc.y + 4);
    }

    // Footer
    doc.fontSize(8).fillColor(gray).text("Confidential — ShortStack Agency", 55, doc.page.height - 50, {
      width: pageWidth, align: "center",
    });
    doc.rect(0, doc.page.height - 6, doc.page.width, 6).fill(gold);

    // === CONTRACT BODY PAGES ===
    const sections = contractBody.split(/\n(?=\d+\.|#{1,3}\s|[A-Z]{2,})/);

    for (const section of sections) {
      if (!section.trim()) continue;

      // Check if we need a new page
      if (doc.y > doc.page.height - 150) {
        doc.addPage();
        doc.rect(0, 0, doc.page.width, doc.page.height).fill(dark);
        doc.rect(0, 0, doc.page.width, 3).fill(gold);
        doc.rect(0, doc.page.height - 3, doc.page.width, 3).fill(gold);
        doc.fontSize(7).fillColor(gray).text("SHORTSTACK", 55, 15);
        doc.fontSize(7).fillColor(gray).text(`Service Agreement — ${params.clientBusiness}`, 55, 15, { width: pageWidth, align: "right" });
        doc.y = 40;
      }

      const lines = section.trim().split("\n");
      const firstLine = lines[0].trim();

      // Check if it's a section header
      if (firstLine.match(/^\d+\./) || firstLine.match(/^#{1,3}/) || firstLine === firstLine.toUpperCase()) {
        const headerText = firstLine.replace(/^#+\s*/, "").replace(/^\d+\.\s*/, "");
        doc.fontSize(13).fillColor(gold).text(headerText.toUpperCase(), 55, doc.y + 15, { width: pageWidth });
        doc.moveTo(55, doc.y + 4).lineTo(140, doc.y + 4).strokeColor(gold).lineWidth(0.5).stroke();
        doc.moveDown(0.5);

        // Body text
        const bodyText = lines.slice(1).join("\n").trim();
        if (bodyText) {
          doc.fontSize(9.5).fillColor(lightGray).text(bodyText, 55, doc.y + 5, {
            width: pageWidth,
            lineGap: 4,
          });
        }
      } else {
        doc.fontSize(9.5).fillColor(lightGray).text(section.trim(), 55, doc.y + 5, {
          width: pageWidth,
          lineGap: 4,
        });
      }
    }

    // === SIGNATURE PAGE ===
    doc.addPage();
    doc.rect(0, 0, doc.page.width, doc.page.height).fill(dark);
    doc.rect(0, 0, doc.page.width, 3).fill(gold);

    doc.fontSize(18).fillColor(gold).text("SIGNATURES", 55, 60, { width: pageWidth });
    doc.moveTo(55, doc.y + 8).lineTo(180, doc.y + 8).strokeColor(gold).lineWidth(1).stroke();

    doc.fontSize(10).fillColor(lightGray).text(
      "By signing below, both parties agree to the terms and conditions outlined in this Service Agreement.",
      55, doc.y + 20, { width: pageWidth, lineGap: 4 }
    );

    // ShortStack signature block
    doc.fontSize(11).fillColor(gold).text("SERVICE PROVIDER", 55, doc.y + 40);
    doc.fontSize(10).fillColor(white).text("ShortStack Digital Marketing Agency", 55, doc.y + 8);
    doc.moveDown(2);
    doc.moveTo(55, doc.y).lineTo(280, doc.y).strokeColor(gray).lineWidth(0.5).stroke();
    doc.fontSize(8).fillColor(gray).text("Signature", 55, doc.y + 5);
    doc.moveDown(1.5);
    doc.moveTo(55, doc.y).lineTo(280, doc.y).strokeColor(gray).lineWidth(0.5).stroke();
    doc.fontSize(8).fillColor(gray).text("Date", 55, doc.y + 5);

    // Client signature block
    doc.fontSize(11).fillColor(gold).text("CLIENT", 55, doc.y + 35);
    doc.fontSize(10).fillColor(white).text(`${params.clientName} — ${params.clientBusiness}`, 55, doc.y + 8);
    doc.moveDown(2);
    doc.moveTo(55, doc.y).lineTo(280, doc.y).strokeColor(gray).lineWidth(0.5).stroke();
    doc.fontSize(8).fillColor(gray).text("Signature", 55, doc.y + 5);
    doc.moveDown(1.5);
    doc.moveTo(55, doc.y).lineTo(280, doc.y).strokeColor(gray).lineWidth(0.5).stroke();
    doc.fontSize(8).fillColor(gray).text("Date", 55, doc.y + 5);

    // Footer
    doc.rect(0, doc.page.height - 6, doc.page.width, 6).fill(gold);

    doc.end();
  });
}

function getDefaultContractBody(params: {
  clientBusiness: string;
  services: string[];
  mrr: number;
  startDate: string;
  contractLength?: string;
}): string {
  return `1. SCOPE OF WORK
ShortStack Digital Marketing Agency ("Provider") agrees to provide the following digital marketing services to ${params.clientBusiness} ("Client"):
${params.services.map(s => `- ${s}`).join("\n")}

2. DELIVERABLES
The Provider will deliver monthly reports, content as specified in the service package, and maintain all active campaigns. Specific deliverables will be tracked in the Trinity client portal.

3. PAYMENT TERMS
The Client agrees to pay $${params.mrr.toLocaleString()} per month, due on the 1st of each month. Payment is due within 7 days of invoice date. Late payments may incur a 5% monthly fee.

4. TERM AND TERMINATION
This agreement begins on ${params.startDate} and continues for ${params.contractLength || "12 months"}. Either party may terminate with 30 days written notice. Early termination by Client requires payment of remaining contract balance.

5. CONFIDENTIALITY
Both parties agree to maintain confidentiality of all proprietary information, business strategies, client data, and trade secrets shared during the course of this agreement.

6. LIMITATION OF LIABILITY
Provider's total liability shall not exceed the total fees paid by Client in the 3 months preceding any claim. Provider is not liable for indirect, incidental, or consequential damages.

7. GENERAL PROVISIONS
This agreement constitutes the entire understanding between the parties. Any modifications must be in writing and signed by both parties. This agreement is governed by applicable law.`;
}
