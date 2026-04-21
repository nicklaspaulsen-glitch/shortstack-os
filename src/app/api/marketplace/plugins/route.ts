import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// GET — Plugin catalog from DB.
export async function GET(request: NextRequest) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const q = searchParams.get("q");

  let query = supabase
    .from("marketplace_plugins")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (category && category !== "all") query = query.eq("category", category);
  if (q && q.trim()) {
    const needle = q.trim();
    query = query.or(`name.ilike.%${needle}%,description.ilike.%${needle}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ plugins: data ?? [], total: (data ?? []).length });
}
