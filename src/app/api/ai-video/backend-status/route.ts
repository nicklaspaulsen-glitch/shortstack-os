import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * GET /api/ai-video/backend-status
 *
 * Returns which video-generation backends are configured server-side.
 * Used by the AI Video admin panel to surface a warning only when a
 * backend is actually missing — not as a static informational note.
 *
 * Admin/founder only — non-admin callers receive 403.
 */
export async function GET() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdmin =
    profile?.role === "admin" || profile?.role === "founder";

  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    higgsfield: !!process.env.HIGGSFIELD_URL,
    runpod: !!process.env.RUNPOD_API_KEY,
    kling: !!process.env.KLING_API_KEY,
    fal: !!process.env.FAL_KEY,
  });
}
