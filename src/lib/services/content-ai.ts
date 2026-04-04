// Content AI Agent — Generates scripts, briefs, SEO metadata, and personal brand ideas

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
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI API key not configured");

  const isLongForm = params.scriptType === "long_form";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a content strategist for ShortStack digital marketing agency. Generate ${isLongForm ? "a long-form video script (8-15 min)" : "a short-form video script (30-60 sec)"} for client "${params.clientName}". Brand voice: ${params.brandVoice || "professional and engaging"}. Return JSON.`,
        },
        {
          role: "user",
          content: `Create a ${params.scriptType} video script${params.topic ? ` about "${params.topic}"` : ""}${params.platform ? ` for ${params.platform}` : ""}. Return JSON with keys: title, hook, script_body, outline (object with sections), seo_title, description, hashtags (array of 20-30), keywords (array), chapters (object with timestamps if long form, null if short), thumbnail_idea.`,
        },
      ],
      max_tokens: 2000,
      temperature: 0.8,
      response_format: { type: "json_object" },
    }),
  });

  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}

export async function generateContentBrief(requestText: string, clientName: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return `Brief for ${clientName}: ${requestText}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a content strategist. Create a concise content brief from this request. Include: objective, key messages, target audience, format recommendation, and suggested deadline.",
        },
        {
          role: "user",
          content: `Client: ${clientName}\nRequest: ${requestText}`,
        },
      ],
      max_tokens: 500,
    }),
  });

  const data = await res.json();
  return data.choices?.[0]?.message?.content || `Brief for ${clientName}: ${requestText}`;
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
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      seo_title: params.videoTitle,
      description: `Watch this video about ${params.topic}`,
      hashtags: [`#${params.topic.replace(/\s/g, "")}`, "#shortstackagency"],
      thumbnail_text: params.videoTitle,
    };
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Generate SEO-optimized metadata for a ${params.platform} video. Adapt tone for the platform. Return JSON with: seo_title (with primary keyword), description (with secondary keywords and CTA), hashtags (20-30 platform-specific), chapters (timestamps if YouTube), thumbnail_text (short punchy text for thumbnail).`,
        },
        {
          role: "user",
          content: `Video: "${params.videoTitle}" about "${params.topic}" for ${params.platform}`,
        },
      ],
      max_tokens: 1000,
      response_format: { type: "json_object" },
    }),
  });

  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
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
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI API key not configured");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a personal brand strategist for Nicklas, founder of ShortStack digital marketing agency. Generate content ideas about: agency building, AI in marketing, making money online, ShortStack growth journey, digital marketing tips. Return JSON.`,
        },
        {
          role: "user",
          content: `Generate:
1. 5 long-form YouTube video ideas with: title, hook (compelling intro paragraph), outline (intro + 3-5 main points + outro/CTA), thumbnail_concept (text + visual idea), estimated_length, target_keyword
2. 20 short-form content ideas for TikTok/Reels/Shorts with: title, hook (first 3 seconds), core_concept (1-2 sentences), platform_recommendation (TikTok vs Reels vs Shorts), trending_angle

Return as JSON with keys: longForm (array of 5), shortForm (array of 20)`,
        },
      ],
      max_tokens: 4000,
      temperature: 0.9,
      response_format: { type: "json_object" },
    }),
  });

  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}
