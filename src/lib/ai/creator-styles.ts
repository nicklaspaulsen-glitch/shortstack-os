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
  | "copy"
  | "websites"
  | "ads"
  | "email"
  | "proposals"
  | "crm-followup"
  | "weekly-plan";

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
      websites:
        "Homepage copy: explosive headline with a big promise or impossible claim. Sub-headline amplifies the stakes. CTA button copy must feel like a dare ('Join the challenge', 'Prove me wrong'). Use numbers and extremes throughout.",
      ads:
        "Ad headline: lead with a number or impossible-sounding result. 'We spent $1M testing this — here's what works.' Short punchy body. CTA triggers curiosity or FOMO.",
      email:
        "Subject line: bold claim or controversy. Body opens with the result, then reveals the story. One CTA. High energy, no padding.",
      proposals:
        "Open with the client's biggest missed opportunity in numbers. Make the gap feel urgent. ROI projection upfront. Bold guarantee or challenge statement at the end.",
      "crm-followup":
        "Short, direct message. Reference something specific (their challenge, last interaction). One clear next step. High-energy but not pushy. Make them feel like they're missing out.",
      "weekly-plan":
        "Plan content that escalates: start with a teaser/challenge post Monday, build to a reveal or result by Friday. Each day's hook must be stronger than the day before. Include at least one giveaway or challenge angle.",
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
      websites:
        "Homepage copy: clean, precise headline stating the key benefit. No superlatives. Sub-headline adds one specific proof point. Minimal words, maximum clarity. CTA is direct ('Get the review', 'See the specs').",
      ads:
        "Ad headline: state the product and one objective differentiator. Body: 2 lines max, one proof point. CTA: simple action verb + benefit ('See why it's the best').",
      email:
        "Subject: precise and specific — name the product and the finding. Body: clean structure, one spec or comparison per section. No filler. Sign off with a verdict sentence.",
      proposals:
        "Proposal structure: precise scope → specific deliverables with measurable outcomes → timeline with milestones → investment. No padding. Every claim has a metric or example.",
      "crm-followup":
        "Clean, professional follow-up. Reference the exact topic discussed. One question or one clear next action. No filler phrases. Signed off with calm confidence.",
      "weekly-plan":
        "Plan a structured review or comparison series: one product/feature per day. Monday: overview. Tuesday: deep-dive. Wednesday: comparison. Thursday: verdict. Friday: FAQ or 'is it worth it?' post.",
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
      websites:
        "Homepage copy: open with a mind-bending question or counterintuitive claim ('Most people believe X. They're wrong.'). Explain the surprising truth in 2 sentences. CTA triggers intellectual curiosity.",
      ads:
        "Ad headline: pose a question that challenges what the audience thinks they know. Body: the surprising answer in one sentence. CTA: 'Find out why' or 'See the experiment'.",
      email:
        "Subject: a counterintuitive claim or question. Body: walk through the discovery like an experiment. Include one tangible result or 'aha' moment. End with a curiosity-driven CTA.",
      proposals:
        "Open with an insight the client hasn't considered — a data point or trend that reframes their challenge. Structure the proposal like a scientific argument: hypothesis → evidence → recommended solution.",
      "crm-followup":
        "Reference a surprising insight or stat related to their industry. Frame the follow-up as sharing a discovery. Ask a curiosity-triggering question that makes them want to reply.",
      "weekly-plan":
        "Plan a 'myth-busting week': Monday debunks a common belief, Tuesday reveals the real data, Wednesday runs the experiment, Thursday shows the results, Friday answers viewer questions.",
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
      websites:
        "Homepage copy: brutal opening that calls out the visitor's biggest mistake or excuse. No softening. Sub-headline states the fix. CTA is a direct command ('Stop wasting time. Start here.').",
      ads:
        "Ad headline: call out the problem or the excuse directly. Body: the solution in one sentence. CTA: strong imperative ('Stop doing X. Do this instead.').",
      email:
        "Subject: direct challenge or uncomfortable truth. Body: 3 short paragraphs — the problem, why they're stuck, the action. No warm-up. End with a one-sentence challenge.",
      proposals:
        "Open by naming the client's biggest mistake or missed opportunity. Be direct about the gap. Proposal is structured as: current reality → the hard truth → the solution → what happens if they don't act.",
      "crm-followup":
        "Direct and brief. No pleasantries. Reference the exact gap or problem they mentioned. Give one concrete action they can take today. End with a direct question.",
      "weekly-plan":
        "Plan a confrontational content week: Monday calls out a myth, Tuesday is 'stop doing X', Wednesday is the hard truth about their niche, Thursday is a tough love success story, Friday is a direct challenge to the audience.",
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
      websites:
        "Homepage copy: warm, personal opening ('hey, I'm [name] and...'). Conversational tone throughout. Address the visitor directly. CTA feels like an invitation, not a command. Include a genuine personal anecdote.",
      ads:
        "Ad copy: conversational, first-person. 'I tried everything until I found this.' Relatable situation → discovery → invitation. CTA: soft and friendly ('come check it out').",
      email:
        "Subject: personal and lowercase. Body reads like a message from a friend — use contractions, be real. One personal story. One ask. Feels like it wasn't mass-sent.",
      proposals:
        "Warm, personal opening. Acknowledge how you found them or what caught your attention. Structure as a conversation, not a document. Make them feel known, not just pitched.",
      "crm-followup":
        "Personal, short, genuine. Reference something specific from your last interaction. Keep it casual. Ask a real question you actually want to know the answer to.",
      "weekly-plan":
        "Plan a 'come along with me' week: every post invites the audience into a real moment. Monday: behind the scenes. Tuesday: a lesson from a mistake. Wednesday: 'what I'm working on'. Thursday: a candid Q&A. Friday: personal reflection.",
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
      websites:
        "Homepage copy: show the transformation clearly — describe the before state the visitor is in, then the after state they want. Include a specific result or metric. CTA triggers aspiration ('Start your transformation').",
      ads:
        "Ad: before state (pain) → after state (result) → proof metric. Visual should be a before/after split. CTA: 'See how they did it' or 'Get the same result'.",
      email:
        "Subject: a before/after result with a timeframe. Body: someone's real transformation story. Numbers throughout. End with 'you can do this too' + CTA.",
      proposals:
        "Frame the proposal as a transformation journey: where the client is now → where they'll be in [X months] with specific metrics. Include a case study of a similar client's transformation.",
      "crm-followup":
        "Reference where they were when you last spoke. Acknowledge any progress. Show them what the next milestone looks like. Make them want to continue the journey.",
      "weekly-plan":
        "30-day challenge week: Monday kick-off post with the goal, daily check-in updates, Thursday mid-point reveal, Friday results teaser leading to a full reveal next Monday.",
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
      websites:
        "Homepage copy: lead with a specific revenue or result number. Sub-headline adds context. Break down the service like a financial statement — inputs, outputs, ROI. CTA is evidence-based ('See the numbers').",
      ads:
        "Ad headline: a specific dollar amount, percentage, or time metric. Body: brief proof + methodology. CTA: 'Get the breakdown' or 'See my exact strategy'.",
      email:
        "Subject: a specific number result. Body: transparent breakdown of how it was achieved. Include actual metrics, not vague claims. End with a clear ROI calculation for the reader.",
      proposals:
        "Lead with the ROI calculation. Break down costs, expected returns, and timeline with specifics. Include a risk section. Close with an evidence-based case for acting now vs. waiting.",
      "crm-followup":
        "Reference a specific number from their situation. Frame the next step in terms of ROI or risk of inaction. Keep it short, analytical, and evidence-based.",
      "weekly-plan":
        "Income/results transparency week: Monday shares a specific metric, Tuesday breaks down the methodology, Wednesday addresses a common mistake with data, Thursday shares a loss/failure with numbers, Friday is a recap with lessons and an action plan.",
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
      websites:
        "Homepage copy: open in the middle of a story — the moment of peak tension. 'We almost lost everything, then we found this.' Rewind to context. CTA carries narrative tension ('Hear the full story').",
      ads:
        "Ad: a micro-story arc — one sentence of tension, one of resolution. 'We had 48 hours to save the campaign. Here's what worked.' CTA: 'See the full story'.",
      email:
        "Subject: an unresolved tension. Body: open in the middle of the story. Build to a cliffhanger before the CTA. The email should feel like the trailer for a longer story.",
      proposals:
        "Frame as a journey: the client's current challenge is the 'inciting incident'. The proposal is the roadmap through obstacles to resolution. Include a case study structured as a story arc with a clear climax and resolution.",
      "crm-followup":
        "Open with a story hook related to their situation. Create a cliffhanger that makes them want to reply. Make the next meeting sound like 'the next chapter'.",
      "weekly-plan":
        "Story arc week: Monday opens the story (a problem or mission), each day advances the arc with new developments, Friday delivers the resolution or revelation — but teases a new chapter for next week.",
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
      websites:
        "Homepage copy: sensory-rich opening that makes the reader hungry for the solution. Use warm, inviting language. List the 'ingredients' of the offer. CTA feels like an invitation to a table.",
      ads:
        "Ad: open with the finished result (the 'dish'), describe one secret ingredient or technique, invite them to learn how. Warm, appetite-triggering language.",
      email:
        "Subject: a recipe-style promise ('The exact 3-step process for...'). Body structured like a recipe — ingredients, method, result. Warm and instructional tone. End with the 'taste test' CTA.",
      proposals:
        "Present the proposal as a recipe: ingredients (deliverables), method (process), expected result (outcome). Warm, approachable language that makes working together feel enjoyable.",
      "crm-followup":
        "Warm and personal. Reference something specific from your last conversation, like a chef noting a guest's preference. Offer one helpful tip or resource. Make them feel looked after.",
      "weekly-plan":
        "Technique week: each day focuses on one skill or secret. Monday: the ingredient that changes everything. Tuesday: the technique most people skip. Wednesday: a comparison (with vs. without). Thursday: a client success with this technique. Friday: a beginner's guide.",
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
      websites:
        "Homepage copy: explosive energy from the first word. Use community language and insider references. CTA should feel like joining a squad. Include social proof from the community (numbers, testimonials with usernames).",
      ads:
        "Ad: high-energy, uses community slang or memes (if applicable). 'If you know, you know.' Reaction-style hook. CTA: 'Join the community' or 'See what everyone's talking about'.",
      email:
        "Subject: reaction-style or referencing a community moment. Body: conversational, energetic, feels like a Discord message. Include community participation element. Short and punchy.",
      proposals:
        "Community-focused framing. Show how you'll help them build a loyal audience that shows up repeatedly. Use engagement metrics and community size as ROI indicators.",
      "crm-followup":
        "Energetic and direct. Reference a recent win, piece of content, or community moment. Make them feel like part of the inner circle.",
      "weekly-plan":
        "Community engagement week: Monday posts a challenge, Tuesday showcases a community member's result, Wednesday is a reaction/response to a trending topic, Thursday runs a poll or Q&A, Friday announces next week's challenge.",
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
      websites:
        "Homepage copy: a thesis statement that challenges conventional wisdom. Understated, authoritative. Sub-headline adds one specific proof or data point. CTA is intellectual: 'Read the full investigation' or 'Watch the documentary'.",
      ads:
        "Ad: investigative tone. 'Nobody is talking about this.' One sentence of setup, one sentence of the finding. Muted, serious aesthetic. CTA: 'Watch the investigation'.",
      email:
        "Subject: a counterintuitive claim stated as fact. Body: structured like a documentary — context, evidence, implication. Serious tone. End with 'the full story is here'.",
      proposals:
        "Research-driven framing. Open with an industry-wide insight they haven't considered. Back every claim with data or sources. Structure the proposal as an investigative brief: situation → evidence → recommended course of action.",
      "crm-followup":
        "Reference an industry trend or data point relevant to their business. Frame your outreach as sharing an important finding. Invite them to 'go deeper' with a meeting or call.",
      "weekly-plan":
        "Investigation week: Monday sets up the thesis, Tuesday presents the evidence, Wednesday explores the counterargument, Thursday reveals the expert perspective, Friday delivers the verdict and implications.",
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
      websites:
        "Homepage copy: system-first. Open with the specific outcome, then name the methodology. Clean numbered value proposition. CTA is evidence-based: 'Get the system' or 'See how it works'.",
      ads:
        "Ad: state the time or result saved. 'From 8 hours to 2. Here's the system.' Body: one key efficiency insight. CTA: 'Get the framework' or 'Steal my system'.",
      email:
        "Subject: a specific time-saving or result claim. Body: structured breakdown with numbered steps. Include one personal experiment result. End with a single actionable step CTA.",
      proposals:
        "Present as a system with clear inputs and outputs. Include a workflow diagram or numbered process. Show exactly how time and effort are reduced. Back with case study metrics.",
      "crm-followup":
        "Efficient and respectful of their time. One sentence of context, one insight or resource relevant to their situation, one clear next action. Never more than 5 sentences.",
      "weekly-plan":
        "System-building week: Monday introduces the framework, Tuesday covers step 1 with a practical example, Wednesday covers step 2, Thursday shows the system in action, Friday is a complete checklist or template post.",
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
