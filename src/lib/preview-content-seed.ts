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
const THUMBNAILS: Array<[string, string, string]> = [
  ["kX3nB4PpJko", "Last To Leave Chair Wins $500K", "Challenge"],
  ["0e3GPea1Tyg", "Squid Game In Real Life", "Challenge"],
  ["jsq2rNZHlOk", "I Spent 50 Hours Buried Alive", "Challenge"],
  ["erLbbextvlY", "I Gave My 40M Sub Away", "Challenge"],
  ["aZ03JUi9-SA", "iPhone 15 Pro Max Review", "Tech Review"],
  ["5P7O8HhD9Eg", "Ranking Every Phone I've Reviewed", "Tech Review"],
  ["BtvNQLzNc_g", "I Built a Petabyte Home Server", "Tech Review"],
  ["4Zl3bTxA7vs", "$100M Offers — Hormozi", "Business"],
  ["TUt1JlP48nE", "Why I'm Selling Everything", "Finance"],
  ["XkP4_n3bmQ8", "$10k/Month In 2024", "Business"],
  ["bHIhgxav9LY", "Big Misconception About Electricity", "Education"],
  ["ulCdoCfw-bY", "What If The Biggest Black Hole Hit Earth", "Education"],
  ["hFZFjoX2cGg", "Squirrel Proof Bird Feeder", "Education"],
  ["PWCxb3B1gxE", "Minecraft but I Die I Restart", "Gaming"],
  ["EBP4xr-o4oY", "Speedrunner vs 3 Hunters", "Gaming"],
  ["KQI_m-Gs2Kw", "Scariest Game I've Played", "Gaming"],
  ["fIKC1vH9a3s", "Most Effective Way To Lose Fat", "Fitness"],
  ["FMlVTSGlC8g", "Day Of My Olympia Win", "Fitness"],
  ["Ci_Qx4rYIDs", "Perfect Breakfast Sandwich", "Food"],
  ["rT1h6u8kKkw", "McDonald's McRib At Home", "Food"],
  ["xXiO80ccmfU", "Snowboarding With The NYPD", "Vlog"],
  ["LsoLEjrDogU", "Paris Breakdown", "Vlog"],
  ["Mvh6D3JHuLc", "How I Manage My Time", "Productivity"],
  ["rRYXVCswkKk", "Why I Own Almost Nothing", "Productivity"],
  ["a5FYcTYKI1U", "Inside The SBF FTX Fraud", "Documentary"],
  ["z7R3qIkOH3I", "Why This Tiny Country Has Power", "Documentary"],
  ["1PsZZycn9z8", "JRE — Elon Musk", "Podcast"],
  ["L_Guz73e6fw", "Lex — Sam Altman AGI", "Podcast"],
  ["NSW26z1uFhU", "Surprising Best Friend With $100K", "Vlog"],
  ["cDA3_5982h8", "Things About Me — Jaiden", "Animation"],
];

// Video editor — more lifestyle/ad-style vertical thumbnails.
const VIDEO_EDITOR_TOOL = "video_editor";
const VIDEO_EDITOR_THUMBS: Array<[string, string, string]> = [
  ["pWtH9PbsXYs", "iPhone — Shot on iPhone", "Ad"],
  ["cLdxuaxaQwc", "Samsung — Do What You Can't", "Ad"],
  ["d9MyW72ELq0", "Nike — You Can't Stop Us", "Ad"],
  ["0TD96VTf0Xs", "Apple Vision Pro — Hello", "Ad"],
  ["aIvQyDAIsEM", "Apple — Meet the iPhone 14 Pro", "Ad"],
  ["PnzVhqbzyMw", "Tesla — Cybertruck", "Ad"],
  ["GFQyfasNu4E", "Allbirds — First Running Shoe", "Ad"],
  ["NpEaa2P7qZI", "Casey Neistat — Make It Count", "Vlog"],
  ["xBmPsBNY17A", "Peter McKinnon Cinematic B-Roll", "Cinematic"],
  ["Q7P7oMRyq-o", "Rolex — A Pioneer of Values", "Luxury"],
  ["KqffpTQVAqY", "BMW — The 8", "Automotive"],
  ["pMB_g7SXZog", "Red Bull Stratos Jump", "Action"],
  ["aMYyOCm0nsc", "Marvel Avengers Endgame Trailer", "Film"],
  ["5NPBIwQyPWE", "Coke — Share A Coke", "Ad"],
  ["tQ0yjYUFKAE", "Dollar Shave Club — Blades", "Ad"],
  ["I38b8-9syRU", "Squarespace Super Bowl Ad", "Ad"],
  ["VB5XAc-5Pjw", "Netflix — The Crown Trailer", "Film"],
  ["uYPbbksJxIg", "Oatly — Wow No Cow", "Ad"],
  ["L_LUpnjgPso", "Airbnb — Belong Anywhere", "Ad"],
  ["w4p_5d8GmDU", "Tiffany — Not Your Mother's", "Luxury"],
  ["gxV0CWUGLXM", "GoPro Hero 12 Reel", "Sport"],
  ["_lYmz-YFRLU", "Patagonia — The Fisherman's Son", "Outdoor"],
  ["JxS5E-kZc2s", "Dove — Real Beauty Sketches", "Ad"],
  ["hXWIENcHtyQ", "Volvo — Epic Split Van Damme", "Ad"],
  ["ZOCcDbJ5uV4", "Nike — Dream Crazy Kaepernick", "Ad"],
  ["wcRYrJlNCJw", "Peloton — Workout", "Fitness"],
  ["u4ZoJKF_VuA", "Red Bull — Gives You Wings", "Ad"],
  ["rmOlB6cKy9E", "Epic Meal Time Huge Burger", "Food"],
  ["x_NKvvT66DE", "Casey Neistat Drone Flight", "Vlog"],
  ["6ZfuNTqbHE8", "Gordon Ramsay Hell's Kitchen", "Food"],
];

// AI video — more cinematic abstract/B-roll style thumbs.
const AI_VIDEO_TOOL = "ai_video";
const AI_VIDEO_THUMBS: Array<[string, string, string]> = [
  ["_9LX9HSQkWo", "Runway Gen-3 Showcase", "AI Video"],
  ["FfqqDxF_qFY", "OpenAI Sora Trailer", "AI Video"],
  ["HK6y8DAPN_0", "Kling AI Showcase", "AI Video"],
  ["_Lr1d4uvHg0", "Pika Labs Art", "AI Video"],
  ["YSs8QelfwjI", "Luma Dream Machine", "AI Video"],
  ["BlnTpjoxAHQ", "Minimax Hailuo Video", "AI Video"],
  ["Ap0UN3IMWNw", "Runway ML Reel", "AI Video"],
  ["jwhUxyVYrZU", "Adobe Firefly Video", "AI Video"],
  ["nTmgqlMFq4M", "AI Animated Short", "Animation"],
  ["JGPNAc_N4k8", "Kurzgesagt Motion Graphics", "Animation"],
  ["X0tOpBuYasI", "Blur Studio Love Death", "Animation"],
  ["-nZU7jfaTfI", "AI Cinematic Trailer", "Cinematic"],
  ["qfWMJoNMEcA", "Imaginative AI Short", "Cinematic"],
  ["pWtH9PbsXYs", "Shot on iPhone Cinematic", "Cinematic"],
  ["wQSlUCndyGc", "Neon Cyberpunk AI Scene", "Abstract"],
  ["KAr5iWdUGeA", "Blender Open Movie — Spring", "Animation"],
  ["XgM_cXBDBOY", "AI Surreal Dreamscape", "Surreal"],
  ["M7lc1UVf-VE", "Google AI Showcase", "AI"],
  ["fsZwVkEm-wQ", "Blender 3D Demo Reel", "Animation"],
  ["eZwGYnz88bI", "AI Color Particles", "Abstract"],
  ["9qLWLsOQYQI", "Unreal Engine 5 City Sample", "3D"],
  ["DvT3xkm5hyk", "AI Portrait Generator Demo", "Portrait"],
  ["jpXFKMu2UXY", "DeepMotion AI Animation", "Animation"],
  ["LXb3EKWsInQ", "Costa Rica In 4K HDR", "Nature"],
  ["fRmzCfUhW7o", "Tokyo Neon Reel", "City"],
  ["gFD3NFR7fKw", "Northern Lights Iceland", "Nature"],
  ["6lxf7pMRnWU", "Shot on iPhone — Portraits", "Portrait"],
  ["z9Ul9ccDOqE", "Apple iPhone Macro", "Macro"],
  ["R_tHrd7n7_A", "Peter McKinnon Aerial", "Drone"],
  ["rDRR5XxIy8E", "Slo-Mo Water Droplet", "Abstract"],
];

// Carousel generator — more infographic/slide-style thumbs.
const CAROUSEL_TOOL = "carousel";
const CAROUSEL_THUMBS: Array<[string, string, string]> = [
  ["4Zl3bTxA7vs", "$100M Offers Carousel", "Business"],
  ["fIKC1vH9a3s", "Fat Loss Science", "Fitness"],
  ["Mvh6D3JHuLc", "Time Management Rules", "Productivity"],
  ["TUt1JlP48nE", "Selling Everything", "Finance"],
  ["bHIhgxav9LY", "Electricity Misconception", "Education"],
  ["ulCdoCfw-bY", "Black Hole What If", "Education"],
  ["rRYXVCswkKk", "Own Almost Nothing", "Minimalism"],
  ["XkP4_n3bmQ8", "Make $10k/Month 2024", "Business"],
  ["z7R3qIkOH3I", "Tiny Country Big Power", "Geopolitics"],
  ["a5FYcTYKI1U", "SBF FTX Fraud", "Documentary"],
  ["hFZFjoX2cGg", "Squirrel Proof Feeder", "Engineering"],
  ["cDA3_5982h8", "Things About Me", "Personal"],
  ["aZ03JUi9-SA", "iPhone 15 Pro Max", "Tech Review"],
  ["5P7O8HhD9Eg", "Phone Tier List", "Tech Review"],
  ["rT1h6u8kKkw", "McRib At Home", "Food"],
  ["Ci_Qx4rYIDs", "Breakfast Sandwich", "Food"],
  ["LsoLEjrDogU", "Paris Breakdown", "Vlog"],
  ["xXiO80ccmfU", "Snowboarding NYPD", "Vlog"],
  ["kX3nB4PpJko", "Last Chair $500K", "Challenge"],
  ["0e3GPea1Tyg", "Squid Game IRL", "Challenge"],
  ["jsq2rNZHlOk", "50 Hours Buried", "Challenge"],
  ["FMlVTSGlC8g", "Olympia Win", "Fitness"],
  ["1PsZZycn9z8", "JRE Elon", "Podcast"],
  ["L_Guz73e6fw", "Lex Altman AGI", "Podcast"],
  ["BtvNQLzNc_g", "Petabyte Server", "Tech"],
  ["NSW26z1uFhU", "$100K Surprise", "Vlog"],
  ["EBP4xr-o4oY", "Speedrunner Hunters", "Gaming"],
  ["KQI_m-Gs2Kw", "Scariest Game", "Gaming"],
  ["PWCxb3B1gxE", "Minecraft Death Restart", "Gaming"],
  ["erLbbextvlY", "40M Sub Away", "Challenge"],
];

// Ads — brand/ad-style thumbs.
const ADS_TOOL = "ads";
const ADS_THUMBS: Array<[string, string, string]> = [
  ["pWtH9PbsXYs", "Apple Shot on iPhone", "Apple"],
  ["tQ0yjYUFKAE", "Dollar Shave Club", "Dollar Shave"],
  ["I38b8-9syRU", "Squarespace Super Bowl", "Squarespace"],
  ["hXWIENcHtyQ", "Volvo Epic Split", "Volvo"],
  ["uYPbbksJxIg", "Oatly Wow No Cow", "Oatly"],
  ["ZOCcDbJ5uV4", "Nike Dream Crazy", "Nike"],
  ["JxS5E-kZc2s", "Dove Real Beauty", "Dove"],
  ["u4ZoJKF_VuA", "Red Bull Gives Wings", "Red Bull"],
  ["L_LUpnjgPso", "Airbnb Belong Anywhere", "Airbnb"],
  ["wcRYrJlNCJw", "Peloton Workout", "Peloton"],
  ["d9MyW72ELq0", "Nike You Can't Stop Us", "Nike"],
  ["NpEaa2P7qZI", "Casey Neistat Nike", "Nike"],
  ["GFQyfasNu4E", "Allbirds Running Shoe", "Allbirds"],
  ["5NPBIwQyPWE", "Coke Share", "Coke"],
  ["_lYmz-YFRLU", "Patagonia Fisherman", "Patagonia"],
  ["Q7P7oMRyq-o", "Rolex Pioneer", "Rolex"],
  ["KqffpTQVAqY", "BMW The 8", "BMW"],
  ["PnzVhqbzyMw", "Tesla Cybertruck", "Tesla"],
  ["cLdxuaxaQwc", "Samsung Do What You Can't", "Samsung"],
  ["aIvQyDAIsEM", "Apple iPhone 14 Pro", "Apple"],
  ["w4p_5d8GmDU", "Tiffany Not Mother's", "Tiffany"],
  ["0TD96VTf0Xs", "Apple Vision Pro", "Apple"],
  ["VB5XAc-5Pjw", "Netflix The Crown", "Netflix"],
  ["aMYyOCm0nsc", "Marvel Endgame", "Marvel"],
  ["pMB_g7SXZog", "Red Bull Stratos", "Red Bull"],
  ["4Zl3bTxA7vs", "Hormozi $100M Offers", "Creator"],
  ["TUt1JlP48nE", "Graham Selling", "Creator"],
  ["XkP4_n3bmQ8", "Iman $10k/mo", "Creator"],
  ["Mvh6D3JHuLc", "Ali Abdaal Time", "Creator"],
  ["rRYXVCswkKk", "Matt Davella Own Nothing", "Creator"],
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
  { tool: VIDEO_EDITOR_TOOL, url: "https://assets.mixkit.co/videos/18571/18571-720.mp4", title: "Sneakers Product Shot", tag: "Product" },
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
