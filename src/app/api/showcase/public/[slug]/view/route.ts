import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createHash } from "crypto";

// POST /api/showcase/public/[slug]/view — no auth. Log a view.
// Body: { referrer?: string }
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const supabase = createServiceClient();

  const { data: cs } = await supabase
    .from("case_studies")
    .select("id, published")
    .eq("slug", params.slug)
    .single();
  if (!cs || !cs.published) {
    // Silently 204 so clients can fire-and-forget without logging errors.
    return new NextResponse(null, { status: 204 });
  }

  let body: { referrer?: string } = {};
  try {
    body = await request.json();
  } catch {
    // body is optional
  }

  const ua = request.headers.get("user-agent") || "";
  const uaHash = ua
    ? createHash("sha256").update(ua).digest("hex").slice(0, 32)
    : null;
  const country = request.headers.get("x-vercel-ip-country") || null;

  await supabase.from("case_study_views").insert({
    case_study_id: cs.id,
    referrer: typeof body.referrer === "string" ? body.referrer.slice(0, 500) : null,
    user_agent_hash: uaHash,
    country,
  });

  return new NextResponse(null, { status: 204 });
}
