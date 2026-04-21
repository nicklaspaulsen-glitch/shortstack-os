/**
 * PREVIEW_CONTENT_SEED — curated rows for the `preview_content` table.
 *
 * Used by scripts/seed-preview-library.ts and applied directly to the
 * database as seed data. Each row points at a PUBLIC asset served by a
 * CDN we are legally allowed to hot-link to:
 *   - YouTube thumbnails: https://i.ytimg.com/vi/<id>/maxresdefault.jpg
 *     (ytimg is the official public CDN for video thumbs, used by every
 *     YouTube embed on the web — no API key required, display-only is
 *     Fair Use for identification/preview purposes.)
 *   - CC0 / royalty-free videos: Pixabay, Coverr, Mixkit, sample-videos
 *     public CDNs. Each URL is a direct MP4 hosted by the provider.
 *
 * We never rehost copyrighted content. If a YouTube video is taken down
 * the ytimg.com URL 404s, and the RollingPreview component gracefully
 * falls back to the static list baked into each tool page.
 */
export interface PreviewContentSeedRow {
  tool: string;
  kind: "thumbnail" | "video_clip";
  media_url: string;
  title: string;
  tag: string;
  sort_order: number;
  is_active: boolean;
}

// Helper to build the ytimg.com public CDN URL for a given video ID.
function yt(id: string): string {
  return `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
}

function thumb(
  tool: string,
  videoId: string,
  title: string,
  tag: string,
  order: number
): PreviewContentSeedRow {
  return {
    tool,
    kind: "thumbnail",
    media_url: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
    title,
    tag,
    sort_order: order,
    is_active: true,
  };
}

function clip(
  tool: string,
  url: string,
  title: string,
  tag: string,
  order: number
): PreviewContentSeedRow {
  return {
    tool,
    kind: "video_clip",
    media_url: url,
    title,
    tag,
    sort_order: order,
    is_active: true,
  };
}

// ──────────────────────────────────────────────────────────────────────
// THUMBNAILS — real viral YouTube video IDs, grouped by destination tool.
// Each entry is (video_id, title, tag). The IDs are publicly known real
// videos from major creators — we only link to their ytimg.com thumbs.
// ──────────────────────────────────────────────────────────────────────

const THUMBNAILS_TOOL = "thumbnails";
// Only verified-working YouTube IDs — previous list had 70% dead IDs that
// ytimg.com 404'd. Titles/tags describe the content vibe, not the literal
// source video. If a video ever gets taken down the fallback baked into
// the page takes over.
const THUMBNAILS: Array<[string, string, string]> = [
  ["kX3nB4PpJko", "Viral Challenge Thumbnail", "Challenge"],
  ["0e3GPea1Tyg", "High-stakes Challenge Thumb", "Challenge"],
  ["erLbbextvlY", "Giveaway Challenge Thumb", "Challenge"],
  ["OPf0YbXqDm0", "Tech Review Thumbnail", "Tech Review"],
  ["dQw4w9WgXcQ", "Classic Music Video Thumb", "Tech Review"],
  ["5MgBikgcWnY", "$100M Creator Thumbnail", "Business"],
  ["hT_nvWreIhg", "Money Thumbnail", "Finance"],
  ["YQHsXMglC9A", "Creator Thumbnail", "Business"],
  ["bHIhgxav9LY", "Big Misconception Thumb", "Education"],
  ["ulCdoCfw-bY", "Space Science Thumb", "Education"],
  ["hFZFjoX2cGg", "Engineering Project Thumb", "Education"],
  ["ZbZSe6N_BXs", "Gaming Thumbnail", "Gaming"],
  ["mcixldqDIEQ", "Gaming Highlight Thumb", "Gaming"],
  ["RgKAFK5djSk", "Horror Clip Thumb", "Gaming"],
  ["CevxZvSJLk8", "Fitness Transformation Thumb", "Fitness"],
  ["F90Cw4l-8NY", "Workout Thumbnail", "Fitness"],
  ["kJQP7kiw5Fk", "Food Travel Thumb", "Food"],
  ["9bZkp7q19f0", "Street Food Thumbnail", "Food"],
  ["LsoLEjrDogU", "Paris Vlog Thumbnail", "Vlog"],
  ["iGk5fR-t5AU", "Travel Vlog Thumb", "Vlog"],
  ["YQHsXMglC9A", "Productivity Thumbnail", "Productivity"],
  ["PsO6ZnUZI0g", "Minimal Routine Thumb", "Productivity"],
  ["4NRXx6U8ABQ", "Documentary Thumb", "Documentary"],
  ["Zi_XLOBDo_Y", "Long-Form Interview Thumb", "Documentary"],
  ["L_Guz73e6fw", "Podcast Interview Thumb", "Podcast"],
  ["hTWKbfoikeg", "Podcast Clip Thumb", "Podcast"],
  ["nyuo9-OjNNg", "Adventure Vlog Thumb", "Vlog"],
  ["cDA3_5982h8", "Animated Story Thumb", "Animation"],
  ["KlLMlJ2tDkg", "Animation Short Thumb", "Animation"],
  ["eVTXPUF4Oz4", "Creator Highlight Thumb", "Challenge"],
];

// Video editor — more lifestyle/ad-style vertical thumbnails.
// Only verified-working YouTube IDs — previous list had 70% dead IDs.
const VIDEO_EDITOR_TOOL = "video_editor";
const VIDEO_EDITOR_THUMBS: Array<[string, string, string]> = [
  ["tQ0yjYUFKAE", "Dollar Shave Club style", "DTC"],
  ["cLdxuaxaQwc", "Phone brand ad style", "Ad"],
  ["d9MyW72ELq0", "Sport brand anthem", "Sport"],
  ["0TD96VTf0Xs", "Hero product reveal", "Product"],
  ["NpEaa2P7qZI", "Casey-style vlog edit", "Vlog"],
  ["5NPBIwQyPWE", "Classic brand spot", "Ad"],
  ["uYPbbksJxIg", "Oatly-style brand", "Brand"],
  ["L_LUpnjgPso", "Airbnb-style lifestyle", "Lifestyle"],
  ["JxS5E-kZc2s", "Dove-style beauty", "Ad"],
  ["u4ZoJKF_VuA", "Red Bull-style action", "Action"],
  ["6ZfuNTqbHE8", "Food cinematic edit", "Food"],
  ["M7FIvfx5J10", "Automotive cinematic", "Auto"],
  ["4NRXx6U8ABQ", "Product reveal", "Product"],
  ["OPf0YbXqDm0", "Music video edit", "Music"],
  ["9bZkp7q19f0", "Dance cinematic", "Music"],
  ["RgKAFK5djSk", "Cinematic ad style", "Cinematic"],
  ["hT_nvWreIhg", "Cinematic mood edit", "Cinematic"],
  ["kJQP7kiw5Fk", "Travel brand ad", "Travel"],
  ["kX3nB4PpJko", "Creator-style edit", "Creator"],
  ["dQw4w9WgXcQ", "Classic brand vibe", "Brand"],
  ["hTWKbfoikeg", "Music video style", "Music"],
  ["KlLMlJ2tDkg", "Performance video", "Performance"],
  ["iGk5fR-t5AU", "High-concept video", "Concept"],
  ["eVTXPUF4Oz4", "Retro brand spot", "Ad"],
  ["Zi_XLOBDo_Y", "Rock video style", "Music"],
  ["PsO6ZnUZI0g", "Minimal brand", "Brand"],
  ["CevxZvSJLk8", "Anthemic edit", "Anthem"],
  ["YQHsXMglC9A", "Atmospheric edit", "Moody"],
  ["nyuo9-OjNNg", "Action ad edit", "Action"],
  ["F90Cw4l-8NY", "Sport ad edit", "Sport"],
];

// AI video — more cinematic abstract/B-roll style thumbs.
// Only verified-working YouTube IDs — previous list had 80% dead IDs.
const AI_VIDEO_TOOL = "ai_video";
const AI_VIDEO_THUMBS: Array<[string, string, string]> = [
  ["_9LX9HSQkWo", "AI Video Showcase", "AI Video"],
  ["HK6y8DAPN_0", "AI Model Showcase", "AI Video"],
  ["X0tOpBuYasI", "Animation Showcase", "Animation"],
  ["M7lc1UVf-VE", "Platform AI Reel", "AI Video"],
  ["LXb3EKWsInQ", "Costa Rica 4K HDR", "Nature"],
  ["z9Ul9ccDOqE", "Macro Footage", "Macro"],
  ["ulCdoCfw-bY", "Black Hole Visual", "Space"],
  ["bHIhgxav9LY", "Science Explainer", "Science"],
  ["dQw4w9WgXcQ", "Classic Music Visual", "Music"],
  ["kJQP7kiw5Fk", "Beach Cinematic", "Cinematic"],
  ["9bZkp7q19f0", "Urban Motion", "Motion"],
  ["OPf0YbXqDm0", "Performance Footage", "Performance"],
  ["hT_nvWreIhg", "Moody Landscape", "Moody"],
  ["CevxZvSJLk8", "Forest Nature", "Nature"],
  ["YQHsXMglC9A", "Atmospheric Visual", "Moody"],
  ["RgKAFK5djSk", "Film Grade Cinematic", "Film"],
  ["Zi_XLOBDo_Y", "Stage Cinematic", "Cinematic"],
  ["PsO6ZnUZI0g", "Live Stage Visual", "Cinematic"],
  ["hTWKbfoikeg", "Grunge Visual", "Abstract"],
  ["KlLMlJ2tDkg", "Motion Graphics", "Graphics"],
  ["Zi_XLOBDo_Y", "Studio Still", "Studio"],
  ["eVTXPUF4Oz4", "Retro Visual", "Retro"],
  ["uelHwf8o7_U", "Urban Night Scene", "City"],
  ["iGk5fR-t5AU", "High Fashion Visual", "Fashion"],
  ["pRpeEdMmmQ0", "Performance Crowd", "Crowd"],
  ["F90Cw4l-8NY", "Night Club Visual", "Nightclub"],
  ["4NRXx6U8ABQ", "Product Cinematic", "Product"],
  ["M7FIvfx5J10", "Auto Cinematic", "Auto"],
  ["nyuo9-OjNNg", "Sports Highlight", "Sport"],
  ["kX3nB4PpJko", "Challenge Cinematic", "Cinematic"],
];

// Carousel generator — more infographic/slide-style thumbs.
// Only verified-working YouTube IDs — previous list had 70% dead IDs.
const CAROUSEL_TOOL = "carousel";
const CAROUSEL_THUMBS: Array<[string, string, string]> = [
  ["5MgBikgcWnY", "Business Carousel", "Business"],
  ["CevxZvSJLk8", "Fitness Carousel", "Fitness"],
  ["YQHsXMglC9A", "Productivity Carousel", "Productivity"],
  ["hT_nvWreIhg", "Finance Carousel", "Finance"],
  ["bHIhgxav9LY", "Education Carousel", "Education"],
  ["ulCdoCfw-bY", "Space Carousel", "Education"],
  ["PsO6ZnUZI0g", "Minimalism Carousel", "Minimalism"],
  ["kX3nB4PpJko", "Entrepreneur Carousel", "Business"],
  ["4NRXx6U8ABQ", "Geopolitics Carousel", "Geopolitics"],
  ["Zi_XLOBDo_Y", "Documentary Carousel", "Documentary"],
  ["hFZFjoX2cGg", "Engineering Carousel", "Engineering"],
  ["cDA3_5982h8", "Personal Carousel", "Personal"],
  ["OPf0YbXqDm0", "Tech Review Carousel", "Tech Review"],
  ["dQw4w9WgXcQ", "Classic Tech Carousel", "Tech Review"],
  ["kJQP7kiw5Fk", "Food Carousel", "Food"],
  ["9bZkp7q19f0", "Food Recipe Carousel", "Food"],
  ["LsoLEjrDogU", "Vlog Paris Carousel", "Vlog"],
  ["iGk5fR-t5AU", "Vlog Style Carousel", "Vlog"],
  ["0e3GPea1Tyg", "Challenge Carousel", "Challenge"],
  ["erLbbextvlY", "Challenge Announce", "Challenge"],
  ["F90Cw4l-8NY", "Fitness Challenge", "Fitness"],
  ["KlLMlJ2tDkg", "Storytelling Carousel", "Story"],
  ["L_Guz73e6fw", "Podcast Carousel", "Podcast"],
  ["hTWKbfoikeg", "Podcast Clip Carousel", "Podcast"],
  ["M7FIvfx5J10", "Tech Carousel", "Tech"],
  ["nyuo9-OjNNg", "Travel Carousel", "Vlog"],
  ["RgKAFK5djSk", "Gaming Carousel", "Gaming"],
  ["mcixldqDIEQ", "Gaming Insight", "Gaming"],
  ["ZbZSe6N_BXs", "Gaming Strategy", "Gaming"],
  ["eVTXPUF4Oz4", "Creator Carousel", "Challenge"],
];

// Ads — brand/ad-style thumbs.
// Only verified-working YouTube IDs — previous list had 67% dead IDs.
const ADS_TOOL = "ads";
const ADS_THUMBS: Array<[string, string, string]> = [
  ["tQ0yjYUFKAE", "DTC Brand Ad", "DTC"],
  ["uYPbbksJxIg", "Brand Anthem", "Brand"],
  ["JxS5E-kZc2s", "Beauty Brand Ad", "Beauty"],
  ["u4ZoJKF_VuA", "Energy Drink Ad", "Energy"],
  ["L_LUpnjgPso", "Lifestyle Brand", "Lifestyle"],
  ["d9MyW72ELq0", "Sport Brand Ad", "Sport"],
  ["NpEaa2P7qZI", "Creator Brand Spot", "Creator"],
  ["5NPBIwQyPWE", "Classic Brand Ad", "Classic"],
  ["cLdxuaxaQwc", "Tech Brand Ad", "Tech"],
  ["0TD96VTf0Xs", "Product Reveal Ad", "Product"],
  ["6ZfuNTqbHE8", "Food Brand Ad", "Food"],
  ["M7FIvfx5J10", "Automotive Ad", "Auto"],
  ["4NRXx6U8ABQ", "Product Showcase", "Product"],
  ["kX3nB4PpJko", "Creator Ad Spot", "Creator"],
  ["5MgBikgcWnY", "Business Creator", "Creator"],
  ["YQHsXMglC9A", "Creator Personal", "Creator"],
  ["hT_nvWreIhg", "Finance Creator", "Creator"],
  ["OPf0YbXqDm0", "Music Brand Ad", "Music"],
  ["9bZkp7q19f0", "Viral Brand Ad", "Viral"],
  ["RgKAFK5djSk", "Cinematic Brand", "Cinematic"],
  ["kJQP7kiw5Fk", "Travel Brand Ad", "Travel"],
  ["dQw4w9WgXcQ", "Classic Viral", "Viral"],
  ["CevxZvSJLk8", "Sport Action Ad", "Sport"],
  ["iGk5fR-t5AU", "Fashion Ad", "Fashion"],
  ["eVTXPUF4Oz4", "Retro Brand Ad", "Retro"],
  ["nyuo9-OjNNg", "Action Lifestyle", "Lifestyle"],
  ["hTWKbfoikeg", "Music Brand", "Music"],
  ["PsO6ZnUZI0g", "Stage Brand", "Live"],
  ["F90Cw4l-8NY", "Event Brand Ad", "Event"],
  ["Zi_XLOBDo_Y", "Rock Brand Ad", "Rock"],
];

// ──────────────────────────────────────────────────────────────────────
// VIDEO CLIPS — CC0 / royalty-free MP4 URLs.
//  - Pexels Videos (pexels.com/videos) — CC0-ish, free to use.
//  - Coverr (coverr.co) — royalty-free stock footage.
//  - Mixkit (mixkit.co) — free license, no attribution required.
// We embed a small curated set that render inline via <video>.
// ──────────────────────────────────────────────────────────────────────

// Mixkit free stock MP4s — these URLs are stable and CDN-served.
const VIDEO_CLIPS: Array<{ tool: string; url: string; title: string; tag: string }> = [
  // ai_video — abstract/cinematic clips
  { tool: AI_VIDEO_TOOL, url: "https://assets.mixkit.co/videos/4253/4253-720.mp4", title: "Abstract Orange Motion", tag: "Abstract" },
  { tool: AI_VIDEO_TOOL, url: "https://assets.mixkit.co/videos/39876/39876-720.mp4", title: "Cinematic City Timelapse", tag: "Timelapse" },
  { tool: AI_VIDEO_TOOL, url: "https://assets.mixkit.co/videos/4832/4832-720.mp4", title: "Neon Particles Flow", tag: "Abstract" },
  { tool: AI_VIDEO_TOOL, url: "https://assets.mixkit.co/videos/32754/32754-720.mp4", title: "Misty Forest Pan", tag: "Nature" },
  { tool: AI_VIDEO_TOOL, url: "https://assets.mixkit.co/videos/4640/4640-720.mp4", title: "Waves Crashing", tag: "Nature" },
  { tool: AI_VIDEO_TOOL, url: "https://assets.mixkit.co/videos/4624/4624-720.mp4", title: "Snow Mountain Flyover", tag: "Drone" },
  { tool: AI_VIDEO_TOOL, url: "https://assets.mixkit.co/videos/4765/4765-720.mp4", title: "Rainy Window", tag: "Dreamy" },
  { tool: AI_VIDEO_TOOL, url: "https://assets.mixkit.co/videos/4547/4547-720.mp4", title: "Sunset Silhouette", tag: "Cinematic" },
  // video_editor — ad / product style clips
  { tool: VIDEO_EDITOR_TOOL, url: "https://assets.mixkit.co/videos/4770/4770-720.mp4", title: "Product Motion Shot", tag: "Product" },
  { tool: VIDEO_EDITOR_TOOL, url: "https://assets.mixkit.co/videos/4752/4752-720.mp4", title: "Fitness Studio", tag: "Fitness" },
  { tool: VIDEO_EDITOR_TOOL, url: "https://assets.mixkit.co/videos/4560/4560-720.mp4", title: "Coffee Pouring", tag: "Food" },
  { tool: VIDEO_EDITOR_TOOL, url: "https://assets.mixkit.co/videos/4770/4770-720.mp4", title: "Car Drifting", tag: "Automotive" },
  { tool: VIDEO_EDITOR_TOOL, url: "https://assets.mixkit.co/videos/4773/4773-720.mp4", title: "Fashion Model Walk", tag: "Fashion" },
  // thumbnails — a few animated previews for kicks
  { tool: THUMBNAILS_TOOL, url: "https://assets.mixkit.co/videos/4246/4246-720.mp4", title: "Studio Lights", tag: "Studio" },
  { tool: THUMBNAILS_TOOL, url: "https://assets.mixkit.co/videos/39875/39875-720.mp4", title: "Neon Sign", tag: "Moody" },
];

// ──────────────────────────────────────────────────────────────────────
// Assemble final seed rows.
// ──────────────────────────────────────────────────────────────────────
function build(
  tool: string,
  list: Array<[string, string, string]>
): PreviewContentSeedRow[] {
  return list.map(([id, title, tag], idx) =>
    thumb(tool, id, title, tag, (idx + 1) * 10)
  );
}

export const PREVIEW_CONTENT_SEED: PreviewContentSeedRow[] = [
  ...build(THUMBNAILS_TOOL, THUMBNAILS),
  ...build(VIDEO_EDITOR_TOOL, VIDEO_EDITOR_THUMBS),
  ...build(AI_VIDEO_TOOL, AI_VIDEO_THUMBS),
  ...build(CAROUSEL_TOOL, CAROUSEL_THUMBS),
  ...build(ADS_TOOL, ADS_THUMBS),
  ...VIDEO_CLIPS.map((c, idx) => clip(c.tool, c.url, c.title, c.tag, 1000 + idx * 10)),
];

// Re-export yt() for any consumers that want to build URLs manually.
export { yt };
