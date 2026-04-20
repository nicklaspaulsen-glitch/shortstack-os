// ──────────────────────────────────────────────────────────────────────
// Thumbnail style preset library.
//
// This is the smart replacement for training 50 LoRAs. Each preset is a
// (name, category, prompt_modifier) triple — NO training, NO reference
// images required. The generate route concatenates the prompt_modifier
// onto the user's prompt before sending to FLUX.
//
// Adding a new style = adding one entry here. No infra, no GPU, no data.
// Pairs nicely with IP-Adapter if a reference_image_url is provided.
//
// Categories are used to group the style picker UI.
// ──────────────────────────────────────────────────────────────────────

export interface ThumbnailStyle {
  id: string;
  name: string;
  category: StyleCategory;
  description: string;
  /** Injected into the FLUX prompt. Keep under ~200 chars so it doesn't
   *  drown out the user's original prompt. */
  promptModifier: string;
  /** Optional extra negative prompt tokens. */
  negativeModifier?: string;
  /** UI card gradient when no reference image is available. */
  gradient: [string, string];
  /** Optional IP-Adapter reference image URL. Leave undefined to skip. */
  referenceImageUrl?: string;
  /** Optional IP-Adapter weight when a reference is passed. 0.0-1.0. */
  ipAdapterWeight?: number;
  /** If true, only surface to Growth+ plan tiers. */
  premium?: boolean;
}

export type StyleCategory =
  | "youtube_viral"
  | "tech"
  | "finance"
  | "gaming"
  | "food"
  | "fitness"
  | "business"
  | "education"
  | "entertainment"
  | "lifestyle"
  | "news"
  | "cinematic"
  | "minimal"
  | "experimental";

// ──────────────────────────────────────────────────────────────────────
// The 50 presets. Grouped roughly by category for easy scanning.
// Replace the old 8-preset STYLE_PROMPTS in generate/route.ts by
// importing these instead.
// ──────────────────────────────────────────────────────────────────────

export const THUMBNAIL_STYLES: ThumbnailStyle[] = [
  // ───────── YOUTUBE VIRAL (mass-appeal creator styles) ─────────
  {
    id: "mrbeast_classic",
    name: "MrBeast Classic",
    category: "youtube_viral",
    description: "Jaw-dropped faces, pile of cash, red/yellow pop, oversized props.",
    promptModifier:
      "MrBeast-style viral thumbnail, exaggerated shocked expression, jaw wide open, piles of cash or giant prop, bold red and yellow accents, high-saturation, studio lighting, extreme close-up face, 3-color palette, clean background",
    gradient: ["#FF2D2D", "#FFDD00"],
  },
  {
    id: "yt_gaming_stream",
    name: "Gaming Stream",
    category: "gaming",
    description: "Purple-black cyber aesthetic, RGB glow, headset-wearing streamer.",
    promptModifier:
      "gaming thumbnail, cyberpunk purple and black palette, RGB rim light, streamer with gaming headset, dramatic in-game screenshot composite, neon glow edges, high-contrast dramatic",
    gradient: ["#7C3AED", "#0B0120"],
  },
  {
    id: "yt_finance_bold",
    name: "Finance Bold",
    category: "finance",
    description: "Green numbers, stacks of cash, red arrows, Wall Street intensity.",
    promptModifier:
      "finance content thumbnail, green rising chart arrows, hundred-dollar bills stacks, Wall Street intensity, red percentage callouts, black suit professional subject, high-contrast white background",
    gradient: ["#10B981", "#065F46"],
  },
  {
    id: "yt_tech_reviewer",
    name: "Tech Reviewer",
    category: "tech",
    description: "MKBHD-style moody product shot, teal-orange grading, phone hero.",
    promptModifier:
      "tech reviewer thumbnail, MKBHD-inspired moody product photography, teal and orange color grading, premium smartphone or laptop centered, deep black background, rim lighting, ultra-sharp focus, pro photography",
    gradient: ["#1F2937", "#EA580C"],
  },
  {
    id: "yt_food_explosion",
    name: "Food Explosion",
    category: "food",
    description: "Mid-air ingredients, glossy sauce splash, warm kitchen light.",
    promptModifier:
      "food content thumbnail, mid-air flying ingredients, glossy splash of sauce, warm golden kitchen lighting, freshly cooked dish hero shot, vibrant saturated colors, shallow depth of field, appetizing close-up",
    gradient: ["#F59E0B", "#B91C1C"],
  },
  {
    id: "yt_fitness_transformation",
    name: "Fitness Transformation",
    category: "fitness",
    description: "Before/after split, sweat-drenched, stark gym contrast.",
    promptModifier:
      "fitness transformation thumbnail, high-contrast gym setting, athletic subject mid-workout, dramatic side lighting revealing muscle definition, split-screen before-after composition, intense focus, motivational tone",
    gradient: ["#DC2626", "#1E1B4B"],
  },
  {
    id: "yt_clickbait_shock",
    name: "Clickbait Shock",
    category: "youtube_viral",
    description: "Red circle, yellow arrow, WTF face — peak YouTube meta.",
    promptModifier:
      "clickbait YouTube thumbnail, subject with jaw-dropped shocked face, red circle highlight over a detail, yellow pointing arrow, bright saturated colors, maximum contrast, hand-drawn feeling callouts",
    gradient: ["#EF4444", "#FACC15"],
  },
  {
    id: "yt_tutorial_howto",
    name: "Tutorial / How-To",
    category: "education",
    description: "Clean flat-lay, labeled steps, friendly colors, high readability.",
    promptModifier:
      "tutorial thumbnail, clean well-lit flat-lay or screen recording, numbered step callouts, soft natural daylight, friendly approachable tone, bright white or light gradient background, organized hierarchy",
    gradient: ["#FBBF24", "#34D399"],
  },
  {
    id: "yt_podcast_clip",
    name: "Podcast Clip",
    category: "entertainment",
    description: "Split two-shot, studio mic, oversized pull-quote.",
    promptModifier:
      "podcast clip thumbnail, two hosts in split-screen composition, studio condenser microphones visible, dramatic pull-quote text space on side, warm amber studio lighting, rich wood backdrop",
    gradient: ["#92400E", "#1F2937"],
  },
  {
    id: "yt_beauty_glam",
    name: "Beauty Glam",
    category: "lifestyle",
    description: "Glossy makeup close-up, soft ring light, pastel pink.",
    promptModifier:
      "beauty content thumbnail, glossy makeup close-up, soft ring-light reflection in eyes, pastel pink and gold palette, flawless skin texture, luxurious cosmetic products subtly in frame",
    gradient: ["#FBCFE8", "#C084FC"],
  },

  // ───────── TECH ─────────
  {
    id: "tech_minimal_flatlay",
    name: "Tech Flat-Lay",
    category: "tech",
    description: "Overhead shot, white desk, perfectly arranged gadgets.",
    promptModifier:
      "overhead flat-lay photography, pristine white desk surface, perfectly aligned tech gadgets, soft even lighting, clean minimal composition, muted natural color palette, pro product photography",
    gradient: ["#E5E7EB", "#64748B"],
  },
  {
    id: "tech_neon_cyber",
    name: "Cyberpunk Tech",
    category: "tech",
    description: "Neon signage, rain-slicked streets, holographic UI overlays.",
    promptModifier:
      "cyberpunk aesthetic thumbnail, neon pink and cyan signage, rain-slicked futuristic city street, holographic UI overlays, dramatic low angle, volumetric fog, Blade Runner inspired",
    gradient: ["#EC4899", "#06B6D4"],
  },
  {
    id: "tech_ai_futuristic",
    name: "AI Futuristic",
    category: "tech",
    description: "Holographic brain, particle swarms, cool blue glow.",
    promptModifier:
      "AI and technology thumbnail, holographic brain or neural network visualization, particle effects, cool blue and white glow, sci-fi futuristic aesthetic, dark space background with glowing nodes",
    gradient: ["#1E3A8A", "#3B82F6"],
  },

  // ───────── FINANCE / BUSINESS ─────────
  {
    id: "biz_wolf_wallstreet",
    name: "Wolf of Wall Street",
    category: "finance",
    description: "Money rain, Rolex, power-suit confidence.",
    promptModifier:
      "Wolf of Wall Street inspired thumbnail, falling 100-dollar bills, luxury watch and suit details, confident power pose, marble and gold accents, cinematic golden-hour tint, wealth energy",
    gradient: ["#EAB308", "#0F172A"],
  },
  {
    id: "biz_hustle_grindset",
    name: "Hustle / Grindset",
    category: "business",
    description: "Late-night laptop glow, coffee cup, red-black intensity.",
    promptModifier:
      "hustle culture thumbnail, late-night entrepreneur at laptop, glowing screen lighting the face, coffee mug, red and black palette, intense focus expression, city lights through window",
    gradient: ["#DC2626", "#020617"],
  },
  {
    id: "biz_corporate_clean",
    name: "Corporate Clean",
    category: "business",
    description: "Navy suit, glass boardroom, Harvard-Business-Review polish.",
    promptModifier:
      "corporate business thumbnail, navy suit subject, glass boardroom backdrop, natural daylight, Harvard Business Review polish, muted blues and grays, professional trustworthy tone",
    gradient: ["#1E40AF", "#94A3B8"],
  },

  // ───────── GAMING ─────────
  {
    id: "gaming_esports_hero",
    name: "Esports Hero",
    category: "gaming",
    description: "Backlit silhouette, team jersey, stadium lights.",
    promptModifier:
      "esports hero thumbnail, backlit silhouette of gamer in team jersey, stadium arena lights, confetti or smoke effects, dramatic low-angle hero shot, high-intensity competitive energy",
    gradient: ["#7C3AED", "#F43F5E"],
  },
  {
    id: "gaming_fortnite_bright",
    name: "Fortnite Bright",
    category: "gaming",
    description: "Pastel cartoon explosion, character hero pose, sparkles.",
    promptModifier:
      "bright cartoony gaming thumbnail, Fortnite inspired palette, pastel sky with sparkles, character in hero pose with weapon, exaggerated cel-shaded style, high saturation, kid-friendly energy",
    gradient: ["#38BDF8", "#F472B6"],
  },
  {
    id: "gaming_retro_arcade",
    name: "Retro Arcade",
    category: "gaming",
    description: "CRT scanlines, pixel art, 80s synthwave palette.",
    promptModifier:
      "retro arcade thumbnail, CRT scanline texture overlay, pixel art elements, 80s synthwave palette with magenta and cyan, neon grid floor, old arcade cabinet, nostalgic vibe",
    gradient: ["#F472B6", "#22D3EE"],
  },

  // ───────── EDUCATION ─────────
  {
    id: "edu_chalkboard",
    name: "Chalkboard Lesson",
    category: "education",
    description: "Chalk equations, wooden pointer, academic nostalgia.",
    promptModifier:
      "educational thumbnail, dark green chalkboard with handwritten chalk equations, wooden pointer stick, vintage academic feel, warm library lighting, classic teacher aesthetic",
    gradient: ["#14532D", "#FEF3C7"],
  },
  {
    id: "edu_whiteboard_explainer",
    name: "Whiteboard Explainer",
    category: "education",
    description: "Clean whiteboard, colorful markers, icon doodles.",
    promptModifier:
      "explainer video thumbnail, clean white whiteboard background, colorful marker doodles and icons, organized visual hierarchy, friendly approachable tone, natural daylight",
    gradient: ["#F8FAFC", "#3B82F6"],
  },
  {
    id: "edu_science_lab",
    name: "Science Lab",
    category: "education",
    description: "Bubbling flasks, safety goggles, cinematic lab light.",
    promptModifier:
      "science educational thumbnail, bubbling colorful flasks in laboratory, safety goggles and lab coat, cinematic teal volumetric lighting, sparks or chemical reaction, curious expression",
    gradient: ["#06B6D4", "#1E1B4B"],
  },

  // ───────── LIFESTYLE ─────────
  {
    id: "lifestyle_travel_drone",
    name: "Travel Drone",
    category: "lifestyle",
    description: "Aerial beach/mountain, tiny person, wanderlust saturation.",
    promptModifier:
      "travel drone thumbnail, sweeping aerial shot of exotic beach or mountain, tiny silhouetted person for scale, golden-hour saturation, cinematic aspect crop, wanderlust-inducing composition",
    gradient: ["#14B8A6", "#F59E0B"],
  },
  {
    id: "lifestyle_cozy_aesthetic",
    name: "Cozy Aesthetic",
    category: "lifestyle",
    description: "Warm candles, steaming mug, soft film grain.",
    promptModifier:
      "cozy aesthetic thumbnail, warm candlelight, steaming coffee mug, knitted blanket, soft film grain texture, amber and cream palette, intimate homey feeling, natural window light",
    gradient: ["#FCD34D", "#78350F"],
  },
  {
    id: "lifestyle_fashion_editorial",
    name: "Fashion Editorial",
    category: "lifestyle",
    description: "Vogue-style, sharp shadows, single pose, bold pop color.",
    promptModifier:
      "fashion editorial thumbnail, Vogue-style composition, sharp directional shadows, subject in single strong pose, bold single pop color against neutral, high-fashion magazine energy",
    gradient: ["#F43F5E", "#0F172A"],
  },

  // ───────── NEWS / DOCUMENTARY ─────────
  {
    id: "news_breaking_red",
    name: "Breaking News",
    category: "news",
    description: "Red banner, serious anchor, urgent energy.",
    promptModifier:
      "breaking news thumbnail, red banner with white text space, serious news anchor look, urgent intensity, broadcast-quality composition, red and navy blue palette, sharp professional",
    gradient: ["#B91C1C", "#1E3A8A"],
  },
  {
    id: "news_investigative_doc",
    name: "Investigative Doc",
    category: "news",
    description: "Moody dossier, black-red accent, conspiracy board feel.",
    promptModifier:
      "investigative documentary thumbnail, dark moody evidence-board aesthetic, red thread connecting pinned photos, vintage paper textures, single spotlight, mystery and intrigue tone",
    gradient: ["#1C1917", "#DC2626"],
  },

  // ───────── CINEMATIC / ARTISTIC ─────────
  {
    id: "cinematic_blockbuster",
    name: "Blockbuster Poster",
    category: "cinematic",
    description: "Big-face hero, teal-orange grade, dramatic stare.",
    promptModifier:
      "Hollywood blockbuster movie poster thumbnail, giant hero face staring forward, teal-orange Hollywood color grade, epic dramatic mood, explosions or city skyline behind, cinematic scope",
    gradient: ["#0369A1", "#EA580C"],
  },
  {
    id: "cinematic_horror",
    name: "Horror",
    category: "cinematic",
    description: "Deep shadows, single rim light, pale skin, dread.",
    promptModifier:
      "horror movie thumbnail, deep inky black shadows, single cold rim light, pale skin texture, sense of dread, slight film grain, desaturated teal accents, unsettling composition",
    gradient: ["#0F172A", "#94A3B8"],
  },
  {
    id: "cinematic_anime_opening",
    name: "Anime Opening",
    category: "cinematic",
    description: "Dynamic pose, wind-blown hair, painterly sunset sky.",
    promptModifier:
      "anime opening thumbnail, dynamic hero pose, wind-blown hair, painterly sunset sky with clouds, cel-shaded style, saturated colors, nostalgic Studio Ghibli or Makoto Shinkai inspiration",
    gradient: ["#F97316", "#7C3AED"],
  },

  // ───────── MINIMAL / DESIGN ─────────
  {
    id: "minimal_swiss_design",
    name: "Swiss Minimal",
    category: "minimal",
    description: "Single geometric shape, one bold color, Helvetica space.",
    promptModifier:
      "Swiss minimalist design thumbnail, single bold geometric shape, one vivid accent color on white, mountain of negative space for text, Helvetica-inspired sensibility, modernist restraint",
    gradient: ["#F3F4F6", "#EF4444"],
  },
  {
    id: "minimal_duotone",
    name: "Duotone",
    category: "minimal",
    description: "Two-color gradient, halftone dots, Spotify-ad aesthetic.",
    promptModifier:
      "duotone thumbnail, two-color gradient subject treatment, halftone dot texture overlay, Spotify campaign aesthetic, striking monochromatic energy, bold minimalist composition",
    gradient: ["#22D3EE", "#F472B6"],
  },
  {
    id: "minimal_paper_cutout",
    name: "Paper Cutout",
    category: "minimal",
    description: "Layered construction paper, craft shadows, kids-book vibe.",
    promptModifier:
      "paper cutout craft thumbnail, layered construction paper aesthetic, soft craft shadows between layers, bright primary colors, friendly kids-book illustration vibe",
    gradient: ["#FDE68A", "#F87171"],
  },

  // ───────── EXPERIMENTAL / TRENDY ─────────
  {
    id: "exp_y2k_chrome",
    name: "Y2K Chrome",
    category: "experimental",
    description: "Mirror chrome text, iridescent bubbles, 2001 nostalgia.",
    promptModifier:
      "Y2K chrome aesthetic thumbnail, liquid mirror metal textures, iridescent holographic bubbles, early-2000s nostalgia, glossy 3D typography, blue and silver palette, Matrix meets Bratz",
    gradient: ["#A5B4FC", "#E5E7EB"],
  },
  {
    id: "exp_risograph",
    name: "Risograph Print",
    category: "experimental",
    description: "Grainy two-color overprint, indie zine texture.",
    promptModifier:
      "risograph print aesthetic thumbnail, grainy textured two-color overprint, fluorescent pink and blue ink, indie zine DIY feel, slight misregistration, artisanal handmade quality",
    gradient: ["#F9A8D4", "#60A5FA"],
  },
  {
    id: "exp_vaporwave",
    name: "Vaporwave",
    category: "experimental",
    description: "Purple-pink gradients, marble busts, palm silhouettes.",
    promptModifier:
      "vaporwave aesthetic thumbnail, pink and purple gradient sky, Greek marble bust, palm tree silhouettes, retro-future nostalgia, grid floor receding to horizon, dreamy surreal mood",
    gradient: ["#A78BFA", "#EC4899"],
  },
  {
    id: "exp_glitch_distort",
    name: "Glitch Distort",
    category: "experimental",
    description: "RGB split, VHS artifacts, datamosh fragments.",
    promptModifier:
      "glitch art thumbnail, RGB channel split distortion, VHS tracking artifacts, datamosh fragment shards, analog static interference, unsettling digital decay, underground internet aesthetic",
    gradient: ["#EF4444", "#2563EB"],
  },
  {
    id: "exp_3d_render",
    name: "3D Render",
    category: "experimental",
    description: "Octane-style render, soft studio HDRI, pastel materials.",
    promptModifier:
      "3D render thumbnail, Octane-style physically accurate render, soft studio HDRI lighting, pastel material finish, subtle ambient occlusion, Blender sculpture aesthetic, Pinterest-core",
    gradient: ["#FED7AA", "#C7D2FE"],
  },

  // ───────── MORE VIRAL CREATOR ARCHETYPES ─────────
  {
    id: "creator_alpha_male",
    name: "Alpha-Male Podcast",
    category: "entertainment",
    description: "Andrew-Tate-style cold stare, cigar smoke, red accents.",
    promptModifier:
      "alpha-male podcast thumbnail, cold unflinching stare at camera, cigar smoke wisps, red and black palette, luxury watch visible, low-key high-contrast lighting, dominating presence",
    gradient: ["#991B1B", "#0C0A09"],
  },
  {
    id: "creator_reaction_react",
    name: "Reaction Channel",
    category: "entertainment",
    description: "Exaggerated jaw-drop, green arrow, split-screen clip.",
    promptModifier:
      "reaction channel thumbnail, massive exaggerated jaw-drop gasp face, green arrow pointing to the reacted-to content, split-screen composition, blue studio ring light, meme-culture energy",
    gradient: ["#22C55E", "#1E3A8A"],
  },
  {
    id: "creator_hasan_leftist",
    name: "Commentary Essayist",
    category: "entertainment",
    description: "Headset mic, glasses glare, studied-intellectual vibe.",
    promptModifier:
      "commentary essayist thumbnail, subject with wireless headset mic, slight glasses glare, bookshelf or set backdrop, thoughtful pointing gesture, warm balanced studio lighting, intellectual tone",
    gradient: ["#92400E", "#D97706"],
  },
  {
    id: "creator_vlog_dayinlife",
    name: "Day-in-the-Life Vlog",
    category: "lifestyle",
    description: "iPhone selfie, natural light, messy real-moment energy.",
    promptModifier:
      "day-in-the-life vlog thumbnail, iPhone selfie aesthetic, natural window daylight, casual unposed expression, slightly messy real-moment feel, warm authentic tone, no studio polish",
    gradient: ["#FDBA74", "#F9A8D4"],
  },
  {
    id: "creator_asmr_cozy",
    name: "ASMR Cozy",
    category: "lifestyle",
    description: "Extreme close-up, tingle triggers, soft pastel palette.",
    promptModifier:
      "ASMR cozy thumbnail, extreme close-up of hands or object, clear tingle-trigger detail, soft pastel palette, shallow depth of field, intimate headphones-required mood",
    gradient: ["#E9D5FF", "#A7F3D0"],
  },
  {
    id: "creator_true_crime",
    name: "True Crime",
    category: "entertainment",
    description: "Black-red evidence board, redacted stamps, dread.",
    promptModifier:
      "true crime thumbnail, black and red evidence board aesthetic, REDACTED stamps, grainy security-camera subject, looming sense of dread, single spotlight, investigator mood",
    gradient: ["#171717", "#B91C1C"],
  },
  {
    id: "creator_luxury_travel",
    name: "Luxury Travel",
    category: "lifestyle",
    description: "Overwater villa, cocktail in hand, infinity-pool horizon.",
    promptModifier:
      "luxury travel thumbnail, overwater villa or infinity pool, cocktail in foreground hand, turquoise ocean horizon, bright midday sun, wealth-tourism aspirational tone",
    gradient: ["#06B6D4", "#FDE68A"],
  },

  // ───────── WILDCARDS — useful for variety ─────────
  {
    id: "wild_comic_book",
    name: "Comic Book",
    category: "experimental",
    description: "Ben-Day dots, thick black outlines, BAM! callouts.",
    promptModifier:
      "comic book panel thumbnail, thick black ink outlines, Ben-Day dot shading, BAM or POW action callout, vivid primary colors, dynamic Kirby-style energy",
    gradient: ["#FACC15", "#EF4444"],
  },
  {
    id: "wild_watercolor",
    name: "Watercolor",
    category: "experimental",
    description: "Soft washes, paper texture, gentle bleeds.",
    promptModifier:
      "watercolor illustration thumbnail, soft paint washes bleeding into one another, rough paper texture, gentle pastel palette, organic imperfect strokes, hand-painted storybook feel",
    gradient: ["#BFDBFE", "#FBCFE8"],
  },
  {
    id: "wild_isometric",
    name: "Isometric Diagram",
    category: "tech",
    description: "Clean isometric illustration, infographic tiles, flat shading.",
    promptModifier:
      "isometric illustration thumbnail, clean flat-shaded 3D diagram, infographic tile composition, muted professional palette, explanatory tech-product aesthetic, Dribbble-style",
    gradient: ["#60A5FA", "#A78BFA"],
  },
];

export const STYLE_CATEGORIES: { id: StyleCategory; label: string }[] = [
  { id: "youtube_viral", label: "YouTube Viral" },
  { id: "tech", label: "Tech" },
  { id: "finance", label: "Finance" },
  { id: "gaming", label: "Gaming" },
  { id: "food", label: "Food" },
  { id: "fitness", label: "Fitness" },
  { id: "business", label: "Business" },
  { id: "education", label: "Education" },
  { id: "entertainment", label: "Entertainment" },
  { id: "lifestyle", label: "Lifestyle" },
  { id: "news", label: "News" },
  { id: "cinematic", label: "Cinematic" },
  { id: "minimal", label: "Minimal" },
  { id: "experimental", label: "Experimental" },
];

export function getStyleById(id: string): ThumbnailStyle | undefined {
  return THUMBNAIL_STYLES.find((s) => s.id === id);
}

export function getStylesByCategory(category: StyleCategory): ThumbnailStyle[] {
  return THUMBNAIL_STYLES.filter((s) => s.category === category);
}
