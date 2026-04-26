/**
 * Portal File Upload endpoint
 *
 * POST /api/portal/uploads
 *   Multipart form upload. Portal session required (regular Supabase auth).
 *   Uploads file to Supabase Storage `portal-files` bucket under
 *   {portal_user_id}/{client_id}/{timestamp}-{filename}, inserts row into
 *   portal_uploads, fires a trinity_log entry and notifies the agency owner.
 *   Returns a signed URL valid for 1 hour for immediate preview.
 *
 * GET /api/portal/uploads
 *   Lists past portal uploads for the caller's client. Returns rows + signed
 *   URLs (1h).
 *
 * Maximum file size: 100 MB.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { verifySniffedMime } from "@/lib/server/file-sniff";
import { ALLOWED_GENERAL_UPLOADS } from "@/lib/file-types";

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB
const SIGNED_URL_TTL_SECONDS = 3600;
const BUCKET = "portal-files";

async function resolvePortalClient(userId: string) {
  const service = createServiceClient();
  const { data: client } = await service
    .from("clients")
    .select("id, profile_id, business_name")
    .eq("profile_id", userId)
    .maybeSingle();
  return client;
}

export async function GET(_req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();
  const { data: uploads, error } = await service
    .from("portal_uploads")
    .select("*")
    .eq("portal_user_id", user.id)
    .order("uploaded_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Attach signed URLs
  const withUrls = await Promise.all(
    (uploads || []).map(async (u) => {
      const { data: signed } = await service.storage
        .from(BUCKET)
        .createSignedUrl(u.file_path, SIGNED_URL_TTL_SECONDS);
      return { ...u, signed_url: signed?.signedUrl || null };
    }),
  );

  return NextResponse.json({ uploads: withUrls });
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = await resolvePortalClient(user.id);
  if (!client) {
    return NextResponse.json(
      { error: "No portal client linked to this account" },
      { status: 403 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart body" }, { status: 400 });
  }

  const file = form.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "file field required" }, { status: 400 });
  }

  const uploaded = file as File;
  if (uploaded.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File exceeds 100 MB limit (${uploaded.size} bytes)` },
      { status: 413 },
    );
  }

  // DEFENSE LAYER 1 — server-side declared-MIME allowlist.
  // Codex round-1+2 catch: requires NON-EMPTY declared MIME in the
  // allowlist. The original guard accepted empty uploaded.type which let
  // an attacker send a payload with no Content-Type at all and bypass
  // both this layer AND the magic-byte sniff (which returns null for
  // unsniffable text formats).
  if (
    !uploaded.type ||
    !(ALLOWED_GENERAL_UPLOADS as readonly string[]).includes(uploaded.type)
  ) {
    return NextResponse.json(
      {
        error: uploaded.type
          ? `Unsupported MIME type "${uploaded.type}".`
          : "Missing Content-Type — upload must declare a supported MIME.",
      },
      { status: 400 },
    );
  }

  const service = createServiceClient();
  const safeName = uploaded.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${user.id}/${client.id}/${Date.now()}-${safeName}`;
  const buffer = Buffer.from(await uploaded.arrayBuffer());

  /*
   * DEFENSE LAYER 2 — server-side magic-byte MIME sniffing.
   * Layer 1 (client-side) validates file.type + extension.
   * Layer 2 (here) reads the actual bytes to detect spoofed Content-Type.
   * Text/unsniffable formats (CSV, TXT, SVG) return null from the sniff
   * and are passed through — layer 1 already covered them.
   */
  const sniffError = await verifySniffedMime(buffer, ALLOWED_GENERAL_UPLOADS, uploaded.type);
  if (sniffError) {
    return NextResponse.json({ error: sniffError }, { status: 400 });
  }

  const { error: storageError } = await service.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: uploaded.type || "application/octet-stream",
      upsert: false,
    });

  if (storageError) {
    console.error("[portal uploads] storage error:", storageError);
    return NextResponse.json(
      { error: `Storage upload failed: ${storageError.message}` },
      { status: 500 },
    );
  }

  const { data: row, error: insertError } = await service
    .from("portal_uploads")
    .insert({
      portal_user_id: user.id,
      client_id: client.id,
      file_path: path,
      file_name: uploaded.name,
      file_size_bytes: uploaded.size,
      content_type: uploaded.type || null,
    })
    .select()
    .single();

  if (insertError) {
    // Best-effort cleanup of orphan storage object
    await service.storage.from(BUCKET).remove([path]);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const { data: signed } = await service.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  // Trinity log entry
  await service.from("trinity_log").insert({
    agent: "portal",
    action_type: "custom",
    description: `Client uploaded "${uploaded.name}" (${Math.round(uploaded.size / 1024)} KB) for ${client.business_name || "client"}`,
    client_id: client.id,
    status: "completed",
    result: {
      type: "portal_upload",
      upload_id: row.id,
      file_name: uploaded.name,
      file_size_bytes: uploaded.size,
      content_type: uploaded.type,
    },
  });

  // Notify the agency owner (clients.profile_id is the owner → OR in this schema
  // a client-role profile owns their own clients row. We resolve the *agency*
  // owner by looking at the client's profile's parent_agency_id).
  try {
    const { data: clientProfile } = await service
      .from("profiles")
      .select("parent_agency_id")
      .eq("id", client.profile_id)
      .maybeSingle();

    const ownerId = clientProfile?.parent_agency_id || client.profile_id;
    if (ownerId && ownerId !== user.id) {
      await service.from("notifications").insert({
        user_id: ownerId,
        title: "New client upload",
        message: `${client.business_name || "Client"} uploaded ${uploaded.name}`,
        type: "info",
        link: "/dashboard/clients",
      });
    }
  } catch (e) {
    // Non-fatal
    console.warn("[portal uploads] notify failed:", e);
  }

  return NextResponse.json({
    upload: row,
    signed_url: signed?.signedUrl || null,
  });
}
