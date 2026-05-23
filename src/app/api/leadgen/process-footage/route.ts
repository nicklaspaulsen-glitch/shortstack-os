import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendDM as zernioDM } from "@/lib/services/zernio";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/leadgen/process-footage
 *
 * Called when a lead in the "scripting" stage sends footage via DM.
 * Orchestrates the full editing pipeline:
 *
 *   1. Determine content type:
 *      - footage_url present → real footage → /api/video/auto-edit/full-pass
 *      - no footage_url but text says "AI" / "generate" → AI-generated video
 *        (routed to the AI video gen pipeline — stub for now)
 *
 *   2. If needs_thumbnail is true, fire /api/thumbnail/generate in parallel.
 *
 *   3. When auto-edit finishes (best-effort — we use a background job approach):
 *      fire /api/leadgen/deliver with the output URL.
 *
 * Auth: WEBHOOK_SECRET (called from webhooks/zernio handler)
 *
 * Body:
 *   lead_id       string   — lead_pipeline.id
 *   owner_id      string   — agency owner user_id
 *   footage_url   string   — URL to the footage the lead sent
 *   needs_thumbnail? boolean — whether to also generate a thumbnail
 *   brief?        string   — optional text instructions from the lead
 *   attachments?  Array<{url,type,filename}> — raw attachment list
 */

interface ProcessFootageBody {
  lead_id: string;
  owner_id: string;
  footage_url: string;
  needs_thumbnail?: boolean;
  brief?: string;
  attachments?: Array<{ url: string; type?: string; filename?: string }>;
}

function isVideoAttachment(a: { url: string; type?: string; filename?: string }): boolean {
  if (a.type && a.type.startsWith("video/")) return true;
  if (a.filename) {
    const ext = a.filename.split(".").pop()?.toLowerCase() ?? "";
    return ["mp4", "mov", "avi", "webm", "mkv", "m4v"].includes(ext);
  }
  // Fall back to URL extension
  const urlExt = a.url.split(".").pop()?.split("?")[0].toLowerCase() ?? "";
  return ["mp4", "mov", "avi", "webm", "mkv", "m4v"].includes(urlExt);
}

function isAiGeneratedRequest(brief?: string): boolean {
  if (!brief) return false;
  const lower = brief.toLowerCase();
  return (
    lower.includes("ai generat") ||
    lower.includes("generate") ||
    lower.includes("create") ||
    lower.includes("make a video")
  );
}

export async function POST(request: NextRequest) {
  // Auth
  const key =
    request.headers.get("x-webhook-key") ||
    new URL(request.url).searchParams.get("key");
  const expectedKey = process.env.WEBHOOK_SECRET;
  if (!expectedKey) {
    return NextResponse.json({ error: "WEBHOOK_SECRET not configured" }, { status: 503 });
  }
  if (!key || key !== expectedKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ProcessFootageBody;
  try {
    body = (await request.json()) as ProcessFootageBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { lead_id, owner_id, footage_url, needs_thumbnail, brief, attachments = [] } = body;
  if (!lead_id || !owner_id) {
    return NextResponse.json({ error: "lead_id and owner_id required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: lead } = await supabase
    .from("lead_pipeline")
    .select("id, stage, display_name, handle, platform, generated_content, owner_id")
    .eq("id", lead_id)
    .eq("owner_id", owner_id)
    .maybeSingle();

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  // Pick the best footage URL: explicit param → first video attachment
  const videoAttachment = attachments.find(isVideoAttachment);
  const resolvedFootageUrl = footage_url || videoAttachment?.url || null;

  // Determine content type
  const useAiGen = !resolvedFootageUrl && isAiGeneratedRequest(brief);

  // Persist footage info on the lead
  await supabase
    .from("lead_pipeline")
    .update({
      footage_url: resolvedFootageUrl,
      needs_thumbnail: needs_thumbnail ?? false,
    })
    .eq("id", lead_id);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.shortstack.work";
  const webhookKey = process.env.WEBHOOK_SECRET || "";

  if (resolvedFootageUrl && !useAiGen) {
    // ── Real footage → auto-edit pipeline ──────────────────────────────
    // Fire auto-edit asynchronously; the job completes in the background.
    // When it completes we need to deliver the result — for now we store
    // the job ID so a future poll/webhook can pick it up and fire deliver.

    const editBody = {
      video_url: resolvedFootageUrl,
      // If lead has a generated content brief, pass it as context
      brief:
        brief ||
        (lead.generated_content
          ? (lead.generated_content as Record<string, unknown>)?.brief || ""
          : ""),
      client_id: lead_id,
      auto_accept: true,
    };

    fetch(`${appUrl}/api/video/auto-edit/full-pass`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-key": webhookKey,
      },
      body: JSON.stringify(editBody),
    })
      .then(async (res) => {
        if (!res.ok) {
          console.warn("[leadgen/process-footage] auto-edit non-ok:", res.status);
          return;
        }
        const json = (await res.json()) as { job_id?: string; output_url?: string };

        // Store the job id for tracking
        await supabase
          .from("lead_pipeline")
          .update({ edit_job_id: json.job_id || null })
          .eq("id", lead_id);

        // If the pipeline returned a synchronous output URL, deliver immediately
        if (json.output_url) {
          fetch(`${appUrl}/api/leadgen/deliver`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-webhook-key": webhookKey,
            },
            body: JSON.stringify({
              lead_id,
              owner_id,
              deliverable_urls: [json.output_url],
              message: "Your video is ready! Here's the edited version 🎬",
            }),
          }).catch((err) =>
            console.warn("[leadgen/process-footage] deliver trigger failed:", err),
          );
        }
      })
      .catch((err) => console.warn("[leadgen/process-footage] auto-edit fire failed:", err));
  } else if (useAiGen) {
    // ── AI-generated video ─────────────────────────────────────────────
    // Stub: call fal.ai / RunPod video gen with the brief.
    // For now we log and let the user manually deliver.
    console.warn(
      `[leadgen/process-footage] AI video gen requested for lead ${lead_id} — stub path, brief: "${brief}"`,
    );

    await supabase.from("trinity_log").insert({
      action_type: "automation",
      description: `AI video gen requested for ${lead.display_name || lead.handle}: "${brief?.slice(0, 100) || "no brief"}"`,
      user_id: owner_id,
      status: "pending",
      result: { type: "ai_video_gen_requested", lead_id, brief },
    });
  } else {
    // No footage and no AI request — ask the lead for footage
    const dmResult = await zernioDM({
      platform: lead.platform,
      handle: lead.handle,
      message:
        "Hey! To start editing, could you send over your footage? Just drop it right here in the chat and I'll get started immediately 📹",
    });
    if (!dmResult.ok) {
      console.warn("[leadgen/process-footage] DM request failed:", dmResult.error);
    }

    return NextResponse.json({ ok: true, status: "awaiting_footage" });
  }

  // ── Thumbnail generation (parallel, fire-and-forget) ──────────────────
  if (needs_thumbnail && resolvedFootageUrl) {
    fetch(`${appUrl}/api/thumbnail/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-key": webhookKey,
      },
      body: JSON.stringify({
        video_url: resolvedFootageUrl,
        lead_id,
        owner_id,
      }),
    }).catch((err) =>
      console.warn("[leadgen/process-footage] thumbnail gen fire failed:", err),
    );
  }

  return NextResponse.json({
    ok: true,
    status: resolvedFootageUrl ? "editing_started" : "ai_gen_queued",
    footage_url: resolvedFootageUrl,
    needs_thumbnail: needs_thumbnail ?? false,
  });
}
