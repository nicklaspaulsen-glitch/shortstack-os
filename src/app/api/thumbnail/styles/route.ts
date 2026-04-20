import { NextRequest, NextResponse } from "next/server";
import {
  THUMBNAIL_STYLES,
  STYLE_CATEGORIES,
  getStylesByCategory,
  type StyleCategory,
} from "@/lib/thumbnail-styles";

// GET /api/thumbnail/styles
//   Returns the thumbnail style preset library. Supports:
//     ?category=<id>   filter to a single category
//     ?grouped=1       return { [category]: Style[] } instead of a flat list
//
// Used by the thumbnail generator style picker and by Trinity's
// `browse_thumbnail_styles` tool so the assistant can recommend a style.
export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get("category");
  const grouped = request.nextUrl.searchParams.get("grouped") === "1";

  if (grouped) {
    const byCategory: Record<string, typeof THUMBNAIL_STYLES> = {};
    for (const cat of STYLE_CATEGORIES) {
      byCategory[cat.id] = getStylesByCategory(cat.id);
    }
    return NextResponse.json({
      ok: true,
      categories: STYLE_CATEGORIES,
      styles_by_category: byCategory,
      total: THUMBNAIL_STYLES.length,
    });
  }

  if (category) {
    const filtered = getStylesByCategory(category as StyleCategory);
    return NextResponse.json({
      ok: true,
      styles: filtered,
      total: filtered.length,
    });
  }

  return NextResponse.json({
    ok: true,
    styles: THUMBNAIL_STYLES,
    categories: STYLE_CATEGORIES,
    total: THUMBNAIL_STYLES.length,
  });
}
