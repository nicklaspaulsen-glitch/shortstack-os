// Content AI Agent — Powered by Claude (Anthropic)
// Generates scripts, briefs, SEO metadata, personal brand ideas, and premium PDF documents

async function callClaude(systemPrompt: string, userPrompt: string, maxTokens = 2000): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Anthropic API key not configured");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text;
  if (!text) throw new Error("No response from Claude");
  return text;
}

async function callClaudeJSON<T>(systemPrompt: string, userPrompt: string, maxTokens = 2000): Promise<T> {
  const text = await callClaude(
    systemPrompt + "\n\nIMPORTANT: Respond with valid JSON only. No markdown, no code blocks, just raw JSON.",
    userPrompt,
    maxTokens
  );
  // Strip any markdown code blocks if present
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned);
}

export async function generateContentScript(params: {
  clientName: string;
  brandVoice: string;
  scriptType: "long_form" | "short_form";
  topic?: string;
  platform?: string;
}): Promise<{
  title: string;
  hook: string;
  script_body: string;
  outline: Record<string, unknown>;
  seo_title: string;
  description: string;
  hashtags: string[];
  keywords: string[];
  chapters: Record<string, unknown> | null;
  thumbnail_idea: string;
}> {
  const isLongForm = params.scriptType === "long_form";

  return callClaudeJSON(
    `You are a premium content strategist for ShortStack digital marketing agency. Generate ${isLongForm ? "a long-form video script (8-15 min)" : "a short-form video script (30-60 sec)"} for client "${params.clientName}". Brand voice: ${params.brandVoice || "professional and engaging"}.`,
    `Create a ${params.scriptType} video script${params.topic ? ` about "${params.topic}"` : ""}${params.platform ? ` for ${params.platform}` : ""}. Return JSON with keys: title, hook, script_body (full script text), outline (object with sections), seo_title, description, hashtags (array of 20-30), keywords (array), chapters (object with timestamps if long form, null if short), thumbnail_idea.`,
    3000
  );
}

export async function generateContentBrief(requestText: string, clientName: string): Promise<string> {
  try {
    return await callClaude(
      "You are a content strategist for ShortStack agency. Create a concise, professional content brief. Include: objective, key messages, target audience, format recommendation, and suggested deadline.",
      `Client: ${clientName}\nRequest: ${requestText}`,
      500
    );
  } catch {
    return `Brief for ${clientName}: ${requestText}`;
  }
}

export async function generateSEOMetadata(params: {
  videoTitle: string;
  platform: string;
  topic: string;
}): Promise<{
  seo_title: string;
  description: string;
  hashtags: string[];
  chapters?: Record<string, string>;
  thumbnail_text: string;
}> {
  try {
    return await callClaudeJSON(
      `Generate SEO-optimized metadata for a ${params.platform} video. Adapt tone and hashtag strategy for the specific platform.`,
      `Video: "${params.videoTitle}" about "${params.topic}" for ${params.platform}. Return JSON with: seo_title (with primary keyword), description (with secondary keywords and CTA), hashtags (20-30 platform-specific), chapters (timestamps if YouTube, omit otherwise), thumbnail_text (short punchy text for thumbnail).`,
      1000
    );
  } catch {
    return {
      seo_title: params.videoTitle,
      description: `Watch this video about ${params.topic}`,
      hashtags: [`#${params.topic.replace(/\s/g, "")}`, "#shortstackagency"],
      thumbnail_text: params.videoTitle,
    };
  }
}

export async function generatePersonalBrandIdeas(): Promise<{
  longForm: Array<{
    title: string;
    hook: string;
    outline: Record<string, unknown>;
    thumbnail_concept: string;
    estimated_length: string;
    target_keyword: string;
  }>;
  shortForm: Array<{
    title: string;
    hook: string;
    core_concept: string;
    platform_recommendation: string;
    trending_angle: string;
  }>;
}> {
  return callClaudeJSON(
    `You are a personal brand strategist for Nicklas, founder of ShortStack digital marketing agency. Generate content ideas about: agency building, AI in marketing, making money online, ShortStack growth journey, digital marketing tips.`,
    `Generate:
1. 5 long-form YouTube video ideas with: title, hook (compelling intro paragraph), outline (intro + 3-5 main points + outro/CTA), thumbnail_concept (text + visual idea), estimated_length, target_keyword
2. 20 short-form content ideas for TikTok/Reels/Shorts with: title, hook (first 3 seconds), core_concept (1-2 sentences), platform_recommendation (TikTok vs Reels vs Shorts), trending_angle

Return as JSON with keys: longForm (array of 5), shortForm (array of 20)`,
    4000
  );
}

// ============================================
// Premium PDF Script Generator
// ============================================

export async function generateScriptPDF(script: {
  title: string;
  client_name?: string;
  script_type: string;
  hook?: string;
  script_body?: string;
  outline?: Record<string, unknown>;
  seo_title?: string;
  description?: string;
  hashtags?: string[];
  keywords?: string[];
  thumbnail_idea?: string;
}): Promise<Buffer> {
  const PDFDocument = (await import("pdfkit")).default;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 60, bottom: 60, left: 50, right: 50 },
      info: {
        Title: script.title,
        Author: "ShortStack Digital Marketing Agency",
        Creator: "Trinity",
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
    const pageWidth = doc.page.width - 100;

    // === COVER PAGE ===
    // Dark background
    doc.rect(0, 0, doc.page.width, doc.page.height).fill(dark);

    // Gold accent bar at top
    doc.rect(0, 0, doc.page.width, 6).fill(gold);

    // Logo area
    doc.fontSize(14).fillColor(gold).text("SHORTSTACK", 50, 80, { align: "left" });
    doc.fontSize(8).fillColor(gray).text("DIGITAL MARKETING AGENCY", 50, 98, { align: "left" });

    // Title
    doc.moveDown(6);
    doc.fontSize(32).fillColor(white).text(script.title, 50, 220, {
      width: pageWidth,
      align: "left",
      lineGap: 8,
    });

    // Divider
    const titleBottom = doc.y + 20;
    doc.moveTo(50, titleBottom).lineTo(200, titleBottom).strokeColor(gold).lineWidth(2).stroke();

    // Meta info
    doc.fontSize(11).fillColor(gray);
    doc.text(`Script Type: ${script.script_type === "long_form" ? "Long Form" : "Short Form"}`, 50, titleBottom + 20);
    if (script.client_name) {
      doc.text(`Client: ${script.client_name}`, 50, doc.y + 5);
    }
    doc.text(`Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, 50, doc.y + 5);

    // Footer on cover
    doc.fontSize(8).fillColor(gray).text("Confidential — Trinity", 50, doc.page.height - 60, {
      width: pageWidth,
      align: "center",
    });

    // Gold bar at bottom
    doc.rect(0, doc.page.height - 6, doc.page.width, 6).fill(gold);

    // === CONTENT PAGES ===
    const addContentPage = () => {
      doc.addPage();
      doc.rect(0, 0, doc.page.width, doc.page.height).fill(dark);
      doc.rect(0, 0, doc.page.width, 4).fill(gold);
      doc.rect(0, doc.page.height - 4, doc.page.width, 4).fill(gold);

      // Header
      doc.fontSize(8).fillColor(gray).text("SHORTSTACK", 50, 20);
      doc.fontSize(8).fillColor(gray).text(script.title, 50, 20, { width: pageWidth, align: "right" });
      doc.moveTo(50, 38).lineTo(doc.page.width - 50, 38).strokeColor("#2a2a2a").lineWidth(0.5).stroke();

      return 55; // starting Y position for content
    };

    const sectionHeader = (title: string, y?: number) => {
      const startY = y || doc.y + 25;
      doc.fontSize(16).fillColor(gold).text(title, 50, startY, { width: pageWidth });
      doc.moveTo(50, doc.y + 5).lineTo(150, doc.y + 5).strokeColor(gold).lineWidth(1).stroke();
      doc.moveDown(0.8);
    };

    // Hook section
    if (script.hook) {
      const y = addContentPage();
      sectionHeader("THE HOOK", y);
      doc.fontSize(12).fillColor(white).text(script.hook, 50, doc.y, {
        width: pageWidth,
        lineGap: 6,
      });
    }

    // Script body
    if (script.script_body) {
      const y = addContentPage();
      sectionHeader("FULL SCRIPT", y);
      doc.fontSize(10).fillColor("#e0e0e0").text(script.script_body, 50, doc.y, {
        width: pageWidth,
        lineGap: 5,
      });
    }

    // Outline
    if (script.outline && Object.keys(script.outline).length > 0) {
      const y = addContentPage();
      sectionHeader("OUTLINE", y);
      for (const [key, value] of Object.entries(script.outline)) {
        doc.fontSize(11).fillColor(gold).text(`${key}`, 50, doc.y + 8);
        doc.fontSize(10).fillColor("#cccccc").text(String(value), 70, doc.y + 4, {
          width: pageWidth - 20,
          lineGap: 4,
        });
      }
    }

    // SEO & Metadata page
    if (script.seo_title || script.description || script.hashtags) {
      const y = addContentPage();
      sectionHeader("SEO & METADATA", y);

      if (script.seo_title) {
        doc.fontSize(10).fillColor(gray).text("SEO Title", 50, doc.y + 10);
        doc.fontSize(11).fillColor(white).text(script.seo_title, 50, doc.y + 4, { width: pageWidth });
      }

      if (script.description) {
        doc.fontSize(10).fillColor(gray).text("Description", 50, doc.y + 15);
        doc.fontSize(10).fillColor("#cccccc").text(script.description, 50, doc.y + 4, {
          width: pageWidth,
          lineGap: 4,
        });
      }

      if (script.keywords && script.keywords.length > 0) {
        doc.fontSize(10).fillColor(gray).text("Keywords", 50, doc.y + 15);
        doc.fontSize(10).fillColor(gold).text(script.keywords.join(", "), 50, doc.y + 4, { width: pageWidth });
      }

      if (script.hashtags && script.hashtags.length > 0) {
        doc.fontSize(10).fillColor(gray).text("Hashtags", 50, doc.y + 15);
        doc.fontSize(9).fillColor("#aaaaaa").text(script.hashtags.join("  "), 50, doc.y + 4, {
          width: pageWidth,
          lineGap: 3,
        });
      }

      if (script.thumbnail_idea) {
        doc.fontSize(10).fillColor(gray).text("Thumbnail Concept", 50, doc.y + 15);
        doc.fontSize(10).fillColor(white).text(script.thumbnail_idea, 50, doc.y + 4, { width: pageWidth });
      }
    }

    doc.end();
  });
}
