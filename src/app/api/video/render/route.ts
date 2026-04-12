import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Video Render API — creates videos using Remotion or Creatomate
// Remotion: self-hosted on Railway for full control
// Creatomate: cloud API for template-based renders
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type, title, script, style, duration, aspect_ratio, client_id, template_id, plan_only } = await request.json();

  // Option 1: Remotion (self-hosted on Railway) — skip if plan_only
  const remotionUrl = process.env.REMOTION_RENDER_URL || "https://shortstack-remotion-production.up.railway.app";
  if (remotionUrl && !template_id && !plan_only) {
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
          result: { url: data.url, render_id: data.renderId, source: "remotion" },
        });
        return NextResponse.json({ success: true, source: "remotion", url: data.url, render_id: data.renderId });
      }
    } catch {}
  }

  // Option 2: Creatomate (cloud template rendering)
  const creatomateKey = process.env.CREATOMATE_API_KEY;
  if (creatomateKey && template_id) {
    try {
      const res = await fetch("https://api.creatomate.com/v1/renders", {
        method: "POST",
        headers: { Authorization: `Bearer ${creatomateKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id,
          modifications: { "Title.text": title, "Script.text": script },
          output_format: "mp4",
        }),
      });
      const data = await res.json();
      return NextResponse.json({ success: true, source: "creatomate", render_id: data[0]?.id, url: data[0]?.url, status: data[0]?.status });
    } catch {}
  }

  // Option 3: Higgsfield AI Video Generation (cloud API)
  const higgsKey = process.env.HIGGSFIELD_API_KEY;
  if (higgsKey && !plan_only) {
    try {
      const model = type === "ad" ? "kling-v2.5-t2v" : "seedance-v2.0-t2v";
      const res = await fetch("https://api.higgsfield.ai/v1/generate/video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${higgsKey}`,
        },
        body: JSON.stringify({
          model,
          prompt: script || `Create a ${duration || 30}-second ${style || "modern"} video: ${title}`,
          aspect_ratio: aspect_ratio || "9:16",
          duration: Math.min(duration || 10, 25),
          quality: "high",
        }),
      });
      const data = await res.json();
      if (data.id || data.url || data.video_url) {
        await supabase.from("trinity_log").insert({
          action_type: "content",
          description: `AI Video generated via Higgsfield: ${title}`,
          client_id: client_id || null,
          status: "completed",
          result: { url: data.url || data.video_url, generation_id: data.id, model, source: "higgsfield" },
        });
        return NextResponse.json({
          success: true,
          source: "higgsfield",
          url: data.url || data.video_url,
          generation_id: data.id,
          model,
          status: data.status || "completed",
        });
      }
    } catch {}
  }

  // Option 4: Generate video concept with AI (no rendering, just the plan)
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: `Create a detailed video production plan for a ${duration || 30}-second ${type || "social media"} video. Title: "${title}". Script: "${script || "needs script"}". Style: ${style || "modern"}. Aspect ratio: ${aspect_ratio || "9:16"}. Include: shot list, timing, text overlays, music suggestions, transitions. Plain text, no markdown.`,
          }],
        }),
      });
      const data = await res.json();
      return NextResponse.json({
        success: true,
        source: "ai-plan",
        plan: data.content?.[0]?.text || "",
        message: "Video plan generated. Add REMOTION_RENDER_URL or CREATOMATE_API_KEY for actual video rendering.",
      });
    } catch {}
  }

  return NextResponse.json({ error: "No video service configured" }, { status: 500 });
}
