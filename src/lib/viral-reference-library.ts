/**
 * VIRAL_REFERENCE_LIBRARY — hand-curated annotated patterns from real viral videos.
 *
 * These become few-shot examples when /api/video/analyze-viral (and the Trinity
 * analyze_viral_video tool) asks Claude to extract a pattern from a new URL.
 *
 * Each entry captures what made the reference video work: the thumbnail
 * composition, estimated editing signature, and a link to a matching
 * CREATOR_VIDEO_PACK id from src/lib/video-presets/creator-packs.ts.
 *
 * We never rehost thumbnails — source_url points at the public ytimg.com CDN
 * (maxresdefault.jpg) for display only, same legal posture as the thumbnail
 * recreate flow.
 */
export interface ViralPattern {
  thumbnail_pattern: {
    composition: string;
    dominant_colors: string[];
    text_overlay_style: string;
    subject_emotion: string;
    hook_element: string;
  };
  estimated_edit_signature: {
    pacing: "fast" | "medium" | "slow";
    likely_cut_frequency_sec: number;
    probable_sfx_categories: string[];
    probable_captions: boolean;
    color_grade: string;
  };
  recommended_creator_pack_id?: string;
  key_elements_to_replicate: string[];
}

export interface ViralReferenceEntry {
  id: string;
  title: string;
  niche: string;
  creator_pack_id: string;
  pattern: ViralPattern;
  source_url: string;
  /** Readable approximate view count at curation (e.g. "200M", "42M"). */
  views_at_curation: string;
}

/**
 * 30 hand-annotated reference videos across major YouTube/TikTok niches.
 * These seed Claude's vision analyses with high-quality exemplars.
 */
export const VIRAL_REFERENCE_LIBRARY: ViralReferenceEntry[] = [
  // ── Challenge / MrBeast-style ─────────────────────────────────────
  {
    id: "ref_mrbeast_lastchair",
    title: "Last To Leave The Chair Wins $500,000",
    niche: "challenge",
    creator_pack_id: "creator_mrbeast_challenge",
    pattern: {
      thumbnail_pattern: {
        composition: "centered-face-with-giant-number",
        dominant_colors: ["#ff2d2d", "#ffd700", "#000000"],
        text_overlay_style: "impact-bold-yellow-shadow",
        subject_emotion: "shocked-mouth-open",
        hook_element: "giant dollar sign + arrow pointing to prize",
      },
      estimated_edit_signature: {
        pacing: "fast",
        likely_cut_frequency_sec: 1.8,
        probable_sfx_categories: ["whoosh", "impact", "riser", "meme"],
        probable_captions: true,
        color_grade: "HDR pop, saturated reds and yellows",
      },
      recommended_creator_pack_id: "creator_mrbeast_challenge",
      key_elements_to_replicate: [
        "open with a dollar-figure hook in the first 2 seconds",
        "cut every 1-2 seconds during game play",
        "use a centered face + giant number on the thumbnail",
        "saturate reds and yellows for HDR pop",
        "overlay mrbeast-pop-style word-highlight captions",
      ],
    },
    source_url: "https://youtu.be/kX3nB4PpJko",
    views_at_curation: "200M",
  },
  {
    id: "ref_mrbeast_squidgame",
    title: "$456,000 Squid Game In Real Life!",
    niche: "challenge",
    creator_pack_id: "creator_mrbeast_challenge",
    pattern: {
      thumbnail_pattern: {
        composition: "split-screen-face-vs-prize",
        dominant_colors: ["#e84545", "#53a548", "#fff3b0"],
        text_overlay_style: "bold-impact-white-red-stroke",
        subject_emotion: "intense-determined",
        hook_element: "Squid Game track suit reference + money stack",
      },
      estimated_edit_signature: {
        pacing: "fast",
        likely_cut_frequency_sec: 2.0,
        probable_sfx_categories: ["whoosh", "impact", "riser"],
        probable_captions: true,
        color_grade: "saturated cinematic, high contrast",
      },
      recommended_creator_pack_id: "creator_mrbeast_challenge",
      key_elements_to_replicate: [
        "massive prize at stake shown in thumbnail",
        "recognizable pop-culture visual reference",
        "non-stop jumpcuts with rising stakes",
      ],
    },
    source_url: "https://youtu.be/0e3GPea1Tyg",
    views_at_curation: "650M",
  },
  {
    id: "ref_mrbeast_buriedalive",
    title: "I Spent 50 Hours Buried Alive",
    niche: "challenge",
    creator_pack_id: "creator_mrbeast_challenge",
    pattern: {
      thumbnail_pattern: {
        composition: "claustrophobic-close-up-face",
        dominant_colors: ["#2a2a2a", "#8b5a2b", "#ffffff"],
        text_overlay_style: "bold-sans-white-outline",
        subject_emotion: "fearful-alarmed",
        hook_element: "coffin lid visible + countdown timer",
      },
      estimated_edit_signature: {
        pacing: "fast",
        likely_cut_frequency_sec: 2.2,
        probable_sfx_categories: ["impact", "riser", "ambient"],
        probable_captions: true,
        color_grade: "HDR pop with dark ambient undertones",
      },
      recommended_creator_pack_id: "creator_mrbeast_challenge",
      key_elements_to_replicate: [
        "time-based stakes (countdown on thumbnail)",
        "physical discomfort as the hook",
        "every cut punched with a whoosh",
      ],
    },
    source_url: "https://youtu.be/jsq2rNZHlOk",
    views_at_curation: "180M",
  },

  // ── Tech review ─────────────────────────────────────────────────────
  {
    id: "ref_mkbhd_iphone",
    title: "iPhone 15 Pro Max Review: More Than Titanium!",
    niche: "tech_review",
    creator_pack_id: "creator_mkbhd",
    pattern: {
      thumbnail_pattern: {
        composition: "product-hero-centered-with-subject",
        dominant_colors: ["#1a1a1a", "#c0c0c0", "#d4af37"],
        text_overlay_style: "minimal-thin-sans-bottom",
        subject_emotion: "confident-neutral",
        hook_element: "isolated product on dark gradient, halo rim light",
      },
      estimated_edit_signature: {
        pacing: "medium",
        likely_cut_frequency_sec: 4.5,
        probable_sfx_categories: ["ambient", "ui-click"],
        probable_captions: false,
        color_grade: "clean natural with slight matte roll-off",
      },
      recommended_creator_pack_id: "creator_mkbhd",
      key_elements_to_replicate: [
        "dark seamless backdrop, product as hero",
        "punch-in cuts on key spec moments",
        "no on-screen caption spam — let the shot breathe",
      ],
    },
    source_url: "https://youtu.be/aZ03JUi9-SA",
    views_at_curation: "14M",
  },
  {
    id: "ref_mrwhosetheboss_tier",
    title: "Ranking Every Phone I've Ever Reviewed",
    niche: "tech_review",
    creator_pack_id: "creator_mrwhosetheboss",
    pattern: {
      thumbnail_pattern: {
        composition: "tier-list-grid-with-face",
        dominant_colors: ["#ffd700", "#ff4d4d", "#1e1e1e"],
        text_overlay_style: "bold-angled-yellow",
        subject_emotion: "thinking-finger-on-chin",
        hook_element: "tier grid overlay (S, A, B tiers) + dozens of phones",
      },
      estimated_edit_signature: {
        pacing: "medium",
        likely_cut_frequency_sec: 3.2,
        probable_sfx_categories: ["pop", "ui-click", "whoosh"],
        probable_captions: true,
        color_grade: "vibrant warm, crushed shadows",
      },
      recommended_creator_pack_id: "creator_mrwhosetheboss",
      key_elements_to_replicate: [
        "ranking/tier-list thumbnail format",
        "quick product b-roll between talking head",
        "animated pop-in overlays for every claim",
      ],
    },
    source_url: "https://youtu.be/5P7O8HhD9Eg",
    views_at_curation: "11M",
  },
  {
    id: "ref_linus_ltt_server",
    title: "I Built A Petabyte Home Server",
    niche: "tech_review",
    creator_pack_id: "creator_ltt_linus",
    pattern: {
      thumbnail_pattern: {
        composition: "centered-face-pointing-at-hardware",
        dominant_colors: ["#1a4a6e", "#ffffff", "#ff9100"],
        text_overlay_style: "impact-stacked-shadow",
        subject_emotion: "excited-pointing",
        hook_element: "visible hard drive stack, scale of rig",
      },
      estimated_edit_signature: {
        pacing: "medium",
        likely_cut_frequency_sec: 3.5,
        probable_sfx_categories: ["whoosh", "ui-click", "meme"],
        probable_captions: true,
        color_grade: "bright warm studio lighting",
      },
      recommended_creator_pack_id: "creator_ltt_linus",
      key_elements_to_replicate: [
        "hero hardware shot with hand pointing at it",
        "casual zoom-in/zoom-out between jokes",
        "stacked text overlay with strong drop shadow",
      ],
    },
    source_url: "https://youtu.be/BtvNQLzNc_g",
    views_at_curation: "8M",
  },

  // ── Finance / entrepreneurship ──────────────────────────────────────
  {
    id: "ref_hormozi_sales",
    title: "$100M Offers: How To Make Offers So Good People Feel Stupid Saying No",
    niche: "business",
    creator_pack_id: "creator_hormozi",
    pattern: {
      thumbnail_pattern: {
        composition: "centered-face-bald-serious",
        dominant_colors: ["#000000", "#e0b43a", "#ffffff"],
        text_overlay_style: "block-caps-big-yellow-accent",
        subject_emotion: "direct-eye-contact-serious",
        hook_element: "dollar amounts + direct stare into camera",
      },
      estimated_edit_signature: {
        pacing: "fast",
        likely_cut_frequency_sec: 2.5,
        probable_sfx_categories: ["whoosh", "ui-click", "impact"],
        probable_captions: true,
        color_grade: "crushed blacks, warm highlights",
      },
      recommended_creator_pack_id: "creator_hormozi",
      key_elements_to_replicate: [
        "hormozi-bounce word-level captions in block caps",
        "black + yellow color palette",
        "jump cut every 2-3 seconds to maintain attention",
        "direct-to-camera talking-head format",
      ],
    },
    source_url: "https://youtu.be/4Zl3bTxA7vs",
    views_at_curation: "12M",
  },
  {
    id: "ref_graham_stephan_money",
    title: "Why I'm Selling Everything",
    niche: "finance",
    creator_pack_id: "creator_graham_stephan",
    pattern: {
      thumbnail_pattern: {
        composition: "centered-face-with-money-overlay",
        dominant_colors: ["#e84545", "#ffffff", "#2f5233"],
        text_overlay_style: "red-banner-white-type",
        subject_emotion: "concerned-serious",
        hook_element: "red down-arrow + dollar figures in banner",
      },
      estimated_edit_signature: {
        pacing: "medium",
        likely_cut_frequency_sec: 3.0,
        probable_sfx_categories: ["ui-click", "whoosh"],
        probable_captions: true,
        color_grade: "bright clean office studio",
      },
      recommended_creator_pack_id: "creator_graham_stephan",
      key_elements_to_replicate: [
        "red + white alarm palette on thumbnail",
        "'Why I'm selling everything' style urgency hook",
        "static studio shot with b-roll cutaways on statistics",
      ],
    },
    source_url: "https://youtu.be/TUt1JlP48nE",
    views_at_curation: "2M",
  },
  {
    id: "ref_iman_gadzhi_agency",
    title: "How I'd Make $10k/Month In 2024 (If I Had To Start Over)",
    niche: "business",
    creator_pack_id: "creator_iman_gadzhi",
    pattern: {
      thumbnail_pattern: {
        composition: "luxe-lifestyle-with-subject-centered",
        dominant_colors: ["#c5a880", "#1a1a1a", "#ffffff"],
        text_overlay_style: "thin-serif-elegant",
        subject_emotion: "calm-confident",
        hook_element: "yacht or penthouse backdrop",
      },
      estimated_edit_signature: {
        pacing: "medium",
        likely_cut_frequency_sec: 3.5,
        probable_sfx_categories: ["ambient", "ui-click"],
        probable_captions: true,
        color_grade: "gold-tinted cinematic warm",
      },
      recommended_creator_pack_id: "creator_iman_gadzhi",
      key_elements_to_replicate: [
        "luxury backdrop B-roll between talking head",
        "gold + black color grade",
        "soft ambient music bed under voice",
      ],
    },
    source_url: "https://youtu.be/XkP4_n3bmQ8",
    views_at_curation: "3M",
  },

  // ── Science / education ─────────────────────────────────────────────
  {
    id: "ref_veritasium_electricity",
    title: "The Big Misconception About Electricity",
    niche: "education",
    creator_pack_id: "creator_veritasium",
    pattern: {
      thumbnail_pattern: {
        composition: "diagram-with-subject-pointing",
        dominant_colors: ["#0066cc", "#ffcc00", "#ffffff"],
        text_overlay_style: "clean-sans-questioning",
        subject_emotion: "curious-explaining",
        hook_element: "circuit diagram + arrow question mark",
      },
      estimated_edit_signature: {
        pacing: "medium",
        likely_cut_frequency_sec: 4.0,
        probable_sfx_categories: ["ui-click", "ambient"],
        probable_captions: false,
        color_grade: "clean natural, slight cool bias",
      },
      recommended_creator_pack_id: "creator_veritasium",
      key_elements_to_replicate: [
        "pose the counter-intuitive question on the thumbnail",
        "on-screen animated diagrams over narration",
        "slow reveal of answer — no jump cuts",
      ],
    },
    source_url: "https://youtu.be/bHIhgxav9LY",
    views_at_curation: "22M",
  },
  {
    id: "ref_kurzgesagt_blackhole",
    title: "What If The Biggest Black Hole Hit Earth?",
    niche: "education",
    creator_pack_id: "creator_kurzgesagt",
    pattern: {
      thumbnail_pattern: {
        composition: "flat-illustration-hero-shot",
        dominant_colors: ["#ff3366", "#2e1a47", "#ffd700"],
        text_overlay_style: "bold-bright-white-sans",
        subject_emotion: "n/a-illustrated",
        hook_element: "cosmic event illustrated, Earth silhouette",
      },
      estimated_edit_signature: {
        pacing: "medium",
        likely_cut_frequency_sec: 4.0,
        probable_sfx_categories: ["ambient", "cinematic", "whoosh"],
        probable_captions: false,
        color_grade: "flat vector bright saturated",
      },
      recommended_creator_pack_id: "creator_kurzgesagt",
      key_elements_to_replicate: [
        "flat vector illustration style, no live action",
        "calm narrator voice with cosmic SFX",
        "counterfactual 'what if' framing",
      ],
    },
    source_url: "https://youtu.be/ulCdoCfw-bY",
    views_at_curation: "18M",
  },
  {
    id: "ref_mark_rober_squirrel",
    title: "Building The Perfect Squirrel Proof Bird Feeder",
    niche: "education",
    creator_pack_id: "creator_veritasium",
    pattern: {
      thumbnail_pattern: {
        composition: "playful-contraption-with-subject",
        dominant_colors: ["#ff9100", "#4caf50", "#ffffff"],
        text_overlay_style: "kid-friendly-chunky-sans",
        subject_emotion: "grinning-pointing",
        hook_element: "elaborate obstacle course + squirrel mid-action",
      },
      estimated_edit_signature: {
        pacing: "medium",
        likely_cut_frequency_sec: 3.2,
        probable_sfx_categories: ["meme", "whoosh", "impact"],
        probable_captions: true,
        color_grade: "bright natural outdoor",
      },
      recommended_creator_pack_id: "creator_veritasium",
      key_elements_to_replicate: [
        "'will it work?' contraption hook",
        "fun SFX on every obstacle",
        "bright outdoor color grade",
      ],
    },
    source_url: "https://youtu.be/hFZFjoX2cGg",
    views_at_curation: "100M",
  },

  // ── Gaming / streaming ──────────────────────────────────────────────
  {
    id: "ref_pewdiepie_minecraft",
    title: "Minecraft but I Die I Restart Everything",
    niche: "gaming",
    creator_pack_id: "creator_pewdiepie",
    pattern: {
      thumbnail_pattern: {
        composition: "facecam-reaction-plus-game",
        dominant_colors: ["#55a630", "#ff0000", "#ffffff"],
        text_overlay_style: "rough-hand-drawn-sans",
        subject_emotion: "exaggerated-shock",
        hook_element: "funny facecam + in-game screenshot",
      },
      estimated_edit_signature: {
        pacing: "fast",
        likely_cut_frequency_sec: 2.2,
        probable_sfx_categories: ["meme", "impact", "whoosh"],
        probable_captions: true,
        color_grade: "saturated gaming-rig aesthetic",
      },
      recommended_creator_pack_id: "creator_pewdiepie",
      key_elements_to_replicate: [
        "split facecam + gameplay in the thumbnail",
        "meme SFX on every reaction",
        "fast jump cuts between facecam and gameplay",
      ],
    },
    source_url: "https://youtu.be/PWCxb3B1gxE",
    views_at_curation: "50M",
  },
  {
    id: "ref_dream_speedrun",
    title: "Minecraft Speedrunner vs 3 Hunters",
    niche: "gaming",
    creator_pack_id: "creator_dream_speedrun",
    pattern: {
      thumbnail_pattern: {
        composition: "chase-composition-runner-vs-hunters",
        dominant_colors: ["#55a630", "#ff4d4d", "#ffffff"],
        text_overlay_style: "impact-green-outline",
        subject_emotion: "n/a-mask",
        hook_element: "smile-mask avatar + chasers behind",
      },
      estimated_edit_signature: {
        pacing: "fast",
        likely_cut_frequency_sec: 2.5,
        probable_sfx_categories: ["impact", "riser"],
        probable_captions: true,
        color_grade: "saturated greens and reds",
      },
      recommended_creator_pack_id: "creator_dream_speedrun",
      key_elements_to_replicate: [
        "protagonist vs X-hunters numeric hook",
        "relentless zoom-in on key plays",
        "punch-in whip pans between players",
      ],
    },
    source_url: "https://youtu.be/EBP4xr-o4oY",
    views_at_curation: "150M",
  },
  {
    id: "ref_jacksepticeye_horror",
    title: "Scariest Game I've Ever Played",
    niche: "gaming",
    creator_pack_id: "creator_jacksepticeye",
    pattern: {
      thumbnail_pattern: {
        composition: "dark-facecam-with-horror-bg",
        dominant_colors: ["#0a0a0a", "#8b0000", "#ffffff"],
        text_overlay_style: "horror-dripping-red",
        subject_emotion: "screaming-terrified",
        hook_element: "dark monster silhouette + wide-eyed face",
      },
      estimated_edit_signature: {
        pacing: "medium",
        likely_cut_frequency_sec: 3.5,
        probable_sfx_categories: ["ambient", "impact", "cinematic"],
        probable_captions: true,
        color_grade: "crushed blacks, saturated reds",
      },
      recommended_creator_pack_id: "creator_jacksepticeye",
      key_elements_to_replicate: [
        "horror-themed thumbnail color palette",
        "silence → jumpscare audio pattern",
        "fade-to-black transitions between scares",
      ],
    },
    source_url: "https://youtu.be/KQI_m-Gs2Kw",
    views_at_curation: "15M",
  },

  // ── Fitness ─────────────────────────────────────────────────────────
  {
    id: "ref_jeff_nippard_science",
    title: "The Most Effective Way To Lose Fat (Backed By Science)",
    niche: "fitness",
    creator_pack_id: "creator_jeff_nippard",
    pattern: {
      thumbnail_pattern: {
        composition: "before-after-split-screen",
        dominant_colors: ["#0077b6", "#ffffff", "#fca311"],
        text_overlay_style: "clean-block-caps-clinical",
        subject_emotion: "confident-flexing",
        hook_element: "before/after physique comparison",
      },
      estimated_edit_signature: {
        pacing: "medium",
        likely_cut_frequency_sec: 3.8,
        probable_sfx_categories: ["ui-click"],
        probable_captions: true,
        color_grade: "clean clinical bright",
      },
      recommended_creator_pack_id: "creator_jeff_nippard",
      key_elements_to_replicate: [
        "science/study callouts on-screen",
        "before/after physique hook on thumbnail",
        "whiteboard-style diagram overlays",
      ],
    },
    source_url: "https://youtu.be/fIKC1vH9a3s",
    views_at_curation: "3M",
  },
  {
    id: "ref_chris_bumstead_classic",
    title: "The Day Of My Olympia Win",
    niche: "fitness",
    creator_pack_id: "creator_chris_bumstead",
    pattern: {
      thumbnail_pattern: {
        composition: "cinematic-pose-backstage",
        dominant_colors: ["#111111", "#d4af37", "#8b0000"],
        text_overlay_style: "serif-gold-debossed",
        subject_emotion: "focused-intense",
        hook_element: "trophy + backstage lighting",
      },
      estimated_edit_signature: {
        pacing: "slow",
        likely_cut_frequency_sec: 5.0,
        probable_sfx_categories: ["ambient", "cinematic"],
        probable_captions: false,
        color_grade: "cinematic teal-orange, film grain",
      },
      recommended_creator_pack_id: "creator_chris_bumstead",
      key_elements_to_replicate: [
        "cinematic slow-motion b-roll",
        "ambient score under narration",
        "gold/black cinematic color grade",
      ],
    },
    source_url: "https://youtu.be/FMlVTSGlC8g",
    views_at_curation: "4M",
  },

  // ── Food / cooking ──────────────────────────────────────────────────
  {
    id: "ref_nick_digiovanni_breakfast",
    title: "The Perfect Breakfast Sandwich",
    niche: "food",
    creator_pack_id: "creator_nick_digiovanni",
    pattern: {
      thumbnail_pattern: {
        composition: "close-up-food-hero-with-subject",
        dominant_colors: ["#f4a261", "#264653", "#ffffff"],
        text_overlay_style: "hand-script-yellow",
        subject_emotion: "mouth-open-wow",
        hook_element: "steaming cheese pull + layered cross-section",
      },
      estimated_edit_signature: {
        pacing: "medium",
        likely_cut_frequency_sec: 2.8,
        probable_sfx_categories: ["pop", "sizzle", "ui-click"],
        probable_captions: true,
        color_grade: "warm appetizing, high saturation",
      },
      recommended_creator_pack_id: "creator_nick_digiovanni",
      key_elements_to_replicate: [
        "close-up cheese-pull / sizzle B-roll",
        "warm appetizing color grade",
        "rapid cooking beats synced to music",
      ],
    },
    source_url: "https://youtu.be/Ci_Qx4rYIDs",
    views_at_curation: "8M",
  },
  {
    id: "ref_joshua_weissman_remake",
    title: "Making McDonald's McRib At Home",
    niche: "food",
    creator_pack_id: "creator_joshua_weissman",
    pattern: {
      thumbnail_pattern: {
        composition: "homemade-vs-fast-food-split",
        dominant_colors: ["#ff2d2d", "#ffd700", "#8b4513"],
        text_overlay_style: "italic-underline-chef",
        subject_emotion: "smug-approval",
        hook_element: "McDonald's original vs homemade side-by-side",
      },
      estimated_edit_signature: {
        pacing: "fast",
        likely_cut_frequency_sec: 2.2,
        probable_sfx_categories: ["pop", "meme", "ui-click"],
        probable_captions: true,
        color_grade: "warm punchy saturated",
      },
      recommended_creator_pack_id: "creator_joshua_weissman",
      key_elements_to_replicate: [
        "'but better' framing with side-by-side thumbnail",
        "rapid-fire cooking cuts sync'd to beat",
        "meme SFX on every step",
      ],
    },
    source_url: "https://youtu.be/rT1h6u8kKkw",
    views_at_curation: "12M",
  },

  // ── Vlog / lifestyle ────────────────────────────────────────────────
  {
    id: "ref_casey_neistat_nyc",
    title: "Snowboarding With The NYPD",
    niche: "vlog",
    creator_pack_id: "creator_casey_neistat",
    pattern: {
      thumbnail_pattern: {
        composition: "action-shot-handheld-wide",
        dominant_colors: ["#ffffff", "#0066cc", "#1a1a1a"],
        text_overlay_style: "minimalist-no-overlay",
        subject_emotion: "in-action",
        hook_element: "city snow + snowboarder mid-air",
      },
      estimated_edit_signature: {
        pacing: "medium",
        likely_cut_frequency_sec: 3.0,
        probable_sfx_categories: ["ambient", "cinematic"],
        probable_captions: false,
        color_grade: "cinematic teal-cyan-crushed-blacks",
      },
      recommended_creator_pack_id: "creator_casey_neistat",
      key_elements_to_replicate: [
        "handheld wide dynamic camera",
        "cinematic teal-cyan grade",
        "music-led edit, minimal voiceover",
      ],
    },
    source_url: "https://youtu.be/xXiO80ccmfU",
    views_at_curation: "23M",
  },
  {
    id: "ref_emma_chamberlain_coffee",
    title: "I Went To Paris And Had A Breakdown",
    niche: "vlog",
    creator_pack_id: "creator_emma_chamberlain",
    pattern: {
      thumbnail_pattern: {
        composition: "candid-selfie-coffee-cup",
        dominant_colors: ["#d4a373", "#f5ebe0", "#7f4f24"],
        text_overlay_style: "handwritten-lowercase",
        subject_emotion: "casual-thoughtful",
        hook_element: "coffee cup + candid relatable expression",
      },
      estimated_edit_signature: {
        pacing: "fast",
        likely_cut_frequency_sec: 2.5,
        probable_sfx_categories: ["meme", "pop", "ui-click"],
        probable_captions: true,
        color_grade: "warm vintage film-emulated",
      },
      recommended_creator_pack_id: "creator_emma_chamberlain",
      key_elements_to_replicate: [
        "candid handheld vlog-style footage",
        "warm vintage film color grade",
        "lowercase casual captions between jumpcuts",
      ],
    },
    source_url: "https://youtu.be/LsoLEjrDogU",
    views_at_curation: "9M",
  },

  // ── Motivation / productivity ───────────────────────────────────────
  {
    id: "ref_ali_abdaal_productive",
    title: "How I Manage My Time — 10 Rules",
    niche: "productivity",
    creator_pack_id: "creator_ali_abdaal",
    pattern: {
      thumbnail_pattern: {
        composition: "smiling-subject-with-icon-grid",
        dominant_colors: ["#ffd700", "#0066cc", "#ffffff"],
        text_overlay_style: "bold-sans-serif-positive",
        subject_emotion: "welcoming-smile",
        hook_element: "icon grid of 10 rules floating around subject",
      },
      estimated_edit_signature: {
        pacing: "medium",
        likely_cut_frequency_sec: 3.5,
        probable_sfx_categories: ["ui-click", "pop"],
        probable_captions: true,
        color_grade: "bright clean studio",
      },
      recommended_creator_pack_id: "creator_ali_abdaal",
      key_elements_to_replicate: [
        "warm smiling thumbnail face",
        "numbered list structure signaled on thumbnail",
        "animated iconography over narration",
      ],
    },
    source_url: "https://youtu.be/Mvh6D3JHuLc",
    views_at_curation: "4M",
  },
  {
    id: "ref_matt_davella_minimalism",
    title: "Why I Own Almost Nothing",
    niche: "productivity",
    creator_pack_id: "creator_matt_davella",
    pattern: {
      thumbnail_pattern: {
        composition: "minimalist-subject-white-room",
        dominant_colors: ["#ffffff", "#000000", "#cccccc"],
        text_overlay_style: "helvetica-thin-black",
        subject_emotion: "calm-neutral",
        hook_element: "near-empty white room, single subject",
      },
      estimated_edit_signature: {
        pacing: "medium",
        likely_cut_frequency_sec: 4.0,
        probable_sfx_categories: ["ambient", "ui-click"],
        probable_captions: false,
        color_grade: "clean white cinematic",
      },
      recommended_creator_pack_id: "creator_matt_davella",
      key_elements_to_replicate: [
        "minimal white backdrop with single subject",
        "smooth slider/tracking shots",
        "ambient soft score, no overlay clutter",
      ],
    },
    source_url: "https://youtu.be/rRYXVCswkKk",
    views_at_curation: "3M",
  },

  // ── Drama / documentary / expose ────────────────────────────────────
  {
    id: "ref_coffeezilla_crypto",
    title: "Inside The SBF FTX Fraud",
    niche: "documentary",
    creator_pack_id: "creator_coffeezilla",
    pattern: {
      thumbnail_pattern: {
        composition: "subject-portrait-with-target",
        dominant_colors: ["#0d0d0d", "#ff2d2d", "#ffffff"],
        text_overlay_style: "serious-thin-sans-red-accent",
        subject_emotion: "investigative-serious",
        hook_element: "target mark / crosshair over subject face",
      },
      estimated_edit_signature: {
        pacing: "medium",
        likely_cut_frequency_sec: 4.5,
        probable_sfx_categories: ["ambient", "cinematic", "riser"],
        probable_captions: true,
        color_grade: "desaturated documentary, crushed blacks",
      },
      recommended_creator_pack_id: "creator_coffeezilla",
      key_elements_to_replicate: [
        "desaturated documentary color grade",
        "archival footage intercut with narration",
        "dark investigative tone in music + SFX",
      ],
    },
    source_url: "https://youtu.be/a5FYcTYKI1U",
    views_at_curation: "5M",
  },
  {
    id: "ref_johnny_harris_map",
    title: "Why This Tiny Country Has So Much Power",
    niche: "documentary",
    creator_pack_id: "creator_johnny_harris",
    pattern: {
      thumbnail_pattern: {
        composition: "map-overlay-with-subject-pointing",
        dominant_colors: ["#e63946", "#1d3557", "#f1faee"],
        text_overlay_style: "serif-italic-question",
        subject_emotion: "curious-explaining",
        hook_element: "zoomed-in map + red circle highlight",
      },
      estimated_edit_signature: {
        pacing: "medium",
        likely_cut_frequency_sec: 3.5,
        probable_sfx_categories: ["ambient", "ui-click", "whoosh"],
        probable_captions: true,
        color_grade: "rich red + blue, filmic",
      },
      recommended_creator_pack_id: "creator_johnny_harris",
      key_elements_to_replicate: [
        "map-zoom hook at thumbnail and open",
        "red highlight / circle on key region",
        "typographic animated overlays on place names",
      ],
    },
    source_url: "https://youtu.be/z7R3qIkOH3I",
    views_at_curation: "10M",
  },

  // ── Podcast ─────────────────────────────────────────────────────────
  {
    id: "ref_joe_rogan_elon",
    title: "Joe Rogan Experience — Elon Musk",
    niche: "podcast",
    creator_pack_id: "creator_joe_rogan",
    pattern: {
      thumbnail_pattern: {
        composition: "two-guests-across-the-mic",
        dominant_colors: ["#0f0f0f", "#b8860b", "#e0e0e0"],
        text_overlay_style: "minimal-bottom-white",
        subject_emotion: "in-conversation",
        hook_element: "close-up of both speakers + branded mic",
      },
      estimated_edit_signature: {
        pacing: "slow",
        likely_cut_frequency_sec: 8.0,
        probable_sfx_categories: ["ambient"],
        probable_captions: false,
        color_grade: "warm dim studio",
      },
      recommended_creator_pack_id: "creator_joe_rogan",
      key_elements_to_replicate: [
        "simple two-shot podcast composition",
        "minimal cuts — let the conversation breathe",
        "warm dim studio lighting",
      ],
    },
    source_url: "https://youtu.be/1PsZZycn9z8",
    views_at_curation: "45M",
  },
  {
    id: "ref_lex_fridman_ai",
    title: "Lex Fridman — Sam Altman on AGI",
    niche: "podcast",
    creator_pack_id: "creator_lex_fridman",
    pattern: {
      thumbnail_pattern: {
        composition: "profile-side-shots-black-background",
        dominant_colors: ["#000000", "#1a1a1a", "#cccccc"],
        text_overlay_style: "monospace-minimalist",
        subject_emotion: "contemplative",
        hook_element: "pure black background, contemplative portrait",
      },
      estimated_edit_signature: {
        pacing: "slow",
        likely_cut_frequency_sec: 10.0,
        probable_sfx_categories: ["ambient"],
        probable_captions: false,
        color_grade: "black-and-white-adjacent, low key",
      },
      recommended_creator_pack_id: "creator_lex_fridman",
      key_elements_to_replicate: [
        "pure-black background with single key light",
        "long take, minimal jump cuts",
        "monospace overlay text for quotes",
      ],
    },
    source_url: "https://youtu.be/L_Guz73e6fw",
    views_at_curation: "8M",
  },

  // ── Reaction / entertainment ────────────────────────────────────────
  {
    id: "ref_david_dobrik_vlog",
    title: "SURPRISING MY BEST FRIEND WITH $100K!!",
    niche: "vlog",
    creator_pack_id: "creator_david_dobrik",
    pattern: {
      thumbnail_pattern: {
        composition: "group-celebration-wide",
        dominant_colors: ["#ffcc00", "#ff2d2d", "#ffffff"],
        text_overlay_style: "all-caps-bouncy-pink",
        subject_emotion: "screaming-joy",
        hook_element: "cash being thrown, friends reacting",
      },
      estimated_edit_signature: {
        pacing: "fast",
        likely_cut_frequency_sec: 1.8,
        probable_sfx_categories: ["meme", "impact", "whoosh"],
        probable_captions: true,
        color_grade: "saturated pop palette",
      },
      recommended_creator_pack_id: "creator_david_dobrik",
      key_elements_to_replicate: [
        "'4-minute 20-scene' ultra-fast-cut structure",
        "all-caps bouncy thumbnail typography",
        "meme-SFX between every beat",
      ],
    },
    source_url: "https://youtu.be/NSW26z1uFhU",
    views_at_curation: "25M",
  },

  // ── Animation / storytelling ────────────────────────────────────────
  {
    id: "ref_jaiden_animations_story",
    title: "Things About Me",
    niche: "animation",
    creator_pack_id: "creator_jaiden_animations",
    pattern: {
      thumbnail_pattern: {
        composition: "cartoon-character-centered",
        dominant_colors: ["#ffd166", "#06d6a0", "#ef476f"],
        text_overlay_style: "cartoon-bubble-font",
        subject_emotion: "n/a-illustrated",
        hook_element: "animated character + speech bubble",
      },
      estimated_edit_signature: {
        pacing: "medium",
        likely_cut_frequency_sec: 3.0,
        probable_sfx_categories: ["meme", "pop"],
        probable_captions: false,
        color_grade: "flat cartoon bright",
      },
      recommended_creator_pack_id: "creator_jaiden_animations",
      key_elements_to_replicate: [
        "hand-drawn cartoon visuals over narration",
        "storytelling-pacing cuts (not action-pacing)",
        "bright saturated flat palette",
      ],
    },
    source_url: "https://youtu.be/cDA3_5982h8",
    views_at_curation: "32M",
  },

  // ── Ads / brand ─────────────────────────────────────────────────────
  {
    id: "ref_apple_hero_ad",
    title: "iPhone — Shot on iPhone",
    niche: "ads",
    creator_pack_id: "creator_mkbhd",
    pattern: {
      thumbnail_pattern: {
        composition: "minimal-product-on-white",
        dominant_colors: ["#ffffff", "#1a1a1a", "#c0c0c0"],
        text_overlay_style: "thin-sans-minimalist",
        subject_emotion: "n/a-product",
        hook_element: "isolated product, halo lighting",
      },
      estimated_edit_signature: {
        pacing: "medium",
        likely_cut_frequency_sec: 2.5,
        probable_sfx_categories: ["ambient", "cinematic", "ui-click"],
        probable_captions: false,
        color_grade: "clean white premium",
      },
      recommended_creator_pack_id: "creator_mkbhd",
      key_elements_to_replicate: [
        "product isolated on clean backdrop",
        "beat-synced minimal cuts",
        "no captions, no voiceover clutter",
      ],
    },
    source_url: "https://youtu.be/pWtH9PbsXYs",
    views_at_curation: "12M",
  },
];

/**
 * Return up to `limit` reference entries, preferring ones whose niche or
 * creator_pack_id best matches the caller's context. Used as few-shot
 * exemplars when Claude analyzes a new URL — passing the whole library
 * would blow through context, so we pick a handful.
 */
export function pickReferenceExemplars(
  context: { niche?: string | null; creator_pack_id?: string | null } = {},
  limit = 5
): ViralReferenceEntry[] {
  const niche = (context.niche || "").toLowerCase();
  const packId = (context.creator_pack_id || "").toLowerCase();

  const scored = VIRAL_REFERENCE_LIBRARY.map((entry) => {
    let score = 0;
    if (packId && entry.creator_pack_id.toLowerCase() === packId) score += 10;
    if (niche && entry.niche.toLowerCase() === niche) score += 5;
    return { entry, score };
  });

  scored.sort((a, b) => b.score - a.score || (Math.random() - 0.5));
  return scored.slice(0, limit).map((s) => s.entry);
}

/**
 * Produce a compact string-form few-shot section. Claude reads this inside the
 * system prompt so we teach it the output shape + variety without bloating
 * every request with the full library.
 */
export function renderExemplarsForSystemPrompt(
  exemplars: ViralReferenceEntry[]
): string {
  return exemplars
    .map(
      (e, idx) =>
        `--- Exemplar ${idx + 1}: ${e.title} (${e.niche}, ${e.views_at_curation} views) ---\n` +
        JSON.stringify(e.pattern, null, 2)
    )
    .join("\n\n");
}
