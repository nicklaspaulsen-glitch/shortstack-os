/**
 * GET /api/verticals — list vertical templates with previews.
 *
 * Returns the full template payload (for the detail page) plus pre-computed
 * counts so the index page can render "5 automations / 10 SMS / ..." badges
 * without instantiating each template. Public-readable: anyone authenticated
 * can browse the catalog.
 */
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { listVerticals, countVertical } from "@/lib/verticals";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const verticals = listVerticals().map((t) => ({
    vertical: t.vertical,
    display_name: t.display_name,
    tagline: t.tagline,
    description: t.description,
    accent: t.accent,
    icon: t.icon,
    preview_image: t.preview_image ?? null,
    counts: countVertical(t),
  }));

  return NextResponse.json({ verticals });
}
