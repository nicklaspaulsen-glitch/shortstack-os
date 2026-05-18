import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getEffectiveOwnerId } from "@/lib/security/require-owned-client";

/**
 * GET /api/enemy-tracker/feed
 *
 * Returns paginated viral content items for competitors tracked by the
 * authenticated agency owner.  Data sources (future):
 *  - TikTok Research API (public videos filtered by competitor handle)
 *  - Instagram Basic Display / Graph API
 *  - YouTube Data API v3
 *  - X/Twitter API v2 search
 *
 * Current state: returns mock data with a cursor-based pagination stub so
 * the frontend IntersectionObserver + "load more" flow can be verified
 * end-to-end before real API keys are wired in.
 *
 * Query params:
 *   cursor   – opaque pagination token (last item's created_at ISO string)
 *   limit    – page size, default 12, max 50
 *   platform – filter by platform slug (tiktok|instagram|youtube|x), optional
 *   handle   – filter by competitor handle, optional
 */

export interface ViralItem {
  id: string;
  platform: "tiktok" | "instagram" | "youtube" | "x";
  handle: string;
  display_name: string;
  avatar_url: string;
  thumbnail_url: string;
  video_url: string | null;
  caption: string;
  likes: number;
  comments: number;
  shares: number;
  views: number;
  viral_score: number; // 0–100
  posted_at: string; // ISO 8601
  tags: string[];
  niche: string;
}

// ---------------------------------------------------------------------------
// Mock data — replace with real platform API calls in v2
// ---------------------------------------------------------------------------

const MOCK_ITEMS: ViralItem[] = [
  {
    id: "v1",
    platform: "tiktok",
    handle: "@growthwithkyle",
    display_name: "Growth with Kyle",
    avatar_url: "https://api.dicebear.com/8.x/avataaars/svg?seed=kyle",
    thumbnail_url: "https://picsum.photos/seed/vid1/400/700",
    video_url: null,
    caption: "I cold-called 500 agency owners in 30 days. Here's what happened 🧵",
    likes: 284000,
    comments: 4200,
    shares: 18900,
    views: 3100000,
    viral_score: 96,
    posted_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    tags: ["agency", "coldcall", "sales"],
    niche: "Agency Growth",
  },
  {
    id: "v2",
    platform: "instagram",
    handle: "@agencymastery",
    display_name: "Agency Mastery",
    avatar_url: "https://api.dicebear.com/8.x/avataaars/svg?seed=mastery",
    thumbnail_url: "https://picsum.photos/seed/vid2/400/700",
    video_url: null,
    caption: "My client went from 0 to $28k/month in 60 days. Strategy breakdown ↓",
    likes: 92000,
    comments: 1800,
    shares: 7400,
    views: 890000,
    viral_score: 88,
    posted_at: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    tags: ["results", "casestudy", "smma"],
    niche: "SMMA",
  },
  {
    id: "v3",
    platform: "youtube",
    handle: "@futurpreneur",
    display_name: "Futurpreneur",
    avatar_url: "https://api.dicebear.com/8.x/avataaars/svg?seed=futur",
    thumbnail_url: "https://picsum.photos/seed/vid3/400/700",
    video_url: null,
    caption: "How I built a $2M creative agency without running ads (full breakdown)",
    likes: 48000,
    comments: 2100,
    shares: 5600,
    views: 620000,
    viral_score: 83,
    posted_at: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    tags: ["creative", "agency", "noads"],
    niche: "Creative Agency",
  },
  {
    id: "v4",
    platform: "x",
    handle: "@joannewilkes_",
    display_name: "Joanne Wilkes",
    avatar_url: "https://api.dicebear.com/8.x/avataaars/svg?seed=joanne",
    thumbnail_url: "https://picsum.photos/seed/vid4/400/700",
    video_url: null,
    caption: "The cold DM template that got us 6 discovery calls last week. Steal it:",
    likes: 31200,
    comments: 890,
    shares: 12400,
    views: 480000,
    viral_score: 79,
    posted_at: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
    tags: ["dm", "outreach", "template"],
    niche: "Agency Growth",
  },
  {
    id: "v5",
    platform: "tiktok",
    handle: "@clientgetterdan",
    display_name: "Client Getter Dan",
    avatar_url: "https://api.dicebear.com/8.x/avataaars/svg?seed=dan",
    thumbnail_url: "https://picsum.photos/seed/vid5/400/700",
    video_url: null,
    caption: "This pricing structure 10x'd my close rate. Watch until the end.",
    likes: 174000,
    comments: 3300,
    shares: 9800,
    views: 2200000,
    viral_score: 93,
    posted_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    tags: ["pricing", "sales", "agency"],
    niche: "SMMA",
  },
  {
    id: "v6",
    platform: "instagram",
    handle: "@branddesignco",
    display_name: "Brand Design Co.",
    avatar_url: "https://api.dicebear.com/8.x/avataaars/svg?seed=brand",
    thumbnail_url: "https://picsum.photos/seed/vid6/400/700",
    video_url: null,
    caption: "Why your agency logo is costing you clients (real examples)",
    likes: 67000,
    comments: 1400,
    shares: 4200,
    views: 740000,
    viral_score: 77,
    posted_at: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString(),
    tags: ["branding", "design", "agency"],
    niche: "Creative Agency",
  },
  {
    id: "v7",
    platform: "youtube",
    handle: "@agencyaccelerator",
    display_name: "Agency Accelerator",
    avatar_url: "https://api.dicebear.com/8.x/avataaars/svg?seed=acc",
    thumbnail_url: "https://picsum.photos/seed/vid7/400/700",
    video_url: null,
    caption: "Full month of outreach on camera: 247 touches → 3 clients",
    likes: 39000,
    comments: 2600,
    shares: 8100,
    views: 510000,
    viral_score: 81,
    posted_at: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
    tags: ["outreach", "transparent", "results"],
    niche: "Agency Growth",
  },
  {
    id: "v8",
    platform: "x",
    handle: "@socialmktg_pro",
    display_name: "Social Marketing Pro",
    avatar_url: "https://api.dicebear.com/8.x/avataaars/svg?seed=smpro",
    thumbnail_url: "https://picsum.photos/seed/vid8/400/700",
    video_url: null,
    caption: "Our content strategy for B2B clients. 84% engagement rate increase MoM:",
    likes: 18900,
    comments: 560,
    shares: 6300,
    views: 290000,
    viral_score: 72,
    posted_at: new Date(Date.now() - 1000 * 60 * 60 * 42).toISOString(),
    tags: ["content", "b2b", "strategy"],
    niche: "Social Media",
  },
  {
    id: "v9",
    platform: "tiktok",
    handle: "@freelancefreelancer",
    display_name: "Freelance to Agency",
    avatar_url: "https://api.dicebear.com/8.x/avataaars/svg?seed=f2a",
    thumbnail_url: "https://picsum.photos/seed/vid9/400/700",
    video_url: null,
    caption: "I fired my first client and tripled revenue in 90 days. Story time:",
    likes: 218000,
    comments: 5100,
    shares: 14700,
    views: 2900000,
    viral_score: 95,
    posted_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    tags: ["firingclients", "agency", "story"],
    niche: "SMMA",
  },
  {
    id: "v10",
    platform: "instagram",
    handle: "@videoadagency",
    display_name: "Video Ad Agency",
    avatar_url: "https://api.dicebear.com/8.x/avataaars/svg?seed=vidads",
    thumbnail_url: "https://picsum.photos/seed/vid10/400/700",
    video_url: null,
    caption: "Ad creative that generated $600k for an e-comm client this quarter",
    likes: 54000,
    comments: 1200,
    shares: 8900,
    views: 680000,
    viral_score: 85,
    posted_at: new Date(Date.now() - 1000 * 60 * 60 * 54).toISOString(),
    tags: ["ads", "ecommerce", "creative"],
    niche: "Paid Media",
  },
  {
    id: "v11",
    platform: "youtube",
    handle: "@contentmachinepro",
    display_name: "Content Machine Pro",
    avatar_url: "https://api.dicebear.com/8.x/avataaars/svg?seed=cmp",
    thumbnail_url: "https://picsum.photos/seed/vid11/400/700",
    video_url: null,
    caption: "We post 40 pieces of content/week for clients. Full process revealed.",
    likes: 27000,
    comments: 1700,
    shares: 4400,
    views: 380000,
    viral_score: 74,
    posted_at: new Date(Date.now() - 1000 * 60 * 60 * 60).toISOString(),
    tags: ["content", "process", "volume"],
    niche: "Content Agency",
  },
  {
    id: "v12",
    platform: "tiktok",
    handle: "@rankandbank",
    display_name: "Rank & Bank SEO",
    avatar_url: "https://api.dicebear.com/8.x/avataaars/svg?seed=rnb",
    thumbnail_url: "https://picsum.photos/seed/vid12/400/700",
    video_url: null,
    caption: "Ranked a site #1 in 6 weeks. Zero backlinks. Here's the playbook:",
    likes: 142000,
    comments: 3900,
    shares: 11200,
    views: 1800000,
    viral_score: 91,
    posted_at: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    tags: ["seo", "ranking", "organic"],
    niche: "SEO Agency",
  },
];

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ownerId = await getEffectiveOwnerId(supabase, user.id);
  if (!ownerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const cursor = searchParams.get("cursor");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "12", 10), 50);
  const platform = searchParams.get("platform");
  const handle = searchParams.get("handle");

  // TODO v2: replace MOCK_ITEMS with queries to:
  //   - competitor_content table (synced by a background cron)
  //   - or real-time platform API proxy calls
  let items = [...MOCK_ITEMS];

  // Platform filter
  if (platform && platform !== "all") {
    items = items.filter((i) => i.platform === platform);
  }

  // Handle filter
  if (handle) {
    items = items.filter((i) =>
      i.handle.toLowerCase().includes(handle.toLowerCase())
    );
  }

  // Cursor pagination (cursor = index offset encoded as base64)
  let startIndex = 0;
  if (cursor) {
    try {
      startIndex = parseInt(Buffer.from(cursor, "base64").toString("utf8"), 10);
    } catch {
      startIndex = 0;
    }
  }

  const pageItems = items.slice(startIndex, startIndex + limit);
  const nextStart = startIndex + pageItems.length;
  const hasMore = nextStart < items.length;
  const nextCursor = hasMore
    ? Buffer.from(String(nextStart)).toString("base64")
    : null;

  return NextResponse.json({
    items: pageItems,
    cursor: nextCursor,
    has_more: hasMore,
    total: items.length,
  });
}
