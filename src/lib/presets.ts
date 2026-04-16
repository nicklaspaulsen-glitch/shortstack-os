/* ─── Video Editor Presets ────────────────────────────────────── */

export interface VideoPreset {
  id: string;
  name: string;
  category: string;
  desc: string;
  config: {
    type: string;
    style: string;
    duration: number;
    aspect_ratio: string;
    music_mood: string;
    caption_style: string;
    include_voiceover: boolean;
    include_cta: boolean;
    target_platform: string;
    script?: string;
    title?: string;
  };
}

export const VIDEO_PRESET_CATEGORIES = [
  { id: "hooks", name: "Hooks & Openers", icon: "Zap" },
  { id: "content", name: "Content Formats", icon: "Film" },
  { id: "captions", name: "Caption Styles", icon: "Type" },
  { id: "effects", name: "Effects & Transitions", icon: "Sparkles" },
  { id: "ads", name: "Ad Templates", icon: "Target" },
  { id: "social", name: "Social Media", icon: "Globe" },
  { id: "agency", name: "Agency / Client", icon: "Briefcase" },
];

export const VIDEO_PRESETS: VideoPreset[] = [
  // ── Hooks & Openers ──
  { id: "vh-1", name: "Controversy Hook", category: "hooks", desc: "Bold statement that creates engagement", config: { type: "reel", style: "bold-gradient", duration: 15, aspect_ratio: "9:16", music_mood: "dramatic", caption_style: "word_highlight", include_voiceover: true, include_cta: false, target_platform: "instagram", title: "Controversial Opinion" } },
  { id: "vh-2", name: "Question Hook", category: "hooks", desc: "Start with a compelling question", config: { type: "reel", style: "modern-dark", duration: 15, aspect_ratio: "9:16", music_mood: "upbeat", caption_style: "centered_bold", include_voiceover: true, include_cta: false, target_platform: "tiktok", title: "Did You Know?" } },
  { id: "vh-3", name: "Stat Shock", category: "hooks", desc: "Lead with a surprising statistic", config: { type: "reel", style: "neon", duration: 15, aspect_ratio: "9:16", music_mood: "dramatic", caption_style: "karaoke", include_voiceover: true, include_cta: false, target_platform: "instagram", title: "Mind-Blowing Stat" } },
  { id: "vh-4", name: "Before/After Reveal", category: "hooks", desc: "Transformation reveal hook", config: { type: "reel", style: "cinematic", duration: 20, aspect_ratio: "9:16", music_mood: "motivational", caption_style: "bottom_bar", include_voiceover: false, include_cta: false, target_platform: "instagram", title: "Before & After" } },
  { id: "vh-5", name: "Story Time", category: "hooks", desc: "Personal story opening", config: { type: "reel", style: "clean-white", duration: 30, aspect_ratio: "9:16", music_mood: "emotional", caption_style: "word_highlight", include_voiceover: true, include_cta: false, target_platform: "tiktok", title: "Story Time" } },

  // ── Content Formats ──
  { id: "vc-1", name: "Listicle (5 Tips)", category: "content", desc: "Quick tips with numbered slides", config: { type: "reel", style: "modern-dark", duration: 30, aspect_ratio: "9:16", music_mood: "upbeat", caption_style: "word_highlight", include_voiceover: true, include_cta: true, target_platform: "instagram", script: "Hook: 5 [topic] tips you need to know. Tip 1: ... Tip 2: ... Tip 3: ... Tip 4: ... Tip 5: ... CTA: Follow for more." } },
  { id: "vc-2", name: "Tutorial / How-To", category: "content", desc: "Step-by-step walkthrough", config: { type: "explainer", style: "clean-white", duration: 60, aspect_ratio: "16:9", music_mood: "chill", caption_style: "bottom_bar", include_voiceover: true, include_cta: true, target_platform: "youtube" } },
  { id: "vc-3", name: "Client Testimonial", category: "content", desc: "Happy client success story", config: { type: "testimonial", style: "cinematic", duration: 30, aspect_ratio: "1:1", music_mood: "emotional", caption_style: "word_highlight", include_voiceover: false, include_cta: true, target_platform: "instagram" } },
  { id: "vc-4", name: "Day in the Life", category: "content", desc: "Behind the scenes vlog", config: { type: "reel", style: "retro", duration: 60, aspect_ratio: "9:16", music_mood: "chill", caption_style: "karaoke", include_voiceover: true, include_cta: false, target_platform: "tiktok" } },
  { id: "vc-5", name: "Product Demo", category: "content", desc: "Feature showcase with CTA", config: { type: "product_demo", style: "modern-dark", duration: 45, aspect_ratio: "16:9", music_mood: "corporate", caption_style: "bottom_bar", include_voiceover: true, include_cta: true, target_platform: "youtube" } },
  { id: "vc-6", name: "Comparison / VS", category: "content", desc: "Side-by-side comparison", config: { type: "reel", style: "bold-gradient", duration: 30, aspect_ratio: "9:16", music_mood: "trendy", caption_style: "centered_bold", include_voiceover: true, include_cta: false, target_platform: "tiktok" } },
  { id: "vc-7", name: "FAQ Answer", category: "content", desc: "Answer a common question", config: { type: "reel", style: "clean-white", duration: 20, aspect_ratio: "9:16", music_mood: "upbeat", caption_style: "word_highlight", include_voiceover: true, include_cta: true, target_platform: "instagram" } },
  { id: "vc-8", name: "Motivational / Quote", category: "content", desc: "Inspiring quote overlay", config: { type: "story", style: "cinematic", duration: 15, aspect_ratio: "9:16", music_mood: "motivational", caption_style: "centered_bold", include_voiceover: false, include_cta: false, target_platform: "instagram" } },
  { id: "vc-9", name: "Carousel Video", category: "content", desc: "Multi-slide educational", config: { type: "carousel_video", style: "minimal", duration: 60, aspect_ratio: "1:1", music_mood: "chill", caption_style: "bottom_bar", include_voiceover: true, include_cta: true, target_platform: "instagram" } },
  { id: "vc-10", name: "Podcast Clip", category: "content", desc: "Audiogram with waveform", config: { type: "reel", style: "modern-dark", duration: 30, aspect_ratio: "9:16", music_mood: "none", caption_style: "karaoke", include_voiceover: false, include_cta: true, target_platform: "instagram" } },

  // ── Caption Styles ──
  { id: "vcap-1", name: "TikTok Viral Captions", category: "captions", desc: "Word-by-word highlight, large text", config: { type: "reel", style: "modern-dark", duration: 30, aspect_ratio: "9:16", music_mood: "trendy", caption_style: "karaoke", include_voiceover: true, include_cta: false, target_platform: "tiktok" } },
  { id: "vcap-2", name: "Clean Subtitles", category: "captions", desc: "Professional bottom bar", config: { type: "youtube", style: "clean-white", duration: 60, aspect_ratio: "16:9", music_mood: "corporate", caption_style: "bottom_bar", include_voiceover: true, include_cta: false, target_platform: "youtube" } },
  { id: "vcap-3", name: "Bold Center Text", category: "captions", desc: "Centered large captions", config: { type: "reel", style: "bold-gradient", duration: 30, aspect_ratio: "9:16", music_mood: "upbeat", caption_style: "centered_bold", include_voiceover: true, include_cta: false, target_platform: "instagram" } },
  { id: "vcap-4", name: "No Captions (Cinematic)", category: "captions", desc: "Visual-only, no text", config: { type: "reel", style: "cinematic", duration: 30, aspect_ratio: "9:16", music_mood: "dramatic", caption_style: "none", include_voiceover: false, include_cta: false, target_platform: "instagram" } },

  // ── Effects & Transitions ──
  { id: "ve-1", name: "Zoom-In Energy", category: "effects", desc: "Quick zooms with beat sync", config: { type: "reel", style: "bold-gradient", duration: 15, aspect_ratio: "9:16", music_mood: "trendy", caption_style: "word_highlight", include_voiceover: false, include_cta: false, target_platform: "tiktok" } },
  { id: "ve-2", name: "Smooth Pan Reveal", category: "effects", desc: "Slow horizontal pan reveals", config: { type: "reel", style: "cinematic", duration: 30, aspect_ratio: "9:16", music_mood: "chill", caption_style: "none", include_voiceover: false, include_cta: false, target_platform: "instagram" } },
  { id: "ve-3", name: "Glitch / Distortion", category: "effects", desc: "Glitch transitions with neon", config: { type: "reel", style: "neon", duration: 15, aspect_ratio: "9:16", music_mood: "dramatic", caption_style: "karaoke", include_voiceover: false, include_cta: false, target_platform: "tiktok" } },
  { id: "ve-4", name: "Parallax Depth", category: "effects", desc: "3D depth effect on photos", config: { type: "reel", style: "modern-dark", duration: 20, aspect_ratio: "9:16", music_mood: "motivational", caption_style: "centered_bold", include_voiceover: false, include_cta: false, target_platform: "instagram" } },
  { id: "ve-5", name: "Typewriter Text", category: "effects", desc: "Text appears letter by letter", config: { type: "story", style: "minimal", duration: 15, aspect_ratio: "9:16", music_mood: "chill", caption_style: "none", include_voiceover: false, include_cta: false, target_platform: "instagram" } },
  { id: "ve-6", name: "Split Screen Compare", category: "effects", desc: "Side-by-side split comparison", config: { type: "reel", style: "clean-white", duration: 20, aspect_ratio: "9:16", music_mood: "upbeat", caption_style: "bottom_bar", include_voiceover: true, include_cta: false, target_platform: "instagram" } },
  { id: "ve-7", name: "Rough Cut / Jump Cuts", category: "effects", desc: "Fast cuts, high energy", config: { type: "reel", style: "bold-gradient", duration: 15, aspect_ratio: "9:16", music_mood: "trendy", caption_style: "word_highlight", include_voiceover: true, include_cta: false, target_platform: "tiktok" } },

  // ── Ad Templates ──
  { id: "va-1", name: "AIDA Ad", category: "ads", desc: "Attention-Interest-Desire-Action", config: { type: "ad", style: "bold-gradient", duration: 15, aspect_ratio: "1:1", music_mood: "motivational", caption_style: "word_highlight", include_voiceover: true, include_cta: true, target_platform: "facebook" } },
  { id: "va-2", name: "Problem-Solution Ad", category: "ads", desc: "Show pain point, offer fix", config: { type: "ad", style: "modern-dark", duration: 15, aspect_ratio: "1:1", music_mood: "dramatic", caption_style: "centered_bold", include_voiceover: true, include_cta: true, target_platform: "instagram" } },
  { id: "va-3", name: "Social Proof Ad", category: "ads", desc: "Testimonials + numbers", config: { type: "ad", style: "clean-white", duration: 15, aspect_ratio: "1:1", music_mood: "corporate", caption_style: "bottom_bar", include_voiceover: false, include_cta: true, target_platform: "facebook" } },
  { id: "va-4", name: "UGC-Style Ad", category: "ads", desc: "Authentic user content feel", config: { type: "ad", style: "retro", duration: 15, aspect_ratio: "9:16", music_mood: "trendy", caption_style: "karaoke", include_voiceover: false, include_cta: true, target_platform: "tiktok" } },

  // ── Social Media ──
  { id: "vs-1", name: "Instagram Story", category: "social", desc: "Quick 15s story template", config: { type: "story", style: "neon", duration: 15, aspect_ratio: "9:16", music_mood: "trendy", caption_style: "centered_bold", include_voiceover: false, include_cta: true, target_platform: "instagram" } },
  { id: "vs-2", name: "TikTok Trend", category: "social", desc: "Trending TikTok format", config: { type: "reel", style: "retro", duration: 30, aspect_ratio: "9:16", music_mood: "trendy", caption_style: "karaoke", include_voiceover: false, include_cta: false, target_platform: "tiktok" } },
  { id: "vs-3", name: "YouTube Short", category: "social", desc: "YouTube Shorts optimized", config: { type: "reel", style: "modern-dark", duration: 60, aspect_ratio: "9:16", music_mood: "upbeat", caption_style: "word_highlight", include_voiceover: true, include_cta: true, target_platform: "youtube" } },
  { id: "vs-4", name: "LinkedIn Pro", category: "social", desc: "Professional LinkedIn video", config: { type: "youtube", style: "corporate", duration: 60, aspect_ratio: "16:9", music_mood: "corporate", caption_style: "bottom_bar", include_voiceover: true, include_cta: true, target_platform: "linkedin" } },

  // ── Agency / Client ──
  { id: "vag-1", name: "Monthly Recap", category: "agency", desc: "Client monthly results summary", config: { type: "youtube", style: "modern-dark", duration: 60, aspect_ratio: "16:9", music_mood: "corporate", caption_style: "bottom_bar", include_voiceover: true, include_cta: true, target_platform: "youtube" } },
  { id: "vag-2", name: "Case Study", category: "agency", desc: "Detailed client success story", config: { type: "explainer", style: "clean-white", duration: 90, aspect_ratio: "16:9", music_mood: "motivational", caption_style: "bottom_bar", include_voiceover: true, include_cta: true, target_platform: "youtube" } },
  { id: "vag-3", name: "Onboarding Video", category: "agency", desc: "Welcome new clients", config: { type: "explainer", style: "corporate", duration: 60, aspect_ratio: "16:9", music_mood: "corporate", caption_style: "bottom_bar", include_voiceover: true, include_cta: false, target_platform: "youtube" } },
  { id: "vag-4", name: "Service Highlight", category: "agency", desc: "Showcase a specific service", config: { type: "product_demo", style: "bold-gradient", duration: 30, aspect_ratio: "1:1", music_mood: "upbeat", caption_style: "centered_bold", include_voiceover: true, include_cta: true, target_platform: "instagram" } },
];


/* ─── Thumbnail Presets ──────────────────────────────────────── */

export interface ThumbnailPreset {
  id: string;
  name: string;
  category: string;
  desc: string;
  config: {
    style: string;
    aspect_ratio: string;
    text_overlay: string;
    face_expression: string;
    background: string;
    color_scheme: string;
    description?: string;
  };
}

export const THUMBNAIL_PRESET_CATEGORIES = [
  { id: "youtube", name: "YouTube", icon: "Monitor" },
  { id: "social", name: "Social Media", icon: "Globe" },
  { id: "podcast", name: "Podcast", icon: "Mic" },
  { id: "education", name: "Education", icon: "BookOpen" },
  { id: "business", name: "Business", icon: "Briefcase" },
  { id: "personal", name: "Personal Brand", icon: "User" },
];

export const THUMBNAIL_PRESETS: ThumbnailPreset[] = [
  // ── YouTube ──
  { id: "th-1", name: "Shocked Face Reaction", category: "youtube", desc: "Big face, bold text, bright colors", config: { style: "youtube_bold", aspect_ratio: "16:9", text_overlay: "YOU WON'T BELIEVE THIS", face_expression: "shocked", background: "gradient", color_scheme: "red-yellow" } },
  { id: "th-2", name: "Tutorial / How-To", category: "youtube", desc: "Clean with step numbers", config: { style: "youtube_clean", aspect_ratio: "16:9", text_overlay: "How To [Topic]", face_expression: "professional", background: "solid_dark", color_scheme: "blue-white" } },
  { id: "th-3", name: "Before / After Split", category: "youtube", desc: "Split screen transformation", config: { style: "split_screen", aspect_ratio: "16:9", text_overlay: "BEFORE → AFTER", face_expression: "none", background: "split", color_scheme: "red-green" } },
  { id: "th-4", name: "Listicle Number", category: "youtube", desc: "Large number with topic", config: { style: "youtube_bold", aspect_ratio: "16:9", text_overlay: "TOP 10", face_expression: "excited", background: "gradient", color_scheme: "gold-black" } },
  { id: "th-5", name: "Drama / Story", category: "youtube", desc: "Dramatic lighting, suspense", config: { style: "cinematic", aspect_ratio: "16:9", text_overlay: "The Truth About...", face_expression: "serious", background: "dark_moody", color_scheme: "dark-red" } },
  { id: "th-6", name: "Review / Comparison", category: "youtube", desc: "Product images with rating", config: { style: "youtube_clean", aspect_ratio: "16:9", text_overlay: "HONEST REVIEW", face_expression: "thinking", background: "gradient", color_scheme: "green-white" } },

  // ── Social Media ──
  { id: "th-7", name: "Instagram Carousel Cover", category: "social", desc: "Eye-catching first slide", config: { style: "modern_clean", aspect_ratio: "1:1", text_overlay: "Swipe →", face_expression: "none", background: "gradient", color_scheme: "pastel" } },
  { id: "th-8", name: "TikTok Cover", category: "social", desc: "Vertical attention grabber", config: { style: "bold_text", aspect_ratio: "9:16", text_overlay: "WATCH THIS", face_expression: "excited", background: "neon", color_scheme: "neon-pink" } },
  { id: "th-9", name: "LinkedIn Post Image", category: "social", desc: "Professional thought leadership", config: { style: "corporate", aspect_ratio: "1.91:1", text_overlay: "Key Insight", face_expression: "professional", background: "solid_dark", color_scheme: "blue-white" } },
  { id: "th-10", name: "Twitter / X Header", category: "social", desc: "Punchy quote card", config: { style: "minimal", aspect_ratio: "16:9", text_overlay: "Hot Take:", face_expression: "none", background: "solid_dark", color_scheme: "white-dark" } },

  // ── Podcast ──
  { id: "th-11", name: "Episode Cover", category: "podcast", desc: "Guest photo + episode number", config: { style: "podcast_cover", aspect_ratio: "1:1", text_overlay: "EP. 42", face_expression: "professional", background: "solid_dark", color_scheme: "gold-black" } },
  { id: "th-12", name: "Audiogram Thumbnail", category: "podcast", desc: "Quote card with waveform", config: { style: "podcast_quote", aspect_ratio: "1:1", text_overlay: "Best quote here", face_expression: "none", background: "gradient", color_scheme: "purple-dark" } },

  // ── Education ──
  { id: "th-13", name: "Course Lesson", category: "education", desc: "Clean lesson number + topic", config: { style: "modern_clean", aspect_ratio: "16:9", text_overlay: "Lesson 1: Intro", face_expression: "professional", background: "solid_dark", color_scheme: "blue-white" } },
  { id: "th-14", name: "Infographic Style", category: "education", desc: "Data-driven visual", config: { style: "infographic", aspect_ratio: "1:1", text_overlay: "Did You Know?", face_expression: "none", background: "gradient", color_scheme: "teal-white" } },
  { id: "th-15", name: "Whiteboard Explainer", category: "education", desc: "Hand-drawn whiteboard look", config: { style: "whiteboard", aspect_ratio: "16:9", text_overlay: "Explained Simply", face_expression: "none", background: "white", color_scheme: "black-red" } },

  // ── Business ──
  { id: "th-16", name: "Client Result", category: "business", desc: "Revenue/metrics showcase", config: { style: "corporate", aspect_ratio: "16:9", text_overlay: "+300% Revenue", face_expression: "professional", background: "gradient", color_scheme: "green-dark" } },
  { id: "th-17", name: "Service Offering", category: "business", desc: "Clean service description", config: { style: "modern_clean", aspect_ratio: "16:9", text_overlay: "Our Services", face_expression: "none", background: "solid_dark", color_scheme: "gold-black" } },
  { id: "th-18", name: "Team / About Us", category: "business", desc: "Team photo professional", config: { style: "corporate", aspect_ratio: "16:9", text_overlay: "Meet The Team", face_expression: "professional", background: "solid_light", color_scheme: "blue-white" } },

  // ── Personal Brand ──
  { id: "th-19", name: "Quote Card", category: "personal", desc: "Personal quote with headshot", config: { style: "minimal", aspect_ratio: "1:1", text_overlay: "Your quote here", face_expression: "confident", background: "solid_dark", color_scheme: "white-dark" } },
  { id: "th-20", name: "Challenge / Dare", category: "personal", desc: "Bold challenge thumbnail", config: { style: "bold_text", aspect_ratio: "16:9", text_overlay: "I TRIED [X] FOR 30 DAYS", face_expression: "shocked", background: "neon", color_scheme: "neon-green" } },
  { id: "th-21", name: "Lifestyle / Aesthetic", category: "personal", desc: "Curated aesthetic vibe", config: { style: "aesthetic", aspect_ratio: "1:1", text_overlay: "", face_expression: "none", background: "gradient", color_scheme: "pastel" } },

  // ── YouTube (Extended) ──
  { id: "th-22", name: "YouTube Classic Bold", category: "youtube", desc: "Big bold text top + face cutout + colorful bg", config: { style: "youtube_bold", aspect_ratio: "16:9", text_overlay: "THIS CHANGES EVERYTHING", face_expression: "shocked", background: "colorful_burst", color_scheme: "red-yellow", description: "YouTube classic style: huge bold text at the top, face cutout on the right, colorful radial gradient background with energy lines" } },
  { id: "th-23", name: "Before/After Arrow", category: "youtube", desc: "Split screen with arrow divider", config: { style: "split_screen", aspect_ratio: "16:9", text_overlay: "BEFORE → AFTER", face_expression: "none", background: "split_diagonal", color_scheme: "gray-gold", description: "Before/After split with bold arrow in center, left side muted/gray, right side vibrant, transformation text overlay" } },
  { id: "th-24", name: "Listicle Number Circle", category: "youtube", desc: "Numbered circle badge + topic image", config: { style: "youtube_bold", aspect_ratio: "16:9", text_overlay: "TOP 10 MISTAKES", face_expression: "pointing", background: "gradient", color_scheme: "orange-dark", description: "Large circled number badge, bold topic text, relevant image grid behind, high contrast" } },
  { id: "th-25", name: "Reaction Emoji Overlay", category: "youtube", desc: "Surprised face + emoji overlays + bold text", config: { style: "youtube_bold", aspect_ratio: "16:9", text_overlay: "NO WAY!", face_expression: "shocked", background: "neon", color_scheme: "neon-pink", description: "Extreme reaction face enlarged, floating emoji reactions around frame, bold capitalized text, saturated colors" } },
  { id: "th-26", name: "Tutorial Arrow Pointer", category: "youtube", desc: "Step text + device mockup + arrow pointers", config: { style: "youtube_clean", aspect_ratio: "16:9", text_overlay: "COMPLETE GUIDE", face_expression: "professional", background: "solid_dark", color_scheme: "blue-white", description: "Device mockup centered, red arrow pointers highlighting key areas, numbered step badges, clean instructional layout" } },
  { id: "th-27", name: "VS Comparison", category: "youtube", desc: "Two items side by side with VS badge", config: { style: "split_screen", aspect_ratio: "16:9", text_overlay: "VS", face_expression: "none", background: "split", color_scheme: "red-blue", description: "Two competing items side by side, large VS badge in center with lightning bolt, each side has its own color accent" } },
  { id: "th-28", name: "News Breaking Banner", category: "youtube", desc: "Red banner BREAKING + headline + image", config: { style: "news_style", aspect_ratio: "16:9", text_overlay: "BREAKING NEWS", face_expression: "serious", background: "dark_moody", color_scheme: "dark-red", description: "Red breaking news banner at top, large headline text below, reporter-style face, urgent dark background with red accents" } },
  { id: "th-29", name: "Minimalist Clean", category: "youtube", desc: "White bg, centered bold text, small accent", config: { style: "minimal", aspect_ratio: "16:9", text_overlay: "One Simple Rule", face_expression: "none", background: "solid_light", color_scheme: "black-accent", description: "Clean white background, single bold centered text, thin accent line or small color pop, lots of white space" } },
  { id: "th-30", name: "Dark Luxury Gold", category: "youtube", desc: "Black bg, gold text, subtle gradient glow", config: { style: "luxury", aspect_ratio: "16:9", text_overlay: "EXCLUSIVE", face_expression: "confident", background: "dark_premium", color_scheme: "gold-black", description: "Premium black background, gold metallic text, subtle radial gradient glow, elegant serif font feel, luxury branding" } },
  { id: "th-31", name: "Challenge Accepted", category: "youtube", desc: "Bold dare text with timer element", config: { style: "youtube_bold", aspect_ratio: "16:9", text_overlay: "24 HOUR CHALLENGE", face_expression: "excited", background: "gradient", color_scheme: "red-yellow", description: "Clock/timer graphic, bold dare text, energetic person, bright saturated colors with energy burst lines" } },
  { id: "th-32", name: "Unboxing / Reveal", category: "youtube", desc: "Mystery box with glow reveal effect", config: { style: "cinematic", aspect_ratio: "16:9", text_overlay: "UNBOXING", face_expression: "excited", background: "dark_moody", color_scheme: "purple-gold", description: "Dramatic lighting on package/box, golden glow emanating, excited face reaction, dark cinematic background" } },
  { id: "th-33", name: "Ranking Tier List", category: "youtube", desc: "Tier list grid layout S-F ranking", config: { style: "youtube_bold", aspect_ratio: "16:9", text_overlay: "TIER LIST", face_expression: "thinking", background: "gradient", color_scheme: "multi-color", description: "Color-coded tier rows (S/A/B/C/F), items in grid, bold tier labels, opinionated face on side" } },
  { id: "th-34", name: "Money / Revenue Shot", category: "youtube", desc: "Cash imagery with revenue numbers", config: { style: "youtube_bold", aspect_ratio: "16:9", text_overlay: "$10,000/Month", face_expression: "excited", background: "gradient", color_scheme: "green-dark", description: "Dollar signs and cash imagery, large revenue number, green money theme, growth chart element" } },
  { id: "th-35", name: "Exposed / Debunk", category: "youtube", desc: "Red X marks with investigative look", config: { style: "youtube_bold", aspect_ratio: "16:9", text_overlay: "EXPOSED", face_expression: "serious", background: "dark_moody", color_scheme: "dark-red", description: "Red X marks, investigative magnifying glass, dark suspicious background, bold accusatory text" } },

  // ── Social Media (Extended) ──
  { id: "th-36", name: "Instagram Reel Cover", category: "social", desc: "Vertical bold thumbnail for Reels", config: { style: "bold_text", aspect_ratio: "9:16", text_overlay: "MUST WATCH", face_expression: "excited", background: "gradient", color_scheme: "purple-pink", description: "Vertical format reel cover, large text hook, bright gradient, face peek at bottom" } },
  { id: "th-37", name: "Pinterest Infographic", category: "social", desc: "Tall pin with numbered tips", config: { style: "modern_clean", aspect_ratio: "2:3", text_overlay: "7 Tips You Need", face_expression: "none", background: "solid_light", color_scheme: "pastel", description: "Tall Pinterest pin format, numbered tips with icons, clean font, soft color palette" } },
  { id: "th-38", name: "Facebook Event Cover", category: "social", desc: "Event promotion with date and details", config: { style: "modern_clean", aspect_ratio: "16:9", text_overlay: "JOIN US LIVE", face_expression: "none", background: "gradient", color_scheme: "blue-purple", description: "Event date prominently displayed, venue/details, gradient background, clean typography" } },

  // ── Podcast (Extended) ──
  { id: "th-39", name: "Podcast Guest Spotlight", category: "podcast", desc: "Dual headshots with guest name banner", config: { style: "podcast_cover", aspect_ratio: "1:1", text_overlay: "Special Guest", face_expression: "professional", background: "solid_dark", color_scheme: "gold-black", description: "Two headshots side by side, guest name banner, episode number, microphone icon accent" } },

  // ── Education (Extended) ──
  { id: "th-40", name: "Study Guide Cover", category: "education", desc: "Textbook-style study topic cover", config: { style: "modern_clean", aspect_ratio: "16:9", text_overlay: "Complete Study Guide", face_expression: "none", background: "gradient", color_scheme: "teal-white", description: "Academic style cover with subject title, chapter markers, clean organized layout" } },

  // ── Business (Extended) ──
  { id: "th-41", name: "Webinar Announcement", category: "business", desc: "Professional webinar promotional thumbnail", config: { style: "corporate", aspect_ratio: "16:9", text_overlay: "FREE WEBINAR", face_expression: "professional", background: "gradient", color_scheme: "blue-white", description: "Speaker headshot, webinar title, date/time, professional corporate gradient, registration CTA" } },
  { id: "th-42", name: "Case Study Results", category: "business", desc: "Before/after metrics with charts", config: { style: "corporate", aspect_ratio: "16:9", text_overlay: "Case Study", face_expression: "none", background: "solid_dark", color_scheme: "green-dark", description: "Before/after metrics, upward charts, bold percentage improvements, professional dark theme" } },

  // ── Personal Brand (Extended) ──
  { id: "th-43", name: "Quote Card Gradient", category: "personal", desc: "Centered quote + author + gradient bg", config: { style: "quote_card", aspect_ratio: "1:1", text_overlay: "Your best quote here", face_expression: "none", background: "gradient", color_scheme: "indigo-violet", description: "Large quotation marks, centered quote text, author name below, beautiful gradient background, elegant typography" } },
  { id: "th-44", name: "Day in My Life", category: "personal", desc: "Photo collage vlog style", config: { style: "aesthetic", aspect_ratio: "16:9", text_overlay: "A Day In My Life", face_expression: "happy", background: "warm_filter", color_scheme: "warm-earth", description: "Warm filtered photo collage, casual lifestyle vibe, handwritten-style text, soft warm tones" } },
  { id: "th-45", name: "Hot Take / Rant", category: "personal", desc: "Bold opinion with fire accents", config: { style: "bold_text", aspect_ratio: "16:9", text_overlay: "UNPOPULAR OPINION", face_expression: "serious", background: "dark_moody", color_scheme: "orange-dark", description: "Dark dramatic background, bold opinion text, fire/flame accents, intense face expression, high contrast" } },
];
