// Blog & Article Generator — Claude writes, Midjourney illustrates
// Generates SEO-optimized blog posts with custom images for clients

export async function generateBlogPost(params: {
  clientName: string;
  industry: string;
  topic: string;
  keywords?: string[];
  tone?: string;
  wordCount?: number;
}): Promise<{
  title: string;
  metaDescription: string;
  content: string;
  keywords: string[];
  imagePrompts: string[];
  estimatedReadTime: string;
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("AI not configured");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system: `You are an expert SEO content writer for ${params.clientName} in the ${params.industry} industry. Write engaging, informative blog posts that rank well on Google. Include headers (H2, H3), bullet points, and natural keyword integration. Return valid JSON only.`,
      messages: [{
        role: "user",
        content: `Write a ${params.wordCount || 1500}-word blog post about: "${params.topic}"
${params.keywords ? `Target keywords: ${params.keywords.join(", ")}` : ""}
Tone: ${params.tone || "professional yet approachable"}

Return JSON with:
- title: SEO-optimized title (under 60 chars)
- metaDescription: compelling meta description (under 160 chars)
- content: full blog post in HTML format with h2, h3, p, ul/li tags
- keywords: array of target keywords used
- imagePrompts: array of 3 Midjourney prompt ideas for blog illustrations (describe the visual concept)
- estimatedReadTime: e.g. "5 min read"`,
      }],
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text || "";
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned);
}

// Generate a blog post as a premium PDF
export async function generateBlogPDF(params: {
  title: string;
  content: string;
  clientName: string;
  author?: string;
}): Promise<Buffer> {
  const PDFDocument = (await import("pdfkit")).default;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 60, bottom: 60, left: 55, right: 55 },
    });
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
    doc.fontSize(8).fillColor(gray).text(`Content for ${params.clientName}`, 55, 98);
    doc.fontSize(28).fillColor(white).text(params.title, 55, 200, { width: pw, lineGap: 8 });
    const dy = doc.y + 25;
    doc.moveTo(55, dy).lineTo(200, dy).strokeColor(gold).lineWidth(2).stroke();
    doc.fontSize(10).fillColor(gray).text(params.author || "ShortStack Content Team", 55, dy + 15);
    doc.fontSize(10).fillColor(gray).text(new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), 55, doc.y + 5);
    doc.rect(0, doc.page.height - 6, doc.page.width, 6).fill(gold);

    // Content — strip HTML tags and render
    doc.addPage();
    doc.rect(0, 0, doc.page.width, doc.page.height).fill(dark);
    doc.rect(0, 0, doc.page.width, 3).fill(gold);
    doc.rect(0, doc.page.height - 3, doc.page.width, 3).fill(gold);

    const plainText = params.content
      .replace(/<h2[^>]*>/gi, "\n\n## ")
      .replace(/<h3[^>]*>/gi, "\n\n### ")
      .replace(/<\/h[23]>/gi, "\n")
      .replace(/<li[^>]*>/gi, "\n  • ")
      .replace(/<\/li>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<p[^>]*>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ")
      .replace(/\n{3,}/g, "\n\n");

    const lines = plainText.split("\n");
    let y = 40;

    for (const line of lines) {
      if (doc.y > doc.page.height - 80) {
        doc.addPage();
        doc.rect(0, 0, doc.page.width, doc.page.height).fill(dark);
        doc.rect(0, 0, doc.page.width, 3).fill(gold);
        doc.rect(0, doc.page.height - 3, doc.page.width, 3).fill(gold);
        y = 40;
      }

      const trimmed = line.trim();
      if (trimmed.startsWith("## ")) {
        doc.fontSize(16).fillColor(gold).text(trimmed.replace("## ", ""), 55, doc.y + 15, { width: pw });
      } else if (trimmed.startsWith("### ")) {
        doc.fontSize(13).fillColor(gold).text(trimmed.replace("### ", ""), 55, doc.y + 10, { width: pw });
      } else if (trimmed.startsWith("•")) {
        doc.fontSize(10).fillColor("#e0e0e0").text(trimmed, 65, doc.y + 4, { width: pw - 10, lineGap: 3 });
      } else if (trimmed) {
        doc.fontSize(10).fillColor("#e0e0e0").text(trimmed, 55, doc.y + 4, { width: pw, lineGap: 3 });
      }
    }

    doc.end();
  });
}
