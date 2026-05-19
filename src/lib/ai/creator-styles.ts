/**
 * Creator DNA Registry — 12 viral creator archetypes with style fingerprints.
 *
 * These are style ARCHETYPES derived from research into what makes content
 * perform on each platform. Not person-specific; they represent proven
 * formulas used across thousands of top-performing creators.
 *
 * Each archetype carries:
 *   - thumbnail DNA (composition, color, text style)
 *   - hook formulas (proven templates with {{topic}} placeholder)
 *   - tone keywords (for LLM style injection)
 *   - platform-specific CTR ranges
 *   - prompt hints per page context
 */

export type Platform = "youtube" | "tiktok" | "instagram" | "twitter" | "linkedin";

export type PageContext =
  | "ai-video"
  | "thumbnail"
  | "script"
  | "social"
  | "carousel"
  | "copy";

export interface CreatorStyle {
  id: string;
  name: string;
  emoji: string;
  tagline: string;
  platforms: Platform[];
  primaryColor: string;
  accentColor: string;
  /** Human-readable thumbnail composition brief */
  thumbnailDNA: string;
  /**
   * 3 proven hook formulas. Use {{topic}} as the subject placeholder.
   * LLM substitutes real topic when generating ideas.
   */
  hookFormulas: string[];
  /** Tone descriptor injected into LLM system prompt */
  tone: string;
  /** Pacing guidance for video / script pages */
  pacing: "slow" | "medium" | "fast" | "viral-fast";
  /** Best-fit content formats for this archetype */
  contentFormats: string[];
  /** Core ingredients that make this style perform */
  viralIngredients: string[];
  /** CTR benchmark from platform research */
  ctrRange: string;
  /**
   * Context-specific prompt injection: when the user picks this creator style
   * in a given page context, this hint is appended to the LLM system prompt.
   */
  promptHints: Partial<Record<PageContext, string>>;
}

export const CREATOR_STYLES: CreatorStyle[] = [
  {
    id: "challenger",
    name: "The Challenger",
    emoji: "🏆",
    tagline: "Epic scale, impossible odds, massive wins",
    platforms: ["youtube", "tiktok"],
    primaryColor: "#DC2626",
    accentColor: "#FBBF24",
    thumbnailDNA:
      "Shocked/surprised face close-up + giant yellow/white 900-weight text + red arrow pointing at subject + extreme or unexpected scene element",
    hookFormulas: [
      "I {{topic}} for 24 hours straight and this happened",
      "Last person to stop {{topic}} wins $10,000",
      "I gave {{topic}} to 100 strangers — their reactions were insane",
    ],
    tone: "energetic, hyperbolic, inclusive, fast-paced, shock-and-awe",
    pacing: "viral-fast",
    contentFormats: ["challenge", "social experiment", "reaction", "giveaway"],
    viralIngredients: [
      "massive financial stakes or prizes",
      "impossible or forbidden premise",
      "emotional payoff for participants",
      "fast cut + punchy music",
      "multiple sub-stories inside one video",
    ],
    ctrRange: "9–12%",
    promptHints: {
      "ai-video":
        "Generate a high-energy, fast-paced video concept. Start with a shocking premise in the first 3 seconds. Use extreme superlatives. Include a clear prize or challenge outcome.",
      thumbnail:
        "Design concept: shocked face at left, enormous yellow text at right, red accent shape pointing at the surprising element. High contrast, no subtlety.",
      script:
        "Open with the challenge/stakes immediately. Cut between multiple sub-stories. End with emotional payoff. Every 45 seconds must have a new hook to retain viewers.",
      social:
        "Caption: bold claim + curiosity gap + CTA. No long setup. Lead with the result.",
    },
  },
  {
    id: "tech-minimalist",
    name: "Tech Minimalist",
    emoji: "⚡",
    tagline: "Clean reviews, cinematic shots, honest takes",
    platforms: ["youtube", "instagram"],
    primaryColor: "#18181B",
    accentColor: "#71717A",
    thumbnailDNA:
      "Product centered on pure gradient or dark background + 1–2 word bold text + perfect studio lighting + no clutter",
    hookFormulas: [
      "This is the best {{topic}} ever made — and here's why",
      "{{topic}} after 6 months: my completely honest review",
      "Why {{topic}} is worth every penny (or isn't)",
    ],
    tone: "calm, authoritative, precise, confident, no-nonsense",
    pacing: "medium",
    contentFormats: ["review", "comparison", "tutorial", "unboxing"],
    viralIngredients: [
      "cinematic B-roll with satisfying sounds",
      "objective pros/cons structure",
      "honest criticism that builds trust",
      "premium aesthetic that validates the purchase decision",
      "data and benchmarks as proof",
    ],
    ctrRange: "6–8%",
    promptHints: {
      "ai-video":
        "Create a cinematic, product-focused video. Open with a sweeping shot. Narrate with calm authority. Use data/benchmarks. Structure: hook → context → details → verdict.",
      thumbnail:
        "Design concept: centered product on dark or gradient bg, one strong sentence in clean sans-serif, no emoji, no arrows. Let the product do the talking.",
      script:
        "Structure: hook claim → credentials/context → feature deep-dive → pros and cons → final verdict. Voice stays measured and confident throughout.",
      social:
        "Caption: 1-sentence verdict + key spec or data point. Clean, no hype. Let the photo carry the emotion.",
    },
  },
  {
    id: "science-explorer",
    name: "Science Explorer",
    emoji: "🔬",
    tagline: "Curiosity gaps, epic experiments, mind-blowing facts",
    platforms: ["youtube"],
    primaryColor: "#1D4ED8",
    accentColor: "#60A5FA",
    thumbnailDNA:
      "Experiment in progress + dramatic question mark or '?' text + scale comparison (tiny vs. huge) + blue/white color grading",
    hookFormulas: [
      "Why {{topic}} actually works (and everyone gets it wrong)",
      "I built the world's largest {{topic}} — here's what broke first",
      "The surprisingly simple engineering behind {{topic}}",
    ],
    tone: "curious, enthusiastic, educational, humble, wonder-driven",
    pacing: "medium",
    contentFormats: ["experiment", "explainer", "build", "myth-busting"],
    viralIngredients: [
      "curiosity gap in title + thumbnail",
      "tangible real-world experiment viewers can relate to",
      "unexpected result that flips the assumption",
      "clear step-by-step that makes complex simple",
      "emotional 'aha' moment near the end",
    ],
    ctrRange: "8–11%",
    promptHints: {
      "ai-video":
        "Open with the surprising result, then rewind to explain how we got there. Use concrete analogies. Explain one core mechanism per video. End with a call to curiosity.",
      thumbnail:
        "Design concept: the experiment mid-action, large bold question on right, cool blue tones. The image should prompt 'how is that possible?'",
      script:
        "Structure: reveal the result first → set up the question → build up the experiment → explain the mechanism → connect to everyday life → callback to the opening.",
      social:
        "Caption: state the counterintuitive fact + 'here's why' tease. No full explanation — create the itch.",
    },
  },
  {
    id: "raw-motivator",
    name: "Raw Motivator",
    emoji: "🔥",
    tagline: "No-BS hustle, confrontational truths, take action now",
    platforms: ["youtube", "tiktok", "instagram", "linkedin"],
    primaryColor: "#B45309",
    accentColor: "#F59E0B",
    thumbnailDNA:
      "Creator pointing directly at camera + aggressive white-on-dark bold text + orange/red fire accent",
    hookFormulas: [
      "Nobody is telling you the truth about {{topic}}",
      "Stop {{topic}}. Do this instead.",
      "The real reason you're failing at {{topic}} (and the fix)",
    ],
    tone: "raw, direct, confrontational, urgent, zero fluff",
    pacing: "fast",
    contentFormats: ["rant", "advice", "mindset", "day-in-life", "breakdown"],
    viralIngredients: [
      "direct challenge to common belief",
      "social proof through personal results",
      "uncomfortable truth that people know but avoid",
      "specific actionable step at the end",
      "repetition for emphasis",
    ],
    ctrRange: "7–9%",
    promptHints: {
      "ai-video":
        "Start with the confrontational truth in the first sentence. No warm-up. Use 'you' language throughout. Give one concrete action step. End with a challenge to the viewer.",
      thumbnail:
        "Design concept: intense face or bold text taking up 60% of frame. Orange/red palette. 4–6 word bold claim. No decoration.",
      script:
        "Open with the problem statement that challenges the viewer's current behavior. Three examples/proof points. One clear action step. Call to accountability.",
      social:
        "Caption: 2–3 short punchy sentences. Problem → truth → action. No hashtag spam. End with a direct question to the reader.",
    },
  },
  {
    id: "authentic-vlogger",
    name: "Authentic Vlogger",
    emoji: "📱",
    tagline: "Real life, no filter, relatable chaos",
    platforms: ["youtube", "tiktok", "instagram"],
    primaryColor: "#EC4899",
    accentColor: "#F9A8D4",
    thumbnailDNA:
      "Natural face photo or candid moment + lowercase or handwritten-style text + warm tones + intentional lo-fi aesthetic",
    hookFormulas: [
      "come with me to {{topic}} (things got weird)",
      "a day in my life: {{topic}} edition",
      "let's talk about {{topic}} (i've been avoiding this)",
    ],
    tone: "casual, authentic, conversational, warm, self-aware",
    pacing: "medium",
    contentFormats: ["vlog", "day-in-life", "haul", "q&a", "story-time"],
    viralIngredients: [
      "imperfect relatable moments that feel unscripted",
      "emotional vulnerability that builds parasocial connection",
      "fast jump cuts between scenes",
      "trending sounds or music bed",
      "direct-to-camera breaks that feel like conversation",
    ],
    ctrRange: "5–7%",
    promptHints: {
      "ai-video":
        "Start mid-scene, no intro. Conversational narration as if talking to a friend. Keep it personal and self-aware. Natural pauses and humor. Jump cuts between moments.",
      thumbnail:
        "Design concept: genuine expression, not posed. Warm or pastel tones. Lowercase text feels handwritten. Nothing feels produced.",
      script:
        "Open in the middle of an action or emotion. No scripted intro. First-person voice. Include a personal anecdote. End with a genuine reflection.",
      social:
        "Caption: lowercase, conversational. Write like a text to a friend. Include a genuine question at the end.",
    },
  },
  {
    id: "transformation",
    name: "Transformation Expert",
    emoji: "✨",
    tagline: "Before/after reveals, dramatic results, step-by-step journeys",
    platforms: ["youtube", "instagram", "tiktok"],
    primaryColor: "#7C3AED",
    accentColor: "#C4B5FD",
    thumbnailDNA:
      "Split before/after composition + large result text + bright high-contrast colors + progress visual arrow",
    hookFormulas: [
      "I tried {{topic}} every day for 30 days — shocking results",
      "BEFORE vs AFTER: {{topic}} transformation (honest review)",
      "Watch me completely transform {{topic}} in one video",
    ],
    tone: "inspiring, dramatic, empathetic, result-focused, aspirational",
    pacing: "fast",
    contentFormats: [
      "transformation",
      "challenge",
      "tutorial",
      "review",
      "journey",
    ],
    viralIngredients: [
      "dramatic visual before/after in thumbnail and video",
      "timeline progress keeps viewers watching",
      "relatable starting point (viewers see themselves in the 'before')",
      "specific results with numbers/dates",
      "reveal moment near the end",
    ],
    ctrRange: "6–9%",
    promptHints: {
      "ai-video":
        "Start with a quick reveal of the final result to hook viewers, then rewind. Build tension through the journey. Include specific metrics or dates. End with a full reveal.",
      thumbnail:
        "Design concept: true split-screen before/after. BEFORE in red/dull, AFTER in bright/vibrant. Large result text. Arrow between the two states.",
      script:
        "Structure: reveal ending → rewind to start → day-by-day or step-by-step progression → obstacles → final transformation moment → takeaways.",
      social:
        "Caption: lead with the result number or metric. Include the journey timeline. End with 'full story in the video.'",
    },
  },
  {
    id: "finance-authority",
    name: "Finance Authority",
    emoji: "💰",
    tagline: "Transparent numbers, actionable money advice, real receipts",
    platforms: ["youtube", "twitter", "linkedin"],
    primaryColor: "#065F46",
    accentColor: "#34D399",
    thumbnailDNA:
      "Dollar amount or percentage in massive text + creator face showing genuine surprise/confidence + green or dark wealth palette",
    hookFormulas: [
      "How I made ${{topic}} in one year (full breakdown)",
      "My exact {{topic}} portfolio: the good, the bad, the numbers",
      "{{topic}} mistake that cost me $50,000 (so you don't repeat it)",
    ],
    tone:
      "transparent, analytical, calm, authoritative, number-driven, trustworthy",
    pacing: "medium",
    contentFormats: ["breakdown", "case-study", "explainer", "strategy", "q&a"],
    viralIngredients: [
      "real numbers and screenshots as proof",
      "counterintuitive financial insight",
      "step-by-step framework viewers can apply immediately",
      "personal vulnerability (sharing failures/losses)",
      "clear ROI calculation",
    ],
    ctrRange: "6–8%",
    promptHints: {
      "ai-video":
        "Open with the specific number or result. No vague promises. Give the framework in the first 90 seconds. Include real data. Acknowledge risks honestly.",
      thumbnail:
        "Design concept: large dollar figure or percentage as the hero. Green or dark palette. Creator face optional but should show genuine confidence or curiosity. Keep text to the money metric.",
      script:
        "Structure: state the result/number → credentials/context → exact breakdown (step by step) → what went wrong → key insight → action plan for viewers.",
      social:
        "Caption: lead with the number. Short bullet breakdown. End with 'DM me [keyword] for the full breakdown.'",
    },
  },
  {
    id: "story-driven",
    name: "Story-Driven",
    emoji: "🎬",
    tagline: "Journey arcs, cliffhangers, emotional payoffs",
    platforms: ["youtube", "tiktok"],
    primaryColor: "#BE123C",
    accentColor: "#FDA4AF",
    thumbnailDNA:
      "Creator mid-journey in dramatic setting + countdown or time pressure element + cinematic color grade",
    hookFormulas: [
      "I had 24 hours to {{topic}} or lose everything",
      "So I quit everything and tried to {{topic}} — here's what happened",
      "The {{topic}} challenge that changed my life (I wasn't ready)",
    ],
    tone: "narrative, dramatic, emotional, cliffhanger-driven, personal",
    pacing: "fast",
    contentFormats: ["challenge", "vlog", "documentary", "experiment"],
    viralIngredients: [
      "clear stakes established in first 30 seconds",
      "multiple obstacles that build tension",
      "emotional low point before the climax",
      "satisfying resolution with personal insight",
      "callback to the opening premise",
    ],
    ctrRange: "8–10%",
    promptHints: {
      "ai-video":
        "Open at the highest-tension moment. Rewind to show how we got there. Include at least 2 obstacles that seem insurmountable. End with emotional payoff + personal lesson.",
      thumbnail:
        "Design concept: creator at the pivotal/dramatic moment. Urgency text (hours remaining, countdown). Cinematic grade. Red or high-drama tones.",
      script:
        "Structure: in medias res opening → context setup → obstacle 1 → near failure → obstacle 2 → breakthrough → resolution → lesson/callback.",
      social:
        "Caption: tell the start of the story but cut off at the tension point. 'Watch until the end to see what happened.'",
    },
  },
  {
    id: "culinary",
    name: "Culinary Creator",
    emoji: "🍳",
    tagline: "Restaurant-level home cooking, technique secrets, food ASMR",
    platforms: ["youtube", "instagram", "tiktok"],
    primaryColor: "#92400E",
    accentColor: "#FCD34D",
    thumbnailDNA:
      "Plated dish hero shot + warm golden tones + minimal text overlay naming the dish + appetite-triggering close-up",
    hookFormulas: [
      "How to make {{topic}} at home (way better than takeout)",
      "The secret technique behind {{topic}} that restaurants don't tell you",
      "I ate {{topic}} every day for a week — here's the best recipe",
    ],
    tone: "warm, instructional, sensory, enthusiastic, approachable",
    pacing: "medium",
    contentFormats: ["recipe", "technique", "comparison", "series"],
    viralIngredients: [
      "satisfying ASMR cooking sounds",
      "restaurant-quality result from accessible ingredients",
      "one surprising technique or shortcut",
      "close-up beauty shots of finished dish",
      "honest commentary on common mistakes",
    ],
    ctrRange: "5–8%",
    promptHints: {
      "ai-video":
        "Open with the finished dish being sliced/served. Rewind to ingredients. Include one technique secret that home cooks don't know. Emphasize sensory details (sizzle, color, texture).",
      thumbnail:
        "Design concept: hero shot of the dish filling the frame. Warm golden light. Minimal text naming the dish. No distractions.",
      script:
        "Structure: finished dish reveal → ingredient list → technique breakdown → the secret step → final plating → tasting reaction.",
      social:
        "Caption: name the dish + one key ingredient or technique. 'Recipe in bio' or 'Comment RECIPE for the full guide.'",
    },
  },
  {
    id: "gaming",
    name: "Gaming & Reaction",
    emoji: "🎮",
    tagline: "Over-the-top reactions, viral clips, community challenges",
    platforms: ["youtube", "tiktok", "twitter"],
    primaryColor: "#4F46E5",
    accentColor: "#A78BFA",
    thumbnailDNA:
      "Extreme reaction face + in-game screenshot or clip + bold accent color + '???' or exclamation text",
    hookFormulas: [
      "Playing {{topic}} but with the most broken rules ever",
      "I gave {{topic}} a $1,000 challenge — they didn't know",
      "The most insane {{topic}} moment I've ever recorded",
    ],
    tone:
      "explosive, reactive, community-focused, fast, hyperbolic, entertaining",
    pacing: "viral-fast",
    contentFormats: ["highlights", "challenge", "reaction", "commentary"],
    viralIngredients: [
      "immediate high-energy reaction in first frame",
      "clip that viewers want to share/reference",
      "community participation element",
      "familiar game + unexpected twist",
      "repeat-watchable moment",
    ],
    ctrRange: "7–10%",
    promptHints: {
      "ai-video":
        "Jump straight into the action. No intro. React authentically. The first 2 seconds must be the peak reaction moment. Include audience participation.",
      thumbnail:
        "Design concept: peak reaction face + game frame beside it. Use the game's visual language. Bright accent. Exclamation or question text.",
      script:
        "Open with the clip/moment. React live. Add commentary/analysis. Include viewer challenge or question.",
      social:
        "Caption: short reaction + clip link. Use the community's language. Tag relevant accounts.",
    },
  },
  {
    id: "documentary",
    name: "Documentary",
    emoji: "🌍",
    tagline: "Research-driven, cinematic storytelling, world-changing narratives",
    platforms: ["youtube"],
    primaryColor: "#1C1917",
    accentColor: "#A8A29E",
    thumbnailDNA:
      "Cinematic wide or location shot + understated serif or clean sans-serif text + muted/de-saturated grade",
    hookFormulas: [
      "Why {{topic}} is not what you think it is",
      "The untold story of {{topic}} that nobody is covering",
      "I traveled to {{topic}} to understand what's really happening",
    ],
    tone:
      "investigative, measured, authoritative, cinematic, thought-provoking",
    pacing: "slow",
    contentFormats: ["documentary", "explainer", "investigation", "essay"],
    viralIngredients: [
      "counterintuitive thesis in the title",
      "on-the-ground footage that TV news doesn't show",
      "expert interviews that shift the viewer's understanding",
      "cinematic grade that signals seriousness",
      "maps, data overlays, and historical context",
    ],
    ctrRange: "6–9%",
    promptHints: {
      "ai-video":
        "Open with a thesis that challenges conventional wisdom. Use B-roll and expert voices. Build the argument layer by layer. End with a call to rethink the viewer's position.",
      thumbnail:
        "Design concept: cinematic location or wide shot. Muted tones. Clean text — the title is the visual. No click-bait.",
      script:
        "Structure: provocative thesis → on-the-ground context → historical background → multiple perspectives → the real answer → what this means for us.",
      social:
        "Caption: state the counterintuitive finding. 2 sentences. Link to the full piece.",
    },
  },
  {
    id: "productivity",
    name: "Productivity Expert",
    emoji: "🧠",
    tagline: "Evidence-based systems, calm optimization, second-brain thinking",
    platforms: ["youtube", "twitter", "linkedin"],
    primaryColor: "#0F172A",
    accentColor: "#38BDF8",
    thumbnailDNA:
      "Clean workspace or notebook visual + structured title card with list callout + blue or neutral academic palette",
    hookFormulas: [
      "After {{topic}} for 2 years, here's what actually works",
      "The exact {{topic}} system I use to do in 4 hours what takes others 8",
      "{{topic}} is not the answer — this is (with evidence)",
    ],
    tone: "calm, measured, evidence-based, humble, methodical, helpful",
    pacing: "medium",
    contentFormats: ["system", "review", "framework", "case-study", "list"],
    viralIngredients: [
      "specific named system or framework viewers can steal immediately",
      "counterintuitive productivity insight backed by research",
      "personal experiment with measurable results",
      "aesthetic workspace visuals that signal credibility",
      "actionable checklist in every video",
    ],
    ctrRange: "5–7%",
    promptHints: {
      "ai-video":
        "Start with a time-based claim. Build the framework using numbered steps. Include personal experiment results. End with one actionable thing viewers can do in the next 10 minutes.",
      thumbnail:
        "Design concept: clean desk or notebook. Title card with number list. No clutter. Blue or cool tone for focus energy.",
      script:
        "Structure: time-saving claim → why most people fail at this → the system (numbered steps) → personal results → the one thing to start today.",
      social:
        "Caption: lead with the insight or technique name. Numbered list of 3 key points. End with 'the full breakdown is in the video.'",
    },
  },
];

/** Look up a style by id — returns undefined if not found */
export function getCreatorStyle(id: string): CreatorStyle | undefined {
  return CREATOR_STYLES.find((s) => s.id === id);
}

/** Filter styles by platform */
export function getStylesByPlatform(platform: Platform): CreatorStyle[] {
  return CREATOR_STYLES.filter((s) => s.platforms.includes(platform));
}
