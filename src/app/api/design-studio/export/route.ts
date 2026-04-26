/**
 * Design Studio — /api/design-studio/export
 *
 * POST: Rasterize a design page and upload to R2.
 *       Returns the public CDN URL.
 *
 * Body: { design_id, page_index?, format?, quality? }
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireOwnedClient } from "@/lib/security/require-owned-client";
import { uploadToR2 } from "@/lib/server/r2-client";
import { renderDesign } from "@/lib/design/render-server";
import { v4 as uuidv4 } from "uuid";
import type { ExportFormat } from "@/lib/design/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_FORMATS = new Set<string>(["png", "jpg", "webp"]);

interface ExportBody {
  design_id: string;
  page_index?: number;
  format?: ExportFormat;
  quality?: number;
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ctx = await requireOwnedClient(supabase, user.id);
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: ExportBody;
  try {
    body = (await req.json()) as ExportBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.design_id) {
    return NextResponse.json({ error: "design_id is required" }, { status: 400 });
  }

  const format: ExportFormat = ALLOWED_FORMATS.has(body.format ?? "")
    ? (body.format as ExportFormat)
    : "png";

  const quality = Math.max(1, Math.min(100, body.quality ?? 90));

  // Fetch design
  const { data: design } = await supabase
    .from("designs")
    .select("*")
    .eq("id", body.design_id)
    .single();

  if (!design || design.user_id !== ctx.ownerId) {
    return NextResponse.json({ error: "Design not found" }, { status: 404 });
  }

  try {
    const buffer = await renderDesign(design.doc, design.width, design.height, {
      pageIndex: body.page_index ?? 0,
      format,
      quality,
    });

    const exportId = uuidv4();
    const ext = format === "jpg" ? "jpg" : format;
    const r2Key = `designs/${ctx.ownerId}/${design.id}/exports/${exportId}.${ext}`;
    const contentType =
      format === "jpg" ? "image/jpeg" : format === "webp" ? "image/webp" : "image/png";

    const publicUrl = await uploadToR2(r2Key, buffer, contentType);

    // Update thumbnail if this is page 0 PNG
    if ((body.page_index ?? 0) === 0 && format === "png") {
      await supabase
        .from("designs")
        .update({ thumbnail_url: publicUrl })
        .eq("id", design.id);
    }

    return NextResponse.json({ url: publicUrl, r2_key: r2Key, format });
  } catch (err) {
    console.error("[design-studio/export] render error", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
