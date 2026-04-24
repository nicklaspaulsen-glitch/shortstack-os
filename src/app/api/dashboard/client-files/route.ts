/**
 * GET /api/dashboard/client-files
 *   Lists client_files across every client the caller owns (or can access as
 *   a team member). Grouped result shape:
 *     { groups: [{ client: {id,name}, files: [...] }], quota: {...} }
 *
 *   Signed URLs (1h) are attached for ready files.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";
import { CLIENT_FILES_BUCKET } from "@/lib/cloud-drive/client-files-helpers";

const SIGNED_URL_TTL_SECONDS = 3600;

export async function GET(_req: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;
  const service = createServiceClient();

  // All clients owned by this agency.
  const { data: clients, error: clientsErr } = await service
    .from("clients")
    .select("id, business_name, contact_name")
    .eq("profile_id", ownerId)
    .order("business_name", { ascending: true });
  if (clientsErr) {
    return NextResponse.json({ error: clientsErr.message }, { status: 500 });
  }

  const clientIds = (clients || []).map((c) => c.id as string);
  if (clientIds.length === 0) {
    return NextResponse.json({ groups: [], quota: null });
  }

  const { data: files, error: filesErr } = await service
    .from("client_files")
    .select(
      "id, client_id, uploaded_by, source, external_id, filename, mime_type, size_bytes, storage_url, project_id, status, metadata, created_at",
    )
    .in("client_id", clientIds)
    .order("created_at", { ascending: false })
    .limit(500);
  if (filesErr) {
    return NextResponse.json({ error: filesErr.message }, { status: 500 });
  }

  const withUrls = await Promise.all(
    (files || []).map(async (f) => {
      if (!f.storage_url) return { ...f, signed_url: null };
      const { data: signed } = await service.storage
        .from(CLIENT_FILES_BUCKET)
        .createSignedUrl(f.storage_url, SIGNED_URL_TTL_SECONDS);
      return { ...f, signed_url: signed?.signedUrl || null };
    }),
  );

  // Group by client.
  const byClient = new Map<
    string,
    { client: { id: string; name: string }; files: typeof withUrls }
  >();
  for (const c of clients || []) {
    byClient.set(c.id as string, {
      client: { id: c.id as string, name: (c.business_name || c.contact_name || "Unnamed") as string },
      files: [],
    });
  }
  for (const f of withUrls) {
    const group = byClient.get(f.client_id);
    if (group) group.files.push(f);
  }

  const groups = Array.from(byClient.values())
    .filter((g) => g.files.length > 0)
    .sort((a, b) => (a.files[0]?.created_at < b.files[0]?.created_at ? 1 : -1));

  // Quota summary for the owner.
  const { data: quota } = await service
    .from("org_file_quotas")
    .select("plan_tier, bytes_used, bytes_limit")
    .eq("org_id", ownerId)
    .maybeSingle();

  return NextResponse.json({ groups, quota: quota || null });
}
