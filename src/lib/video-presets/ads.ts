/**
 * ADS_PRESET — the full-ad video template.
 *
 * Opinionated configuration that mirrors the aesthetic of top IG Reels / TikTok
 * ad creators (arzonefx, klemie, hudsonfilmss): bold display type, hard cuts,
 * kinetic word-by-word captions, 9:16 vertical, fast 2s average cut pacing.
 *
 * Exported for:
 *  - the video-editor page preset selector (ADS_PRESET → applyAdsPreset)
 *  - the /api/video/script-to-ad pipeline (stored on video_projects.style_preset)
 *  - the Ads-tuned music_match and b-roll helpers
 */

export interface AdsPresetBrollCategory {
  id: string;
  label: string;
  search_terms: string[];
}

export interface AdsPresetSfxCue {
  id: string;
  label: string;
  mood: "whoosh" | "impact" | "ding" | "rise" | "bass_drop" | "snap";
  trigger: string; // when to use this sfx (hook, cut, reveal, cta)
}

export interface AdsPresetTransition {
  id: string;
  label: string;
  duration_sec: number;
}

export interface AdsPresetTextAnimation {
  id: string;
  label: string;
  // maps to editorSettings.textAnimation.preset when possible
  editor_preset: string;
}

export interface AdsPreset {
  id: "ads";
  name: string;
  description: string;
  thumbnail: string; // emoji or svg-ish placeholder for the card

  font_pack: string[];
  color_palette: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text_on_dark: string;
    text_on_light: string;
    highlight: string;
  };
  transitions: AdsPresetTransition[];
  text_animations: AdsPresetTextAnimation[];
  sfx_library: AdsPresetSfxCue[];
  music_mood_filters: Array<"upbeat" | "energetic" | "hype" | "motivational">;
  broll_categories: AdsPresetBrollCategory[];
  default_duration: number; // seconds
  aspect_ratio: "9:16" | "1:1" | "16:9";
  pacing: "fast-cut" | "medium" | "slow";
  average_clip_length_sec: number;

  caption_style: {
    // references the kinetic-captions feature
    default: "kinetic" | "classic" | "highlight";
    font_family: string;
    font_size: number;
    text_color: string;
    stroke_color: string;
    stroke_width: number;
    backdrop_color: string;
    position: "top" | "center" | "bottom";
    custom_y: number;
    max_words_per_line: number;
    emphasize_keywords: boolean;
    auto_emoji: boolean;
  };

  /**
   * The partial editorSettings this preset should apply when the user clicks
   * "Ads" in the video-editor. Shape aligns with the editor's local
   * EditorSettings state (see src/app/dashboard/video-editor/page.tsx).
   */
  editor_settings_patch: {
    captions: Record<string, unknown>;
    textAnimation: Record<string, unknown>;
    motion: Record<string, unknown>;
    transitions: Record<string, unknown>;
    color: Record<string, unknown>;
    audio: Record<string, unknown>;
    smart: Record<string, unknown>;
    aspect: Record<string, unknown>;
  };
}

export const ADS_PRESET: AdsPreset = {
  id: "ads",
  name: "Ads",
  description:
    "High-converting IG Reels / TikTok ad template. Bold display type, hard cuts, kinetic captions, hype music. Beats Opus Clip and Runway on ad-ready output.",
  thumbnail: "📣", // megaphone emoji as card placeholder

  font_pack: ["Anton", "Montserrat Black", "Bebas Neue"],

  color_palette: {
    primary: "#FFFFFF",
    secondary: "#000000",
    accent: "#FF2D2D", // punchy red
    background: "#0A0A0A",
    text_on_dark: "#FFFFFF",
    text_on_light: "#0A0A0A",
    highlight: "#FFDD00", // yellow pop for emphasized words
  },

  transitions: [
    { id: "hard-cut", label: "Hard Cut", duration_sec: 0 },
    { id: "flash-cut", label: "Flash Cut", duration_sec: 0.15 },
    { id: "zoom-punch", label: "Zoom Punch", duration_sec: 0.25 },
    { id: "whip-pan", label: "Whip Pan", duration_sec: 0.2 },
    { id: "glitch", label: "Glitch", duration_sec: 0.2 },
  ],

  text_animations: [
    { id: "kinetic-word-highlight", label: "Kinetic Word Highlight", editor_preset: "pop" },
    { id: "bounce-in", label: "Bounce In", editor_preset: "bounce" },
    { id: "slide-swipe", label: "Slide Swipe", editor_preset: "slide_left" },
    { id: "pop-scale", label: "Pop Scale", editor_preset: "scale_up" },
    { id: "shake-emphasis", label: "Shake", editor_preset: "shake" },
  ],

  sfx_library: [
    { id: "ads_whoosh_1", label: "Whoosh (transition)", mood: "whoosh", trigger: "cut" },
    { id: "ads_whoosh_2", label: "Fast Whoosh", mood: "whoosh", trigger: "cut" },
    { id: "ads_impact_1", label: "Impact Hit", mood: "impact", trigger: "hook" },
    { id: "ads_impact_2", label: "Deep Impact", mood: "impact", trigger: "reveal" },
    { id: "ads_ding_1", label: "Notification Ding", mood: "ding", trigger: "callout" },
    { id: "ads_rise_1", label: "Riser (build)", mood: "rise", trigger: "hook" },
    { id: "ads_bass_drop_1", label: "Bass Drop", mood: "bass_drop", trigger: "cta" },
    { id: "ads_snap_1", label: "Snap Click", mood: "snap", trigger: "cut" },
  ],

  music_mood_filters: ["upbeat", "energetic", "hype", "motivational"],

  broll_categories: [
    {
      id: "product-closeup",
      label: "Product Close-up",
      search_terms: ["product closeup", "hands holding product", "unboxing", "macro shot"],
    },
    {
      id: "lifestyle",
      label: "Lifestyle",
      search_terms: ["lifestyle", "happy people", "using product", "outdoors", "city street"],
    },
    {
      id: "reaction",
      label: "Reaction",
      search_terms: ["surprised face", "excited person", "wow reaction", "thumbs up"],
    },
    {
      id: "text-overlay-bg",
      label: "Text Overlay Background",
      search_terms: ["abstract motion", "gradient background", "particle background", "light leaks"],
    },
  ],

  default_duration: 30,
  aspect_ratio: "9:16",
  pacing: "fast-cut",
  average_clip_length_sec: 2,

  caption_style: {
    default: "kinetic",
    font_family: "Anton",
    font_size: 72,
    text_color: "#FFFFFF",
    stroke_color: "#000000",
    stroke_width: 6,
    backdrop_color: "transparent",
    position: "center",
    custom_y: 55,
    max_words_per_line: 3,
    emphasize_keywords: true,
    auto_emoji: false,
  },

  editor_settings_patch: {
    captions: {
      enabled: true,
      autoGenerate: true,
      preset: "meme_impact",
      fontFamily: "Anton",
      fontSize: 72,
      textColor: "#FFFFFF",
      strokeColor: "#000000",
      backdropColor: "transparent",
      strokeWidth: 6,
      position: "center" as const,
      customY: 55,
      maxWordsPerLine: 3,
      emphasizeKeywords: true,
      autoEmoji: false,
    },
    textAnimation: {
      enabled: true,
      preset: "pop",
      duration: 0.25,
      easing: "spring",
    },
    motion: {
      enabled: true,
      autoZoomSpeakers: true,
      preset: "punch_zoom",
      intensity: 85,
      autoReframe: true,
      motionBlur: true,
    },
    transitions: {
      enabled: true,
      preset: "flash",
      duration: 0.15,
      autoBetweenCuts: true,
    },
    color: {
      enabled: true,
      lut: "high_contrast",
      brightness: 3,
      contrast: 20,
      saturation: 15,
      temperature: 0,
      tint: 0,
      highlights: -2,
      shadows: 5,
      autoColorMatch: true,
      autoWhiteBalance: false,
    },
    audio: {
      enabled: true,
      autoDucking: true,
      bgGenre: "upbeat",
      volumeAutomation: true,
      noiseRemoval: true,
      voiceEnhance: true,
      autoBeatSync: true,
    },
    smart: {
      autoCutSilence: true,
      silenceThreshold: 0.4,
      autoReframeRatio: "9:16" as const,
      removeFillerWords: true,
      autoChapters: false,
      smartPacing: true,
      hookDetector: true,
      viralMomentFinder: true,
      autoBroll: true,
      trendingAudioMatch: true,
    },
    aspect: { preset: "9:16", customW: 9, customH: 16 },
  },
};

/**
 * Curated royalty-free music tracks for the Ads preset.
 *
 * Sources:
 *  - Pixabay Music (https://pixabay.com/music) — free for commercial use, no attribution
 *  - Free Music Archive (FMA) — licenses noted per track; only CC-BY or public domain used
 *
 * URLs point to the track's public landing page. Clients should download & host
 * via their own CDN for production renders — we never hotlink pixabay/fma audio
 * from render workers.
 */
export interface AdsMusicTrack {
  id: string;
  title: string;
  mood: "upbeat" | "energetic" | "hype" | "motivational";
  bpm: number;
  duration_sec: number;
  source: "pixabay" | "fma" | "pixabay_music";
  url: string; // landing page
  license: string; // one-line license
  tags: string[];
}

export const ADS_MUSIC_LIBRARY: AdsMusicTrack[] = [
  {
    id: "ads_mus_01",
    title: "Powerful Beat Trailer",
    mood: "hype",
    bpm: 128,
    duration_sec: 90,
    source: "pixabay",
    url: "https://pixabay.com/music/beats-powerful-beat-121791/",
    license: "Pixabay Content License — free commercial use",
    tags: ["trailer", "epic", "cinematic", "hype"],
  },
  {
    id: "ads_mus_02",
    title: "Energetic Upbeat Corporate",
    mood: "upbeat",
    bpm: 120,
    duration_sec: 120,
    source: "pixabay",
    url: "https://pixabay.com/music/upbeat-energetic-corporate-154516/",
    license: "Pixabay Content License — free commercial use",
    tags: ["corporate", "clean", "upbeat"],
  },
  {
    id: "ads_mus_03",
    title: "Inspiring Motivation",
    mood: "motivational",
    bpm: 110,
    duration_sec: 135,
    source: "pixabay",
    url: "https://pixabay.com/music/inspirational-inspiring-motivation-141414/",
    license: "Pixabay Content License — free commercial use",
    tags: ["motivational", "piano", "uplifting"],
  },
  {
    id: "ads_mus_04",
    title: "Driving Hip-Hop",
    mood: "energetic",
    bpm: 95,
    duration_sec: 100,
    source: "pixabay",
    url: "https://pixabay.com/music/hip-hop-driving-hip-hop-98722/",
    license: "Pixabay Content License — free commercial use",
    tags: ["hip-hop", "driving", "bass"],
  },
  {
    id: "ads_mus_05",
    title: "Phonk Workout",
    mood: "hype",
    bpm: 140,
    duration_sec: 120,
    source: "pixabay",
    url: "https://pixabay.com/music/phonk-phonk-workout-190047/",
    license: "Pixabay Content License — free commercial use",
    tags: ["phonk", "workout", "aggressive"],
  },
  {
    id: "ads_mus_06",
    title: "Future Bass Drop",
    mood: "hype",
    bpm: 130,
    duration_sec: 110,
    source: "pixabay",
    url: "https://pixabay.com/music/future-bass-future-bass-drop-11307/",
    license: "Pixabay Content License — free commercial use",
    tags: ["future-bass", "drop", "edm"],
  },
  {
    id: "ads_mus_07",
    title: "Upbeat Summer Pop",
    mood: "upbeat",
    bpm: 118,
    duration_sec: 135,
    source: "pixabay",
    url: "https://pixabay.com/music/upbeat-summer-pop-126918/",
    license: "Pixabay Content License — free commercial use",
    tags: ["pop", "summer", "happy"],
  },
  {
    id: "ads_mus_08",
    title: "Action Sports Rock",
    mood: "energetic",
    bpm: 140,
    duration_sec: 120,
    source: "pixabay",
    url: "https://pixabay.com/music/rock-action-sports-rock-110217/",
    license: "Pixabay Content License — free commercial use",
    tags: ["rock", "sports", "action"],
  },
  {
    id: "ads_mus_09",
    title: "Motivational Epic Cinematic",
    mood: "motivational",
    bpm: 100,
    duration_sec: 150,
    source: "pixabay",
    url: "https://pixabay.com/music/cinematic-motivational-epic-cinematic-139484/",
    license: "Pixabay Content License — free commercial use",
    tags: ["cinematic", "epic", "motivational"],
  },
  {
    id: "ads_mus_10",
    title: "Electro Dance Beat",
    mood: "hype",
    bpm: 128,
    duration_sec: 120,
    source: "pixabay",
    url: "https://pixabay.com/music/dance-electro-dance-beat-114837/",
    license: "Pixabay Content License — free commercial use",
    tags: ["electro", "dance", "edm"],
  },
  {
    id: "ads_mus_11",
    title: "Hype Trap Beat",
    mood: "hype",
    bpm: 145,
    duration_sec: 105,
    source: "pixabay",
    url: "https://pixabay.com/music/trap-hype-trap-beat-88492/",
    license: "Pixabay Content License — free commercial use",
    tags: ["trap", "hype", "bass"],
  },
  {
    id: "ads_mus_12",
    title: "Success Corporate Uplifting",
    mood: "motivational",
    bpm: 112,
    duration_sec: 130,
    source: "pixabay",
    url: "https://pixabay.com/music/corporate-success-corporate-uplifting-134014/",
    license: "Pixabay Content License — free commercial use",
    tags: ["corporate", "success", "uplifting"],
  },
  {
    id: "ads_mus_13",
    title: "Pump Up Rock Workout",
    mood: "energetic",
    bpm: 135,
    duration_sec: 120,
    source: "pixabay",
    url: "https://pixabay.com/music/rock-pump-up-rock-workout-138574/",
    license: "Pixabay Content License — free commercial use",
    tags: ["rock", "workout", "pump"],
  },
  {
    id: "ads_mus_14",
    title: "Future House Energy",
    mood: "upbeat",
    bpm: 124,
    duration_sec: 115,
    source: "pixabay",
    url: "https://pixabay.com/music/future-house-future-house-energy-113475/",
    license: "Pixabay Content License — free commercial use",
    tags: ["house", "future", "energy"],
  },
  {
    id: "ads_mus_15",
    title: "Lo-Fi Chill Beat",
    mood: "upbeat",
    bpm: 85,
    duration_sec: 150,
    source: "pixabay",
    url: "https://pixabay.com/music/beats-lofi-chill-beat-95192/",
    license: "Pixabay Content License — free commercial use",
    tags: ["lofi", "chill", "vibe"],
  },
  {
    id: "ads_mus_16",
    title: "Hero Epic Inspiring",
    mood: "motivational",
    bpm: 108,
    duration_sec: 140,
    source: "pixabay",
    url: "https://pixabay.com/music/cinematic-hero-epic-inspiring-124604/",
    license: "Pixabay Content License — free commercial use",
    tags: ["epic", "hero", "inspiring"],
  },
  {
    id: "ads_mus_17",
    title: "Dubstep Drop Heavy",
    mood: "hype",
    bpm: 140,
    duration_sec: 90,
    source: "pixabay",
    url: "https://pixabay.com/music/dubstep-dubstep-drop-heavy-11984/",
    license: "Pixabay Content License — free commercial use",
    tags: ["dubstep", "drop", "heavy"],
  },
  {
    id: "ads_mus_18",
    title: "Funky Summer Vibes",
    mood: "upbeat",
    bpm: 116,
    duration_sec: 125,
    source: "pixabay",
    url: "https://pixabay.com/music/funk-funky-summer-vibes-125683/",
    license: "Pixabay Content License — free commercial use",
    tags: ["funk", "summer", "happy"],
  },
  {
    id: "ads_mus_19",
    title: "Gym Workout Energy",
    mood: "energetic",
    bpm: 150,
    duration_sec: 110,
    source: "pixabay",
    url: "https://pixabay.com/music/beats-gym-workout-energy-144874/",
    license: "Pixabay Content License — free commercial use",
    tags: ["gym", "workout", "energy"],
  },
  {
    id: "ads_mus_20",
    title: "Podcasting Electronic Upbeat",
    mood: "upbeat",
    bpm: 120,
    duration_sec: 160,
    source: "pixabay",
    url: "https://pixabay.com/music/electronic-podcasting-electronic-upbeat-130942/",
    license: "Pixabay Content License — free commercial use",
    tags: ["electronic", "upbeat", "podcast"],
  },
];

/** Return tracks whose mood matches one of the requested moods. */
export function filterMusicByMood(moods: string[]): AdsMusicTrack[] {
  if (!moods.length) return ADS_MUSIC_LIBRARY;
  const s = new Set(moods.map((m) => m.toLowerCase()));
  return ADS_MUSIC_LIBRARY.filter((t) => s.has(t.mood));
}
