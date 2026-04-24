import { NextRequest, NextResponse } from "next/server";
import { resolveSessionByToken } from "@/lib/review/auth";
import type { PublicReviewSession } from "@/lib/review/types";

// GET /api/review/public/[token] — public session details + versions
// (no auth required, token in URL is the only proof of access)
export async function GET(
  _request: NextRequest,
  { params }: { params: { token: string } },
) {
  const res = await resolveSessionByToken(params.token);
  if (!res) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { supabase, session } = res;

  if (session.status === "archived")
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [versionsRes, commentsRes] = await Promise.all([
    supabase
      .from("review_versions")
      .select("version, asset_url, uploaded_at, release_notes")
      .eq("session_id", session.id)
      .order("version", { ascending: false }),
    supabase
      .from("review_comments")
      .select("*")
      .eq("session_id", session.id)
      .order("created_at", { ascending: true }),
  ]);

  const publicSession: PublicReviewSession = {
    id: session.id,
    title: session.title,
    asset_url: session.asset_url,
    asset_type: session.asset_type,
    version: session.version,
    status: session.status,
    created_at: session.created_at,
    approved_at: session.approved_at,
    approved_by_name: session.approved_by_name,
    versions: (versionsRes.data as PublicReviewSession["versions"]) ?? [],
  };

  return NextResponse.json({
    session: publicSession,
    comments: commentsRes.data ?? [],
  });
}
