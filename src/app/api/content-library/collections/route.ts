import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase, createServiceClient } from "@/lib/supabase/server";

/*
  Table: content_collections
  ──────────────────────────
  id            uuid        primary key default gen_random_uuid()
  user_id       uuid        references auth.users(id) on delete cascade
  name          text        not null
  description   text        nullable
  color         text        nullable
  asset_count   integer     default 0
  created_at    timestamptz default now()
*/

// GET /api/content-library/collections
export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();
  const { data, error } = await service
    .from("content_collections")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ collections: data || [] });
}

// POST /api/content-library/collections
export async function POST(req: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, description, color } = body as {
    name: string;
    description?: string;
    color?: string;
  };

  if (!name?.trim()) {
    return NextResponse.json({ error: "Collection name required" }, { status: 400 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("content_collections")
    .insert({
      user_id: user.id,
      name: name.trim(),
      description: description || null,
      color: color || "blue",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ collection: data });
}

// DELETE /api/content-library/collections?id=<collection_id>
export async function DELETE(req: NextRequest) {
  const collectionId = req.nextUrl.searchParams.get("id");
  if (!collectionId) return NextResponse.json({ error: "id required" }, { status: 400 });

  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();

  // Unassign all assets in this collection
  await service
    .from("content_assets")
    .update({ collection_id: null })
    .eq("collection_id", collectionId)
    .eq("user_id", user.id);

  const { error } = await service
    .from("content_collections")
    .delete()
    .eq("id", collectionId)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
