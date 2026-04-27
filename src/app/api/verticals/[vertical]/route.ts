/**
 * GET /api/verticals/[vertical] — full detail for a single vertical.
 *
 * Returns the full template payload (automations, scripts, course, funnel,
 * etc.) so the detail page can render module checkboxes with preview lists.
 */
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getVertical, isVerticalKey, countVertical } from "@/lib/verticals";

export const dynamic = "force-dynamic";

interface Params {
  params: { vertical: string };
}

export async function GET(_req: Request, { params }: Params) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isVerticalKey(params.vertical)) {
    return NextResponse.json({ error: "Unknown vertical" }, { status: 404 });
  }

  const template = getVertical(params.vertical);

  return NextResponse.json({
    template,
    counts: countVertical(template),
  });
}
