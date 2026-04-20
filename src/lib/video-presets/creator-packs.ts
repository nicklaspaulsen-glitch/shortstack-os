// ──────────────────────────────────────────────────────────────────────
// CREATOR_VIDEO_PACKS — one pack per named YouTuber preset.
//
// Each pack encodes the editing "signature" of a real creator: pacing,
// cut frequency, zoom style, text animation, music moods, SFX flavor,
// color grade, and caption style. The video editor uses these to seed
// sensible defaults when a user picks a creator vibe (MrBeast, MKBHD,
// Casey Neistat, etc) — matching the thumbnail style in
// src/lib/thumbnail-styles.ts by shared id.
//
// This is NOT a training artifact — it's hand-curated defaults. Adding
// a new pack is one entry here.
// ──────────────────────────────────────────────────────────────────────

export interface CreatorVideoPackSignature {
  pacing: "fast" | "medium" | "slow";
  /** avg secs per cut, mapped to named tempo bands. */
  cutFrequency: "rapid" | "moderate" | "slow";
  zoomStyle: "punch-in" | "smooth" | "none" | "jerky";
  /** id/name hint from the transitions/effects libraries. */
  textAnimation: string;
  /** moods from MUSIC_LIBRARY (MusicMood[]). */
  musicMood: string[];
  /** SFX category or tag keywords (matches SFX_LIBRARY). */
  sfxCategories: string[];
  /** effect id from EFFECTS_LIBRARY, or a freeform descriptor. */
  colorGrade: string;
  /** Caption/sub style flavor — "hormozi-bounce", "mrbeast-pop", etc. */
  captionStyle: string;
}

export interface CreatorVideoPack {
  id: string;
  name: string;
  creatorName: string;
  description: string;
  signature: CreatorVideoPackSignature;
  typicalVideoLength_sec: { min: number; max: number };
  thumbnailStyleId: string;
}

export const CREATOR_VIDEO_PACKS: CreatorVideoPack[] = [
  // ───────── 7 ORIGINAL NAMED CREATORS ─────────
  {
    id: "creator_mrbeast_challenge",
    name: "MrBeast Challenge Pack",
    creatorName: "MrBeast",
    description:
      "High-stakes challenge pacing with $100K hook, non-stop jumpcuts, giant number overlays.",
    signature: {
      pacing: "fast",
      cutFrequency: "rapid",
      zoomStyle: "punch-in",
      textAnimation: "tr_zoom_punch",
      musicMood: ["hype", "energetic", "epic"],
      sfxCategories: ["whoosh", "impact", "riser", "meme"],
      colorGrade: "fx_color_hdr_pop",
      captionStyle: "mrbeast-pop",
    },
    typicalVideoLength_sec: { min: 600, max: 1800 },
    thumbnailStyleId: "creator_mrbeast_challenge",
  },
  {
    id: "creator_8bitryan",
    name: "8BitRyan Mascot Horror Pack",
    creatorName: "8BitRyan",
    description:
      "Horror mascot pacing with slow dread builds, sudden jumpscare cuts, and creepypasta ambience.",
    signature: {
      pacing: "medium",
      cutFrequency: "moderate",
      zoomStyle: "smooth",
      textAnimation: "tr_fade_dip_black",
      musicMood: ["dark", "mysterious"],
      sfxCategories: ["ambient", "cinematic", "riser", "impact"],
      colorGrade: "fx_color_noir",
      captionStyle: "clean-sans",
    },
    typicalVideoLength_sec: { min: 600, max: 1500 },
    thumbnailStyleId: "creator_8bitryan",
  },
  {
    id: "creator_markiplier",
    name: "Markiplier Horror Reaction Pack",
    creatorName: "Markiplier",
    description:
      "Dramatic reaction pacing with huge face-cam spikes, horror stingers, cinematic zooms.",
    signature: {
      pacing: "medium",
      cutFrequency: "moderate",
      zoomStyle: "punch-in",
      textAnimation: "tr_zoom_in",
      musicMood: ["dark", "epic", "mysterious"],
      sfxCategories: ["cinematic", "impact", "riser"],
      colorGrade: "fx_color_cinematic_flat",
      captionStyle: "clean-sans",
    },
    typicalVideoLength_sec: { min: 900, max: 1800 },
    thumbnailStyleId: "creator_markiplier",
  },
  {
    id: "creator_iman_gadzhi",
    name: "Iman Gadzhi Agency Luxe Pack",
    creatorName: "Iman Gadzhi",
    description:
      "Luxury b-roll agency pacing with slow refined zooms and champagne-gold cinematic polish.",
    signature: {
      pacing: "medium",
      cutFrequency: "moderate",
      zoomStyle: "smooth",
      textAnimation: "tr_fade_cross",
      musicMood: ["motivational", "epic"],
      sfxCategories: ["whoosh", "cinematic"],
      colorGrade: "fx_color_teal_orange",
      captionStyle: "clean-sans",
    },
    typicalVideoLength_sec: { min: 480, max: 1200 },
    thumbnailStyleId: "creator_iman_gadzhi",
  },
  {
    id: "creator_jordan_welch",
    name: "Jordan Welch E-Com Pack",
    creatorName: "Jordan Welch",
    description:
      "Clean e-com tutorial pacing with bold chart callouts and upbeat Shopify/Amazon hustle energy.",
    signature: {
      pacing: "medium",
      cutFrequency: "moderate",
      zoomStyle: "punch-in",
      textAnimation: "tr_zoom_in",
      musicMood: ["upbeat", "motivational"],
      sfxCategories: ["ui", "whoosh", "pop"],
      colorGrade: "fx_color_high_contrast",
      captionStyle: "clean-sans",
    },
    typicalVideoLength_sec: { min: 480, max: 1200 },
    thumbnailStyleId: "creator_jordan_welch",
  },
  {
    id: "creator_vanossgaming",
    name: "VanossGaming Cartoon Gang Pack",
    creatorName: "VanossGaming",
    description:
      "Fast comedy-gaming pacing with meme cutaways, cartoon SFX, ensemble chaos timing.",
    signature: {
      pacing: "fast",
      cutFrequency: "rapid",
      zoomStyle: "jerky",
      textAnimation: "tr_cut_hard",
      musicMood: ["playful", "upbeat", "funky"],
      sfxCategories: ["meme", "comedy", "pop", "whoosh"],
      colorGrade: "fx_color_technicolor",
      captionStyle: "mrbeast-pop",
    },
    typicalVideoLength_sec: { min: 480, max: 900 },
    thumbnailStyleId: "creator_vanossgaming",
  },
  {
    id: "creator_chris_bumstead",
    name: "Chris Bumstead Classic Olympia Pack",
    creatorName: "Chris Bumstead",
    description:
      "Cinematic bodybuilding montage pacing with slow dolly pushes and Mr. Olympia gold tone.",
    signature: {
      pacing: "slow",
      cutFrequency: "slow",
      zoomStyle: "smooth",
      textAnimation: "tr_fade_long_cross",
      musicMood: ["epic", "motivational", "aggressive"],
      sfxCategories: ["cinematic", "riser", "impact"],
      colorGrade: "fx_color_bleach_bypass",
      captionStyle: "clean-sans",
    },
    typicalVideoLength_sec: { min: 300, max: 900 },
    thumbnailStyleId: "creator_chris_bumstead",
  },

  // ───────── 43 NEW NAMED CREATORS ─────────

  // TECH / REVIEWS
  {
    id: "creator_mkbhd",
    name: "MKBHD Studio Review Pack",
    creatorName: "Marques Brownlee (MKBHD)",
    description:
      "Ultra-polished product-review pacing with smooth macro push-ins, moody teal-red grade.",
    signature: {
      pacing: "medium",
      cutFrequency: "moderate",
      zoomStyle: "smooth",
      textAnimation: "tr_fade_cross",
      musicMood: ["chill", "upbeat"],
      sfxCategories: ["ui", "whoosh"],
      colorGrade: "fx_color_teal_orange",
      captionStyle: "clean-sans",
    },
    typicalVideoLength_sec: { min: 360, max: 900 },
    thumbnailStyleId: "creator_mkbhd",
  },
  {
    id: "creator_ltt_linus",
    name: "Linus Tech Tips Chaos Pack",
    creatorName: "Linus Sebastian (LTT)",
    description:
      "Workshop-chaos pacing with frequent punch-ins on gear, laugh cutaways, warm lab look.",
    signature: {
      pacing: "fast",
      cutFrequency: "rapid",
      zoomStyle: "punch-in",
      textAnimation: "tr_zoom_punch",
      musicMood: ["upbeat", "playful"],
      sfxCategories: ["ui", "pop", "comedy"],
      colorGrade: "fx_color_warm_sunset",
      captionStyle: "clean-sans",
    },
    typicalVideoLength_sec: { min: 480, max: 1500 },
    thumbnailStyleId: "creator_ltt_linus",
  },
  {
    id: "creator_unbox_therapy",
    name: "Unbox Therapy Hero Shot Pack",
    creatorName: "Lewis Hilsenteger",
    description:
      "Single-gadget hero pacing with slow macro reveals on jet-black backdrop.",
    signature: {
      pacing: "slow",
      cutFrequency: "slow",
      zoomStyle: "smooth",
      textAnimation: "tr_fade_dip_black",
      musicMood: ["mysterious", "chill"],
      sfxCategories: ["whoosh", "ui", "impact"],
      colorGrade: "fx_color_noir",
      captionStyle: "clean-sans",
    },
    typicalVideoLength_sec: { min: 180, max: 540 },
    thumbnailStyleId: "creator_unbox_therapy",
  },
  {
    id: "creator_mrwhosetheboss",
    name: "Mrwhosetheboss Premium Pack",
    creatorName: "Arun Maini",
    description:
      "Premium indigo cinematic pacing with smooth reveals and Arun's British-cool polish.",
    signature: {
      pacing: "medium",
      cutFrequency: "moderate",
      zoomStyle: "smooth",
      textAnimation: "tr_fade_cross",
      musicMood: ["epic", "motivational", "mysterious"],
      sfxCategories: ["ui", "whoosh", "cinematic"],
      colorGrade: "fx_color_cool_night",
      captionStyle: "clean-sans",
    },
    typicalVideoLength_sec: { min: 360, max: 900 },
    thumbnailStyleId: "creator_mrwhosetheboss",
  },
  {
    id: "creator_dave2d",
    name: "Dave2D Minimal Laptop Pack",
    creatorName: "Dave Lee",
    description:
      "Minimalist laptop-review pacing with long holds, natural daylight, near-silence gaps.",
    signature: {
      pacing: "slow",
      cutFrequency: "slow",
      zoomStyle: "none",
      textAnimation: "tr_fade_long_cross",
      musicMood: ["chill", "calm"],
      sfxCategories: ["ui"],
      colorGrade: "fx_color_cinematic_flat",
      captionStyle: "clean-sans",
    },
    typicalVideoLength_sec: { min: 300, max: 720 },
    thumbnailStyleId: "creator_dave2d",
  },

  // GAMING
  {
    id: "creator_pewdiepie",
    name: "PewDiePie Cartoon Chaos Pack",
    creatorName: "Felix Kjellberg (PewDiePie)",
    description:
      "Meme-dense pacing with zoom-ins on reactions, impact frames, Brofist chaos energy.",
    signature: {
      pacing: "fast",
      cutFrequency: "rapid",
      zoomStyle: "jerky",
      textAnimation: "tr_zoom_punch",
      musicMood: ["playful", "hype"],
      sfxCategories: ["meme", "comedy", "pop"],
      colorGrade: "fx_color_hdr_pop",
      captionStyle: "mrbeast-pop",
    },
    typicalVideoLength_sec: { min: 480, max: 900 },
    thumbnailStyleId: "creator_pewdiepie",
  },
  {
    id: "creator_dream_speedrun",
    name: "Dream Minecraft Manhunt Pack",
    creatorName: "Dream",
    description:
      "Speedrun-tension pacing with tight cuts, lime-green mask stings, rising chase music.",
    signature: {
      pacing: "fast",
      cutFrequency: "rapid",
      zoomStyle: "punch-in",
      textAnimation: "tr_zoom_in",
      musicMood: ["hype", "epic", "aggressive"],
      sfxCategories: ["whoosh", "riser", "impact"],
      colorGrade: "fx_color_high_contrast",
      captionStyle: "mrbeast-pop",
    },
    typicalVideoLength_sec: { min: 900, max: 2400 },
    thumbnailStyleId: "creator_dream_speedrun",
  },
  {
    id: "creator_ninja",
    name: "Ninja Fortnite Blue Pack",
    creatorName: "Tyler Blevins (Ninja)",
    description:
      "Twitch-streamer pacing with explosive Victory Royale cutaways and blue-purple energy.",
    signature: {
      pacing: "fast",
      cutFrequency: "rapid",
      zoomStyle: "punch-in",
      textAnimation: "tr_zoom_bounce",
      musicMood: ["hype", "energetic"],
      sfxCategories: ["impact", "whoosh", "ui"],
      colorGrade: "fx_color_technicolor",
      captionStyle: "mrbeast-pop",
    },
    typicalVideoLength_sec: { min: 300, max: 900 },
    thumbnailStyleId: "creator_ninja",
  },
  {
    id: "creator_shroud",
    name: "Shroud Tactical Focus Pack",
    creatorName: "Michael Grzesiek (Shroud)",
    description:
      "Tactical FPS pacing with calm holds, precision clip cuts, desaturated military grade.",
    signature: {
      pacing: "medium",
      cutFrequency: "moderate",
      zoomStyle: "smooth",
      textAnimation: "tr_cut_hard",
      musicMood: ["dark", "motivational"],
      sfxCategories: ["impact", "hit", "ui"],
      colorGrade: "fx_color_bleach_bypass",
      captionStyle: "clean-sans",
    },
    typicalVideoLength_sec: { min: 600, max: 1500 },
    thumbnailStyleId: "creator_shroud",
  },
  {
    id: "creator_jacksepticeye",
    name: "Jacksepticeye Green Hype Pack",
    creatorName: "Seán McLoughlin",
    description:
      "Hyper-kinetic pacing with full-body reactions, Irish-energy screams, Septic Sam stings.",
    signature: {
      pacing: "fast",
      cutFrequency: "rapid",
      zoomStyle: "punch-in",
      textAnimation: "tr_zoom_bounce",
      musicMood: ["hype", "playful", "energetic"],
      sfxCategories: ["meme", "comedy", "pop"],
      colorGrade: "fx_color_hdr_pop",
      captionStyle: "mrbeast-pop",
    },
    typicalVideoLength_sec: { min: 600, max: 1200 },
    thumbnailStyleId: "creator_jacksepticeye",
  },
  {
    id: "creator_coryxkenshin",
    name: "CoryxKenshin Samurai Horror Pack",
    creatorName: "Cory Williams",
    description:
      "Horror-react pacing with slow suspense builds, big face reactions, samurai red-black.",
    signature: {
      pacing: "medium",
      cutFrequency: "moderate",
      zoomStyle: "punch-in",
      textAnimation: "tr_zoom_in",
      musicMood: ["dark", "mysterious", "playful"],
      sfxCategories: ["impact", "cinematic", "meme"],
      colorGrade: "fx_color_mono_red",
      captionStyle: "mrbeast-pop",
    },
    typicalVideoLength_sec: { min: 900, max: 1800 },
    thumbnailStyleId: "creator_coryxkenshin",
  },
  {
    id: "creator_ssundee",
    name: "SSundee Cartoon Explosion Pack",
    creatorName: "Ian Marcus Stapleton",
    description:
      "Kid-friendly cartoon-mod pacing with exaggerated zooms, meme sfx, pastel chaos.",
    signature: {
      pacing: "fast",
      cutFrequency: "rapid",
      zoomStyle: "jerky",
      textAnimation: "tr_zoom_bounce",
      musicMood: ["playful", "upbeat", "funky"],
      sfxCategories: ["meme", "comedy", "pop"],
      colorGrade: "fx_color_technicolor",
      captionStyle: "mrbeast-pop",
    },
    typicalVideoLength_sec: { min: 480, max: 900 },
    thumbnailStyleId: "creator_ssundee",
  },

  // FITNESS
  {
    id: "creator_jeff_nippard",
    name: "Jeff Nippard Science Pack",
    creatorName: "Jeff Nippard",
    description:
      "Evidence-based fitness pacing with whiteboard cuts, clean B-roll, educational tone.",
    signature: {
      pacing: "medium",
      cutFrequency: "moderate",
      zoomStyle: "smooth",
      textAnimation: "tr_fade_cross",
      musicMood: ["upbeat", "motivational"],
      sfxCategories: ["ui", "pop"],
      colorGrade: "fx_color_high_contrast",
      captionStyle: "clean-sans",
    },
    typicalVideoLength_sec: { min: 480, max: 1200 },
    thumbnailStyleId: "creator_jeff_nippard",
  },
  {
    id: "creator_david_laid",
    name: "David Laid Aesthetic Lean Pack",
    creatorName: "David Laid",
    description:
      "Aesthetic-physique pacing with slow studio dolly pushes and GymShark editorial polish.",
    signature: {
      pacing: "slow",
      cutFrequency: "slow",
      zoomStyle: "smooth",
      textAnimation: "tr_fade_long_cross",
      musicMood: ["epic", "dark", "motivational"],
      sfxCategories: ["cinematic", "riser"],
      colorGrade: "fx_color_bleach_bypass",
      captionStyle: "clean-sans",
    },
    typicalVideoLength_sec: { min: 180, max: 540 },
    thumbnailStyleId: "creator_david_laid",
  },
  {
    id: "creator_larry_wheels",
    name: "Larry Wheels Monster Lift Pack",
    creatorName: "Larry Wheels",
    description:
      "Strongman pacing with chalk-cloud slow-mo, roar cut-ins, raw iron red-black tones.",
    signature: {
      pacing: "medium",
      cutFrequency: "moderate",
      zoomStyle: "punch-in",
      textAnimation: "tr_zoom_in",
      musicMood: ["aggressive", "hype"],
      sfxCategories: ["impact", "hit", "cinematic"],
      colorGrade: "fx_color_mono_red",
      captionStyle: "mrbeast-pop",
    },
    typicalVideoLength_sec: { min: 480, max: 900 },
    thumbnailStyleId: "creator_larry_wheels",
  },
  {
    id: "creator_sam_sulek",
    name: "Sam Sulek Gym Rat POV Pack",
    creatorName: "Sam Sulek",
    description:
      "Raw unedited GoPro pacing with very long holds, ambient gym noise, gen-Z bro-speak.",
    signature: {
      pacing: "slow",
      cutFrequency: "slow",
      zoomStyle: "none",
      textAnimation: "tr_cut_hard",
      musicMood: ["aggressive", "hype"],
      sfxCategories: ["impact", "ambient"],
      colorGrade: "fx_color_faded_film",
      captionStyle: "clean-sans",
    },
    typicalVideoLength_sec: { min: 900, max: 2700 },
    thumbnailStyleId: "creator_sam_sulek",
  },
  {
    id: "creator_chris_heria",
    name: "Chris Heria Calisthenics Rooftop Pack",
    creatorName: "Chris Heria",
    description:
      "Miami-rooftop pacing with silhouette slow-mo muscle-ups and sunset golden hour.",
    signature: {
      pacing: "medium",
      cutFrequency: "moderate",
      zoomStyle: "smooth",
      textAnimation: "tr_zoom_in",
      musicMood: ["hype", "motivational", "energetic"],
      sfxCategories: ["whoosh", "impact"],
      colorGrade: "fx_color_warm_sunset",
      captionStyle: "mrbeast-pop",
    },
    typicalVideoLength_sec: { min: 360, max: 900 },
    thumbnailStyleId: "creator_chris_heria",
  },

  // FINANCE / BUSINESS
  {
    id: "creator_graham_stephan",
    name: "Graham Stephan Real Estate Pack",
    creatorName: "Graham Stephan",
    description:
      "Clean finance pacing with cash-stack cut-ins, pointed explainer zooms, money-green palette.",
    signature: {
      pacing: "medium",
      cutFrequency: "moderate",
      zoomStyle: "punch-in",
      textAnimation: "tr_zoom_in",
      musicMood: ["upbeat", "motivational"],
      sfxCategories: ["ui", "pop", "whoosh"],
      colorGrade: "fx_color_high_contrast",
      captionStyle: "clean-sans",
    },
    typicalVideoLength_sec: { min: 480, max: 1200 },
    thumbnailStyleId: "creator_graham_stephan",
  },
  {
    id: "creator_ali_abdaal",
    name: "Ali Abdaal Productivity Pack",
    creatorName: "Ali Abdaal",
    description:
      "Cozy-study-desk pacing with warm teal-cream grade, soft pushes, approachable educator tone.",
    signature: {
      pacing: "medium",
      cutFrequency: "moderate",
      zoomStyle: "smooth",
      textAnimation: "tr_fade_cross",
      musicMood: ["chill", "upbeat", "motivational"],
      sfxCategories: ["ui", "pop"],
      colorGrade: "fx_color_warm_sunset",
      captionStyle: "clean-sans",
    },
    typicalVideoLength_sec: { min: 480, max: 1200 },
    thumbnailStyleId: "creator_ali_abdaal",
  },
  {
    id: "creator_hormozi",
    name: "Alex Hormozi Offer Stack Pack",
    creatorName: "Alex Hormozi",
    description:
      "Direct-response pacing with hyper-punchy cuts every 1-2s and Hormozi bouncy-bold captions.",
    signature: {
      pacing: "fast",
      cutFrequency: "rapid",
      zoomStyle: "punch-in",
      textAnimation: "tr_zoom_punch",
      musicMood: ["hype", "aggressive", "motivational"],
      sfxCategories: ["impact", "whoosh", "ui"],
      colorGrade: "fx_color_high_contrast",
      captionStyle: "hormozi-bounce",
    },
    typicalVideoLength_sec: { min: 30, max: 300 },
    thumbnailStyleId: "creator_hormozi",
  },
  {
    id: "creator_patrick_bet_david",
    name: "Patrick Bet-David Valuetainment Pack",
    creatorName: "Patrick Bet-David",
    description:
      "Authoritative exec-podcast pacing with whiteboard strategy pauses and red-black studio look.",
    signature: {
      pacing: "medium",
      cutFrequency: "moderate",
      zoomStyle: "smooth",
      textAnimation: "tr_fade_cross",
      musicMood: ["motivational", "epic"],
      sfxCategories: ["ui", "cinematic"],
      colorGrade: "fx_color_cinematic_flat",
      captionStyle: "clean-sans",
    },
    typicalVideoLength_sec: { min: 900, max: 2700 },
    thumbnailStyleId: "creator_patrick_bet_david",
  },
  {
    id: "creator_gary_vee",
    name: "Gary Vaynerchuk Hustle Pack",
    creatorName: "Gary Vaynerchuk",
    description:
      "Handheld-chaos hustle pacing with NYC street cut-ins, kinetic arrows, yell-worthy captions.",
    signature: {
      pacing: "fast",
      cutFrequency: "rapid",
      zoomStyle: "jerky",
      textAnimation: "tr_zoom_punch",
      musicMood: ["hype", "energetic", "aggressive"],
      sfxCategories: ["impact", "whoosh", "ui"],
      colorGrade: "fx_color_hdr_pop",
      captionStyle: "hormozi-bounce",
    },
    typicalVideoLength_sec: { min: 30, max: 180 },
    thumbnailStyleId: "creator_gary_vee",
  },

  // FOOD
  {
    id: "creator_nick_digiovanni",
    name: "Nick DiGiovanni Rainbow Plate Pack",
    creatorName: "Nick DiGiovanni",
    description:
      "Joyful food-styling pacing with rainbow plate spins, playful youthful zooms, TikTok tempo.",
    signature: {
      pacing: "fast",
      cutFrequency: "rapid",
      zoomStyle: "punch-in",
      textAnimation: "tr_zoom_bounce",
      musicMood: ["upbeat", "playful", "funky"],
      sfxCategories: ["ui", "pop", "comedy"],
      colorGrade: "fx_color_hdr_pop",
      captionStyle: "mrbeast-pop",
    },
    typicalVideoLength_sec: { min: 30, max: 300 },
    thumbnailStyleId: "creator_nick_digiovanni",
  },
  {
    id: "creator_joshua_weissman",
    name: "Joshua Weissman But Better Pack",
    creatorName: "Joshua Weissman",
    description:
      "Fast-food-remake pacing with macro sizzle cuts, papa-tier snap zooms, warm kitchen grade.",
    signature: {
      pacing: "fast",
      cutFrequency: "rapid",
      zoomStyle: "punch-in",
      textAnimation: "tr_zoom_punch",
      musicMood: ["upbeat", "playful"],
      sfxCategories: ["pop", "whoosh", "ui", "comedy"],
      colorGrade: "fx_color_warm_sunset",
      captionStyle: "mrbeast-pop",
    },
    typicalVideoLength_sec: { min: 480, max: 900 },
    thumbnailStyleId: "creator_joshua_weissman",
  },
  {
    id: "creator_gordon_ramsay",
    name: "Gordon Ramsay MasterChef Pack",
    creatorName: "Gordon Ramsay",
    description:
      "Reality-tv cooking pacing with dramatic blue spotlight stingers and yelling cut-ins.",
    signature: {
      pacing: "medium",
      cutFrequency: "moderate",
      zoomStyle: "punch-in",
      textAnimation: "tr_zoom_in",
      musicMood: ["epic", "aggressive", "hype"],
      sfxCategories: ["cinematic", "impact", "riser"],
      colorGrade: "fx_color_cool_night",
      captionStyle: "clean-sans",
    },
    typicalVideoLength_sec: { min: 600, max: 1500 },
    thumbnailStyleId: "creator_gordon_ramsay",
  },
  {
    id: "creator_babish",
    name: "Binging with Babish Pack",
    creatorName: "Andrew Rea (Babish)",
    description:
      "Calm Brooklyn-home pacing with overhead flat-lays, methodical narration, muted teal-oak look.",
    signature: {
      pacing: "slow",
      cutFrequency: "slow",
      zoomStyle: "smooth",
      textAnimation: "tr_fade_cross",
      musicMood: ["chill", "playful"],
      sfxCategories: ["ambient", "ui"],
      colorGrade: "fx_color_faded_film",
      captionStyle: "clean-sans",
    },
    typicalVideoLength_sec: { min: 480, max: 900 },
    thumbnailStyleId: "creator_babish",
  },
  {
    id: "creator_mrbeast_burger",
    name: "MrBeast Burger Chain Pack",
    creatorName: "MrBeast Burger",
    description:
      "MrBeast-brand food-ad pacing with giant number hooks, burger-reveal zooms, red-orange pop.",
    signature: {
      pacing: "fast",
      cutFrequency: "rapid",
      zoomStyle: "punch-in",
      textAnimation: "tr_zoom_punch",
      musicMood: ["hype", "energetic"],
      sfxCategories: ["whoosh", "impact", "pop"],
      colorGrade: "fx_color_hdr_pop",
      captionStyle: "mrbeast-pop",
    },
    typicalVideoLength_sec: { min: 30, max: 120 },
    thumbnailStyleId: "creator_mrbeast_burger",
  },

  // LIFESTYLE / VLOG
  {
    id: "creator_casey_neistat",
    name: "Casey Neistat NYC Vlog Pack",
    creatorName: "Casey Neistat",
    description:
      "Run-and-gun NYC vlog pacing with whip pans, timelapse stacks, Technics yellow-black title cards.",
    signature: {
      pacing: "fast",
      cutFrequency: "rapid",
      zoomStyle: "jerky",
      textAnimation: "tr_whip_left",
      musicMood: ["energetic", "upbeat", "epic"],
      sfxCategories: ["whoosh", "ambient", "impact"],
      colorGrade: "fx_color_bleach_bypass",
      captionStyle: "clean-sans",
    },
    typicalVideoLength_sec: { min: 480, max: 900 },
    thumbnailStyleId: "creator_casey_neistat",
  },
  {
    id: "creator_emma_chamberlain",
    name: "Emma Chamberlain Film Grain Pack",
    creatorName: "Emma Chamberlain",
    description:
      "Gen-Z vlog pacing with fish-eye bursts, washed-out film grain, chaotic-authentic jumpcuts.",
    signature: {
      pacing: "fast",
      cutFrequency: "rapid",
      zoomStyle: "jerky",
      textAnimation: "tr_cut_hard",
      musicMood: ["chill", "playful", "funky"],
      sfxCategories: ["meme", "comedy", "ui"],
      colorGrade: "fx_color_faded_film",
      captionStyle: "clean-sans",
    },
    typicalVideoLength_sec: { min: 600, max: 1200 },
    thumbnailStyleId: "creator_emma_chamberlain",
  },
  {
    id: "creator_david_dobrik",
    name: "David Dobrik Vlog Squad Pack",
    creatorName: "David Dobrik",
    description:
      "Four-minute-vlog pacing with rapid intro gags, fisheye group shots, big punch-line stings.",
    signature: {
      pacing: "fast",
      cutFrequency: "rapid",
      zoomStyle: "jerky",
      textAnimation: "tr_cut_flash",
      musicMood: ["upbeat", "playful", "hype"],
      sfxCategories: ["meme", "comedy", "pop", "whoosh"],
      colorGrade: "fx_color_hdr_pop",
      captionStyle: "mrbeast-pop",
    },
    typicalVideoLength_sec: { min: 240, max: 300 },
    thumbnailStyleId: "creator_david_dobrik",
  },
  {
    id: "creator_jake_paul",
    name: "Jake Paul Problem Child Pack",
    creatorName: "Jake Paul",
    description:
      "Fight-hype pacing with slow-mo glove shots, aggressive cut-ins, Problem-Child purple-red.",
    signature: {
      pacing: "fast",
      cutFrequency: "rapid",
      zoomStyle: "punch-in",
      textAnimation: "tr_zoom_punch",
      musicMood: ["hype", "aggressive"],
      sfxCategories: ["impact", "hit", "riser"],
      colorGrade: "fx_color_duotone_pink_blue",
      captionStyle: "mrbeast-pop",
    },
    typicalVideoLength_sec: { min: 300, max: 900 },
    thumbnailStyleId: "creator_jake_paul",
  },

  // EDUCATION
  {
    id: "creator_thomas_frank",
    name: "Thomas Frank Study Pack",
    creatorName: "Thomas Frank",
    description:
      "Cozy-intellectual study pacing with desk flat-lays, warm amber light, Notion screen-recordings.",
    signature: {
      pacing: "medium",
      cutFrequency: "moderate",
      zoomStyle: "smooth",
      textAnimation: "tr_fade_cross",
      musicMood: ["chill", "upbeat", "motivational"],
      sfxCategories: ["ui", "pop"],
      colorGrade: "fx_color_warm_sunset",
      captionStyle: "clean-sans",
    },
    typicalVideoLength_sec: { min: 480, max: 1200 },
    thumbnailStyleId: "creator_thomas_frank",
  },
  {
    id: "creator_matt_davella",
    name: "Matt D'Avella Minimalist Pack",
    creatorName: "Matt D'Avella",
    description:
      "Minimalist documentary pacing with long silent holds, stark white negative space, slow pushes.",
    signature: {
      pacing: "slow",
      cutFrequency: "slow",
      zoomStyle: "smooth",
      textAnimation: "tr_fade_long_cross",
      musicMood: ["calm", "chill", "motivational"],
      sfxCategories: ["ui", "ambient"],
      colorGrade: "fx_color_cinematic_flat",
      captionStyle: "clean-sans",
    },
    typicalVideoLength_sec: { min: 300, max: 900 },
    thumbnailStyleId: "creator_matt_davella",
  },
  {
    id: "creator_veritasium",
    name: "Veritasium Science Pack",
    creatorName: "Derek Muller",
    description:
      "Science-documentary pacing with counter-intuitive reveal pauses and electric-blue callouts.",
    signature: {
      pacing: "medium",
      cutFrequency: "moderate",
      zoomStyle: "smooth",
      textAnimation: "tr_fade_cross",
      musicMood: ["mysterious", "epic", "motivational"],
      sfxCategories: ["cinematic", "ui", "riser"],
      colorGrade: "fx_color_teal_orange",
      captionStyle: "clean-sans",
    },
    typicalVideoLength_sec: { min: 600, max: 1500 },
    thumbnailStyleId: "creator_veritasium",
  },
  {
    id: "creator_kurzgesagt",
    name: "Kurzgesagt Flat Illustration Pack",
    creatorName: "Kurzgesagt – In a Nutshell",
    description:
      "Flat-vector animation pacing with smooth duck-swap transitions, gentle existential narration.",
    signature: {
      pacing: "medium",
      cutFrequency: "moderate",
      zoomStyle: "smooth",
      textAnimation: "tr_fade_cross",
      musicMood: ["chill", "mysterious", "motivational"],
      sfxCategories: ["ui", "ambient", "pop"],
      colorGrade: "fx_color_duotone_pink_blue",
      captionStyle: "clean-sans",
    },
    typicalVideoLength_sec: { min: 480, max: 900 },
    thumbnailStyleId: "creator_kurzgesagt",
  },

  // COMMENTARY / DOCUMENTARY
  {
    id: "creator_johnny_harris",
    name: "Johnny Harris Map Explainer Pack",
    creatorName: "Johnny Harris",
    description:
      "Geopolitical explainer pacing with sepia-map zooms, red-string overlays, field-jacket polish.",
    signature: {
      pacing: "medium",
      cutFrequency: "moderate",
      zoomStyle: "smooth",
      textAnimation: "tr_zoom_in",
      musicMood: ["mysterious", "epic", "motivational"],
      sfxCategories: ["cinematic", "ambient", "whoosh"],
      colorGrade: "fx_color_vintage",
      captionStyle: "clean-sans",
    },
    typicalVideoLength_sec: { min: 600, max: 1200 },
    thumbnailStyleId: "creator_johnny_harris",
  },
  {
    id: "creator_wendover",
    name: "Wendover Productions Infographic Pack",
    creatorName: "Sam Denby (Wendover)",
    description:
      "Infographic-animation pacing with clean vector arrow sweeps and systems-analysis narration.",
    signature: {
      pacing: "medium",
      cutFrequency: "moderate",
      zoomStyle: "smooth",
      textAnimation: "tr_slide_left",
      musicMood: ["upbeat", "motivational"],
      sfxCategories: ["ui", "pop"],
      colorGrade: "fx_color_high_contrast",
      captionStyle: "clean-sans",
    },
    typicalVideoLength_sec: { min: 480, max: 900 },
    thumbnailStyleId: "creator_wendover",
  },
  {
    id: "creator_coffeezilla",
    name: "Coffeezilla Scam Exposé Pack",
    creatorName: "Stephen Findeisen (Coffeezilla)",
    description:
      "Investigative-journalist pacing with evidence-file cuts, low-key shadow, serious gravitas.",
    signature: {
      pacing: "medium",
      cutFrequency: "moderate",
      zoomStyle: "smooth",
      textAnimation: "tr_fade_cross",
      musicMood: ["dark", "mysterious"],
      sfxCategories: ["cinematic", "ui", "ambient"],
      colorGrade: "fx_color_noir",
      captionStyle: "clean-sans",
    },
    typicalVideoLength_sec: { min: 600, max: 1500 },
    thumbnailStyleId: "creator_coffeezilla",
  },
  {
    id: "creator_joe_rogan",
    name: "Joe Rogan Experience Clip Pack",
    creatorName: "Joe Rogan",
    description:
      "Long-form-podcast clip pacing with tight two-shot cuts, pull-quote overlays, moody blue-amber.",
    signature: {
      pacing: "slow",
      cutFrequency: "slow",
      zoomStyle: "smooth",
      textAnimation: "tr_fade_cross",
      musicMood: ["chill", "mysterious"],
      sfxCategories: ["ambient", "ui"],
      colorGrade: "fx_color_cinematic_flat",
      captionStyle: "hormozi-bounce",
    },
    typicalVideoLength_sec: { min: 60, max: 600 },
    thumbnailStyleId: "creator_joe_rogan",
  },
  {
    id: "creator_lex_fridman",
    name: "Lex Fridman Interview Pack",
    creatorName: "Lex Fridman",
    description:
      "Philosophical long-form pacing with ultra-slow cuts, black-wall gravitas, contemplative pauses.",
    signature: {
      pacing: "slow",
      cutFrequency: "slow",
      zoomStyle: "none",
      textAnimation: "tr_fade_long_cross",
      musicMood: ["calm", "mysterious", "sad"],
      sfxCategories: ["ambient", "ui"],
      colorGrade: "fx_color_noir",
      captionStyle: "clean-sans",
    },
    typicalVideoLength_sec: { min: 60, max: 900 },
    thumbnailStyleId: "creator_lex_fridman",
  },

  // ANIME / CREATIVE
  {
    id: "creator_rdcworld1",
    name: "RDCworld1 Anime Sketch Pack",
    creatorName: "RDCworld1",
    description:
      "Anime-sketch comedy pacing with speed-line whip-ins, dramatic stare holds, DBZ parody stings.",
    signature: {
      pacing: "fast",
      cutFrequency: "rapid",
      zoomStyle: "punch-in",
      textAnimation: "tr_zoom_punch",
      musicMood: ["hype", "playful", "epic"],
      sfxCategories: ["whoosh", "impact", "meme"],
      colorGrade: "fx_color_technicolor",
      captionStyle: "mrbeast-pop",
    },
    typicalVideoLength_sec: { min: 180, max: 480 },
    thumbnailStyleId: "creator_rdcworld1",
  },
  {
    id: "creator_jaiden_animations",
    name: "Jaiden Animations Pack",
    creatorName: "Jaiden Dittfach",
    description:
      "Storytime-animation pacing with cute Ari parrot cutaways, pastel hold frames, diary-vlog warmth.",
    signature: {
      pacing: "medium",
      cutFrequency: "moderate",
      zoomStyle: "smooth",
      textAnimation: "tr_fade_cross",
      musicMood: ["playful", "chill", "upbeat"],
      sfxCategories: ["pop", "comedy", "ui"],
      colorGrade: "fx_color_duotone_pink_blue",
      captionStyle: "clean-sans",
    },
    typicalVideoLength_sec: { min: 360, max: 900 },
    thumbnailStyleId: "creator_jaiden_animations",
  },
  {
    id: "creator_somethingelseyt",
    name: "SomethingElseYT Fast Paced Pack",
    creatorName: "Adam Ortiz (SomethingElseYT)",
    description:
      "Hyperactive-animation pacing with motion-blur cut-ins, shout stingers, yellow-purple pop.",
    signature: {
      pacing: "fast",
      cutFrequency: "rapid",
      zoomStyle: "jerky",
      textAnimation: "tr_zoom_bounce",
      musicMood: ["playful", "hype", "upbeat"],
      sfxCategories: ["meme", "comedy", "pop", "whoosh"],
      colorGrade: "fx_color_hdr_pop",
      captionStyle: "mrbeast-pop",
    },
    typicalVideoLength_sec: { min: 240, max: 720 },
    thumbnailStyleId: "creator_somethingelseyt",
  },
];

/** Return a creator video pack by id, or undefined. */
export function getCreatorPackById(id: string): CreatorVideoPack | undefined {
  return CREATOR_VIDEO_PACKS.find((p) => p.id === id);
}

/** Filter creator packs using a predicate. */
export function filterCreatorPacks(
  predicate: (pack: CreatorVideoPack) => boolean,
): CreatorVideoPack[] {
  return CREATOR_VIDEO_PACKS.filter(predicate);
}
