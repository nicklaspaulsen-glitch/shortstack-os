import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOrgId, isOrgAdmin } from "@/lib/assets/helpers";

export const dynamic = "force-dynamic";

// POST /api/assets/reindex — admin backfill. Idempotent via ai_metadata->>'origin_id'.
export async function POST(_req: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getEffectiveOrgId(supabase, user.id);
  if (!isOrgAdmin(user.id, orgId)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const service = createServiceClient();
  const inserted: Record<string, number> = {};

  async function existingKeys(origin: string): Promise<Set<string>> {
    const { data } = await service
      .from("assets")
      .select("ai_metadata")
      .eq("org_id", orgId)
      .contains("ai_metadata", { origin_table: origin });
    const s = new Set<string>();
    (data || []).forEach((row: { ai_metadata: unknown }) => {
      const m = row.ai_metadata as { origin_id?: string } | null;
      if (m?.origin_id) s.add(m.origin_id);
    });
    return s;
  }

  // generations
  try {
    const skip = await existingKeys("generations");
    const { data } = await service.from("generations").select("*").eq("user_id", orgId);
    const rows = (data || []).filter((r) => !skip.has(r.id as string));
    if (rows.length) {
      const payload = rows.map((r) => ({
        org_id: orgId,
        asset_type:
          r.category === "video"
            ? "video"
            : ["thumbnail", "image", "social_post"].includes(r.category)
              ? "image"
              : "doc",
        source:
          typeof r.source_tool === "string" && r.source_tool.toLowerCase().includes("thumbnail")
            ? "from_thumbnail_tool"
            : typeof r.source_tool === "string" && r.source_tool.toLowerCase().includes("copywrit")
              ? "from_copywriter"
              : "ai_generated",
        filename: r.title,
        description: r.content_preview,
        ai_metadata: {
          origin_table: "generations",
          origin_id: r.id,
          category: r.category,
          source_tool: r.source_tool,
          metadata: r.metadata,
        },
        created_by: r.user_id,
        created_at: r.created_at,
      }));
      await service.from("assets").insert(payload);
      inserted.generations = rows.length;
    } else {
      inserted.generations = 0;
    }
  } catch {
    inserted.generations = -1;
  }

  // generated_images
  try {
    const skip = await existingKeys("generated_images");
    const { data } = await service
      .from("generated_images")
      .select("*")
      .eq("profile_id", orgId)
      .eq("status", "completed");
    const rows = (data || []).filter((r) => !skip.has(r.id as string));
    if (rows.length) {
      const payload = rows.map((r) => ({
        org_id: orgId,
        asset_type: "image",
        source: "ai_generated",
        storage_url: r.image_url,
        thumbnail_url: r.thumbnail_url,
        filename: r.prompt || "Generated image",
        description: r.prompt,
        ai_metadata: {
          origin_table: "generated_images",
          origin_id: r.id,
          model: r.model,
          width: r.width,
          height: r.height,
          wizard_answers: r.wizard_answers,
          metadata: r.metadata,
        },
        created_by: r.profile_id,
        created_at: r.created_at,
      }));
      await service.from("assets").insert(payload);
      inserted.generated_images = rows.length;
    } else {
      inserted.generated_images = 0;
    }
  } catch {
    inserted.generated_images = -1;
  }

  // video_projects
  try {
    const skip = await existingKeys("video_projects");
    const { data } = await service.from("video_projects").select("*").eq("profile_id", orgId);
    const rows = (data || []).filter((r) => !skip.has(r.id as string));
    if (rows.length) {
      const payload = rows.map((r) => ({
        org_id: orgId,
        asset_type: "video",
        source: "ai_generated",
        storage_url: r.render_url,
        filename: r.title || r.topic || "Video project",
        description: r.topic,
        ai_metadata: {
          origin_table: "video_projects",
          origin_id: r.id,
          duration: r.duration,
          style_preset: r.style_preset,
          render_status: r.render_status,
        },
        created_by: r.profile_id,
        created_at: r.created_at,
      }));
      await service.from("assets").insert(payload);
      inserted.video_projects = rows.length;
    } else {
      inserted.video_projects = 0;
    }
  } catch {
    inserted.video_projects = -1;
  }

  // portal_uploads
  try {
    const skip = await existingKeys("portal_uploads");
    const { data: clientIds } = await service.from("clients").select("id").eq("profile_id", orgId);
    const ids = (clientIds || []).map((c) => c.id as string);
    if (ids.length) {
      const { data } = await service.from("portal_uploads").select("*").in("client_id", ids);
      const rows = (data || []).filter((r) => !skip.has(r.id as string));
      if (rows.length) {
        const payload = rows.map((r) => ({
          org_id: orgId,
          asset_type:
            typeof r.content_type === "string" && r.content_type.startsWith("image/")
              ? "image"
              : typeof r.content_type === "string" && r.content_type.startsWith("video/")
                ? "video"
                : typeof r.content_type === "string" && r.content_type.startsWith("audio/")
                  ? "audio"
                  : "doc",
          source: "uploaded",
          storage_url: r.file_path,
          filename: r.file_name,
          mime_type: r.content_type,
          size_bytes: r.file_size_bytes || 0,
          ai_metadata: {
            origin_table: "portal_uploads",
            origin_id: r.id,
            client_id: r.client_id,
          },
          created_by: r.portal_user_id,
          created_at: r.uploaded_at,
        }));
        await service.from("assets").insert(payload);
        inserted.portal_uploads = rows.length;
      } else {
        inserted.portal_uploads = 0;
      }
    } else {
      inserted.portal_uploads = 0;
    }
  } catch {
    inserted.portal_uploads = -1;
  }

  return NextResponse.json({ ok: true, inserted });
}
