import { SocialPlatform } from "./types";

/**
 * Per-platform "best post window" rules used by the AI Auto-Upload tab when
 * scoring suggested send times. v1 ships these as hardcoded heuristics so the
 * UX flow lands first; a future ML pass can replace this with per-account
 * historical analysis.
 *
 * Hours are 24h local-clock based on the user's timezone — the route just
 * picks a date and combines with the recommended hour.
 */
export const PLATFORM_BEST_HOURS: Record<SocialPlatform, number[]> = {
  // LinkedIn weekday business hours dominate engagement; avoid weekends.
  linkedin: [8, 9, 10, 12, 17],
  // Instagram engagement peaks late morning + early evening.
  instagram: [11, 13, 19, 20],
  // TikTok skews evening + late night.
  tiktok: [18, 19, 20, 21, 22],
  // Facebook mid-day + early evening.
  facebook: [12, 13, 15, 19],
  // X/Twitter morning commute + lunch + evening.
  twitter: [8, 9, 12, 17, 21],
  // YouTube evenings work for both Shorts and long-form intent.
  youtube: [17, 18, 19, 20, 21],
  // Pinterest evenings — discovery time, weekend lift.
  pinterest: [20, 21, 22],
  // Threads echoes Instagram but slightly later in the evening.
  threads: [12, 19, 20, 21],
};

/**
 * Days the platform performs noticeably worse — used to skip those days
 * when generating a candidate window list. 0 = Sunday … 6 = Saturday.
 */
export const PLATFORM_WEAK_DAYS: Partial<Record<SocialPlatform, number[]>> = {
  linkedin: [0, 6], // weekends are quiet for B2B
  // The rest perform consistently across the week — leave empty.
};

/**
 * Fallback hashtag pool when Zernio analytics aren't returning trending
 * tags for a given platform. Curated for an agency-owner / digital-marketing
 * niche; the route lets callers override via a `niche` query param.
 */
export const FALLBACK_HASHTAGS: Record<SocialPlatform, string[]> = {
  instagram: [
    "#smallbusiness",
    "#marketingagency",
    "#entrepreneurlife",
    "#contentcreator",
    "#digitalmarketing",
    "#growyourbusiness",
    "#marketingtips",
    "#instagrowth",
    "#brandstrategy",
    "#reelstrending",
  ],
  tiktok: [
    "#smallbusinesstiktok",
    "#marketingtiktok",
    "#entrepreneur",
    "#fyp",
    "#agencylife",
    "#marketingtips",
    "#contentstrategy",
    "#smbgrowth",
    "#digitalstrategy",
    "#viralmarketing",
  ],
  linkedin: [
    "#leadership",
    "#marketing",
    "#entrepreneurship",
    "#growthstrategy",
    "#smb",
    "#agencylife",
    "#productivity",
    "#thoughtleadership",
    "#b2b",
    "#linkedinmarketing",
  ],
  facebook: [
    "#smallbusiness",
    "#marketing",
    "#entrepreneur",
    "#agencyowner",
    "#growthhacking",
    "#localbusiness",
    "#marketingtips",
    "#contentmarketing",
    "#brandstrategy",
    "#facebookmarketing",
  ],
  twitter: [
    "#marketing",
    "#startup",
    "#smb",
    "#growth",
    "#buildinpublic",
    "#agency",
    "#contentmarketing",
    "#saas",
    "#entrepreneurship",
    "#leadgen",
  ],
  youtube: [
    "#youtube",
    "#shorts",
    "#marketing",
    "#contentcreator",
    "#agency",
    "#videomarketing",
    "#smallbusiness",
    "#youtubegrowth",
    "#digitalmarketing",
    "#reels",
  ],
  pinterest: [
    "#marketingtips",
    "#smallbusiness",
    "#contentideas",
    "#brandstrategy",
    "#agencylife",
    "#instagramtips",
    "#socialmediamarketing",
    "#marketinginspiration",
    "#brandinginspo",
    "#contentcreator",
  ],
  threads: [
    "#threads",
    "#marketing",
    "#smallbusiness",
    "#content",
    "#agency",
    "#growth",
    "#strategy",
    "#brand",
    "#community",
    "#creators",
  ],
};

/**
 * Display metadata for each platform — colours + short labels used by
 * every tab so the chips/legends are consistent.
 */
export const PLATFORM_META: Record<SocialPlatform, { label: string; color: string; bg: string; border: string }> = {
  instagram:  { label: "Instagram", color: "#EC4899", bg: "rgba(236,72,153,0.10)", border: "rgba(236,72,153,0.30)" },
  facebook:   { label: "Facebook",  color: "#3B82F6", bg: "rgba(59,130,246,0.10)", border: "rgba(59,130,246,0.30)" },
  tiktok:     { label: "TikTok",    color: "#E4E4E7", bg: "rgba(228,228,231,0.10)", border: "rgba(228,228,231,0.30)" },
  linkedin:   { label: "LinkedIn",  color: "#60A5FA", bg: "rgba(96,165,250,0.10)", border: "rgba(96,165,250,0.30)" },
  twitter:    { label: "X",         color: "#A1A1AA", bg: "rgba(161,161,170,0.10)", border: "rgba(161,161,170,0.30)" },
  youtube:    { label: "YouTube",   color: "#F87171", bg: "rgba(248,113,113,0.10)", border: "rgba(248,113,113,0.30)" },
  pinterest:  { label: "Pinterest", color: "#F472B6", bg: "rgba(244,114,182,0.10)", border: "rgba(244,114,182,0.30)" },
  threads:    { label: "Threads",   color: "#D4D4D8", bg: "rgba(212,212,216,0.10)", border: "rgba(212,212,216,0.30)" },
};

export const ALL_PLATFORMS: SocialPlatform[] = [
  "instagram",
  "tiktok",
  "linkedin",
  "facebook",
  "twitter",
  "youtube",
  "pinterest",
  "threads",
];

export const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  draft:       { label: "Draft",       color: "#A1A1AA", bg: "rgba(161,161,170,0.10)" },
  scheduled:   { label: "Scheduled",   color: "#60A5FA", bg: "rgba(96,165,250,0.10)" },
  publishing:  { label: "Publishing",  color: "#FBBF24", bg: "rgba(251,191,36,0.10)" },
  published:   { label: "Published",   color: "#4ADE80", bg: "rgba(74,222,128,0.10)" },
  failed:      { label: "Failed",      color: "#F87171", bg: "rgba(248,113,113,0.10)" },
  cancelled:   { label: "Cancelled",   color: "#A1A1AA", bg: "rgba(161,161,170,0.10)" },
};
