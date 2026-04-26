/**
 * Shared types for the Social Studio MVP. Keeps every tab + route on the
 * same shape definitions so the calendar, AI auto-upload, stats, and
 * top-commenters surfaces never drift on field names.
 */

export type SocialPlatform =
  | "instagram"
  | "facebook"
  | "tiktok"
  | "linkedin"
  | "twitter"
  | "youtube"
  | "pinterest"
  | "threads";

export type SocialPostStatus =
  | "draft"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed"
  | "cancelled";

export interface SocialPost {
  id: string;
  user_id: string;
  client_id: string | null;
  platforms: SocialPlatform[];
  content: string | null;
  media_urls: string[] | null;
  caption: string | null;
  hashtags: string[] | null;
  scheduled_at: string | null;
  published_at: string | null;
  status: SocialPostStatus;
  zernio_post_id: string | null;
  engagement_metrics: Record<string, unknown>;
  ai_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SocialComment {
  id: string;
  user_id: string;
  platform: SocialPlatform;
  post_id: string | null;
  commenter_handle: string;
  text: string;
  sentiment: string | null;
  zernio_comment_id: string | null;
  created_at: string;
}

export interface CaptionVariation {
  variant: number;
  text: string;
  rationale: string;
}

/**
 * Shape returned by /api/social/auto-upload — three caption ideas per
 * platform plus a curated hashtag list, recommended posting windows, and
 * the platforms the AI thinks the asset will perform best on.
 */
export interface AutoUploadSuggestions {
  platforms_recommended: SocialPlatform[];
  times_recommended: Array<{
    platform: SocialPlatform;
    iso: string;
    label: string;
    rationale: string;
  }>;
  captions_per_platform: Partial<Record<SocialPlatform, CaptionVariation[]>>;
  hashtags_per_platform: Partial<Record<SocialPlatform, string[]>>;
  asset_summary: string;
}

export interface PostStats {
  total_scheduled: number;
  posts_this_week: number;
  published_this_month: number;
  avg_engagement_rate: number;
}

export interface PlatformWeeklyCount {
  week: string;
  total: number;
  // Per-platform counts on the same row so recharts can stack lines.
  instagram: number;
  facebook: number;
  tiktok: number;
  linkedin: number;
  twitter: number;
  youtube: number;
  pinterest: number;
  threads: number;
}

export interface TopPost {
  id: string;
  caption: string | null;
  platforms: SocialPlatform[];
  published_at: string | null;
  engagement_total: number;
}

/**
 * Heatmap cell for "best post times". `intensity` is a 0–1 normalized
 * score we use to colour the cell.
 */
export interface HeatmapCell {
  day: number; // 0 = Sun .. 6 = Sat
  hour: number; // 0..23
  count: number;
  intensity: number;
}

export interface TopCommenter {
  commenter_handle: string;
  platform: SocialPlatform;
  total_comments: number;
  most_recent_comment: string;
  most_recent_at: string;
}

export interface ContentIdea {
  title: string;
  hook: string;
  format: string; // e.g. "carousel", "reel", "thread"
  platforms: SocialPlatform[];
}

export interface TrendsResponse {
  hashtags_by_platform: Partial<Record<SocialPlatform, string[]>>;
  ideas: ContentIdea[];
  niche: string;
}
