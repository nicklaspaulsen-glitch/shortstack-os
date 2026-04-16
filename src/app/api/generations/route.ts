import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// GET — list generations for the current user
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const category = request.nextUrl.searchParams.get("category");
  const page = parseInt(request.nextUrl.searchParams.get("page") || "1", 10);
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "20", 10);
  const offset = (page - 1) * limit;

  try {
    let query = supabase
      .from("generations")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (category && category !== "all") {
      query = query.eq("category", category);
    }

    const { data, count, error } = await query;

    if (error) {
      // Table likely doesn't exist yet — return empty with a hint
      return NextResponse.json({
        generations: [],
        total: 0,
        page,
        limit,
        hint: "The generations table may not exist yet. Create it in Supabase with columns: id (uuid), user_id (uuid), category (text), title (text), source_tool (text), content_preview (text), metadata (jsonb), created_at (timestamptz).",
      });
    }

    return NextResponse.json({
      generations: data || [],
      total: count || 0,
      page,
      limit,
    });
  } catch {
    return NextResponse.json({
      generations: [],
      total: 0,
      page,
      limit,
      hint: "Unexpected error fetching generations.",
    });
  }
}

// POST — create a new generation record
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { category, title, source_tool, content_preview, metadata } = body;

  if (!category || !title || !source_tool) {
    return NextResponse.json(
      { error: "category, title, and source_tool are required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase.from("generations").insert({
    user_id: user.id,
    category,
    title,
    source_tool,
    content_preview: content_preview || null,
    metadata: metadata || {},
  }).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ generation: data });
}
