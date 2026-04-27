import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  searchStockPhotos,
  getCuratedStockPhotos,
  isStockPhotosConfigured,
  type StockPhotoOrientation,
} from "@/lib/integrations/stock-photos";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID_ORIENTATIONS: StockPhotoOrientation[] = ["landscape", "portrait", "square"];
const VALID_CATEGORIES = ["business", "tech", "abstract", "people", "nature"] as const;
type Category = (typeof VALID_CATEGORIES)[number];

function isCategory(value: string | null): value is Category {
  return value !== null && (VALID_CATEGORIES as readonly string[]).includes(value);
}

export async function GET(request: NextRequest) {
  // Auth-gated — only authenticated users can hit the stock-photo proxy.
  // This keeps random scrapers from burning our free-tier quota.
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() || "";
  const category = searchParams.get("category");
  const orientationRaw = searchParams.get("orientation");
  const orientation: StockPhotoOrientation | undefined =
    orientationRaw && (VALID_ORIENTATIONS as string[]).includes(orientationRaw)
      ? (orientationRaw as StockPhotoOrientation)
      : undefined;
  const perPageRaw = searchParams.get("per_page");
  const perPage = perPageRaw ? Math.max(1, Math.min(50, parseInt(perPageRaw, 10) || 12)) : 12;

  const config = isStockPhotosConfigured();

  if (isCategory(category)) {
    const photos = await getCuratedStockPhotos(category, perPage);
    return NextResponse.json({
      success: true,
      photos,
      configured: config.configured,
      providers: config.providers,
    });
  }

  if (!query) {
    return NextResponse.json({
      success: true,
      photos: [],
      configured: config.configured,
      providers: config.providers,
      message: "Provide ?q=<query> or ?category=<one of business/tech/abstract/people/nature>",
    });
  }

  const photos = await searchStockPhotos(query, { perPage, orientation });
  return NextResponse.json({
    success: true,
    photos,
    configured: config.configured,
    providers: config.providers,
  });
}
