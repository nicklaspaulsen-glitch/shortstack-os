import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/*
  community_resources — see migration 20260418_community_events_polls_resources.sql
*/

const VALID_TYPES = ["pdf", "video", "template", "link"] as const;

// GET — list all resources, pinned first
export async function GET() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: resources, error } = await supabase
    .from("community_resources")
    .select("*")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ resources: resources || [] });
}

// POST — create a new resource
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { title, url, type, description } = body;

  if (!title?.trim() || !url?.trim())
    return NextResponse.json(
      { error: "title and url are required" },
      { status: 400 }
    );

  const cleanType = (VALID_TYPES as readonly string[]).includes(type)
    ? type
    : "link";

  const { data: resource, error } = await supabase
    .from("community_resources")
    .insert({
      user_id: user.id,
      title: title.trim(),
      url: url.trim(),
      type: cleanType,
      description: description?.trim() || null,
      downloads: 0,
      pinned: false,
    })
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ resource });
}
