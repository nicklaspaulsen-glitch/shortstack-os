// Midjourney Integration via Discord — Generates custom images for clients
// Used for: ad creatives, blog images, social media visuals, thumbnails

const DISCORD_API = "https://discord.com/api/v10";

interface MidjourneyRequest {
  prompt: string;
  clientName?: string;
  imageType: "ad_creative" | "blog_image" | "social_post" | "thumbnail" | "logo" | "banner";
  style?: string;
  aspectRatio?: "1:1" | "16:9" | "9:16" | "4:5";
}

interface MidjourneyResult {
  success: boolean;
  messageId?: string;
  prompt?: string;
  error?: string;
}

// Generate an optimized Midjourney prompt using Claude
export async function generateImagePrompt(params: {
  concept: string;
  imageType: string;
  clientBrand?: string;
  style?: string;
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return params.concept;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        system: `You are a Midjourney prompt engineer. Write optimized Midjourney prompts for professional marketing images.
Rules:
- Be specific about composition, lighting, and style
- Include quality parameters like --v 6.1 --q 2
- Add aspect ratio based on the image type
- Keep prompts under 200 words
- Make it photorealistic unless specified otherwise
- Return ONLY the prompt, nothing else`,
        messages: [{
          role: "user",
          content: `Create a Midjourney prompt for a ${params.imageType} image.
Concept: ${params.concept}
${params.clientBrand ? `Brand: ${params.clientBrand}` : ""}
${params.style ? `Style: ${params.style}` : "Style: professional, modern, clean"}
Aspect ratio: ${params.imageType === "ad_creative" ? "1:1" : params.imageType === "blog_image" ? "16:9" : params.imageType === "social_post" ? "4:5" : params.imageType === "thumbnail" ? "16:9" : "1:1"}`,
        }],
      }),
    });
    const data = await res.json();
    return data.content?.[0]?.text || params.concept;
  } catch {
    return params.concept;
  }
}

// Send a prompt to Midjourney via Discord bot
export async function sendMidjourneyPrompt(params: MidjourneyRequest): Promise<MidjourneyResult> {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.MIDJOURNEY_CHANNEL_ID;
  const midjourneyBotId = process.env.MIDJOURNEY_BOT_ID || "936929561302675456"; // Default MJ bot ID

  if (!botToken || !channelId) {
    return { success: false, error: "Discord bot token or Midjourney channel ID not configured" };
  }

  // Generate optimized prompt with Claude
  const optimizedPrompt = await generateImagePrompt({
    concept: params.prompt,
    imageType: params.imageType,
    clientBrand: params.clientName,
    style: params.style,
  });

  try {
    // Send /imagine command to Midjourney channel
    const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: `/imagine prompt: ${optimizedPrompt}`,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: `Discord error: ${err}` };
    }

    const msg = await res.json();
    return { success: true, messageId: msg.id, prompt: optimizedPrompt };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// Alternative: Use a Midjourney API wrapper service
export async function generateImageViaAPI(params: MidjourneyRequest): Promise<{
  success: boolean;
  imageUrl?: string;
  prompt?: string;
  error?: string;
}> {
  const apiKey = process.env.MIDJOURNEY_API_KEY; // For services like GoAPI, ImagineAPI

  if (!apiKey) {
    // Fallback to Discord method
    const discordResult = await sendMidjourneyPrompt(params);
    return { success: discordResult.success, prompt: discordResult.prompt, error: discordResult.error };
  }

  const optimizedPrompt = await generateImagePrompt({
    concept: params.prompt,
    imageType: params.imageType,
    clientBrand: params.clientName,
    style: params.style,
  });

  const aspectMap: Record<string, string> = {
    "1:1": "1:1",
    "16:9": "16:9",
    "9:16": "9:16",
    "4:5": "4:5",
  };

  try {
    // GoAPI / ImagineAPI compatible endpoint
    const res = await fetch("https://api.goapi.ai/mj/v2/imagine", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({
        prompt: optimizedPrompt,
        aspect_ratio: aspectMap[params.aspectRatio || "1:1"] || "1:1",
        process_mode: "fast",
      }),
    });

    const data = await res.json();

    if (data.task_id) {
      // Poll for result
      let attempts = 0;
      while (attempts < 30) {
        await new Promise(r => setTimeout(r, 10000));
        const statusRes = await fetch(`https://api.goapi.ai/mj/v2/fetch/${data.task_id}`, {
          headers: { "X-API-Key": apiKey },
        });
        const status = await statusRes.json();

        if (status.status === "finished" && status.task_result?.image_url) {
          return { success: true, imageUrl: status.task_result.image_url, prompt: optimizedPrompt };
        }
        if (status.status === "failed") {
          return { success: false, error: status.error || "Image generation failed", prompt: optimizedPrompt };
        }
        attempts++;
      }
      return { success: false, error: "Timed out waiting for image", prompt: optimizedPrompt };
    }

    return { success: false, error: data.message || "Unknown error" };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// Generate a batch of images for a client (ad set, blog series, etc.)
export async function generateClientImageBatch(params: {
  clientName: string;
  industry: string;
  concepts: string[];
  imageType: MidjourneyRequest["imageType"];
  style?: string;
}): Promise<Array<{ concept: string; prompt: string; success: boolean; imageUrl?: string }>> {
  const results: Array<{ concept: string; prompt: string; success: boolean; imageUrl?: string }> = [];

  for (const concept of params.concepts) {
    const result = await generateImageViaAPI({
      prompt: concept,
      clientName: params.clientName,
      imageType: params.imageType,
      style: params.style || `professional ${params.industry} marketing`,
    });

    results.push({
      concept,
      prompt: result.prompt || concept,
      success: result.success,
      imageUrl: result.imageUrl,
    });

    // Rate limit between requests
    await new Promise(r => setTimeout(r, 2000));
  }

  return results;
}
