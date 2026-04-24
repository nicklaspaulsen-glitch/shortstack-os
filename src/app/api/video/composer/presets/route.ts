import { NextResponse } from "next/server";

// Hyperframes preset snippets — a curated selection of the ~50 blocks from
// the hyperframes package (see node_modules/hyperframes/dist/skills/
// hyperframes/references/). These are HTML fragments users can insert at
// the cursor in the editor. TODO: the hyperframes package does not expose a
// programmatic block catalog as of v0.4.22; if/when it does (e.g. via
// `hyperframes/blocks`), switch this to a runtime read of that registry.
const PRESETS: Array<{
  id: string;
  name: string;
  category:
    | "clip"
    | "transition"
    | "overlay"
    | "audio"
    | "animation"
    | "caption"
    | "shape";
  description: string;
  html: string;
}> = [
  // Clips
  {
    id: "clip-video",
    name: "Video clip",
    category: "clip",
    description: "Full-bleed video clip, muted, fills the canvas.",
    html: `<video class="clip" src="https://example.com/video.mp4" muted playsinline
  data-start="0" data-duration="5" data-track-index="0"
  style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"></video>`,
  },
  {
    id: "clip-image",
    name: "Image clip",
    category: "clip",
    description: "Static image clip with Ken Burns zoom.",
    html: `<img class="clip" src="https://example.com/image.jpg"
  data-start="0" data-duration="4" data-track-index="0"
  style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover" />`,
  },
  {
    id: "clip-title",
    name: "Title card",
    category: "clip",
    description: "Big centered title with subtitle.",
    html: `<div id="title-card" class="clip"
  data-start="0" data-duration="3" data-track-index="1"
  style="position:absolute;inset:0;display:flex;flex-direction:column;
         align-items:center;justify-content:center;color:#fff;text-align:center">
  <div style="font-size:96px;font-weight:800;letter-spacing:-2px">Main Title</div>
  <div style="font-size:36px;opacity:0.7;margin-top:24px">Subtitle goes here</div>
</div>`,
  },

  // Transitions
  {
    id: "transition-fade",
    name: "Crossfade",
    category: "transition",
    description: "Simple opacity fade between clips.",
    html: `<!-- In <script> timeline: -->
tl.to("#clip-a", { opacity: 0, duration: 0.5 }, "+=2");
tl.to("#clip-b", { opacity: 1, duration: 0.5 }, "<");`,
  },
  {
    id: "transition-slide",
    name: "Slide push",
    category: "transition",
    description: "Slide new clip in from the right.",
    html: `tl.from("#next-clip", { x: 1920, duration: 0.6, ease: "power2.out" }, "+=2");`,
  },
  {
    id: "transition-zoom",
    name: "Zoom burst",
    category: "transition",
    description: "Dramatic zoom into the next clip.",
    html: `tl.from("#next-clip", { scale: 0.5, opacity: 0, duration: 0.4, ease: "expo.out" }, "+=2");`,
  },
  {
    id: "transition-blur",
    name: "Blur fade",
    category: "transition",
    description: "Defocus blur into next scene.",
    html: `tl.to("#clip-a", { filter: "blur(40px)", opacity: 0, duration: 0.6 }, "+=2");`,
  },
  {
    id: "transition-wipe",
    name: "Wipe reveal",
    category: "transition",
    description: "Clip-path wipe to reveal next scene.",
    html: `tl.to("#next-clip", { clipPath: "inset(0 0 0 0)", duration: 0.8, ease: "power3.inOut" }, "+=2");`,
  },

  // Overlays
  {
    id: "overlay-lower-third",
    name: "Lower third",
    category: "overlay",
    description: "Name + title graphic at bottom-left.",
    html: `<div class="clip" data-start="1" data-duration="4" data-track-index="2"
  style="position:absolute;bottom:120px;left:80px;color:#fff;
         background:rgba(0,0,0,0.6);padding:24px 36px;border-radius:8px">
  <div style="font-size:42px;font-weight:700">Jane Doe</div>
  <div style="font-size:24px;opacity:0.8">CEO, Acme Corp</div>
</div>`,
  },
  {
    id: "overlay-logo",
    name: "Logo watermark",
    category: "overlay",
    description: "Corner logo, pinned throughout.",
    html: `<img class="clip" src="/logo.png"
  data-start="0" data-duration="10" data-track-index="3"
  style="position:absolute;top:40px;right:40px;width:120px;opacity:0.8" />`,
  },
  {
    id: "overlay-vignette",
    name: "Vignette",
    category: "overlay",
    description: "Radial dark vignette for cinematic feel.",
    html: `<div class="clip" data-start="0" data-duration="10" data-track-index="4"
  style="position:absolute;inset:0;pointer-events:none;
         background:radial-gradient(ellipse at center,transparent 50%,rgba(0,0,0,0.7) 100%)"></div>`,
  },

  // Audio
  {
    id: "audio-bgm",
    name: "Background music",
    category: "audio",
    description: "Looping background music track.",
    html: `<audio src="https://example.com/music.mp3"
  data-start="0" data-duration="10" data-track-index="5" data-volume="0.3"></audio>`,
  },
  {
    id: "audio-voiceover",
    name: "Voiceover",
    category: "audio",
    description: "TTS-generated voiceover (hyperframes supports TTS blocks).",
    html: `<audio src="https://example.com/voiceover.mp3"
  data-start="0.5" data-duration="8" data-track-index="6" data-volume="1"></audio>`,
  },

  // Animations
  {
    id: "anim-fade-in",
    name: "Fade in",
    category: "animation",
    description: "Element fades in on start.",
    html: `tl.from("#el", { opacity: 0, duration: 0.8 }, 0);`,
  },
  {
    id: "anim-slide-up",
    name: "Slide up",
    category: "animation",
    description: "Element rises from below.",
    html: `tl.from("#el", { y: 100, opacity: 0, duration: 0.8, ease: "power2.out" }, 0);`,
  },
  {
    id: "anim-stagger-words",
    name: "Word stagger",
    category: "animation",
    description: "Staggered per-word entrance.",
    html: `tl.from(".word", { opacity: 0, y: 20, duration: 0.4, stagger: 0.08 }, 0.2);`,
  },
  {
    id: "anim-pulse",
    name: "Pulse",
    category: "animation",
    description: "Attention-grabbing pulse.",
    html: `tl.to("#cta", { scale: 1.1, duration: 0.4, yoyo: true, repeat: 3 }, 2);`,
  },
  {
    id: "anim-ken-burns",
    name: "Ken Burns",
    category: "animation",
    description: "Slow pan-and-zoom over an image.",
    html: `tl.fromTo("#bg", { scale: 1.0, x: 0 }, { scale: 1.15, x: -60, duration: 8, ease: "none" }, 0);`,
  },

  // Captions
  {
    id: "caption-word",
    name: "Auto captions",
    category: "caption",
    description: "Word-by-word timed captions (hyperframes TTS pipeline).",
    html: `<div id="captions" class="clip" data-start="0" data-duration="10" data-track-index="7"
  style="position:absolute;bottom:160px;left:50%;transform:translateX(-50%);
         color:#fff;font-size:48px;font-weight:700;text-shadow:0 2px 8px #000">
  <span class="word">Hello</span> <span class="word">world</span>
</div>`,
  },

  // Shapes
  {
    id: "shape-progress-bar",
    name: "Progress bar",
    category: "shape",
    description: "Animated progress bar at the bottom.",
    html: `<div id="progress" class="clip"
  data-start="0" data-duration="10" data-track-index="8"
  style="position:absolute;bottom:0;left:0;height:8px;width:0%;background:#3b82f6"></div>
<!-- animate: -->
tl.to("#progress", { width: "100%", duration: 10, ease: "none" }, 0);`,
  },
  {
    id: "shape-circle-reveal",
    name: "Circle reveal",
    category: "shape",
    description: "Clip-path circle expands to reveal next scene.",
    html: `<div class="clip" data-start="0" data-duration="1.5" data-track-index="9"
  style="position:absolute;inset:0;background:#fff;clip-path:circle(0% at 50% 50%)"></div>
tl.to(".clip[data-track-index='9']", { clipPath: "circle(75% at 50% 50%)", duration: 1, ease: "power2.inOut" }, 0);`,
  },
];

// GET /api/video/composer/presets
export async function GET() {
  return NextResponse.json({ presets: PRESETS, count: PRESETS.length });
}
