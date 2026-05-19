/**
 * POST /api/video/remotion-render
 *
 * Server-side Remotion render — bundles the VideoOverlay composition and
 * exports an MP4 via @remotion/renderer.
 *
 * ⚠️  ENVIRONMENT REQUIREMENTS
 * Remotion's renderer requires:
 *  - A bundled Chromium binary (ships with @remotion/renderer for Linux/macOS)
 *  - Sufficient CPU + memory (≥1 CPU, ≥2 GB RAM recommended)
 *  - Node.js ≥18
 *
 * On Vercel Edge/Serverless this route will return 503 because the Chromium
 * binary is too large for serverless functions. Deploy this route on a
 * self-hosted Node server (Hetzner, Railway, Fly.io, etc.) or use
 * @remotion/lambda for AWS Lambda rendering.
 *
 * Request body (JSON):
 *   videoUrl      string   — source video URL (required)
 *   title         string   — text overlay (optional)
 *   captionText   string   — lower-third caption (optional)
 *   brandColor    string   — hex accent color (default "#3B82F6")
 *   logoUrl       string   — brand logo image URL (optional)
 *   showIntro     boolean  — 30-frame branded intro (default false)
 *   showOutro     boolean  — 30-frame branded outro (default false)
 *   aspectRatio   string   — "9:16" | "16:9" | "1:1" (default "9:16")
 *   durationSeconds number — video duration in seconds (default 5)
 *
 * Response:
 *   { success: true, url: string }  — R2 public URL of rendered MP4
 *   { success: false, error: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const RenderSchema = z.object({
  videoUrl: z.string().url("videoUrl must be a valid URL").min(1, "videoUrl is required"),
  title: z.string().max(200).optional().default(""),
  captionText: z.string().max(500).optional().default(""),
  brandColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "brandColor must be a hex color like #3B82F6")
    .optional()
    .default("#3B82F6"),
  logoUrl: z.string().url().optional(),
  showIntro: z.boolean().optional().default(false),
  showOutro: z.boolean().optional().default(false),
  aspectRatio: z.enum(["9:16", "16:9", "1:1"]).optional().default("9:16"),
  durationSeconds: z.number().min(1).max(60).optional().default(5),
});

type RenderInput = z.infer<typeof RenderSchema>;

// ---------------------------------------------------------------------------
// Dimension lookup
// ---------------------------------------------------------------------------

const DIMENSIONS: Record<string, { compositionId: string; width: number; height: number }> = {
  "9:16": { compositionId: "VideoOverlay", width: 1080, height: 1920 },
  "16:9": { compositionId: "VideoOverlayLandscape", width: 1920, height: 1080 },
  "1:1": { compositionId: "VideoOverlaySquare", width: 1080, height: 1080 },
};

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  // Auth gate
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  // Parse + validate body
  let input: RenderInput;
  try {
    const body = await req.json();
    input = RenderSchema.parse(body);
  } catch (err) {
    const msg = err instanceof z.ZodError ? err.errors[0]?.message : "Invalid request body";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }

  const dims = DIMENSIONS[input.aspectRatio];
  const durationInFrames = Math.max(30, Math.round(input.durationSeconds * 30));

  // ---------------------------------------------------------------------------
  // Attempt Remotion server-side render
  // ---------------------------------------------------------------------------
  // This block intentionally guards against non-server environments. On Vercel
  // the dynamic import of @remotion/renderer will succeed but bundle() will
  // fail due to missing Chromium — we catch that and return a helpful 503.
  // ---------------------------------------------------------------------------
  try {
    const [{ bundle }, { renderMedia, selectComposition }] = await Promise.all([
      import("@remotion/bundler"),
      import("@remotion/renderer"),
    ]);

    const path = await import("path");
    const os = await import("os");
    const { uploadToR2 } = await import("@/lib/server/r2-client");

    // Bundle the Remotion root (points to src/remotion/Root.tsx)
    const rootFile = path.join(process.cwd(), "src", "remotion", "Root.tsx");
    const bundleLocation = await bundle({
      entryPoint: rootFile,
      // Disable webpack caching in serverless (no persistent disk)
      onProgress: () => void 0,
    });

    // Select the right composition
    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: dims.compositionId,
      inputProps: {
        videoUrl: input.videoUrl,
        title: input.title,
        captionText: input.captionText,
        brandColor: input.brandColor,
        logoUrl: input.logoUrl,
        showIntro: input.showIntro,
        showOutro: input.showOutro,
      },
    });

    // Override duration to match the requested length
    const outputPath = path.join(
      os.tmpdir(),
      `remotion-${user.id}-${Date.now()}.mp4`,
    );

    await renderMedia({
      composition: {
        ...composition,
        durationInFrames,
        width: dims.width,
        height: dims.height,
      },
      serveUrl: bundleLocation,
      codec: "h264",
      outputLocation: outputPath,
      inputProps: {
        videoUrl: input.videoUrl,
        title: input.title,
        captionText: input.captionText,
        brandColor: input.brandColor,
        logoUrl: input.logoUrl,
        showIntro: input.showIntro,
        showOutro: input.showOutro,
      },
      chromiumOptions: {
        // Reduce memory usage in constrained environments
        disableWebSecurity: false,
      },
      onProgress: () => void 0,
    });

    // Upload rendered MP4 to R2
    const fs = await import("fs/promises");
    const fileBuffer = await fs.readFile(outputPath);
    const r2Key = `remotion-renders/${user.id}/${Date.now()}.mp4`;
    const publicUrl = await uploadToR2(r2Key, fileBuffer, "video/mp4");

    // Clean up temp file (best-effort)
    fs.unlink(outputPath).catch(() => void 0);

    return NextResponse.json({ success: true, url: publicUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Render failed";

    // Detect Vercel / serverless environment where Chromium is unavailable
    if (
      msg.includes("Chrome") ||
      msg.includes("chromium") ||
      msg.includes("Executable path") ||
      msg.includes("puppeteer") ||
      msg.includes("ENOENT")
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Server-side Remotion rendering requires a self-hosted environment (Hetzner, Fly.io, Railway) with Chromium available. " +
            "Use the in-browser player at /dashboard/ai-video for preview, or deploy to a self-hosted worker.",
          code: "REQUIRES_SELF_HOSTED",
        },
        { status: 503 },
      );
    }

    console.error("[remotion-render] Render failed:", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
