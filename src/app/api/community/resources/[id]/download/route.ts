import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

// POST — increment the downloads counter for a resource.
// Uses a SECURITY DEFINER RPC so any authenticated caller can bump the count
// (RLS only lets the creator UPDATE the row directly).
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase.rpc("increment_resource_downloads", {
    p_resource_id: params.id,
  });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, downloads: data ?? 0 });
}
