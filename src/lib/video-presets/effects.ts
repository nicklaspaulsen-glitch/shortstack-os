/**
 * EFFECTS_LIBRARY — 100+ visual effects for the video editor.
 *
 * Each entry is data-only. The renderer is responsible for mapping `id` to an
 * implementation (WebGL shader, CSS filter stack, ffmpeg filter, or After
 * Effects preset). `paramHints` documents the controls a UI should surface —
 * it's free-form so every effect can expose its own knobs without bloating the
 * schema.
 */

export type EffectCategory =
  | "color"
  | "filter"
  | "particle"
  | "overlay"
  | "motion"
  | "distortion"
  | "stylize"
  | "textFx";

export interface EffectParamHint {
  name: string;
  type: "slider" | "toggle" | "color" | "select" | "number";
  min?: number;
  max?: number;
  default: number | string | boolean;
  options?: string[];
}

export interface VideoEffect {
  id: string;
  name: string;
  category: EffectCategory;
  description: string;
  paramHints: EffectParamHint[];
}

export const EFFECTS_LIBRARY: VideoEffect[] = [
  // ---------- COLOR (15) ----------
  {
    id: "fx_color_teal_orange",
    name: "Teal & Orange",
    category: "color",
    description: "Hollywood look — cyan shadows, warm highlights.",
    paramHints: [{ name: "intensity", type: "slider", min: 0, max: 100, default: 65 }],
  },
  {
    id: "fx_color_bleach_bypass",
    name: "Bleach Bypass",
    category: "color",
    description: "Crushed blacks, desaturated, silvered highlights.",
    paramHints: [{ name: "strength", type: "slider", min: 0, max: 100, default: 70 }],
  },
  {
    id: "fx_color_vintage",
    name: "Vintage",
    category: "color",
    description: "Warm vignette, faded blacks, golden tint.",
    paramHints: [
      { name: "warmth", type: "slider", min: 0, max: 100, default: 55 },
      { name: "fade", type: "slider", min: 0, max: 100, default: 40 },
    ],
  },
  {
    id: "fx_color_noir",
    name: "Noir",
    category: "color",
    description: "High-contrast B&W with crushed shadows.",
    paramHints: [{ name: "contrast", type: "slider", min: 0, max: 100, default: 80 }],
  },
  {
    id: "fx_color_warm_sunset",
    name: "Warm Sunset",
    category: "color",
    description: "Golden hour warmth + soft magenta.",
    paramHints: [{ name: "warmth", type: "slider", min: 0, max: 100, default: 60 }],
  },
  {
    id: "fx_color_cool_night",
    name: "Cool Night",
    category: "color",
    description: "Blue-shifted midtones, green shadows.",
    paramHints: [{ name: "coolness", type: "slider", min: 0, max: 100, default: 60 }],
  },
  {
    id: "fx_color_high_contrast",
    name: "High Contrast",
    category: "color",
    description: "Snap contrast for ad-style punch.",
    paramHints: [
      { name: "contrast", type: "slider", min: 0, max: 100, default: 70 },
      { name: "saturation", type: "slider", min: 0, max: 100, default: 55 },
    ],
  },
  {
    id: "fx_color_faded_film",
    name: "Faded Film",
    category: "color",
    description: "Lifted blacks + soft saturation drop.",
    paramHints: [{ name: "fade", type: "slider", min: 0, max: 100, default: 50 }],
  },
  {
    id: "fx_color_kodachrome",
    name: "Kodachrome",
    category: "color",
    description: "Rich reds + greens, vintage Kodak slide vibe.",
    paramHints: [{ name: "intensity", type: "slider", min: 0, max: 100, default: 65 }],
  },
  {
    id: "fx_color_technicolor",
    name: "Technicolor",
    category: "color",
    description: "Saturated three-strip color look.",
    paramHints: [{ name: "strength", type: "slider", min: 0, max: 100, default: 70 }],
  },
  {
    id: "fx_color_cinematic_flat",
    name: "Cinematic Flat",
    category: "color",
    description: "Log-like flat profile for grading headroom.",
    paramHints: [{ name: "strength", type: "slider", min: 0, max: 100, default: 60 }],
  },
  {
    id: "fx_color_mono_red",
    name: "Mono Red",
    category: "color",
    description: "B&W except for red — Schindler's-style.",
    paramHints: [{ name: "tolerance", type: "slider", min: 0, max: 100, default: 30 }],
  },
  {
    id: "fx_color_mono_blue",
    name: "Mono Blue",
    category: "color",
    description: "Isolate blue channel only.",
    paramHints: [{ name: "tolerance", type: "slider", min: 0, max: 100, default: 30 }],
  },
  {
    id: "fx_color_duotone_pink_blue",
    name: "Duotone Pink/Blue",
    category: "color",
    description: "Synthwave pink + blue duotone.",
    paramHints: [
      { name: "shadow", type: "color", default: "#0A0033" },
      { name: "highlight", type: "color", default: "#FF2D95" },
    ],
  },
  {
    id: "fx_color_hdr_pop",
    name: "HDR Pop",
    category: "color",
    description: "Pushed clarity + local contrast.",
    paramHints: [{ name: "clarity", type: "slider", min: 0, max: 100, default: 60 }],
  },

  // ---------- FILTER — film stocks & grain (15) ----------
  {
    id: "fx_filter_grain_heavy",
    name: "Grain (Heavy)",
    category: "filter",
    description: "Prominent film grain, 800-ASA-ish.",
    paramHints: [{ name: "amount", type: "slider", min: 0, max: 100, default: 70 }],
  },
  {
    id: "fx_filter_grain_subtle",
    name: "Grain (Subtle)",
    category: "filter",
    description: "Fine grain that sells the film look without noise.",
    paramHints: [{ name: "amount", type: "slider", min: 0, max: 100, default: 25 }],
  },
  {
    id: "fx_filter_16mm",
    name: "16mm",
    category: "filter",
    description: "16mm stock — grain + halation + weave.",
    paramHints: [{ name: "strength", type: "slider", min: 0, max: 100, default: 55 }],
  },
  {
    id: "fx_filter_8mm",
    name: "8mm",
    category: "filter",
    description: "Super-8 warm grain + flicker + gate weave.",
    paramHints: [{ name: "flicker", type: "slider", min: 0, max: 100, default: 35 }],
  },
  {
    id: "fx_filter_vhs",
    name: "VHS",
    category: "filter",
    description: "Chroma bleed, scan lines, tracking jitter.",
    paramHints: [
      { name: "chroma_bleed", type: "slider", min: 0, max: 100, default: 55 },
      { name: "scanlines", type: "slider", min: 0, max: 100, default: 40 },
    ],
  },
  {
    id: "fx_filter_polaroid",
    name: "Polaroid",
    category: "filter",
    description: "Square crop + faded milky tint + border.",
    paramHints: [{ name: "fade", type: "slider", min: 0, max: 100, default: 50 }],
  },
  {
    id: "fx_filter_old_photo",
    name: "Old Photo",
    category: "filter",
    description: "Sepia + creases + dust.",
    paramHints: [{ name: "age", type: "slider", min: 0, max: 100, default: 60 }],
  },
  {
    id: "fx_filter_halation",
    name: "Halation",
    category: "filter",
    description: "Red glow around highlights — film-backing look.",
    paramHints: [{ name: "glow", type: "slider", min: 0, max: 100, default: 40 }],
  },
  {
    id: "fx_filter_gate_weave",
    name: "Gate Weave",
    category: "filter",
    description: "Slight horizontal/vertical wobble of the frame.",
    paramHints: [{ name: "wobble", type: "slider", min: 0, max: 100, default: 20 }],
  },
  {
    id: "fx_filter_scanlines",
    name: "Scanlines",
    category: "filter",
    description: "CRT scanlines overlay.",
    paramHints: [{ name: "opacity", type: "slider", min: 0, max: 100, default: 30 }],
  },
  {
    id: "fx_filter_crt_curve",
    name: "CRT Curve",
    category: "filter",
    description: "Slight barrel + vignette — tube TV look.",
    paramHints: [{ name: "curve", type: "slider", min: 0, max: 100, default: 35 }],
  },
  {
    id: "fx_filter_light_leak_preset",
    name: "Light Leak Preset",
    category: "filter",
    description: "Baked-in warm light leak flicker.",
    paramHints: [{ name: "intensity", type: "slider", min: 0, max: 100, default: 45 }],
  },
  {
    id: "fx_filter_dreamy_soft",
    name: "Dreamy Soft",
    category: "filter",
    description: "Soft glow + halation + milky blacks.",
    paramHints: [{ name: "glow", type: "slider", min: 0, max: 100, default: 50 }],
  },
  {
    id: "fx_filter_clarity_boost",
    name: "Clarity Boost",
    category: "filter",
    description: "Sharpen + local-contrast push.",
    paramHints: [{ name: "amount", type: "slider", min: 0, max: 100, default: 45 }],
  },
  {
    id: "fx_filter_vignette",
    name: "Vignette",
    category: "filter",
    description: "Soft dark edges focus viewer's eye.",
    paramHints: [
      { name: "amount", type: "slider", min: 0, max: 100, default: 35 },
      { name: "feather", type: "slider", min: 0, max: 100, default: 65 },
    ],
  },

  // ---------- PARTICLE (12) ----------
  {
    id: "fx_particle_sparkles",
    name: "Sparkles",
    category: "particle",
    description: "Small floating stars around subject.",
    paramHints: [
      { name: "density", type: "slider", min: 0, max: 100, default: 40 },
      { name: "size", type: "slider", min: 0, max: 100, default: 30 },
    ],
  },
  {
    id: "fx_particle_confetti",
    name: "Confetti",
    category: "particle",
    description: "Celebratory confetti burst.",
    paramHints: [{ name: "density", type: "slider", min: 0, max: 100, default: 55 }],
  },
  {
    id: "fx_particle_snow",
    name: "Snow",
    category: "particle",
    description: "Soft drifting snowflakes.",
    paramHints: [
      { name: "density", type: "slider", min: 0, max: 100, default: 50 },
      { name: "wind", type: "slider", min: -100, max: 100, default: 0 },
    ],
  },
  {
    id: "fx_particle_rain",
    name: "Rain",
    category: "particle",
    description: "Vertical rain streaks.",
    paramHints: [
      { name: "density", type: "slider", min: 0, max: 100, default: 60 },
      { name: "speed", type: "slider", min: 0, max: 100, default: 70 },
    ],
  },
  {
    id: "fx_particle_fireflies",
    name: "Fireflies",
    category: "particle",
    description: "Glowing fireflies drift on subject.",
    paramHints: [{ name: "density", type: "slider", min: 0, max: 100, default: 35 }],
  },
  {
    id: "fx_particle_smoke",
    name: "Smoke",
    category: "particle",
    description: "Soft smoke wisps crossing frame.",
    paramHints: [{ name: "opacity", type: "slider", min: 0, max: 100, default: 45 }],
  },
  {
    id: "fx_particle_embers",
    name: "Embers",
    category: "particle",
    description: "Glowing embers rise from bottom.",
    paramHints: [{ name: "density", type: "slider", min: 0, max: 100, default: 40 }],
  },
  {
    id: "fx_particle_bubbles",
    name: "Bubbles",
    category: "particle",
    description: "Floating soap bubbles.",
    paramHints: [{ name: "density", type: "slider", min: 0, max: 100, default: 35 }],
  },
  {
    id: "fx_particle_leaves",
    name: "Falling Leaves",
    category: "particle",
    description: "Autumn leaves drift down.",
    paramHints: [{ name: "density", type: "slider", min: 0, max: 100, default: 40 }],
  },
  {
    id: "fx_particle_dust",
    name: "Dust Motes",
    category: "particle",
    description: "Slow floating dust in light beam.",
    paramHints: [{ name: "density", type: "slider", min: 0, max: 100, default: 30 }],
  },
  {
    id: "fx_particle_stars",
    name: "Starfield",
    category: "particle",
    description: "Parallax star background.",
    paramHints: [
      { name: "density", type: "slider", min: 0, max: 100, default: 50 },
      { name: "speed", type: "slider", min: 0, max: 100, default: 20 },
    ],
  },
  {
    id: "fx_particle_cherry_blossom",
    name: "Cherry Blossom",
    category: "particle",
    description: "Pink petals drift across frame.",
    paramHints: [{ name: "density", type: "slider", min: 0, max: 100, default: 40 }],
  },

  // ---------- OVERLAY (12) ----------
  {
    id: "fx_overlay_light_leak_warm",
    name: "Light Leak (Warm)",
    category: "overlay",
    description: "Warm orange light leak sweep.",
    paramHints: [{ name: "opacity", type: "slider", min: 0, max: 100, default: 60 }],
  },
  {
    id: "fx_overlay_light_leak_cool",
    name: "Light Leak (Cool)",
    category: "overlay",
    description: "Cool cyan light leak.",
    paramHints: [{ name: "opacity", type: "slider", min: 0, max: 100, default: 55 }],
  },
  {
    id: "fx_overlay_lens_flare",
    name: "Lens Flare",
    category: "overlay",
    description: "Anamorphic lens flare streak.",
    paramHints: [
      { name: "x", type: "slider", min: 0, max: 100, default: 80 },
      { name: "y", type: "slider", min: 0, max: 100, default: 20 },
      { name: "intensity", type: "slider", min: 0, max: 100, default: 60 },
    ],
  },
  {
    id: "fx_overlay_dust",
    name: "Dust Overlay",
    category: "overlay",
    description: "Film dust + scratches plate.",
    paramHints: [{ name: "amount", type: "slider", min: 0, max: 100, default: 40 }],
  },
  {
    id: "fx_overlay_bokeh",
    name: "Bokeh",
    category: "overlay",
    description: "Out-of-focus highlight circles.",
    paramHints: [{ name: "amount", type: "slider", min: 0, max: 100, default: 45 }],
  },
  {
    id: "fx_overlay_rain_splash",
    name: "Rain on Lens",
    category: "overlay",
    description: "Water droplets on lens surface.",
    paramHints: [{ name: "density", type: "slider", min: 0, max: 100, default: 40 }],
  },
  {
    id: "fx_overlay_scratch_film",
    name: "Film Scratches",
    category: "overlay",
    description: "Vertical scratch marks.",
    paramHints: [{ name: "amount", type: "slider", min: 0, max: 100, default: 35 }],
  },
  {
    id: "fx_overlay_burnt_edges",
    name: "Burnt Edges",
    category: "overlay",
    description: "Charred corner vignette.",
    paramHints: [{ name: "amount", type: "slider", min: 0, max: 100, default: 40 }],
  },
  {
    id: "fx_overlay_grid_pattern",
    name: "Grid Pattern",
    category: "overlay",
    description: "Subtle tech grid overlay.",
    paramHints: [{ name: "opacity", type: "slider", min: 0, max: 100, default: 20 }],
  },
  {
    id: "fx_overlay_hud_reticle",
    name: "HUD Reticle",
    category: "overlay",
    description: "Targeting reticle + corner brackets.",
    paramHints: [{ name: "style", type: "select", default: "simple", options: ["simple", "tech", "sniper"] }],
  },
  {
    id: "fx_overlay_brand_watermark",
    name: "Brand Watermark",
    category: "overlay",
    description: "Translucent logo overlay.",
    paramHints: [
      { name: "opacity", type: "slider", min: 0, max: 100, default: 40 },
      { name: "corner", type: "select", default: "br", options: ["tl", "tr", "bl", "br"] },
    ],
  },
  {
    id: "fx_overlay_date_timestamp",
    name: "Date Timestamp",
    category: "overlay",
    description: "Camcorder-style date+time overlay.",
    paramHints: [{ name: "format", type: "select", default: "mdy", options: ["mdy", "dmy", "ymd"] }],
  },

  // ---------- MOTION (10) ----------
  {
    id: "fx_motion_shake",
    name: "Shake",
    category: "motion",
    description: "Random camera shake.",
    paramHints: [
      { name: "intensity", type: "slider", min: 0, max: 100, default: 40 },
      { name: "frequency", type: "slider", min: 0, max: 100, default: 60 },
    ],
  },
  {
    id: "fx_motion_zoom_pulse",
    name: "Zoom Pulse",
    category: "motion",
    description: "Rhythmic zoom on the beat.",
    paramHints: [
      { name: "amount", type: "slider", min: 0, max: 100, default: 30 },
      { name: "bpm_sync", type: "toggle", default: true },
    ],
  },
  {
    id: "fx_motion_jitter",
    name: "Jitter",
    category: "motion",
    description: "Tiny per-frame random offset.",
    paramHints: [{ name: "amount", type: "slider", min: 0, max: 100, default: 25 }],
  },
  {
    id: "fx_motion_wobble",
    name: "Wobble",
    category: "motion",
    description: "Smooth sine-wave wobble of the frame.",
    paramHints: [{ name: "amount", type: "slider", min: 0, max: 100, default: 30 }],
  },
  {
    id: "fx_motion_ken_burns",
    name: "Ken Burns",
    category: "motion",
    description: "Slow pan + zoom on stills.",
    paramHints: [
      { name: "direction", type: "select", default: "zoom_in", options: ["zoom_in", "zoom_out", "pan_left", "pan_right"] },
    ],
  },
  {
    id: "fx_motion_dolly_zoom",
    name: "Dolly Zoom",
    category: "motion",
    description: "Vertigo-style zoom with inverse scale.",
    paramHints: [{ name: "strength", type: "slider", min: 0, max: 100, default: 50 }],
  },
  {
    id: "fx_motion_parallax",
    name: "Parallax",
    category: "motion",
    description: "Foreground/background offset for depth.",
    paramHints: [{ name: "depth", type: "slider", min: 0, max: 100, default: 40 }],
  },
  {
    id: "fx_motion_tilt_handheld",
    name: "Handheld Tilt",
    category: "motion",
    description: "Natural handheld camera tilt.",
    paramHints: [{ name: "amount", type: "slider", min: 0, max: 100, default: 30 }],
  },
  {
    id: "fx_motion_punch_zoom",
    name: "Punch Zoom",
    category: "motion",
    description: "Snappy zoom-in to emphasize a beat.",
    paramHints: [{ name: "amount", type: "slider", min: 0, max: 100, default: 55 }],
  },
  {
    id: "fx_motion_speed_ramp",
    name: "Speed Ramp",
    category: "motion",
    description: "Slow-then-fast time remap.",
    paramHints: [
      { name: "start_speed", type: "slider", min: 10, max: 300, default: 100 },
      { name: "end_speed", type: "slider", min: 10, max: 300, default: 200 },
    ],
  },

  // ---------- DISTORTION (10) ----------
  {
    id: "fx_distort_heat",
    name: "Heat Haze",
    category: "distortion",
    description: "Warping like heat above pavement.",
    paramHints: [{ name: "amount", type: "slider", min: 0, max: 100, default: 30 }],
  },
  {
    id: "fx_distort_fisheye",
    name: "Fisheye",
    category: "distortion",
    description: "Extreme wide-angle barrel distortion.",
    paramHints: [{ name: "amount", type: "slider", min: 0, max: 100, default: 50 }],
  },
  {
    id: "fx_distort_mirror_h",
    name: "Mirror Horizontal",
    category: "distortion",
    description: "Left half mirrored to right.",
    paramHints: [{ name: "split", type: "slider", min: 0, max: 100, default: 50 }],
  },
  {
    id: "fx_distort_mirror_v",
    name: "Mirror Vertical",
    category: "distortion",
    description: "Top half mirrored to bottom.",
    paramHints: [{ name: "split", type: "slider", min: 0, max: 100, default: 50 }],
  },
  {
    id: "fx_distort_kaleidoscope",
    name: "Kaleidoscope",
    category: "distortion",
    description: "Radial mirror symmetry.",
    paramHints: [
      { name: "segments", type: "number", min: 3, max: 24, default: 6 },
    ],
  },
  {
    id: "fx_distort_pinch",
    name: "Pinch",
    category: "distortion",
    description: "Pinch center of frame inward.",
    paramHints: [{ name: "amount", type: "slider", min: 0, max: 100, default: 40 }],
  },
  {
    id: "fx_distort_bulge",
    name: "Bulge",
    category: "distortion",
    description: "Bulge center of frame outward.",
    paramHints: [{ name: "amount", type: "slider", min: 0, max: 100, default: 40 }],
  },
  {
    id: "fx_distort_twirl",
    name: "Twirl",
    category: "distortion",
    description: "Spiral distortion around center.",
    paramHints: [{ name: "amount", type: "slider", min: 0, max: 100, default: 50 }],
  },
  {
    id: "fx_distort_wave",
    name: "Wave",
    category: "distortion",
    description: "Sine-wave row offset.",
    paramHints: [
      { name: "amplitude", type: "slider", min: 0, max: 100, default: 30 },
      { name: "frequency", type: "slider", min: 0, max: 100, default: 40 },
    ],
  },
  {
    id: "fx_distort_lens_warp",
    name: "Lens Warp",
    category: "distortion",
    description: "Soft lens-wide distortion.",
    paramHints: [{ name: "amount", type: "slider", min: -100, max: 100, default: 20 }],
  },

  // ---------- STYLIZE (12) ----------
  {
    id: "fx_stylize_oil_painting",
    name: "Oil Painting",
    category: "stylize",
    description: "Oil-paint brush strokes.",
    paramHints: [{ name: "strength", type: "slider", min: 0, max: 100, default: 60 }],
  },
  {
    id: "fx_stylize_watercolor",
    name: "Watercolor",
    category: "stylize",
    description: "Soft watercolor look.",
    paramHints: [{ name: "strength", type: "slider", min: 0, max: 100, default: 55 }],
  },
  {
    id: "fx_stylize_comic",
    name: "Comic Book",
    category: "stylize",
    description: "Halftone shading + bold outlines.",
    paramHints: [{ name: "strength", type: "slider", min: 0, max: 100, default: 65 }],
  },
  {
    id: "fx_stylize_sketch",
    name: "Pencil Sketch",
    category: "stylize",
    description: "Pencil sketch look.",
    paramHints: [{ name: "strength", type: "slider", min: 0, max: 100, default: 70 }],
  },
  {
    id: "fx_stylize_ink",
    name: "Ink Drawing",
    category: "stylize",
    description: "High-contrast ink-wash style.",
    paramHints: [{ name: "strength", type: "slider", min: 0, max: 100, default: 65 }],
  },
  {
    id: "fx_stylize_low_poly",
    name: "Low Poly",
    category: "stylize",
    description: "Triangulated low-poly render.",
    paramHints: [{ name: "density", type: "slider", min: 0, max: 100, default: 50 }],
  },
  {
    id: "fx_stylize_pixelate",
    name: "Pixelate",
    category: "stylize",
    description: "Block pixelation.",
    paramHints: [{ name: "size", type: "slider", min: 2, max: 64, default: 10 }],
  },
  {
    id: "fx_stylize_posterize",
    name: "Posterize",
    category: "stylize",
    description: "Reduce colors to N levels.",
    paramHints: [{ name: "levels", type: "number", min: 2, max: 16, default: 5 }],
  },
  {
    id: "fx_stylize_cartoon",
    name: "Cartoon",
    category: "stylize",
    description: "Flat-shade cartoon render.",
    paramHints: [{ name: "strength", type: "slider", min: 0, max: 100, default: 60 }],
  },
  {
    id: "fx_stylize_ascii",
    name: "ASCII",
    category: "stylize",
    description: "Render as ASCII characters.",
    paramHints: [{ name: "density", type: "slider", min: 0, max: 100, default: 50 }],
  },
  {
    id: "fx_stylize_halftone",
    name: "Halftone",
    category: "stylize",
    description: "Print halftone dot pattern.",
    paramHints: [{ name: "size", type: "slider", min: 2, max: 40, default: 8 }],
  },
  {
    id: "fx_stylize_mosaic",
    name: "Mosaic",
    category: "stylize",
    description: "Tile mosaic render.",
    paramHints: [{ name: "size", type: "slider", min: 4, max: 128, default: 20 }],
  },

  // ---------- TEXT-FX (14) ----------
  {
    id: "fx_text_typewriter",
    name: "Typewriter",
    category: "textFx",
    description: "Letters appear one at a time.",
    paramHints: [
      { name: "speed_cps", type: "slider", min: 1, max: 60, default: 20 },
      { name: "cursor", type: "toggle", default: true },
    ],
  },
  {
    id: "fx_text_word_by_word",
    name: "Word by Word",
    category: "textFx",
    description: "Full-words appear on beat.",
    paramHints: [{ name: "wpm", type: "slider", min: 60, max: 400, default: 180 }],
  },
  {
    id: "fx_text_bounce",
    name: "Bounce",
    category: "textFx",
    description: "Letters bounce in with spring.",
    paramHints: [{ name: "bounciness", type: "slider", min: 0, max: 100, default: 60 }],
  },
  {
    id: "fx_text_wave",
    name: "Wave",
    category: "textFx",
    description: "Letters undulate in a sine wave.",
    paramHints: [{ name: "amplitude", type: "slider", min: 0, max: 100, default: 40 }],
  },
  {
    id: "fx_text_glitch",
    name: "Glitch Text",
    category: "textFx",
    description: "Per-letter RGB split + jitter.",
    paramHints: [{ name: "intensity", type: "slider", min: 0, max: 100, default: 55 }],
  },
  {
    id: "fx_text_neon",
    name: "Neon",
    category: "textFx",
    description: "Glowing neon with flicker.",
    paramHints: [
      { name: "color", type: "color", default: "#FF2D95" },
      { name: "glow", type: "slider", min: 0, max: 100, default: 70 },
    ],
  },
  {
    id: "fx_text_chrome",
    name: "Chrome",
    category: "textFx",
    description: "80s chrome gradient text.",
    paramHints: [{ name: "strength", type: "slider", min: 0, max: 100, default: 70 }],
  },
  {
    id: "fx_text_fire",
    name: "Fire",
    category: "textFx",
    description: "Text engulfed in flame.",
    paramHints: [{ name: "intensity", type: "slider", min: 0, max: 100, default: 60 }],
  },
  {
    id: "fx_text_ice",
    name: "Ice",
    category: "textFx",
    description: "Frosty text with breath vapor.",
    paramHints: [{ name: "frost", type: "slider", min: 0, max: 100, default: 55 }],
  },
  {
    id: "fx_text_3d_extrude",
    name: "3D Extrude",
    category: "textFx",
    description: "Extruded 3D text.",
    paramHints: [
      { name: "depth", type: "slider", min: 0, max: 100, default: 40 },
      { name: "angle", type: "slider", min: -180, max: 180, default: 20 },
    ],
  },
  {
    id: "fx_text_shake",
    name: "Shake",
    category: "textFx",
    description: "Text rattles on emphasis.",
    paramHints: [{ name: "intensity", type: "slider", min: 0, max: 100, default: 50 }],
  },
  {
    id: "fx_text_kinetic_highlight",
    name: "Kinetic Highlight",
    category: "textFx",
    description: "Keyword highlighted as it's spoken.",
    paramHints: [{ name: "color", type: "color", default: "#FFDD00" }],
  },
  {
    id: "fx_text_scale_pop",
    name: "Scale Pop",
    category: "textFx",
    description: "Text pops in with bounce scale.",
    paramHints: [{ name: "strength", type: "slider", min: 0, max: 100, default: 65 }],
  },
  {
    id: "fx_text_meme_impact",
    name: "Meme Impact",
    category: "textFx",
    description: "Big Impact-style white-on-stroke caption.",
    paramHints: [{ name: "stroke", type: "slider", min: 0, max: 20, default: 6 }],
  },
];

/** Filter effects by category. */
export function filterEffectsByCategory(
  category: EffectCategory,
): VideoEffect[] {
  return EFFECTS_LIBRARY.filter((e) => e.category === category);
}

/** Return an effect by id, or undefined. */
export function getEffectById(id: string): VideoEffect | undefined {
  return EFFECTS_LIBRARY.find((e) => e.id === id);
}

/** Pseudo-random effect pick. */
export function getRandomEffect(seed?: number): VideoEffect {
  const idx =
    typeof seed === "number"
      ? Math.abs(Math.floor(seed)) % EFFECTS_LIBRARY.length
      : Math.floor(Math.random() * EFFECTS_LIBRARY.length);
  return EFFECTS_LIBRARY[idx]!;
}
