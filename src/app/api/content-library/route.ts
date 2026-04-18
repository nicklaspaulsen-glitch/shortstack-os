import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

/*
  Table: content_assets
  ─────────────────────
  id            uuid        primary key default gen_random_uuid()
  user_id       uuid        references auth.users(id) on delete cascade
  name          text        not null
  file_url      text        not null
  file_type     text        not null  -- image, video, document, audio
  file_size     integer     not null default 0
  mime_type     text
  tags          text[]      default '{}'
  collection_id text                  -- nullable FK to content_collections.id
  width         integer               -- nullable
  height        integer               -- nullable
  created_at    timestamptz default now()
*/

// GET /api/content-library  — list assets for current user
export async function GET(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  const collectionId = req.nextUrl.searchParams.get("collection_id");
  const fileType = req.nextUrl.searchParams.get("file_type");

  const service = createServiceClient();
  let query = service
    .from("content_assets")
    .select("*")
    .eq("user_id", ownerId)
    .order("created_at", { ascending: false });

  if (collectionId) query = query.eq("collection_id", collectionId);
  if (fileType) query = query.eq("file_type", fileType);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ assets: data || [] });
}

// POST /api/content-library  — upload a file
export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const tags = formData.get("tags") as string | null;
  const collectionId = formData.get("collection_id") as string | null;

  // Determine file type category
  let fileType = "document";
  if (file.type.startsWith("image/")) fileType = "image";
  else if (file.type.startsWith("video/")) fileType = "video";
  else if (file.type.startsWith("audio/")) fileType = "audio";

  // Upload to Supabase Storage
  const ext = file.name.split(".").pop() || "bin";
  const storagePath = `${ownerId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const service = createServiceClient();
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error: uploadError } = await service.storage
    .from("content-assets")
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
  }

  const { data: urlData } = service.storage
    .from("content-assets")
    .getPublicUrl(storagePath);

  const fileUrl = urlData.publicUrl;

  // Parse tags
  const parsedTags: string[] = tags
    ? tags.split(",").map(t => t.trim().toLowerCase()).filter(Boolean)
    : [];

  const { data, error: insertError } = await service
    .from("content_assets")
    .insert({
      user_id: ownerId,
      name: file.name,
      file_url: fileUrl,
      file_type: fileType,
      file_size: file.size,
      mime_type: file.type,
      tags: parsedTags,
      collection_id: collectionId || null,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // If assigned to a collection, bump asset_count
  if (collectionId) {
    await service.rpc("increment_asset_count", { cid: collectionId }).then(() => {}, () => {});
  }

  return NextResponse.json({ asset: data });
}

// DELETE /api/content-library?id=<asset_id>
export async function DELETE(req: NextRequest) {
  const assetId = req.nextUrl.searchParams.get("id");
  if (!assetId) return NextResponse.json({ error: "id required" }, { status: 400 });

  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  const service = createServiceClient();

  // Fetch the asset first to get storage path and collection
  const { data: asset } = await service
    .from("content_assets")
    .select("*")
    .eq("id", assetId)
    .eq("user_id", ownerId)
    .single();

  if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

  // Extract storage path from the public URL
  const urlParts = asset.file_url.split("/content-assets/");
  if (urlParts.length === 2) {
    await service.storage.from("content-assets").remove([urlParts[1]]);
  }

  const { error } = await service
    .from("content_assets")
    .delete()
    .eq("id", assetId)
    .eq("user_id", ownerId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Decrement collection count if applicable
  if (asset.collection_id) {
    await service.rpc("decrement_asset_count", { cid: asset.collection_id }).then(() => {}, () => {});
  }

  return NextResponse.json({ success: true });
}

// PATCH /api/content-library  — update asset metadata
export async function PATCH(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownerId = (await getEffectiveOwnerId(supabase, user.id)) || user.id;

  const body = await req.json();
  const { id, tags, collection_id, name } = body as {
    id: string;
    tags?: string[];
    collection_id?: string | null;
    name?: string;
  };

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (tags !== undefined) updates.tags = tags;
  if (collection_id !== undefined) updates.collection_id = collection_id;
  if (name !== undefined) updates.name = name;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("content_assets")
    .update(updates)
    .eq("id", id)
    .eq("user_id", ownerId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ asset: data });
}
