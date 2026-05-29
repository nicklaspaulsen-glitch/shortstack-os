// ──────────────────────────────────────────────────────────────────────
// EDITING_STYLE_PRESETS — genre-level editing style presets.
//
// Each preset encodes a full editing recipe with NUMERIC, ffmpeg-actionable
// parameters: cut timing, zoom scale, transition durations, SFX density,
// VFX stack, caption style, music profile, and B-roll strategy.
//
// These sit ABOVE creator packs in the hierarchy:
//   EditingStylePreset (genre) → CreatorVideoPack (creator) → per-project overrides
//
// A creator pack can reference one editing style as its base, then override
// specific fields. The auto-edit pipeline picks a style by id and merges
// any creator pack deltas on top.
// ──────────────────────────────────────────────────────────────────────

import type { CaptionStyleId } from "./editing-style-types";

// ─── Timing ──────────────────────────────────────────────────────────

export interface EditingStyleTiming {
  /** Average seconds between cuts. */
  avgCutIntervalSec: number;
  /** Fastest allowable cut. */
  minCutIntervalSec: number;
  /** Slowest cut before it feels draggy. */
  maxCutIntervalSec: number;
  /** How long to hold the opening hook. */
  introHoldSec: number;
  /** Outro padding before end screen. */
  outroHoldSec: number;
}

// ─── Zoom ────────────────────────────────────────────────────────────

export type ZoomStyleName = "punch-in" | "smooth" | "none" | "jerky" | "dolly";
export type ZoomEasing = "ease-out-expo" | "ease-out-quart" | "linear" | "ease-in-out" | "spring";

export interface EditingStyleZoom {
  style: ZoomStyleName;
  /** Scale factor, e.g. 1.15 = 15% zoom in. */
  scale: number;
  /** Duration of the zoom move in ms. */
  durationMs: number;
  /** How often to apply zoom per minute of content. */
  frequencyPerMin: number;
  easing: ZoomEasing;
}

// ─── Transitions ─────────────────────────────────────────────────────

export interface EditingStyleTransitions {
  /** Primary transition id from TRANSITIONS_LIBRARY. */
  primaryId: string;
  /** Secondary/alternate transition id. */
  secondaryId: string;
  /** Duration in ms. */
  durationMs: number;
  /** Use transition between every scene or only on scene changes. */
  betweenEveryScene: boolean;
}

// ─── SFX ─────────────────────────────────────────────────────────────

export type SfxDensity = "none" | "sparse" | "moderate" | "heavy" | "saturated";

export interface EditingStyleSfx {
  /** SFX ids/categories triggered on hard cuts. */
  onCut: string[];
  /** SFX ids/categories triggered on zooms. */
  onZoom: string[];
  /** SFX ids/categories triggered on text reveals. */
  onTextReveal: string[];
  /** Ambient/background SFX layered throughout. */
  ambient: string[];
  /** Overall SFX density. */
  density: SfxDensity;
}

// ─── VFX ─────────────────────────────────────────────────────────────

export interface EditingStyleVfx {
  /** Color grade effect id from EFFECTS_LIBRARY. */
  colorGradeId: string;
  /** Overlay effect ids layered on top. */
  overlayIds: string[];
  filmGrain: boolean;
  /** Film grain intensity 0-1 (only if filmGrain true). */
  filmGrainIntensity: number;
  vignette: boolean;
  /** Vignette intensity 0-1. */
  vignetteIntensity: number;
  letterbox: boolean;
  /** Letterbox ratio, e.g. 2.35 for cinematic. */
  letterboxRatio: number;
}

// ─── Captions ────────────────────────────────────────────────────────

export type CaptionPosition = "bottom-center" | "top-center" | "center" | "lower-third";

export interface EditingStyleCaptions {
  /** One of the 6 caption style ids. */
  styleId: CaptionStyleId;
  position: CaptionPosition;
  /** Always show captions, or only on speech segments. */
  showAlways: boolean;
}

// ─── Music ───────────────────────────────────────────────────────────

export interface EditingStyleMusic {
  /** Preferred mood tags from MUSIC_LIBRARY. */
  moods: string[];
  /** BPM range [low, high]. */
  bpmRange: [number, number];
  /** Energy level 1-10. */
  energy: number;
  fadeInMs: number;
  fadeOutMs: number;
  /** Duck music volume when speech detected (-dB). */
  duckOnSpeechDb: number;
}

// ─── B-Roll ──────────────────────────────────────────────────────────

export type BrollStrategy = "none" | "light" | "moderate" | "heavy" | "cinematic-intercut";

export interface EditingStyleBroll {
  strategy: BrollStrategy;
  /** How often to insert B-roll per minute. */
  insertsPerMin: number;
  /** Max duration of a single B-roll clip in seconds. */
  maxClipDurationSec: number;
  /** Preferred B-roll content types. */
  preferredTypes: string[];
}

// ─── Master interface ────────────────────────────────────────────────

export interface EditingStylePreset {
  id: string;
  name: string;
  description: string;
  /** Genre/category tag for filtering. */
  genre: string;
  timing: EditingStyleTiming;
  zoom: EditingStyleZoom;
  transitions: EditingStyleTransitions;
  sfx: EditingStyleSfx;
  vfx: EditingStyleVfx;
  captions: EditingStyleCaptions;
  music: EditingStyleMusic;
  broll: EditingStyleBroll;
  /** Creator pack ids that map well to this style. */
  relatedCreatorPacks: string[];
}

// ──────────────────────────────────────────────────────────────────────
// 9 GENRE PRESETS — derived from the 13 reference YouTube videos.
// ──────────────────────────────────────────────────────────────────────

export const EDITING_STYLE_PRESETS: EditingStylePreset[] = [
  // ───────── 1. GAMING MONTAGE ─────────
  // Ref: Yumi (x4BYhMM1pko), VanossGaming (N_UnDz8rZHs), Nogla/Terroriser (U0A_oNROelU)
  {
    id: "style_gaming_montage",
    name: "Gaming Montage",
    description:
      "Rapid-fire gameplay highlights with meme SFX stingers, punch-in zooms on kills, " +
      "and high-energy electronic/phonk backing tracks. Built for montage compilations " +
      "and funny-moments edits.",
    genre: "gaming",
    timing: {
      avgCutIntervalSec: 1.2,
      minCutIntervalSec: 0.4,
      maxCutIntervalSec: 3.0,
      introHoldSec: 1.5,
      outroHoldSec: 2.0,
    },
    zoom: {
      style: "punch-in",
      scale: 1.25,
      durationMs: 150,
      frequencyPerMin: 12,
      easing: "ease-out-expo",
    },
    transitions: {
      primaryId: "tr_whip_horizontal",
      secondaryId: "tr_zoom_punch",
      durationMs: 200,
      betweenEveryScene: false,
    },
    sfx: {
      onCut: ["sfx_whoosh_fast", "sfx_impact_hit"],
      onZoom: ["sfx_zoom_bass"],
      onTextReveal: ["sfx_pop_bright"],
      ambient: [],
      density: "heavy",
    },
    vfx: {
      colorGradeId: "fx_color_hdr_pop",
      overlayIds: [],
      filmGrain: false,
      filmGrainIntensity: 0,
      vignette: false,
      vignetteIntensity: 0,
      letterbox: false,
      letterboxRatio: 0,
    },
    captions: {
      styleId: "mrbeast-pop",
      position: "center",
      showAlways: false,
    },
    music: {
      moods: ["hype", "energetic", "aggressive"],
      bpmRange: [140, 180],
      energy: 9,
      fadeInMs: 500,
      fadeOutMs: 1000,
      duckOnSpeechDb: -8,
    },
    broll: {
      strategy: "none",
      insertsPerMin: 0,
      maxClipDurationSec: 0,
      preferredTypes: [],
    },
    relatedCreatorPacks: [
      "creator_vanossgaming",
      "creator_pewdiepie",
      "creator_dream",
      "creator_ninja",
      "creator_yumi_montage",
    ],
  },

  // ───────── 2. CINEMATIC BUILD ─────────
  // Ref: Car build channel (vDhKRZQIvzE)
  {
    id: "style_cinematic_build",
    name: "Cinematic Build",
    description:
      "Slow, deliberate cuts with smooth dolly zooms, ambient workshop sounds, and " +
      "teal-orange color grading. Designed for car builds, maker projects, and " +
      "restoration content where the craft is the star.",
    genre: "cinematic",
    timing: {
      avgCutIntervalSec: 5.0,
      minCutIntervalSec: 2.5,
      maxCutIntervalSec: 10.0,
      introHoldSec: 4.0,
      outroHoldSec: 5.0,
    },
    zoom: {
      style: "dolly",
      scale: 1.08,
      durationMs: 1200,
      frequencyPerMin: 3,
      easing: "ease-in-out",
    },
    transitions: {
      primaryId: "tr_fade_cross",
      secondaryId: "tr_fade_dip_black",
      durationMs: 600,
      betweenEveryScene: true,
    },
    sfx: {
      onCut: [],
      onZoom: [],
      onTextReveal: ["sfx_whoosh_soft"],
      ambient: ["sfx_ambient_workshop", "sfx_ambient_rain"],
      density: "sparse",
    },
    vfx: {
      colorGradeId: "fx_color_teal_orange",
      overlayIds: ["fx_overlay_light_leak"],
      filmGrain: true,
      filmGrainIntensity: 0.15,
      vignette: true,
      vignetteIntensity: 0.3,
      letterbox: true,
      letterboxRatio: 2.35,
    },
    captions: {
      styleId: "clean-sans",
      position: "bottom-center",
      showAlways: false,
    },
    music: {
      moods: ["chill", "calm", "cinematic"],
      bpmRange: [70, 110],
      energy: 4,
      fadeInMs: 2000,
      fadeOutMs: 3000,
      duckOnSpeechDb: -12,
    },
    broll: {
      strategy: "cinematic-intercut",
      insertsPerMin: 4,
      maxClipDurationSec: 6,
      preferredTypes: ["detail-shot", "slow-motion", "timelapse", "process"],
    },
    relatedCreatorPacks: [
      "creator_peter_mckinnon",
      "creator_casey_neistat",
      "creator_cinematic_car_build",
    ],
  },

  // ───────── 3. MRBEAST CHALLENGE ─────────
  // Ref: MrBeast (AaMdXZMvT3w)
  {
    id: "style_mrbeast_challenge",
    name: "MrBeast Challenge",
    description:
      "Non-stop energy with rapid cuts, countdown overlays, massive SFX stacks " +
      "(risers, impacts, stingers), and giant animated text. The high-production " +
      "challenge/reality format that dominates mainstream YouTube.",
    genre: "challenge",
    timing: {
      avgCutIntervalSec: 1.8,
      minCutIntervalSec: 0.6,
      maxCutIntervalSec: 4.0,
      introHoldSec: 0.8,
      outroHoldSec: 3.0,
    },
    zoom: {
      style: "punch-in",
      scale: 1.2,
      durationMs: 200,
      frequencyPerMin: 10,
      easing: "ease-out-expo",
    },
    transitions: {
      primaryId: "tr_zoom_punch",
      secondaryId: "tr_whip_horizontal",
      durationMs: 250,
      betweenEveryScene: false,
    },
    sfx: {
      onCut: ["sfx_whoosh_fast", "sfx_impact_heavy"],
      onZoom: ["sfx_zoom_bass", "sfx_riser_short"],
      onTextReveal: ["sfx_pop_bright", "sfx_sparkle"],
      ambient: ["sfx_crowd_react"],
      density: "saturated",
    },
    vfx: {
      colorGradeId: "fx_color_hdr_pop",
      overlayIds: ["fx_overlay_confetti", "fx_overlay_countdown"],
      filmGrain: false,
      filmGrainIntensity: 0,
      vignette: false,
      vignetteIntensity: 0,
      letterbox: false,
      letterboxRatio: 0,
    },
    captions: {
      styleId: "mrbeast-pop",
      position: "center",
      showAlways: true,
    },
    music: {
      moods: ["hype", "energetic", "epic"],
      bpmRange: [120, 160],
      energy: 10,
      fadeInMs: 300,
      fadeOutMs: 1500,
      duckOnSpeechDb: -6,
    },
    broll: {
      strategy: "moderate",
      insertsPerMin: 3,
      maxClipDurationSec: 3,
      preferredTypes: ["reaction-shot", "wide-shot", "product-shot"],
    },
    relatedCreatorPacks: ["creator_mrbeast_challenge", "creator_airrack"],
  },

  // ───────── 4. COMEDY GROUP ─────────
  // Ref: WOZEN (NP9Tw9Y44Yo), Nogla/Terroriser (U0A_oNROelU)
  {
    id: "style_comedy_group",
    name: "Comedy Group",
    description:
      "Rapid meme-cut pacing with jerky zooms, sound effect punchlines, and " +
      "reaction face holds. Optimized for friend-group comedy, podcast highlights, " +
      "and meme-heavy compilations.",
    genre: "comedy",
    timing: {
      avgCutIntervalSec: 1.0,
      minCutIntervalSec: 0.3,
      maxCutIntervalSec: 3.5,
      introHoldSec: 1.0,
      outroHoldSec: 2.0,
    },
    zoom: {
      style: "jerky",
      scale: 1.3,
      durationMs: 100,
      frequencyPerMin: 15,
      easing: "ease-out-expo",
    },
    transitions: {
      primaryId: "tr_cut_hard",
      secondaryId: "tr_zoom_bounce",
      durationMs: 150,
      betweenEveryScene: false,
    },
    sfx: {
      onCut: ["sfx_impact_hit", "sfx_whoosh_fast"],
      onZoom: ["sfx_zoom_bass"],
      onTextReveal: ["sfx_pop_bright", "sfx_meme_vine_boom"],
      ambient: [],
      density: "saturated",
    },
    vfx: {
      colorGradeId: "fx_color_high_contrast",
      overlayIds: [],
      filmGrain: false,
      filmGrainIntensity: 0,
      vignette: false,
      vignetteIntensity: 0,
      letterbox: false,
      letterboxRatio: 0,
    },
    captions: {
      styleId: "mrbeast-pop",
      position: "center",
      showAlways: false,
    },
    music: {
      moods: ["playful", "upbeat", "funky"],
      bpmRange: [110, 150],
      energy: 8,
      fadeInMs: 500,
      fadeOutMs: 1000,
      duckOnSpeechDb: -10,
    },
    broll: {
      strategy: "none",
      insertsPerMin: 0,
      maxClipDurationSec: 0,
      preferredTypes: [],
    },
    relatedCreatorPacks: [
      "creator_vanossgaming",
      "creator_rdcworld1",
      "creator_somethingelseyt",
      "creator_wozen_comedy",
      "creator_nogla_terroriser",
    ],
  },

  // ───────── 5. FITNESS EDUCATIONAL ─────────
  // Ref: Jeff Nippard (S6rqpxVGKZ4)
  {
    id: "style_fitness_educational",
    name: "Fitness Educational",
    description:
      "Clean medium-paced cuts with smooth zooms on exercise demos, " +
      "motivational backing tracks, and lower-third captions for form cues. " +
      "Built for science-based fitness tutorials and training breakdowns.",
    genre: "fitness",
    timing: {
      avgCutIntervalSec: 4.0,
      minCutIntervalSec: 2.0,
      maxCutIntervalSec: 8.0,
      introHoldSec: 3.0,
      outroHoldSec: 4.0,
    },
    zoom: {
      style: "smooth",
      scale: 1.12,
      durationMs: 600,
      frequencyPerMin: 5,
      easing: "ease-out-quart",
    },
    transitions: {
      primaryId: "tr_fade_cross",
      secondaryId: "tr_slide_left",
      durationMs: 400,
      betweenEveryScene: true,
    },
    sfx: {
      onCut: [],
      onZoom: [],
      onTextReveal: ["sfx_whoosh_soft"],
      ambient: ["sfx_ambient_gym"],
      density: "sparse",
    },
    vfx: {
      colorGradeId: "fx_color_cinematic_flat",
      overlayIds: [],
      filmGrain: false,
      filmGrainIntensity: 0,
      vignette: true,
      vignetteIntensity: 0.15,
      letterbox: false,
      letterboxRatio: 0,
    },
    captions: {
      styleId: "subtle-lower-third",
      position: "lower-third",
      showAlways: true,
    },
    music: {
      moods: ["motivational", "upbeat", "energetic"],
      bpmRange: [100, 140],
      energy: 6,
      fadeInMs: 1500,
      fadeOutMs: 2000,
      duckOnSpeechDb: -14,
    },
    broll: {
      strategy: "moderate",
      insertsPerMin: 3,
      maxClipDurationSec: 4,
      preferredTypes: ["exercise-demo", "slow-motion", "diagram", "whiteboard"],
    },
    relatedCreatorPacks: ["creator_jeff_nippard", "creator_athlean_x"],
  },

  // ───────── 6. PERSONAL VLOG ─────────
  // Ref: PewDiePie (ea0X-DWVOZo)
  {
    id: "style_personal_vlog",
    name: "Personal Vlog",
    description:
      "Jump-cut heavy talking-head format with subtle punch-in zooms on emphasis, " +
      "light background music, and minimal SFX. The bread-and-butter of " +
      "commentary, opinion, and day-in-the-life content.",
    genre: "vlog",
    timing: {
      avgCutIntervalSec: 2.0,
      minCutIntervalSec: 0.8,
      maxCutIntervalSec: 5.0,
      introHoldSec: 2.0,
      outroHoldSec: 3.0,
    },
    zoom: {
      style: "punch-in",
      scale: 1.15,
      durationMs: 250,
      frequencyPerMin: 8,
      easing: "ease-out-quart",
    },
    transitions: {
      primaryId: "tr_cut_hard",
      secondaryId: "tr_fade_cross",
      durationMs: 100,
      betweenEveryScene: false,
    },
    sfx: {
      onCut: [],
      onZoom: [],
      onTextReveal: ["sfx_pop_soft"],
      ambient: [],
      density: "sparse",
    },
    vfx: {
      colorGradeId: "fx_color_natural_warm",
      overlayIds: [],
      filmGrain: false,
      filmGrainIntensity: 0,
      vignette: false,
      vignetteIntensity: 0,
      letterbox: false,
      letterboxRatio: 0,
    },
    captions: {
      styleId: "vlog-handwritten",
      position: "bottom-center",
      showAlways: false,
    },
    music: {
      moods: ["chill", "playful", "indie"],
      bpmRange: [80, 120],
      energy: 4,
      fadeInMs: 1000,
      fadeOutMs: 2000,
      duckOnSpeechDb: -16,
    },
    broll: {
      strategy: "light",
      insertsPerMin: 1,
      maxClipDurationSec: 3,
      preferredTypes: ["lifestyle", "screen-recording", "meme-image"],
    },
    relatedCreatorPacks: [
      "creator_pewdiepie",
      "creator_casey_neistat",
      "creator_emma_chamberlain",
    ],
  },

  // ───────── 7. BODYBUILDING CINEMATIC ─────────
  // Ref: Derek Lunsford (hKJ7t0SQQ_E), Chris Bumstead style (WDg_SX5NL_o), bodybuilding (MNULorW43H8)
  {
    id: "style_bodybuilding_cinematic",
    name: "Bodybuilding Cinematic",
    description:
      "Slow-burn training footage with dramatic music builds, smooth gym zooms, " +
      "slow-motion rep highlights, and cinematic color grading. " +
      "Designed for prep vlogs, training montages, and physique content.",
    genre: "bodybuilding",
    timing: {
      avgCutIntervalSec: 3.5,
      minCutIntervalSec: 1.5,
      maxCutIntervalSec: 7.0,
      introHoldSec: 3.0,
      outroHoldSec: 4.0,
    },
    zoom: {
      style: "smooth",
      scale: 1.1,
      durationMs: 800,
      frequencyPerMin: 4,
      easing: "ease-in-out",
    },
    transitions: {
      primaryId: "tr_fade_dip_black",
      secondaryId: "tr_fade_cross",
      durationMs: 500,
      betweenEveryScene: true,
    },
    sfx: {
      onCut: [],
      onZoom: ["sfx_whoosh_soft"],
      onTextReveal: [],
      ambient: ["sfx_ambient_gym", "sfx_ambient_crowd"],
      density: "moderate",
    },
    vfx: {
      colorGradeId: "fx_color_cinematic_flat",
      overlayIds: ["fx_overlay_light_leak"],
      filmGrain: true,
      filmGrainIntensity: 0.08,
      vignette: true,
      vignetteIntensity: 0.25,
      letterbox: true,
      letterboxRatio: 2.0,
    },
    captions: {
      styleId: "clean-sans",
      position: "bottom-center",
      showAlways: false,
    },
    music: {
      moods: ["motivational", "epic", "dark"],
      bpmRange: [80, 130],
      energy: 7,
      fadeInMs: 2000,
      fadeOutMs: 3000,
      duckOnSpeechDb: -10,
    },
    broll: {
      strategy: "heavy",
      insertsPerMin: 5,
      maxClipDurationSec: 5,
      preferredTypes: ["slow-motion", "detail-shot", "posing", "meal-prep"],
    },
    relatedCreatorPacks: [
      "creator_chris_bumstead",
      "creator_david_laid",
      "creator_sam_sulek",
      "creator_derek_lunsford",
    ],
  },

  // ───────── 8. TECH REVIEW ─────────
  // Ref: MKBHD-style tech review (c347oYQO57A)
  {
    id: "style_tech_review",
    name: "Tech Review",
    description:
      "Clean, measured pacing with smooth product-shot zooms, minimal SFX, " +
      "and precise color grading that lets the hardware shine. " +
      "The MKBHD/Dave2D/LTT review format with studio-quality polish.",
    genre: "tech",
    timing: {
      avgCutIntervalSec: 4.5,
      minCutIntervalSec: 2.0,
      maxCutIntervalSec: 8.0,
      introHoldSec: 2.5,
      outroHoldSec: 4.0,
    },
    zoom: {
      style: "smooth",
      scale: 1.08,
      durationMs: 500,
      frequencyPerMin: 4,
      easing: "ease-out-quart",
    },
    transitions: {
      primaryId: "tr_fade_cross",
      secondaryId: "tr_slide_left",
      durationMs: 350,
      betweenEveryScene: true,
    },
    sfx: {
      onCut: [],
      onZoom: [],
      onTextReveal: ["sfx_ui_click"],
      ambient: [],
      density: "none",
    },
    vfx: {
      colorGradeId: "fx_color_clean_studio",
      overlayIds: [],
      filmGrain: false,
      filmGrainIntensity: 0,
      vignette: false,
      vignetteIntensity: 0,
      letterbox: false,
      letterboxRatio: 0,
    },
    captions: {
      styleId: "clean-sans",
      position: "bottom-center",
      showAlways: false,
    },
    music: {
      moods: ["chill", "minimal-tech"],
      bpmRange: [90, 120],
      energy: 3,
      fadeInMs: 1500,
      fadeOutMs: 2500,
      duckOnSpeechDb: -18,
    },
    broll: {
      strategy: "heavy",
      insertsPerMin: 4,
      maxClipDurationSec: 5,
      preferredTypes: ["product-shot", "screen-recording", "comparison", "unboxing"],
    },
    relatedCreatorPacks: [
      "creator_mkbhd",
      "creator_ltt",
      "creator_dave2d",
      "creator_unbox_therapy",
    ],
  },

  // ───────── 9. AGENCY TALKING HEAD ─────────
  // Ref: Business/agency content (8C_6qojTA78)
  {
    id: "style_agency_talking_head",
    name: "Agency Talking Head",
    description:
      "Professional talking-head format with subtle zoom emphasis, " +
      "testimonial B-roll intercuts, clean lower-third captions, and " +
      "motivational business music. Built for agency owners, coaches, " +
      "and business content creators.",
    genre: "business",
    timing: {
      avgCutIntervalSec: 4.0,
      minCutIntervalSec: 2.0,
      maxCutIntervalSec: 8.0,
      introHoldSec: 2.5,
      outroHoldSec: 5.0,
    },
    zoom: {
      style: "punch-in",
      scale: 1.1,
      durationMs: 400,
      frequencyPerMin: 5,
      easing: "ease-out-quart",
    },
    transitions: {
      primaryId: "tr_fade_cross",
      secondaryId: "tr_cut_hard",
      durationMs: 300,
      betweenEveryScene: false,
    },
    sfx: {
      onCut: [],
      onZoom: [],
      onTextReveal: ["sfx_whoosh_soft"],
      ambient: [],
      density: "sparse",
    },
    vfx: {
      colorGradeId: "fx_color_clean_studio",
      overlayIds: [],
      filmGrain: false,
      filmGrainIntensity: 0,
      vignette: true,
      vignetteIntensity: 0.1,
      letterbox: false,
      letterboxRatio: 0,
    },
    captions: {
      styleId: "hormozi-bounce",
      position: "bottom-center",
      showAlways: true,
    },
    music: {
      moods: ["motivational", "upbeat", "corporate"],
      bpmRange: [90, 125],
      energy: 5,
      fadeInMs: 1500,
      fadeOutMs: 2500,
      duckOnSpeechDb: -16,
    },
    broll: {
      strategy: "moderate",
      insertsPerMin: 2,
      maxClipDurationSec: 4,
      preferredTypes: ["testimonial", "lifestyle", "office", "screen-recording"],
    },
    relatedCreatorPacks: [
      "creator_hormozi",
      "creator_iman_gadzhi",
      "creator_gary_vee",
      "creator_graham_stephan",
      "creator_agency_talking_head",
    ],
  },
];

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────

/** Find an editing style preset by id, or undefined. */
export function getEditingStyleById(id: string): EditingStylePreset | undefined {
  return EDITING_STYLE_PRESETS.find((s) => s.id === id);
}

/** Filter editing style presets using a predicate. */
export function filterEditingStyles(
  predicate: (style: EditingStylePreset) => boolean,
): EditingStylePreset[] {
  return EDITING_STYLE_PRESETS.filter(predicate);
}

/** Find the best editing style for a given creator pack id. */
export function getStyleForCreatorPack(creatorPackId: string): EditingStylePreset | undefined {
  return EDITING_STYLE_PRESETS.find((s) => s.relatedCreatorPacks.includes(creatorPackId));
}

/** Get all editing style ids. */
export function getEditingStyleIds(): string[] {
  return EDITING_STYLE_PRESETS.map((s) => s.id);
}

/** Get a caption style id for a given editing style, falling back to "clean-sans". */
export function getCaptionStyleForEditingStyle(styleId: string): CaptionStyleId {
  const style = getEditingStyleById(styleId);
  return style?.captions.styleId ?? "clean-sans";
}
