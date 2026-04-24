import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// GET /api/showcase/public/[slug] — no auth. Returns the case study + assets
// ONLY if it's published. 404 otherwise (no draft leakage).
export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const supabase = createServiceClient();

  const { data: cs } = await supabase
    .from("case_studies")
    .select("*")
    .eq("slug", params.slug)
    .eq("published", true)
    .single();

  if (!cs) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: assets } = await supabase
    .from("case_study_assets")
    .select("*")
    .eq("case_study_id", cs.id)
    .order("position", { ascending: true });

  return NextResponse.json({ case_study: cs, assets: assets ?? [] });
}
