import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { checkAiRateLimit } from "@/lib/api-rate-limit";

// ── VIDEO STYLE PROMPT SYSTEM ──
// Optimized for social media viral content, cinematic quality, platform-specific aesthetics

const VIDEO_STYLE_PROMPTS: Record<string, string> = {
  "modern-dark":
    "sleek modern dark aesthetic, deep blacks with vibrant accent colors, clean motion graphics, " +
    "subtle neon glow effects, smooth camera movements, professional corporate energy, " +
    "glass morphism elements, gradient overlays, premium tech brand feel",
  "clean-white":
    "bright clean white minimalist aesthetic, soft natural lighting, airy open spaces, " +
    "gentle floating animations, professional and trustworthy, subtle shadows, " +
    "apple-style product presentation, crisp and modern",
  "bold-gradient":
    "vibrant bold color gradients flowing through the scene, dynamic color transitions, " +
    "energetic and eye-catching, festival energy, saturated colors bleeding together, " +
    "modern creative agency feel, paint splash effects",
  "neon":
    "cyberpunk neon aesthetic, dark environment with intense neon lighting, " +
    "electric blues and hot pinks, holographic effects, futuristic city vibes, " +
    "glowing edge lighting, laser effects, matrix-style energy",
  "minimal":
    "ultra minimalist design in motion, single subject focus, vast negative space, " +
    "subtle elegant animations, quiet sophistication, scandinavian design influence, " +
    "muted color palette, slow purposeful camera movements",
  "corporate":
    "professional corporate video, confident business setting, office environment, " +
    "steady smooth camera work, blue and gray color tones, trust and authority, " +
    "clean data visualization, handshake energy, success imagery",
  "retro":
    "nostalgic retro 80s VHS aesthetic, film grain overlay, warm vintage color grading, " +
    "scan lines, chromatic aberration, synthwave sunset gradients, " +
    "cassette tape era vibes, neon palm trees, pixel art elements",
  "cinematic":
    "Hollywood cinematic quality, dramatic volumetric lighting, lens flares, " +
    "shallow depth of field, anamorphic widescreen, epic sweeping camera movements, " +
    "color graded teal and orange, film grain texture, blockbuster movie trailer energy",
};

const VIDEO_TYPE_PROMPTS: Record<string, string> = {
  reel: "fast-paced vertical video, quick cuts, trending social media content, hook in first second, dynamic transitions, text overlays appearing with impact",
  youtube: "engaging horizontal video, professional YouTube content, varied shot compositions, b-roll cutaways, talking head segments, graphic lower thirds",
  ad: "high-converting advertisement, product showcase, bold call-to-action moment, before-and-after transformation, urgency and value proposition",
  story: "immersive full-screen vertical content, casual authentic feel, close-up shots, interactive sticker-style elements, raw and real aesthetic",
  explainer: "clear educational content, step-by-step visual progression, animated diagrams, screen recordings with highlights, friendly approachable tone",
  testimonial: "authentic customer story, warm genuine lighting, real person close-up, quote highlights, emotional connection, trust-building composition",
  product_demo: "detailed product walkthrough, macro close-up shots, feature highlight animations, clean studio background, hands-on demonstration, zoom effects",
  carousel_video: "multi-scene carousel format, clear scene transitions, numbered slides, swipe-through energy, each frame tells a complete point",
};

const MUSIC_MOOD_PROMPTS: Record<string, string> = {
  upbeat: "energetic upbeat rhythmic pacing, quick dynamic cuts on beat drops, bouncy motion",
  motivational: "inspiring building momentum, slow motion hero shots, crescendo pacing, triumph energy",
  chill: "relaxed smooth flow, gentle floating movements, soft transitions, laid-back California vibes",
  dramatic: "dramatic tension build, slow revealing shots, high contrast moments, epic reveal",
  corporate: "steady professional rhythm, clean structured pacing, confidence and trust",
  trendy: "TikTok trending energy, viral dance challenge vibes, fast zooms, bass drops",
  emotional: "heartfelt emotional pacing, slow intimate close-ups, warm golden light, genuine moments",
  none: "",
};

// Use self-hosted LLM to enhance video prompts
async function enhanceVideoPrompt(
  title: string,
  script: string,
  style: string,
  type: string,
  musicMood: string
): Promise<string | null> {
  const runpodUrl = process.env.RUNPOD_LLM_URL;
  const runpodKey = process.env.RUNPOD_API_KEY;
  if (!runpodUrl || !runpodKey) return null;

  try {
    const res = await fetch(`${runpodUrl}/runsync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${runpodKey}`,
      },
      body: JSON.stringify({
        input: {
          messages: [
            {
              role: "system",
              content:
                "You are a viral video prompt engineer for AI video generation. " +
                "Convert the user's video concept into a detailed visual prompt that creates " +
                "eye-catching, scroll-stopping social media video content. Focus on: dramatic lighting, " +
                "smooth camera movements, bold colors, strong visual storytelling, cinematic quality. " +
                "Keep it under 80 words. Only output the prompt, nothing else.",
            },
            {
              role: "user",
              content: `Create a video prompt for: "${title}". Script: "${script || "none"}". Style: ${style}. Type: ${type}. Mood: ${musicMood}`,
            },
          ],
          max_tokens: 200,
          temperature: 0.7,
        },
      }),
    });
    const data = await res.json();
    const enhanced = data?.output?.choices?.[0]?.message?.content;
    return enhanced && enhanced.length > 20 ? enhanced.trim() : null;
  } catch {
    return null;
  }
}

function buildVideoPrompt(opts: {
  title: string;
  script?: string;
  style?: string;
  type?: string;
  musicMood?: string;
  enhancedPrompt?: string | null;
}): string {
  const parts: string[] = [];

  // AI-enhanced prompt or fallback
  if (opts.enhancedPrompt) {
    parts.push(opts.enhancedPrompt);
  } else {
    parts.push(opts.script || `${opts.style || "modern"} style video: ${opts.title}`);
  }

  // Video type specifics
  if (opts.type && VIDEO_TYPE_PROMPTS[opts.type]) {
    parts.push(VIDEO_TYPE_PROMPTS[opts.type]);
  }

  // Style aesthetics
  if (opts.style && VIDEO_STYLE_PROMPTS[opts.style]) {
    parts.push(VIDEO_STYLE_PROMPTS[opts.style]);
  }

  // Music mood pacing
  if (opts.musicMood && MUSIC_MOOD_PROMPTS[opts.musicMood]) {
    parts.push(MUSIC_MOOD_PROMPTS[opts.musicMood]);
  }

  // Universal quality boosters for video
  parts.push(
    "ultra high quality video, smooth 24fps cinematic motion, " +
    "professional color grading, sharp detailed frames, " +
    "broadcast quality production value, trending viral content"
  );

  return parts.join(", ");
}

// ── ROUTE HANDLER ──
// Remotion (template renders) → Mochi on RunPod (AI text-to-video) → AI Plan fallback

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("plan_tier").eq("id", user.id).single();
  const limited = checkAiRateLimit(user.id, profile?.plan_tier);
  if (limited) return limited;

  const {
    type,
    title,
    script,
    style,
    duration,
    aspect_ratio,
    client_id,
    plan_only,
    music_mood,
  } = await request.json();

  // Option 1: Remotion (self-hosted on Railway) — skip if plan_only
  const remotionUrl =
    process.env.REMOTION_RENDER_URL ||
    "https://shortstack-remotion-production.up.railway.app";
  if (remotionUrl && !plan_only) {
    try {
      const res = await fetch(`${remotionUrl}/api/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          composition: type || "social-video",
          inputProps: {
            title: title || "Untitled",
            script: script || "",
            style: style || "modern-dark",
            duration: duration || 30,
            aspectRatio: aspect_ratio || "9:16",
          },
        }),
      });
      const data = await res.json();
      if (data.url || data.renderId) {
        await supabase.from("trinity_log").insert({
          action_type: "content",
          description: `Video rendered: ${title}`,
          client_id: client_id || null,
          status: "completed",
          result: {
            url: data.url,
            render_id: data.renderId,
            source: "remotion",
          },
        });
        return NextResponse.json({
          success: true,
          source: "remotion",
          url: data.url,
          render_id: data.renderId,
        });
      }
    } catch {}
  }

  // Option 2: Mochi Video Generator on RunPod Serverless (AI text-to-video)
  const videoUrl = process.env.HIGGSFIELD_URL;
  const runpodKey = process.env.RUNPOD_API_KEY;
  if (videoUrl && runpodKey && !plan_only) {
    try {
      // Map aspect ratio to Mochi-compatible dimensions
      let vidWidth = 848,
        vidHeight = 480;
      if (aspect_ratio === "9:16") {
        vidWidth = 480;
        vidHeight = 848;
      } else if (aspect_ratio === "1:1") {
        vidWidth = 480;
        vidHeight = 480;
      } else if (aspect_ratio === "4:5") {
        vidWidth = 480;
        vidHeight = 600;
      }

      // Enhance prompt with self-hosted LLM first
      const enhancedPrompt = await enhanceVideoPrompt(
        title || "Untitled",
        script || "",
        style || "modern-dark",
        type || "reel",
        music_mood || "upbeat"
      );

      const fullVideoPrompt = buildVideoPrompt({
        title: title || "Untitled",
        script,
        style,
        type,
        musicMood: music_mood,
        enhancedPrompt,
      });

      const res = await fetch(`${videoUrl}/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${runpodKey}`,
        },
        body: JSON.stringify({
          input: {
            positive_prompt: fullVideoPrompt,
            negative_prompt:
              "blurry, low quality, distorted, watermark, text overlay, ugly, " +
              "static image, frozen, no motion, still frame, amateur video, " +
              "shaky camera, overexposed, underexposed, color banding, " +
              "compression artifacts, pixelated, low resolution, noisy grain",
            width: vidWidth,
            height: vidHeight,
            seed: Math.floor(Math.random() * 2147483647),
            steps: 40,
            cfg: 6,
            num_frames: Math.min(Math.max((duration || 5) * 6, 19), 31),
            vae: {
              enable_vae_tiling: false,
              tile_sample_min_width: 312,
              tile_sample_min_height: 160,
            },
          },
        }),
      });
      const job = await res.json();

      // If completed synchronously
      if (job.status === "COMPLETED" && job.output) {
        const data = job.output;
        const videoResultUrl = data.result || data.video_url || data.url;
        await supabase.from("trinity_log").insert({
          action_type: "content",
          description: `AI Video generated via Mochi: ${title}`,
          client_id: client_id || null,
          status: "completed",
          result: {
            url: videoResultUrl,
            generation_id: job.id,
            source: "mochi",
          },
        });
        return NextResponse.json({
          success: true,
          source: "mochi",
          url: videoResultUrl,
          generation_id: job.id,
          status: "completed",
        });
      }

      // If queued/in-progress, return job ID for polling
      if (job.id) {
        return NextResponse.json({
          success: true,
          source: "mochi",
          job_id: job.id,
          status_url: `/api/video/status?job_id=${job.id}`,
          status: job.status || "IN_QUEUE",
        });
      }
    } catch {}
  }

  // Option 3: Generate video plan with AI (self-hosted LLM first, Claude fallback)
  // Try self-hosted LLM first to save Claude tokens
  const llmUrl = process.env.RUNPOD_LLM_URL;
  if (llmUrl && runpodKey) {
    try {
      const res = await fetch(`${llmUrl}/runsync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${runpodKey}`,
        },
        body: JSON.stringify({
          input: {
            messages: [
              {
                role: "system",
                content:
                  "You are an expert video producer and social media content strategist. " +
                  "Create detailed, actionable video production plans that result in viral content. " +
                  "Focus on hooks, pacing, visual storytelling, trending techniques, and platform-specific best practices. " +
                  "Format: clear sections with shot list, timing, text overlays, music suggestions, transitions.",
              },
              {
                role: "user",
                content:
                  `Create a detailed production plan for a ${duration || 30}-second ${type || "social media"} video.\n` +
                  `Title: "${title}"\n` +
                  `Script: "${script || "needs script"}"\n` +
                  `Style: ${style || "modern"}\n` +
                  `Aspect ratio: ${aspect_ratio || "9:16"}\n` +
                  `Music mood: ${music_mood || "upbeat"}\n` +
                  `Include: opening hook (first 1-3 seconds), shot list with exact timing, ` +
                  `text overlay copy, music/SFX suggestions, transitions between scenes, ` +
                  `call-to-action placement, and platform-specific optimization tips.`,
              },
            ],
            max_tokens: 1500,
            temperature: 0.7,
          },
        }),
      });
      const data = await res.json();
      const plan = data?.output?.choices?.[0]?.message?.content;
      if (plan && plan.length > 50) {
        return NextResponse.json({
          success: true,
          source: "ai-plan",
          plan,
          message:
            "Video plan generated via self-hosted AI. Click Render to generate the actual video.",
        });
      }
    } catch {}
  }

  // Fallback: Claude API for complex plans
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
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1500,
          messages: [
            {
              role: "user",
              content:
                `Create a detailed, actionable video production plan for a ${duration || 30}-second ${type || "social media"} video.\n` +
                `Title: "${title}"\n` +
                `Script: "${script || "needs script"}"\n` +
                `Style: ${style || "modern"}\n` +
                `Aspect ratio: ${aspect_ratio || "9:16"}\n` +
                `Music mood: ${music_mood || "upbeat"}\n\n` +
                `Structure your response as:\n` +
                `HOOK (0-3s): How to grab attention instantly\n` +
                `SCENE BREAKDOWN: Shot-by-shot with exact timestamps, camera angles, visual descriptions\n` +
                `TEXT OVERLAYS: Exact copy for each text that appears on screen\n` +
                `MUSIC & SFX: Specific suggestions for background music and sound effects\n` +
                `TRANSITIONS: How each scene connects to the next\n` +
                `CTA: Call-to-action placement and copy\n` +
                `PLATFORM TIPS: Specific optimization advice for ${type || "social media"}\n` +
                `Keep it practical and actionable. Plain text, no markdown.`,
            },
          ],
        }),
      });
      const data = await res.json();
      return NextResponse.json({
        success: true,
        source: "ai-plan",
        plan: data.content?.[0]?.text || "",
        message: "Video plan generated. Click Render to create the actual video.",
      });
    } catch {}
  }

  return NextResponse.json(
    { error: "No video service configured" },
    { status: 500 }
  );
}
