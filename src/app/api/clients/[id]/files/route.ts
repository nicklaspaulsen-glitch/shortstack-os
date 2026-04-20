import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

/**
 * GET /api/clients/:id/files
 * Returns a unified list of every file a client has dropped into ShortStack.
 *
 * Sources (union):
 *   - client_uploads  — files uploaded via the client portal ("My Uploads")
 *   - content_assets  — files uploaded to the agency Content Library and
 *                       tagged with a collection_id matching the client
 *                       (best-effort; content_assets is agency-scoped so we
 *                       only include rows whose tags array contains the
 *                       client business_name slug — this keeps the join
 *                       simple without a schema migration).
 *
 * Response shape:
 *   { files: Array<{
 *       id, name, url, type, size, uploaded_at, source_tool
 *     }> }
 *
 * Access rules (same as /api/clients/:id/phone):
 *   - agency owner / team member that owns the client → allowed
 *   - portal user whose profile_id is the client.profile_id → allowed
 *   - everyone else → 403
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: clientId } = await context.params;
  if (!clientId) {
    return NextResponse.json({ error: "client id required" }, { status: 400 });
  }

  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();

  const { data: client } = await service
    .from("clients")
    .select("id, profile_id, business_name")
    .eq("id", clientId)
    .maybeSingle();

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  // Ownership check — agency owner, team member, or the portal user themselves.
  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  const callerIsOwner = !!ownerId && client.profile_id === ownerId;
  const callerIsPortalUser = client.profile_id === user.id;
  if (!callerIsOwner && !callerIsPortalUser) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  type FileEntry = {
    id: string;
    name: string;
    url: string | null;
    type: string;
    size: number;
    uploaded_at: string;
    source_tool: string;
  };

  const files: FileEntry[] = [];

  // ── 1) client_uploads (portal drop zone) ──────────────────────────────
  try {
    const { data: uploads } = await service
      .from("client_uploads")
      .select("id, file_name, file_url, file_type, file_size, category, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    for (const u of uploads || []) {
      files.push({
        id: `upload-${u.id}`,
        name: u.file_name || "Untitled",
        url: u.file_url,
        type: u.file_type || u.category || "file",
        size: u.file_size || 0,
        uploaded_at: u.created_at,
        source_tool: "Client Portal",
      });
    }
  } catch {
    // best-effort — table may not exist in older envs
  }

  // ── 2) content_assets tagged with the client's slug ────────────────────
  // content_assets is scoped to the agency (user_id = ownerId). We pull rows
  // whose tags array contains the client business_name slug so agency-side
  // uploads meant for a specific client surface here too.
  const clientSlug = (client.business_name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const assetOwnerId = ownerId || client.profile_id;
  if (clientSlug && assetOwnerId) {
    try {
      const { data: assets } = await service
        .from("content_assets")
        .select("id, name, file_url, file_type, file_size, mime_type, tags, created_at")
        .eq("user_id", assetOwnerId)
        .contains("tags", [clientSlug])
        .order("created_at", { ascending: false });

      for (const a of assets || []) {
        files.push({
          id: `asset-${a.id}`,
          name: a.name || "Untitled",
          url: a.file_url,
          type: a.file_type || a.mime_type || "file",
          size: a.file_size || 0,
          uploaded_at: a.created_at,
          source_tool: "Content Library",
        });
      }
    } catch {
      // tags column might not exist on older envs — ignore
    }
  }

  files.sort(
    (a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime(),
  );

  return NextResponse.json({ files });
}
