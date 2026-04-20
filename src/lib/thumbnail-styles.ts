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

  // ───────── NAMED YOUTUBER CHANNEL PRESETS ─────────
  // Seven curated style matches for the creators Nicklas picked. Each is
  // tuned via prompt engineering alone — no LoRA training required. Add
  // a reference image URL later if IP-Adapter grip is needed.

  {
    id: "creator_mrbeast_challenge",
    name: "MrBeast Challenge",
    category: "youtube_viral",
    description: "Giant number hook ($100,000), oversized prop, wide-eyed gasp, pristine red/yellow.",
    promptModifier:
      "MrBeast-style challenge thumbnail, gigantic bold number overlay (like $100,000 or 1,000,000), oversized real-world prop (car, yacht, mountain of cash, house), wide-eyed gasp with jaw dropped, saturated red and yellow accents on clean blue-sky or colored background, perfect studio lighting, 3-color palette, hyperclean composition, trending YouTube megabudget feel",
    gradient: ["#FF2D2D", "#FACC15"],
  },
  {
    id: "creator_8bitryan",
    name: "8BitRyan Mascot Horror",
    category: "gaming",
    description: "Poppy/Bendy-style mascot looming over player, glowing eyes, red-black dread.",
    promptModifier:
      "mascot horror gaming thumbnail in 8BitRyan style, large terrifying mascot character (fluffy blue or yellow monster) looming behind player silhouette, glowing yellow or red eyes, dark pitch-black environment with dim rim light, blood-red accents and scratches, worn creepypasta texture overlay, small gamer face reacting in terror in the corner, cinematic horror vignette",
    gradient: ["#0B0B0B", "#DC2626"],
  },
  {
    id: "creator_markiplier",
    name: "Markiplier Horror Reaction",
    category: "gaming",
    description: "His face reaction dominating frame, horror game screenshot behind, pink-red accents.",
    promptModifier:
      "Markiplier-style horror gaming thumbnail, large exaggerated reaction face in center-left with mouth wide open in horror, red-brown mustache styling implied, horror-game screenshot as the backdrop (dark corridor or creature), hot pink and crimson text callout space, vignette darkening the edges, cinematic horror film tone, 30-percent face / 70-percent game scene composition",
    gradient: ["#BE123C", "#1E1B4B"],
  },
  {
    id: "creator_iman_gadzhi",
    name: "Iman Gadzhi Agency Luxe",
    category: "business",
    description: "Cold stare, charcoal suit no tie, Porsche/London backdrop, champagne-gold tones.",
    promptModifier:
      "Iman Gadzhi-inspired agency-guru thumbnail, young entrepreneur in charcoal tailored suit with crisp white shirt no tie, cold unflinching stare directly at camera, London or Dubai luxury backdrop (Porsche 911 Turbo, penthouse terrace, Mayfair street, or Monaco yacht), soft champagne-gold key light, cinematic navy and cream palette, subtle vignette, refined wealth energy without vulgarity, editorial magazine polish",
    gradient: ["#1E293B", "#D4AF37"],
  },
  {
    id: "creator_jordan_welch",
    name: "Jordan Welch E-Com",
    category: "business",
    description: "Laptop hero, neon-green arrow charts, Shopify/Amazon hint, navy+green palette.",
    promptModifier:
      "Jordan Welch-style e-commerce thumbnail, sleek young entrepreneur in fitted navy suit presenting a MacBook Pro, bright neon-green revenue-arrow chart graphic hovering above, subtle Shopify or Amazon visual cues, clean white or navy gradient background, bold white headline space on one side, professional confident tone, Wall Street meets Silicon Valley energy, crisp modern polish",
    gradient: ["#0F172A", "#22C55E"],
  },
  {
    id: "creator_vanossgaming",
    name: "VanossGaming Cartoon Gang",
    category: "gaming",
    description: "Cartoon-style group characters, bright pastel chaos, GTA/GMod comedy feel.",
    promptModifier:
      "VanossGaming-style multiplayer cartoon thumbnail, exaggerated cartoonified characters (the whale-headed Vanoss mascot plus friend avatars) striking silly action poses, bright pastel sky-blue and magenta palette, GTA V or Garry's Mod chaos backdrop (cars exploding, ragdoll physics), comedic motion lines, cel-shaded outlines, group-shot composition with all characters fitting into frame, meme-energy playful chaos",
    gradient: ["#3B82F6", "#F472B6"],
  },
  {
    id: "creator_chris_bumstead",
    name: "Chris Bumstead Classic Olympia",
    category: "fitness",
    description: "CBum physique hero shot, gold Mr. Olympia trophy, red-black-gold palette.",
    promptModifier:
      "Chris Bumstead-style classic physique thumbnail, massive chiseled bodybuilder in a vacuum pose or front double biceps, dramatic golden spotlight rim light sculpting every muscle, deep black background with faint red smoke, Mr. Olympia gold trophy or laurel wreath element, classic physique division aesthetic, gold and crimson palette, confident champion stare, cinematic gym poster polish",
    gradient: ["#0B0B0B", "#D4AF37"],
  },

  // ───────── 43 ADDITIONAL NAMED YOUTUBER / CREATOR PRESETS ─────────
  // Each tuned via prompt engineering to match a real creator's visual
  // signature — palette, framing, props, color grade. No LoRA needed.

  // TECH / REVIEW
  {
    id: "creator_mkbhd",
    name: "MKBHD Studio Review",
    category: "tech",
    description: "Moody teal-red MKBHD studio, single gadget hero, glossy reflective surface.",
    promptModifier:
      "Marques Brownlee MKBHD-inspired studio review thumbnail, single premium gadget (smartphone, headphones, or laptop) sharply lit on a glossy reflective black surface, dominant teal-and-red color grade, soft overhead softbox key light with crisp specular highlights, shallow depth of field, deep matte-black background, ultra-clean tech-reviewer polish, oversized white bold sans-serif title space on right",
    gradient: ["#DC2626", "#0F766E"],
  },
  {
    id: "creator_ltt_linus",
    name: "Linus Tech Tips Chaos",
    category: "tech",
    description: "Linus mid-drop shocked face, overflowing parts on wooden desk, warm fluorescent.",
    promptModifier:
      "Linus Tech Tips-style thumbnail, mid-laugh or exaggerated shocked expression with hands thrown up, cluttered warm-lit workshop desk overflowing with PC components, RGB motherboard glow, white pegboard backdrop, slightly chaotic high-energy framing, red LTT logo bold red accent, casual nerd-dad humor tone, handheld run-and-gun feel",
    gradient: ["#DC2626", "#0F172A"],
  },
  {
    id: "creator_unbox_therapy",
    name: "Unbox Therapy Hero Shot",
    category: "tech",
    description: "Hands holding mystery gadget, black backdrop, tight macro crop, white text.",
    promptModifier:
      "Unbox Therapy-style thumbnail, close-up of hands cradling a mystery or flagship gadget against a pure jet-black seamless backdrop, single hard key light from top-left, extreme macro framing on the product detail, minimal composition, bold white sans-serif headline space, understated intrigue aesthetic, matte finish product photography",
    gradient: ["#0F172A", "#E5E7EB"],
  },
  {
    id: "creator_mrwhosetheboss",
    name: "Mrwhosetheboss Premium",
    category: "tech",
    description: "Deep indigo backdrop, phone floating with glow halo, Arun-style polish.",
    promptModifier:
      "Mrwhosetheboss-inspired premium tech thumbnail, flagship smartphone floating mid-air with a soft circular radial glow halo behind it, deep indigo and midnight-blue backdrop with subtle star-field particles, polished cinematic product composition, British-reviewer cool aesthetic, sleek futuristic typography space, ultra-crisp focus and smooth gradients",
    gradient: ["#312E81", "#38BDF8"],
  },
  {
    id: "creator_dave2d",
    name: "Dave2D Minimal Laptop",
    category: "tech",
    description: "One laptop, clean wood desk, natural window light, minimalist restraint.",
    promptModifier:
      "Dave2D-style minimalist laptop review thumbnail, a single thin-bezel ultrabook open at a precise 100-degree angle on a light oak wooden desk, soft diffuse natural window daylight from the left, muted neutral palette, zero clutter, Scandinavian minimalism, very shallow depth of field, small plant or coffee cup as the only secondary element",
    gradient: ["#D6D3D1", "#57534E"],
  },

  // GAMING
  {
    id: "creator_pewdiepie",
    name: "PewDiePie Cartoon Chaos",
    category: "gaming",
    description: "Felix cartoon face exaggerated, meme overlay, bright red-blue Swedish chaos.",
    promptModifier:
      "PewDiePie-style gaming thumbnail, exaggerated cartoonified face with wide bulging eyes and open laughing mouth, meme arrow or circle overlay with Impact-font style caption, Swedish flag blue and vibrant red palette, chair-throwing or flopping ragdoll meme vibe, slightly lo-fi gritty edge, irreverent chaotic energy, Brofist callback element in corner",
    gradient: ["#2563EB", "#EF4444"],
  },
  {
    id: "creator_dream_speedrun",
    name: "Dream Minecraft Manhunt",
    category: "gaming",
    description: "Green smile logo looming, pixel Minecraft landscape, lime-green glow.",
    promptModifier:
      "Dream-style Minecraft manhunt thumbnail, iconic Dream smiley-face mask logo looming large and slightly blurred behind, blocky Minecraft biome landscape (forest or nether) in the background, lime-green magical glow emanating from the mask, small pixel Steve player figure running in the foreground, bright saturated sky blue, speedrun-tension composition",
    gradient: ["#22C55E", "#1E3A8A"],
  },
  {
    id: "creator_ninja",
    name: "Ninja Fortnite Blue",
    category: "gaming",
    description: "Blue-haired streamer hero pose, Fortnite purple-blue sky, massive victory.",
    promptModifier:
      "Ninja-style Fortnite streamer thumbnail, platinum-blue-haired streamer in a hero victory pose wearing a headset, stylized Fortnite battle royale skyline behind with storm-purple and electric-blue clouds, Victory Royale graphic bar across the top, stylized cel-shaded cartoon render, twitch-streamer overlay frame, explosive hype energy",
    gradient: ["#1D4ED8", "#A855F7"],
  },
  {
    id: "creator_shroud",
    name: "Shroud Tactical Focus",
    category: "gaming",
    description: "Tactical FPS silhouette, muted military grade, laser-focus stare.",
    promptModifier:
      "Shroud-style tactical FPS gaming thumbnail, subject in dark green operator jacket and headset with an intensely focused laser-calm stare, desaturated tactical military color grade with olive drab and gunmetal tones, crosshair reticle overlay on a distant target, a tactical operator silhouette in the backdrop, no exaggeration, pure aim-god precision aesthetic",
    gradient: ["#1F2937", "#65A30D"],
  },
  {
    id: "creator_jacksepticeye",
    name: "Jacksepticeye Green Hype",
    category: "gaming",
    description: "Bright neon-green backdrop, Sean's beaming grin, Irish energy explosion.",
    promptModifier:
      "Jacksepticeye-style gaming reaction thumbnail, bright neon-green backdrop with black Septic-Sam eye logo watermark, host with messy bright-green-tinted hair beaming ear-to-ear with both fists pumped, playful tongue-out expression option, bouncy kinetic pose, yellow and green accent palette, pure Irish hype-energy, motion-blurred confetti in corners",
    gradient: ["#22C55E", "#0F172A"],
  },
  {
    id: "creator_coryxkenshin",
    name: "CoryxKenshin Samurai Horror",
    category: "gaming",
    description: "Cory in samurai headband, exaggerated scared-serious face, red-black.",
    promptModifier:
      "CoryxKenshin-style horror gaming thumbnail, Cory wearing his signature red samurai headband and hoodie with an exaggerated scared-but-determined face, one eye squinted, dark horror game environment (abandoned hallway, flickering bulb) behind him, deep crimson-red and jet-black palette, subtle katana silhouette element, Samurai-family bold callout space",
    gradient: ["#991B1B", "#0B0B0B"],
  },
  {
    id: "creator_ssundee",
    name: "SSundee Cartoon Explosion",
    category: "gaming",
    description: "Cartoonified Ssundee tiny body big head, pastel Minecraft chaos, sunglasses.",
    promptModifier:
      "SSundee-style cartoon gaming thumbnail, exaggerated cartoonified Ssundee with oversized head and tiny body wearing his signature sunglasses and purple hoodie, goofy exaggerated open-mouth laugh, bright pastel Minecraft-mod chaos in background (exploding creepers, flying pigs, rainbow blocks), kid-friendly toon-shaded lighting, sky-blue and pink bubble accents",
    gradient: ["#60A5FA", "#F472B6"],
  },

  // FITNESS
  {
    id: "creator_jeff_nippard",
    name: "Jeff Nippard Science",
    category: "fitness",
    description: "Whiteboard with muscle diagrams, lean athletic host, clean white gym.",
    promptModifier:
      "Jeff Nippard-style science-based fitness thumbnail, lean natural bodybuilder in a fitted white t-shirt gesturing to a whiteboard displaying muscle anatomy diagrams, EMG charts, or rep-range graphs, brightly-lit clean white gym studio backdrop, evidence-based nerdy-but-jacked tone, blue and white color palette, crisp professional educational polish",
    gradient: ["#DBEAFE", "#1D4ED8"],
  },
  {
    id: "creator_david_laid",
    name: "David Laid Aesthetic Lean",
    category: "fitness",
    description: "Greek-statue lean physique, moody studio, minimalist high fashion gym.",
    promptModifier:
      "David Laid-style aesthetic physique thumbnail, extremely lean Greek-statue-proportioned subject in minimalist black compression shorts, soft chiaroscuro studio lighting carving every striation, muted grayscale backdrop with a single cold blue rim light, high-fashion editorial mood, cold emotionless model stare, GymShark campaign polish",
    gradient: ["#1E293B", "#CBD5E1"],
  },
  {
    id: "creator_larry_wheels",
    name: "Larry Wheels Monster Lift",
    category: "fitness",
    description: "Massive powerlifter mid-deadlift, chalk cloud, red-black intensity.",
    promptModifier:
      "Larry Wheels-style powerlifting thumbnail, massive heavily-muscled strongman mid-deadlift with a chalk dust explosion in the air, veins bulging, open-mouth roaring intensity, industrial warehouse gym with a loaded deadlift bar bending, red and black blood-and-iron palette, harsh overhead work-light, raw unfiltered strength energy",
    gradient: ["#7F1D1D", "#0B0B0B"],
  },
  {
    id: "creator_sam_sulek",
    name: "Sam Sulek Gym Rat POV",
    category: "fitness",
    description: "GoPro chest-angle, teen bodybuilder pumped, Ohio commercial gym.",
    promptModifier:
      "Sam Sulek-style raw gym-rat thumbnail, chest-up GoPro selfie angle of a young massive bodybuilder mid-pump wearing a sweat-stained gray cutoff and backwards cap, absurd pump visible in the arms, generic commercial gym in the background with a familiar squat rack, warm yellowish fluorescent lighting, casual unpolished authentic gen-Z bro-science vibe",
    gradient: ["#78716C", "#F59E0B"],
  },
  {
    id: "creator_chris_heria",
    name: "Chris Heria Calisthenics Rooftop",
    category: "fitness",
    description: "Miami rooftop calisthenics, shirtless muscle-up silhouette, neon sunset.",
    promptModifier:
      "Chris Heria-style calisthenics thumbnail, shirtless subject at the top of a muscle-up on an outdoor Miami rooftop pull-up bar, golden-hour Miami sunset silhouette with palm trees and pastel pink-orange sky, defined functional aesthetic physique, THENX-style bold white block text space below, motivational street-workout energy",
    gradient: ["#F97316", "#F43F5E"],
  },

  // FINANCE / BUSINESS
  {
    id: "creator_graham_stephan",
    name: "Graham Stephan Real Estate",
    category: "finance",
    description: "Graham pointing at chart, big green number, LA background, clean white.",
    promptModifier:
      "Graham Stephan-style real-estate/finance thumbnail, host with a neat beard pointing at an oversized green revenue number (like $50,000/mo), crisp white background with a faint LA home exterior visible, a subtle Tesla or property photo in the corner, friendly minimalist energy, money-green and clean-white palette, approachable millennial-millionaire tone, let-me-explain-everything body language",
    gradient: ["#16A34A", "#F9FAFB"],
  },
  {
    id: "creator_ali_abdaal",
    name: "Ali Abdaal Productivity",
    category: "education",
    description: "Ali smiling with Notion/iPad, warm teal-cream, cozy study-desk aesthetic.",
    promptModifier:
      "Ali Abdaal-style productivity thumbnail, host smiling warmly while holding an iPad or showing a Notion dashboard, cozy warm-teal and cream color palette, wooden desk with a neatly arranged cup of coffee and a plant, soft window light from the left, doctor-turned-creator intelligent-approachable aesthetic, hand-drawn doodle arrow callout, friendly-educator tone",
    gradient: ["#14B8A6", "#FEF3C7"],
  },
  {
    id: "creator_hormozi",
    name: "Alex Hormozi Offer Stack",
    category: "business",
    description: "Bald Hormozi stare-down, black t-shirt, bold yellow offer-stack graphic.",
    promptModifier:
      "Alex Hormozi-style direct-response business thumbnail, bald heavily-tattooed host in a plain black t-shirt locked into an unbroken stare at the camera with a slight smirk, oversized bold yellow and black value-stack graphic with crossed-out old price and bolded new price, stark white background, aggressive money-making guarantee energy, Acquisition-dot-com typography",
    gradient: ["#FACC15", "#0B0B0B"],
  },
  {
    id: "creator_patrick_bet_david",
    name: "Patrick Bet-David Valuetainment",
    category: "business",
    description: "PBD at glass whiteboard, suit no tie, Valuetainment red-black studio.",
    promptModifier:
      "Patrick Bet-David-style Valuetainment thumbnail, sharp-jawed host in a charcoal suit with open-collar shirt, standing next to a glass whiteboard with hand-drawn business-strategy diagrams, Valuetainment logo-red and deep-black studio backdrop, one strong rim light, authoritative exec-interviewer gaze, leadership-and-entrepreneurship polish",
    gradient: ["#DC2626", "#111827"],
  },
  {
    id: "creator_gary_vee",
    name: "Gary Vaynerchuk Hustle",
    category: "business",
    description: "Gary mid-yell at phone, sneakers/hoodie, NYC chaotic hustle energy.",
    promptModifier:
      "Gary Vaynerchuk-style hustle-energy thumbnail, Gary mid-yell into his phone wearing a Jets hoodie and sneakers, bustling NYC street or VaynerMedia office in the background slightly motion-blurred, raw handheld energy, bright pops of red and yellow accents, kinetic on-the-go entrepreneur vibe, hand-scrawled exclamation callout, authentic unfiltered-hustle aesthetic",
    gradient: ["#F59E0B", "#DC2626"],
  },

  // FOOD
  {
    id: "creator_nick_digiovanni",
    name: "Nick DiGiovanni Rainbow Plate",
    category: "food",
    description: "Colorful plate, Nick smiling, bright pastel rainbow studio kitchen.",
    promptModifier:
      "Nick DiGiovanni-style MasterChef thumbnail, cheerful young chef in a clean white apron holding up a vibrantly plated dish with rainbow-colored fruits or sushi, bright pastel kitchen studio backdrop with seafoam-green cabinets, playful youthful energy, saturated but clean food-styling photography, joyful-foodie approachable tone",
    gradient: ["#F472B6", "#34D399"],
  },
  {
    id: "creator_joshua_weissman",
    name: "Joshua Weissman But Better",
    category: "food",
    description: "Close-up pristine homemade version, papa-tier crispy, warm studio kitchen.",
    promptModifier:
      "Joshua Weissman But-Better-style food thumbnail, extreme macro close-up of a pristinely plated homemade fast-food-remake (a perfect burger, crispy fried chicken, or ramen) with visible steam and glistening sauce, warm-lit tidy home kitchen in soft-focus background, host's arm barely visible holding a knife, deep amber and cream palette, papa-tier-quality food-porn composition",
    gradient: ["#B45309", "#FEF3C7"],
  },
  {
    id: "creator_gordon_ramsay",
    name: "Gordon Ramsay MasterChef",
    category: "food",
    description: "Ramsay yelling, stainless-steel kitchen, dramatic blue-white spotlight.",
    promptModifier:
      "Gordon Ramsay MasterChef-style thumbnail, Ramsay in crisp chef whites mid-yell pointing at something off-frame, gleaming stainless-steel professional kitchen backdrop, cold dramatic blue-and-white spotlight from above, blue fire flame element in the corner, intense high-stakes culinary-tension energy, reality-TV signature composition",
    gradient: ["#1E40AF", "#F3F4F6"],
  },
  {
    id: "creator_babish",
    name: "Binging with Babish",
    category: "food",
    description: "Overhead recreation of movie-food, blue wooden board, calm Brooklyn home.",
    promptModifier:
      "Binging with Babish-style thumbnail, overhead flat-lay shot of a meticulously recreated iconic movie or TV show dish on Babish's signature blue wooden cutting board, arms in rolled-sleeve chef shirt just entering the frame, warm Brooklyn-apartment kitchen natural daylight, soft shadows, calm methodical tone, muted teal and oak palette",
    gradient: ["#1E3A8A", "#D97706"],
  },
  {
    id: "creator_mrbeast_burger",
    name: "MrBeast Burger Chain",
    category: "food",
    description: "Giant oozing burger, wood table, MrBeast red-orange branding energy.",
    promptModifier:
      "MrBeast Burger-style fast-food thumbnail, oversized dripping double-smash-burger with glossy American cheese and crispy lettuce hero-shot on rustic wood, bright studio softbox light, bold MrBeast red and orange palette, French fries and a shake in the blurred backdrop, appetizing-yet-chaotic challenge-channel food-ad composition, giant number or dollar-sign badge",
    gradient: ["#EF4444", "#F97316"],
  },

  // LIFESTYLE / VLOG
  {
    id: "creator_casey_neistat",
    name: "Casey Neistat NYC Vlog",
    category: "lifestyle",
    description: "Casey on boosted-board, NYC street, Technics-style black-white-yellow.",
    promptModifier:
      "Casey Neistat-style NYC vlog thumbnail, subject in a Sony beanie and glasses riding a Boosted board down a Manhattan street, handheld fisheye DSLR-vlog aesthetic, gritty black-white-and-yellow signature color grade with bold sans-serif title card, steam rising from subway grates, busy taxis and yellow cabs, authentic run-and-gun filmmaker tone",
    gradient: ["#FACC15", "#111827"],
  },
  {
    id: "creator_emma_chamberlain",
    name: "Emma Chamberlain Film Grain",
    category: "lifestyle",
    description: "Emma with Chamberlain coffee, faded film, fisheye bedroom, gen-Z mess.",
    promptModifier:
      "Emma Chamberlain-style vlog thumbnail, casual messy-bun subject holding a Chamberlain Coffee cup, faded film-grain color grade with washed-out yellows and dusty pinks, slight fisheye distortion, lived-in bedroom or LA cafe backdrop, unposed candid mid-laugh moment, gen-Z chaotic-authentic aesthetic, low-saturation vintage feel",
    gradient: ["#F5D0A9", "#A78BFA"],
  },
  {
    id: "creator_david_dobrik",
    name: "David Dobrik Vlog Squad",
    category: "lifestyle",
    description: "Group selfie, big ensemble laugh, bright LA sun, fisheye warm chaos.",
    promptModifier:
      "David Dobrik Vlog-Squad-style thumbnail, a big group selfie of eight-plus friends all cramming into a fisheye wide-angle frame with over-the-top laughing open-mouth expressions, piled into a Tesla or crammed into a hotel room, bright LA sunny midday overexposed look, chaotic prank-aftermath energy, orange and sky-blue palette, 4-minute-vlog signature",
    gradient: ["#FB923C", "#38BDF8"],
  },
  {
    id: "creator_jake_paul",
    name: "Jake Paul Problem Child",
    category: "entertainment",
    description: "Jake in boxing gloves, purple-red fight poster, Problem Child branding.",
    promptModifier:
      "Jake Paul Problem-Child-style thumbnail, host in red boxing gloves with a smirking trash-talking stare-down pose, Problem-Child deep-purple-and-red fight-poster color palette, stadium lights hinted behind with boxing-ring ropes, oversized bold white block fight-card typography space, confrontational showboat energy, influencer-boxer polish",
    gradient: ["#7C3AED", "#DC2626"],
  },

  // EDUCATION
  {
    id: "creator_thomas_frank",
    name: "Thomas Frank Study",
    category: "education",
    description: "Open Notion on laptop, cozy study desk, College Info Geek warm tones.",
    promptModifier:
      "Thomas Frank-style study-productivity thumbnail, overhead angle of a laptop running a color-coded Notion dashboard on a tidy wooden desk, bullet-journal notebook, leather pen, and a cup of tea arranged around it, warm amber reading-lamp light, College-Info-Geek cozy-intellectual aesthetic, autumn-earth-tone palette, friendly student-focused tone",
    gradient: ["#B45309", "#064E3B"],
  },
  {
    id: "creator_matt_davella",
    name: "Matt D'Avella Minimalist",
    category: "lifestyle",
    description: "Stark white room, one object, Matt in plain tee, silent-frame minimalism.",
    promptModifier:
      "Matt D'Avella-style minimalist documentary thumbnail, subject in a plain white or heather-gray t-shirt standing in a stark white empty room with one single meaningful object (a chair, a book, a plant), muted slightly-desaturated natural daylight, wide negative space, Helvetica-clean typography room, The-Minimalists thoughtful-pause aesthetic",
    gradient: ["#F3F4F6", "#57534E"],
  },
  {
    id: "creator_veritasium",
    name: "Veritasium Science",
    category: "education",
    description: "Derek holding a counter-intuitive object, physics demo, electric blue.",
    promptModifier:
      "Veritasium-style science-education thumbnail, Derek Muller holding a counter-intuitive physics demonstration object (a spinning top, a vacuum chamber, a magnet), dramatic key light and dark teal backdrop, electric-blue chalkboard-style equation overlay, raised-eyebrow curious expression, educational-but-mind-blown mood, sharp professional documentary polish",
    gradient: ["#0EA5E9", "#0F172A"],
  },
  {
    id: "creator_kurzgesagt",
    name: "Kurzgesagt Flat Illustration",
    category: "education",
    description: "Flat vector ducks, space scene, Kurzgesagt cool-pastel gradient sky.",
    promptModifier:
      "Kurzgesagt-style flat-illustration thumbnail, crisp flat-vector cartoon ducks or tiny geometric characters floating in a cosmic or microscopic scene, signature cool-pastel gradient sky (teal to pink to orange), clean rounded-corner shapes, zero-photoreal textures, Birds-In-A-Nutshell whimsical-explainer tone, cheerful-yet-existential science-of-everything polish",
    gradient: ["#06B6D4", "#FB7185"],
  },

  // COMMENTARY / DOCUMENTARY
  {
    id: "creator_johnny_harris",
    name: "Johnny Harris Map Explainer",
    category: "news",
    description: "Vintage world map zoom, red pins, Johnny in earth-tone jacket.",
    promptModifier:
      "Johnny Harris-style geopolitical-explainer thumbnail, vintage sepia-toned world map dominating the frame with red-string connection lines and pinned markers on conflict zones, host in a rugged earth-tone field-jacket staring thoughtfully off-frame, cinematic warm tungsten light, Vox-alum documentary polish, burnt-orange and forest-green palette",
    gradient: ["#78350F", "#166534"],
  },
  {
    id: "creator_wendover",
    name: "Wendover Productions Infographic",
    category: "education",
    description: "Isometric airplane/map infographic, clean vector, blue corporate palette.",
    promptModifier:
      "Wendover Productions-style infographic thumbnail, isometric vector illustration of a Boeing airplane or a world-trade-route map with clean animated-style arrows and data callouts, corporate-infographic clean cyan and navy palette, no human subject, crisp bold sans-serif title space, systems-analysis-explainer educational-documentary polish",
    gradient: ["#1E3A8A", "#0EA5E9"],
  },
  {
    id: "creator_coffeezilla",
    name: "Coffeezilla Scam Exposé",
    category: "news",
    description: "Coffeezilla cup glare, investigator shadow, brown-black conspiracy moody.",
    promptModifier:
      "Coffeezilla-style scam-investigator thumbnail, low-key lit host with dramatic half-shadow across his face holding a coffee mug with signature skull-and-coffee graphic, a blurred screenshot of crypto scammers or NFT rug-pull evidence behind him, deep brown and black investigative palette, single cool rim light, serious-investigative-journalist tone, evidence-file aesthetic",
    gradient: ["#431407", "#0B0B0B"],
  },
  {
    id: "creator_joe_rogan",
    name: "Joe Rogan Experience Clip",
    category: "entertainment",
    description: "Two-shot at desk, Shure SM7B mics, moody blue JRE studio.",
    promptModifier:
      "Joe Rogan Experience-style podcast clip thumbnail, two-shot of host and guest leaning on the wooden desk holding Shure SM7B microphones mid-conversation, moody blue JRE studio backdrop with shelves of skull art and books, warm amber accent light on the guest, deep navy and amber palette, bold white pull-quote text space, long-form-podcast intensity",
    gradient: ["#0C4A6E", "#F59E0B"],
  },
  {
    id: "creator_lex_fridman",
    name: "Lex Fridman Interview",
    category: "entertainment",
    description: "Two-shot against black wall, suit-and-tie Lex, philosophical dark polish.",
    promptModifier:
      "Lex Fridman-style long-form-interview thumbnail, Lex in his signature black suit and black tie sitting across from a guest against a pure matte black wall, single warm key light on each face creating dramatic rim separation, minimalist no-logo composition, contemplative philosophical energy, muted gold and black palette, AI-ML-and-meaning-of-life gravitas",
    gradient: ["#0B0B0B", "#CA8A04"],
  },

  // ANIME / ANIMATED / CREATIVE
  {
    id: "creator_rdcworld1",
    name: "RDCworld1 Anime Sketch",
    category: "entertainment",
    description: "Group in anime-style pose, explosive speed lines, black dudes as otakus.",
    promptModifier:
      "RDCworld1-style anime-sketch comedy thumbnail, ensemble cast of friends in over-the-top anime battle poses with exaggerated serious expressions, dramatic radial speed-lines exploding from center, bold cel-shaded saturated outlines, If-Anime-Characters-Were-Black energy, Dragon-Ball-Z and Naruto homage composition, text-callout space top and bottom",
    gradient: ["#F97316", "#7C3AED"],
  },
  {
    id: "creator_jaiden_animations",
    name: "Jaiden Animations",
    category: "entertainment",
    description: "Jaiden cartoon avatar with Ari bird, pastel flat backdrop, diary-vlog cute.",
    promptModifier:
      "Jaiden Animations-style storytime-animation thumbnail, Jaiden's pink-hooded cartoon avatar with her green parrot Ari perched on her shoulder, flat pastel-cream backdrop with small doodle sparkles, big expressive anime-style eyes, cozy wholesome diary-vlog energy, soft mint-green and peach palette, hand-drawn caption bubble space, approachable animator-storyteller tone",
    gradient: ["#A7F3D0", "#FECACA"],
  },
  {
    id: "creator_somethingelseyt",
    name: "SomethingElseYT Fast Paced",
    category: "entertainment",
    description: "Adam's yellow-hoodie avatar, motion-blur cartoon chaos, yellow-purple pop.",
    promptModifier:
      "SomethingElseYT-style hyperactive-animation thumbnail, Adam's yellow-hoodie cartoon avatar with giant Kirby-style eyes mid-shout with motion lines radiating out, chaotic bright purple and yellow backdrop with scribble textures, fast-cut vlog-style cartoon energy, over-caffeinated storyteller vibe, comic-strip BAM-style callout graphic in corner",
    gradient: ["#FACC15", "#7C3AED"],
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
