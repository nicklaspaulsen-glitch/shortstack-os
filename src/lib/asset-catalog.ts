/**
 * Asset Catalog — shared across Thumbnail Generator + Video Editor.
 *
 * Curated libraries of high-CTR fonts, caption styles, effects, SFX, and music
 * patterned after what top creators actually use. All lists are hardcoded for
 * now but structured so they can be swapped to a DB/API backed source later
 * without touching consumer components.
 *
 * License notes:
 *  - Fonts marked `"google"` are free via Google Fonts CDN.
 *  - Fonts marked `"system"` are pre-installed on most OSes (Impact, etc.).
 *  - SFX/Music "source_hint" + "free_alt_url" fields are starting-point
 *    suggestions only — real asset URLs will be wired in when the audio
 *    pipeline lands.
 */

/* ──────────────────── POPULAR FONTS ──────────────────── */

export type FontCategory = "thumbnail" | "headline" | "body" | "handwritten";
export type FontLicense = "google" | "paid" | "system";

export interface PopularFont {
  id: string;
  name: string;
  category: FontCategory;
  weight: number;
  license: FontLicense;
  preview_text: string;
  /** CSS font-family stack to render the preview */
  stack: string;
  /** Google Fonts URL for dynamic <link> injection, when license === "google" */
  google_url?: string;
  /** Short vibe/usage descriptor */
  vibe?: string;
  /** Notable creators using this font */
  used_by?: string;
}

export const POPULAR_FONTS: PopularFont[] = [
  {
    id: "impact",
    name: "Impact",
    category: "thumbnail",
    weight: 900,
    license: "system",
    preview_text: "BREAKING NEWS",
    stack: "'Impact', 'Haettenschweiler', 'Arial Narrow Bold', sans-serif",
    vibe: "Classic clickbait — the #1 YouTube thumbnail font",
    used_by: "MrBeast, Peter McKinnon",
  },
  {
    id: "bebas-neue",
    name: "Bebas Neue",
    category: "thumbnail",
    weight: 700,
    license: "google",
    preview_text: "GO VIRAL",
    stack: "'Bebas Neue', sans-serif",
    google_url: "https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap",
    vibe: "Bold, clean, creator-favorite",
    used_by: "Ali Abdaal, Vox",
  },
  {
    id: "montserrat-black",
    name: "Montserrat Black",
    category: "thumbnail",
    weight: 900,
    license: "google",
    preview_text: "HEADLINE",
    stack: "'Montserrat', sans-serif",
    google_url: "https://fonts.googleapis.com/css2?family=Montserrat:wght@900&display=swap",
    vibe: "Geometric heavy weight, premium feel",
    used_by: "Hormozi, Thomas Frank",
  },
  {
    id: "oswald",
    name: "Oswald",
    category: "thumbnail",
    weight: 700,
    license: "google",
    preview_text: "WATCH NOW",
    stack: "'Oswald', sans-serif",
    google_url: "https://fonts.googleapis.com/css2?family=Oswald:wght@700&display=swap",
    vibe: "Condensed / strong",
    used_by: "News channels, sports creators",
  },
  {
    id: "anton",
    name: "Anton",
    category: "thumbnail",
    weight: 400,
    license: "google",
    preview_text: "EXTRA BOLD",
    stack: "'Anton', sans-serif",
    google_url: "https://fonts.googleapis.com/css2?family=Anton&display=swap",
    vibe: "Single heavy weight, headline",
    used_by: "MrBeast, Tasty",
  },
  {
    id: "archivo-black",
    name: "Archivo Black",
    category: "thumbnail",
    weight: 900,
    license: "google",
    preview_text: "URGENT NEWS",
    stack: "'Archivo Black', sans-serif",
    google_url: "https://fonts.googleapis.com/css2?family=Archivo+Black&display=swap",
    vibe: "Heavy / modern",
    used_by: "Graham Stephan",
  },
  {
    id: "roboto-slab-bold",
    name: "Roboto Slab Bold",
    category: "headline",
    weight: 700,
    license: "google",
    preview_text: "Editorial Post",
    stack: "'Roboto Slab', serif",
    google_url: "https://fonts.googleapis.com/css2?family=Roboto+Slab:wght@700&display=swap",
    vibe: "Utility serif, tech/podcast",
  },
  {
    id: "permanent-marker",
    name: "Permanent Marker",
    category: "handwritten",
    weight: 400,
    license: "google",
    preview_text: "ACTUALLY TRUE",
    stack: "'Permanent Marker', cursive",
    google_url: "https://fonts.googleapis.com/css2?family=Permanent+Marker&display=swap",
    vibe: "Handwritten / casual / raw",
    used_by: "Casey Neistat, vloggers",
  },
  {
    id: "bangers",
    name: "Bangers",
    category: "thumbnail",
    weight: 400,
    license: "google",
    preview_text: "BOOM!",
    stack: "'Bangers', cursive",
    google_url: "https://fonts.googleapis.com/css2?family=Bangers&display=swap",
    vibe: "Comic book / fun / gaming",
    used_by: "Dream, PewDiePie-style",
  },
  {
    id: "teko",
    name: "Teko",
    category: "thumbnail",
    weight: 700,
    license: "google",
    preview_text: "GAME DAY",
    stack: "'Teko', sans-serif",
    google_url: "https://fonts.googleapis.com/css2?family=Teko:wght@700&display=swap",
    vibe: "Sports / narrow / high energy",
  },
  {
    id: "playfair-display",
    name: "Playfair Display",
    category: "headline",
    weight: 900,
    license: "google",
    preview_text: "The Luxury Issue",
    stack: "'Playfair Display', serif",
    google_url: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@900&display=swap",
    vibe: "Editorial / luxury / fashion",
    used_by: "Vogue-style creators",
  },
  {
    id: "rubik-mono-one",
    name: "Rubik Mono One",
    category: "thumbnail",
    weight: 400,
    license: "google",
    preview_text: "RETRO POP",
    stack: "'Rubik Mono One', sans-serif",
    google_url: "https://fonts.googleapis.com/css2?family=Rubik+Mono+One&display=swap",
    vibe: "Retro / blocky / techno",
  },
  {
    id: "staatliches",
    name: "Staatliches",
    category: "thumbnail",
    weight: 400,
    license: "google",
    preview_text: "POSTER",
    stack: "'Staatliches', sans-serif",
    google_url: "https://fonts.googleapis.com/css2?family=Staatliches&display=swap",
    vibe: "Poster / condensed / editorial",
  },
  {
    id: "druk-wide",
    name: "Druk Wide (alt: Rubik Mono)",
    category: "thumbnail",
    weight: 900,
    license: "paid",
    preview_text: "PREMIUM",
    stack: "'Druk Wide', 'Rubik Mono One', sans-serif",
    vibe: "Premium wide display — MrBeast-style",
    used_by: "MrBeast (paid Druk), top brands",
  },
  {
    id: "komika-axis",
    name: "Komika Axis (alt: Bangers)",
    category: "thumbnail",
    weight: 400,
    license: "paid",
    preview_text: "POW!",
    stack: "'Komika Axis', 'Bangers', cursive",
    vibe: "Comic-action / gamer thumbnails",
  },
  {
    id: "chunk-five",
    name: "Chunk Five",
    category: "thumbnail",
    weight: 400,
    license: "google",
    preview_text: "NEWSLETTER",
    stack: "'Chunkfive', 'Archivo Black', serif",
    google_url: "https://fonts.googleapis.com/css2?family=Archivo+Black&display=swap",
    vibe: "Chunky slab — newspaper / bold",
  },
  {
    id: "league-gothic",
    name: "League Gothic",
    category: "thumbnail",
    weight: 700,
    license: "google",
    preview_text: "COMING SOON",
    stack: "'League Gothic', sans-serif",
    google_url: "https://fonts.googleapis.com/css2?family=League+Gothic&display=swap",
    vibe: "Vintage poster / condensed",
  },
  {
    id: "poppins-black",
    name: "Poppins Black",
    category: "headline",
    weight: 900,
    license: "google",
    preview_text: "BIG HEADLINE",
    stack: "'Poppins', sans-serif",
    google_url: "https://fonts.googleapis.com/css2?family=Poppins:wght@900&display=swap",
    vibe: "Friendly geometric, heavy weight",
  },
  {
    id: "raleway-black",
    name: "Raleway Black",
    category: "headline",
    weight: 900,
    license: "google",
    preview_text: "STYLISH",
    stack: "'Raleway', sans-serif",
    google_url: "https://fonts.googleapis.com/css2?family=Raleway:wght@900&display=swap",
    vibe: "Thin / stylish at light weights, heavy punch at 900",
  },
  {
    id: "noto-sans-display-black",
    name: "Noto Sans Display Black",
    category: "headline",
    weight: 900,
    license: "google",
    preview_text: "MULTILINGUAL",
    stack: "'Noto Sans Display', sans-serif",
    google_url: "https://fonts.googleapis.com/css2?family=Noto+Sans+Display:wght@900&display=swap",
    vibe: "Universal script coverage, black weight",
  },
  {
    id: "fjalla-one",
    name: "Fjalla One",
    category: "thumbnail",
    weight: 400,
    license: "google",
    preview_text: "UTILITY",
    stack: "'Fjalla One', sans-serif",
    google_url: "https://fonts.googleapis.com/css2?family=Fjalla+One&display=swap",
    vibe: "Utility / bold condensed",
  },
];

/* ──────────────────── CAPTION STYLES (video CC) ──────────────────── */

export type CaptionBestFor = "tiktok" | "youtube" | "reel" | "podcast" | "shorts" | "all";

export interface CaptionStyle {
  id: string;
  name: string;
  /** Human-readable CSS-ish preview config */
  css_preview: {
    fontFamily: string;
    color: string;
    bg: string;
    stroke: string;
    weight: number;
    size: number; // preview size in px
    animation: string; // short label
  };
  best_for: CaptionBestFor[];
  desc: string;
}

export const CAPTION_STYLES_LIBRARY: CaptionStyle[] = [
  {
    id: "bold-yellow-word",
    name: "Bold Yellow Word-by-Word",
    css_preview: {
      fontFamily: "'Montserrat', sans-serif",
      color: "#FFDD00",
      bg: "transparent",
      stroke: "#000000",
      weight: 900,
      size: 28,
      animation: "word pop",
    },
    best_for: ["tiktok", "reel", "shorts"],
    desc: "TikTok viral — massive yellow word flash with thick black stroke",
  },
  {
    id: "hormozi-karaoke",
    name: "Hormozi-style Karaoke",
    css_preview: {
      fontFamily: "'Montserrat', sans-serif",
      color: "#FFFFFF",
      bg: "transparent",
      stroke: "#000000",
      weight: 900,
      size: 26,
      animation: "karaoke highlight",
    },
    best_for: ["shorts", "reel", "tiktok"],
    desc: "White caps with active-word highlight in green/yellow",
  },
  {
    id: "bottom-bar-clean",
    name: "Bottom Bar Clean",
    css_preview: {
      fontFamily: "'Inter', sans-serif",
      color: "#FFFFFF",
      bg: "rgba(0,0,0,0.75)",
      stroke: "transparent",
      weight: 500,
      size: 18,
      animation: "fade",
    },
    best_for: ["youtube", "podcast"],
    desc: "Classic white on dark box — YouTube standard",
  },
  {
    id: "centered-bold-outline",
    name: "Centered Bold Outline",
    css_preview: {
      fontFamily: "'Impact', sans-serif",
      color: "#FFFFFF",
      bg: "transparent",
      stroke: "#000000",
      weight: 900,
      size: 30,
      animation: "pop",
    },
    best_for: ["tiktok", "reel"],
    desc: "Meme-style Impact with thick black outline",
  },
  {
    id: "gold-highlight",
    name: "Gold Highlight",
    css_preview: {
      fontFamily: "'Poppins', sans-serif",
      color: "#FFFFFF",
      bg: "transparent",
      stroke: "#C9A84C",
      weight: 800,
      size: 24,
      animation: "gold glow",
    },
    best_for: ["youtube", "reel"],
    desc: "White caps with gold stroke — premium feel",
  },
  {
    id: "word-pop",
    name: "Word Pop",
    css_preview: {
      fontFamily: "'Anton', sans-serif",
      color: "#FF3BFF",
      bg: "transparent",
      stroke: "#FFFFFF",
      weight: 900,
      size: 28,
      animation: "scale bounce",
    },
    best_for: ["tiktok", "shorts"],
    desc: "Pink/cyan word-at-a-time bounce — Reels trendy",
  },
  {
    id: "typewriter",
    name: "Typewriter",
    css_preview: {
      fontFamily: "'Courier New', monospace",
      color: "#00FF88",
      bg: "rgba(0,0,0,0.6)",
      stroke: "transparent",
      weight: 400,
      size: 18,
      animation: "char reveal",
    },
    best_for: ["youtube", "shorts"],
    desc: "Letter-by-letter terminal reveal",
  },
  {
    id: "subtitles-2line-bottom",
    name: "Subtitles (2-line bottom)",
    css_preview: {
      fontFamily: "'Arial', sans-serif",
      color: "#FFFFFF",
      bg: "rgba(0,0,0,0.6)",
      stroke: "#000000",
      weight: 600,
      size: 16,
      animation: "cut",
    },
    best_for: ["youtube", "podcast"],
    desc: "Netflix-style pinned bottom 2-line subtitles",
  },
  {
    id: "minimal-white",
    name: "Minimal White",
    css_preview: {
      fontFamily: "'Inter', sans-serif",
      color: "#FFFFFF",
      bg: "transparent",
      stroke: "transparent",
      weight: 400,
      size: 16,
      animation: "fade",
    },
    best_for: ["podcast", "youtube"],
    desc: "Clean white, no backdrop — editorial/podcast",
  },
  {
    id: "film-style",
    name: "Film Style",
    css_preview: {
      fontFamily: "'Playfair Display', serif",
      color: "#F5F5F5",
      bg: "transparent",
      stroke: "transparent",
      weight: 300,
      size: 16,
      animation: "fade slow",
    },
    best_for: ["youtube", "podcast"],
    desc: "Cinematic italic lower-third — documentary feel",
  },
];

/* ──────────────────── EFFECTS (video transitions + overlays) ──────────────────── */

export type EffectCategory = "transition" | "overlay" | "filter";
export type EffectBestFor = "action" | "vlog" | "gaming" | "cinematic" | "podcast" | "all";

export interface VideoEffect {
  id: string;
  name: string;
  category: EffectCategory;
  description: string;
  best_for: EffectBestFor[];
  /** Tailwind preview class for a tiny visual swatch */
  preview?: string;
}

export const EFFECTS_CATALOG: VideoEffect[] = [
  {
    id: "zoom-punch",
    name: "Zoom Punch",
    category: "transition",
    description: "Rapid zoom-in snap between cuts — energy boost",
    best_for: ["action", "gaming", "vlog"],
    preview: "bg-gradient-to-br from-red-500 via-orange-400 to-yellow-300",
  },
  {
    id: "whip-pan",
    name: "Whip Pan",
    category: "transition",
    description: "Fast horizontal motion-blur pan between shots",
    best_for: ["vlog", "action"],
    preview: "bg-gradient-to-r from-transparent via-white to-transparent",
  },
  {
    id: "shake-hit",
    name: "Shake Hit",
    category: "transition",
    description: "Screen shake on impact — punch emphasis",
    best_for: ["gaming", "action"],
    preview: "bg-gradient-to-br from-rose-600 to-slate-900",
  },
  {
    id: "light-leak",
    name: "Light Leak",
    category: "overlay",
    description: "Warm orange analog light bleed overlay",
    best_for: ["cinematic", "vlog"],
    preview: "bg-gradient-to-tr from-pink-300 via-orange-300 to-yellow-200",
  },
  {
    id: "vhs-scan",
    name: "VHS Scan",
    category: "overlay",
    description: "Horizontal tracking lines + color bleed",
    best_for: ["vlog", "gaming"],
    preview: "bg-[repeating-linear-gradient(0deg,#222_0_2px,#555_2px_3px)]",
  },
  {
    id: "glitch",
    name: "Glitch",
    category: "filter",
    description: "Digital signal glitch + distortion frames",
    best_for: ["gaming", "action"],
    preview: "bg-gradient-to-r from-red-500 via-cyan-400 to-green-500",
  },
  {
    id: "chromatic-aberration",
    name: "Chromatic Aberration",
    category: "filter",
    description: "RGB channel lens-fringe split",
    best_for: ["cinematic", "gaming"],
    preview: "bg-gradient-to-r from-rose-400 via-slate-800 to-cyan-400",
  },
  {
    id: "lens-flare",
    name: "Lens Flare",
    category: "overlay",
    description: "Cinematic anamorphic lens flare streak",
    best_for: ["cinematic"],
    preview: "bg-gradient-to-br from-yellow-300 via-orange-400 to-transparent",
  },
  {
    id: "smoke-fade",
    name: "Smoke Fade",
    category: "transition",
    description: "Smoke-dissolve wipe between scenes",
    best_for: ["cinematic", "action"],
    preview: "bg-gradient-to-b from-slate-400 via-slate-200 to-slate-500",
  },
  {
    id: "speed-ramp",
    name: "Speed Ramp",
    category: "transition",
    description: "Dynamic slowmo-to-realtime ramp",
    best_for: ["action", "vlog"],
    preview: "bg-gradient-to-r from-slate-500 via-sky-400 to-slate-800",
  },
  {
    id: "film-grain",
    name: "Film Grain",
    category: "filter",
    description: "Analog 35mm film noise texture",
    best_for: ["cinematic", "podcast"],
    preview: "bg-gradient-to-br from-neutral-800 via-neutral-700 to-neutral-900",
  },
  {
    id: "vignette",
    name: "Vignette",
    category: "filter",
    description: "Darkened corners — focus centre",
    best_for: ["cinematic", "podcast", "all"],
    preview: "bg-[radial-gradient(circle,transparent_40%,black_100%)]",
  },
];

/* ──────────────────── SFX LIBRARY ──────────────────── */

export type SfxCategory = "impact" | "ambient" | "tech" | "transition";

export interface SfxClip {
  id: string;
  name: string;
  duration_sec: number;
  category: SfxCategory;
  /** Placeholder URL — real asset wiring TBD. Uses freesound.org / pixabay pages. */
  free_alt_url: string;
  desc?: string;
}

export const SFX_LIBRARY: SfxClip[] = [
  {
    id: "whoosh-transition",
    name: "Whoosh Transition",
    duration_sec: 0.8,
    category: "transition",
    free_alt_url: "https://pixabay.com/sound-effects/search/whoosh/",
    desc: "Classic swoosh between cuts",
  },
  {
    id: "bass-drop-hit",
    name: "Bass Drop Hit",
    duration_sec: 1.2,
    category: "impact",
    free_alt_url: "https://pixabay.com/sound-effects/search/bass%20drop/",
    desc: "Deep sub impact for reveal moments",
  },
  {
    id: "notification-ping",
    name: "Notification Ping",
    duration_sec: 0.4,
    category: "tech",
    free_alt_url: "https://pixabay.com/sound-effects/search/notification/",
    desc: "Pleasant DING for callouts",
  },
  {
    id: "typewriter-click",
    name: "Typewriter Click",
    duration_sec: 0.15,
    category: "tech",
    free_alt_url: "https://pixabay.com/sound-effects/search/typewriter/",
    desc: "Keystroke tick for text reveals",
  },
  {
    id: "record-scratch",
    name: "Record Scratch",
    duration_sec: 0.9,
    category: "transition",
    free_alt_url: "https://freesound.org/search/?q=record+scratch",
    desc: "Abrupt stop / plot-twist cue",
  },
  {
    id: "vine-boom",
    name: "Vine Boom",
    duration_sec: 1.5,
    category: "impact",
    free_alt_url: "https://freesound.org/search/?q=vine+boom",
    desc: "Meme-famous punctuation boom",
  },
  {
    id: "reverse-cymbal",
    name: "Reverse Cymbal",
    duration_sec: 2.0,
    category: "ambient",
    free_alt_url: "https://freesound.org/search/?q=reverse+cymbal",
    desc: "Rising build-up swell",
  },
  {
    id: "cash-register",
    name: "Cash Register",
    duration_sec: 0.7,
    category: "tech",
    free_alt_url: "https://pixabay.com/sound-effects/search/cash%20register/",
    desc: "Ka-ching money cue",
  },
  {
    id: "airhorn",
    name: "Airhorn",
    duration_sec: 1.0,
    category: "impact",
    free_alt_url: "https://pixabay.com/sound-effects/search/airhorn/",
    desc: "Party/hype blast",
  },
  {
    id: "swish",
    name: "Swish",
    duration_sec: 0.3,
    category: "transition",
    free_alt_url: "https://pixabay.com/sound-effects/search/swish/",
    desc: "Short light swipe",
  },
  {
    id: "riser-buildup",
    name: "Riser Build-up",
    duration_sec: 3.5,
    category: "ambient",
    free_alt_url: "https://pixabay.com/sound-effects/search/riser/",
    desc: "Tension-rise before reveal",
  },
  {
    id: "impact-hit",
    name: "Impact Hit",
    duration_sec: 0.6,
    category: "impact",
    free_alt_url: "https://pixabay.com/sound-effects/search/impact/",
    desc: "Trailer-style hit for cuts",
  },
];

/* ──────────────────── MUSIC LIBRARY ──────────────────── */

export type MusicLicense = "royalty_free" | "attribution" | "paid";
export type MusicPlatform = "tiktok" | "youtube" | "reel" | "podcast" | "all";

export interface MusicTrack {
  id: string;
  name: string;
  genre: string;
  bpm: number;
  mood: string;
  duration_sec: number;
  license: MusicLicense;
  suggested_platforms: MusicPlatform[];
  /** Hint for where we'd source the real asset */
  source_hint: string;
}

export const MUSIC_LIBRARY: MusicTrack[] = [
  {
    id: "chill-lofi-beat",
    name: "Chill Lofi Beat",
    genre: "Lo-fi",
    bpm: 72,
    mood: "Calm",
    duration_sec: 120,
    license: "royalty_free",
    suggested_platforms: ["youtube", "podcast"],
    source_hint: "pixabay / artlist.io",
  },
  {
    id: "epic-cinematic-rise",
    name: "Epic Cinematic Rise",
    genre: "Cinematic",
    bpm: 95,
    mood: "Epic",
    duration_sec: 95,
    license: "royalty_free",
    suggested_platforms: ["youtube", "reel"],
    source_hint: "artlist.io / epidemicsound",
  },
  {
    id: "trap-hype-beat",
    name: "Trap Hype Beat",
    genre: "Hip-Hop",
    bpm: 140,
    mood: "Hype",
    duration_sec: 60,
    license: "royalty_free",
    suggested_platforms: ["tiktok", "reel"],
    source_hint: "pixabay / artlist.io",
  },
  {
    id: "corporate-inspire",
    name: "Corporate Inspire",
    genre: "Corporate",
    bpm: 110,
    mood: "Uplifting",
    duration_sec: 150,
    license: "royalty_free",
    suggested_platforms: ["youtube"],
    source_hint: "bensound / artlist.io",
  },
  {
    id: "acoustic-folk",
    name: "Acoustic Folk",
    genre: "Acoustic",
    bpm: 90,
    mood: "Warm",
    duration_sec: 120,
    license: "royalty_free",
    suggested_platforms: ["youtube", "podcast"],
    source_hint: "pixabay",
  },
  {
    id: "synthwave-80s",
    name: "Synthwave 80s",
    genre: "Synthwave",
    bpm: 108,
    mood: "Retro",
    duration_sec: 180,
    license: "royalty_free",
    suggested_platforms: ["youtube", "reel"],
    source_hint: "artlist.io",
  },
  {
    id: "deep-house",
    name: "Deep House",
    genre: "EDM",
    bpm: 124,
    mood: "Groovy",
    duration_sec: 180,
    license: "royalty_free",
    suggested_platforms: ["tiktok", "reel"],
    source_hint: "pixabay",
  },
  {
    id: "piano-emotional",
    name: "Piano Emotional",
    genre: "Piano",
    bpm: 72,
    mood: "Emotional",
    duration_sec: 120,
    license: "royalty_free",
    suggested_platforms: ["youtube", "reel"],
    source_hint: "artlist.io / pixabay",
  },
  {
    id: "rock-workout",
    name: "Rock Workout",
    genre: "Rock",
    bpm: 150,
    mood: "Aggressive",
    duration_sec: 120,
    license: "royalty_free",
    suggested_platforms: ["youtube", "reel"],
    source_hint: "pixabay",
  },
  {
    id: "ambient-tech",
    name: "Ambient Tech",
    genre: "Ambient",
    bpm: 85,
    mood: "Focus",
    duration_sec: 180,
    license: "royalty_free",
    suggested_platforms: ["youtube", "podcast"],
    source_hint: "artlist.io",
  },
  {
    id: "trending-viral-loop",
    name: "Trending Viral Loop",
    genre: "Pop",
    bpm: 120,
    mood: "Trendy",
    duration_sec: 15,
    license: "royalty_free",
    suggested_platforms: ["tiktok", "reel"],
    source_hint: "tiktok sounds (royalty-free tier)",
  },
  {
    id: "bollywood-style",
    name: "Bollywood-style",
    genre: "World",
    bpm: 115,
    mood: "Celebratory",
    duration_sec: 120,
    license: "royalty_free",
    suggested_platforms: ["reel", "tiktok"],
    source_hint: "pixabay",
  },
  {
    id: "edm-drop",
    name: "EDM Drop",
    genre: "EDM",
    bpm: 128,
    mood: "Hype",
    duration_sec: 90,
    license: "royalty_free",
    suggested_platforms: ["reel", "tiktok"],
    source_hint: "artlist.io",
  },
  {
    id: "jazz-lounge",
    name: "Jazz Lounge",
    genre: "Jazz",
    bpm: 95,
    mood: "Smooth",
    duration_sec: 180,
    license: "royalty_free",
    suggested_platforms: ["youtube", "podcast"],
    source_hint: "pixabay",
  },
  {
    id: "country-uplifting",
    name: "Country Uplifting",
    genre: "Country",
    bpm: 108,
    mood: "Uplifting",
    duration_sec: 150,
    license: "royalty_free",
    suggested_platforms: ["youtube", "reel"],
    source_hint: "artlist.io",
  },
];

/* ──────────────────── HELPERS ──────────────────── */

/**
 * Lazily inject a Google Fonts <link> tag for the given font so the browser
 * renders the preview with the real typeface. Safe to call multiple times —
 * the tag is keyed by id and dedupes.
 */
export function loadGoogleFont(font: Pick<PopularFont, "id" | "license" | "google_url">): void {
  if (typeof document === "undefined") return;
  if (font.license !== "google" || !font.google_url) return;
  const linkId = `gf-${font.id}`;
  if (document.getElementById(linkId)) return;
  const link = document.createElement("link");
  link.id = linkId;
  link.rel = "stylesheet";
  link.href = font.google_url;
  document.head.appendChild(link);
}

/** Preload a batch of fonts (e.g. on panel open) */
export function preloadGoogleFonts(fonts: PopularFont[]): void {
  fonts.forEach(loadGoogleFont);
}

/** Play a short placeholder beep for SFX previews (real audio pipeline TBD). */
export function playSfxPlaceholderTone(clip: SfxClip): void {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx =
      (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ||
      (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    // Category → base frequency mapping, for a little audible variety
    const freq =
      clip.category === "impact"
        ? 120
        : clip.category === "tech"
        ? 880
        : clip.category === "transition"
        ? 660
        : 440;
    osc.frequency.value = freq;
    osc.type = clip.category === "impact" ? "sawtooth" : "sine";
    gain.gain.value = 0.07;
    osc.connect(gain);
    gain.connect(ctx.destination);
    // Clamp duration — must be > 0 or exponentialRampToValueAtTime throws
    const dur = Math.max(0.05, Math.min(clip.duration_sec || 0.2, 0.4));
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.stop(ctx.currentTime + dur);
    // Close the context shortly after to free resources
    setTimeout(() => { void ctx.close(); }, (dur + 0.1) * 1000);
  } catch {
    // Silently no-op if AudioContext blocked / unavailable
  }
}

/** Convenience counts (used by summary toasts) */
export const ASSET_COUNTS = {
  fonts: POPULAR_FONTS.length,
  caption_styles: CAPTION_STYLES_LIBRARY.length,
  effects: EFFECTS_CATALOG.length,
  sfx: SFX_LIBRARY.length,
  music: MUSIC_LIBRARY.length,
};
