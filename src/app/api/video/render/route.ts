import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// Video Render API — Remotion (primary) + Higgsfield open-source (AI generation)
// Remotion: self-hosted on Railway for template/composition renders
// Higgsfield: self-hosted open-source diffusion model for AI text-to-video
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type, title, script, style, duration, aspect_ratio, client_id, plan_only } = await request.json();

  // Option 1: Remotion (self-hosted on Railway) — skip if plan_only
  const remotionUrl = process.env.REMOTION_RENDER_URL || "https://shortstack-remotion-production.up.railway.app";
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
          result: { url: data.url, render_id: data.renderId, source: "remotion" },
        });
        return NextResponse.json({ success: true, source: "remotion", url: data.url, render_id: data.renderId });
      }
    } catch {}
  }

  // Option 2: Higgsfield on RunPod Serverless (open-source AI video generation)
  // Deploy from: deploy/higgsfield/ → RunPod serverless endpoint
  const higgsUrl = process.env.HIGGSFIELD_URL;
  const runpodKey = process.env.RUNPOD_API_KEY;
  if (higgsUrl && runpodKey && !plan_only) {
    try {
      // RunPod serverless: POST /run to start, returns job ID
      const res = await fetch(`${higgsUrl}/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${runpodKey}`,
        },
        body: JSON.stringify({
          input: {
            prompt: script || `Create a ${duration || 30}-second ${style || "modern"} video: ${title}`,
            aspect_ratio: aspect_ratio || "9:16",
            num_frames: Math.min((duration || 10) * 8, 120),
            guidance_scale: 7.5,
            negative_prompt: "blurry, low quality, distorted, watermark",
          },
        }),
      });
      const job = await res.json();

      // If completed synchronously (fast enough)
      if (job.status === "COMPLETED" && job.output) {
        const data = job.output;
        await supabase.from("trinity_log").insert({
          action_type: "content",
          description: `AI Video generated via Higgsfield: ${title}`,
          client_id: client_id || null,
          status: "completed",
          result: { url: data.url, generation_id: data.id, source: "higgsfield" },
        });
        return NextResponse.json({
          success: true, source: "higgsfield", url: data.url, generation_id: data.id, status: "completed",
        });
      }

      // If queued/in-progress, return the job ID for polling
      if (job.id) {
        return NextResponse.json({
          success: true,
          source: "higgsfield",
          job_id: job.id,
          status_url: `${higgsUrl}/status/${job.id}`,
          status: job.status || "IN_QUEUE",
        });
      }
    } catch {}
  }

  // Option 3: Generate video concept with AI (no rendering, just the plan)
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
        message: "Video plan generated. Set REMOTION_RENDER_URL or HIGGSFIELD_URL for actual video rendering.",
      });
    } catch {}
  }

  return NextResponse.json({ error: "No video service configured" }, { status: 500 });
}
