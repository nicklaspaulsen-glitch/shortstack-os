/**
 * Pro Services Directory — shared types + constants.
 *
 * The "curated marketplace" where ShortStack agency users can hire vetted
 * human freelancers (editors, thumbnail artists, VO, etc.) when they want
 * human quality over AI output. v1 is email/Telegram notification only;
 * payments flow outside ShortStack (freelancer invoices client directly).
 */

export type ProServiceCategory =
  | "video_editor"
  | "thumbnail_artist"
  | "voice_over"
  | "copywriter"
  | "designer"
  | "other";

export const PRO_SERVICE_CATEGORIES: Array<{
  id: ProServiceCategory;
  label: string;
  description: string;
}> = [
  { id: "video_editor",    label: "Video Editors",      description: "Short-form + long-form video editing" },
  { id: "thumbnail_artist", label: "Thumbnail Artists", description: "High-CTR thumbnails and cover art" },
  { id: "voice_over",      label: "Voice-Over",          description: "Narration, commercial, explainer VO" },
  { id: "copywriter",      label: "Copywriters",         description: "Scripts, landing pages, email" },
  { id: "designer",        label: "Designers",           description: "Logos, brand kits, graphics" },
  { id: "other",           label: "Other",               description: "Motion graphics, 3D, misc creative" },
];

export function isValidCategory(v: unknown): v is ProServiceCategory {
  return (
    typeof v === "string" &&
    PRO_SERVICE_CATEGORIES.some((c) => c.id === v)
  );
}

export function categoryLabel(id: string | null | undefined): string {
  if (!id) return "Other";
  return PRO_SERVICE_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

// ─── Domain types (match DB column shapes 1:1) ────────────────────

export interface ProProvider {
  id: string;
  name: string;
  email: string;
  bio: string | null;
  avatar_url: string | null;
  timezone: string | null;
  categories: ProServiceCategory[];
  starting_price_cents: number;
  turnaround_days: number;
  portfolio_urls: string[];
  vetted: boolean;
  vetted_at: string | null;
  subscription_status: "active" | "inactive" | "trialing";
  stripe_subscription_id: string | null;
  created_at: string;
}

export type ProRequestStatus =
  | "open"
  | "quoted"
  | "accepted"
  | "declined"
  | "completed"
  | "cancelled";

export interface ProRequest {
  id: string;
  user_id: string;
  provider_id: string;
  category: string;
  title: string;
  description: string;
  budget_cents: number | null;
  deadline: string | null;
  attachments: Array<{ name: string; url: string }>;
  status: ProRequestStatus;
  quote_cents: number | null;
  quote_message: string | null;
  accepted_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface ProReview {
  id: string;
  request_id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────

export function fmtPrice(cents: number | null | undefined): string {
  if (!cents || cents <= 0) return "Quote on request";
  return `$${(cents / 100).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })}+`;
}

export function statusColor(status: ProRequestStatus): {
  bg: string;
  fg: string;
  label: string;
} {
  switch (status) {
    case "open":
      return { bg: "rgba(59, 130, 246, 0.15)", fg: "#60a5fa", label: "Open" };
    case "quoted":
      return { bg: "rgba(168, 85, 247, 0.15)", fg: "#c084fc", label: "Quoted" };
    case "accepted":
      return { bg: "rgba(16, 185, 129, 0.15)", fg: "#10b981", label: "Accepted" };
    case "declined":
      return { bg: "rgba(239, 68, 68, 0.15)", fg: "#f87171", label: "Declined" };
    case "completed":
      return { bg: "rgba(200, 168, 85, 0.15)", fg: "#c8a855", label: "Completed" };
    case "cancelled":
      return { bg: "rgba(107, 114, 128, 0.15)", fg: "#9ca3af", label: "Cancelled" };
  }
}
