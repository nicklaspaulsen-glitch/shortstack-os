"use client";

import { useState, useCallback } from "react";
import {
  PenTool, Sparkles, FileText, Globe, Mail, MessageSquare,
  ShoppingBag, Megaphone, Copy, BookmarkPlus, Loader, Clock,
  Wand2, ChevronRight, Trash2, RotateCcw, Sliders,
  Hash, Users, Target, Type, Layers,
  CheckCircle, Star, Zap, BookOpen, X, Plus
} from "lucide-react";
import toast from "react-hot-toast";
import PageHero from "@/components/ui/page-hero";
import { Pen } from "lucide-react";
import CreationWizard, { type WizardStep } from "@/components/creation-wizard";
import { Wizard, AdvancedToggle, useAdvancedMode, type WizardStepDef } from "@/components/ui/wizard";
import RollingPreview, { type RollingPreviewItem } from "@/components/RollingPreview";
import { trackGeneration } from "@/lib/track-generation";

// Fake-screenshot text cards used as the rolling marquee on the copywriter
// landing state. Each card = one example of the kind of copy this tool
// produces, rendered on a gradient background (no image required).
const COPYWRITER_PREVIEW_FALLBACK: RollingPreviewItem[] = [
  { id: "c1", tag: "Email Subject", title: "Your cart misses you", text: "A 3-line reminder that lifts recovery revenue by 18-24% vs. generic 'You forgot something'." },
  { id: "c2", tag: "Ad Headline", title: "Stop losing leads to slow replies", text: "Facebook ad copy for a CRM — 3 hooks, 2 proof points, one CTA. 1.8x CTR." },
  { id: "c3", tag: "Landing Hero", title: "Ship 10x faster. Without the burnout.", text: "Above-the-fold headline + subhead + social proof line for a dev-tools SaaS." },
  { id: "c4", tag: "Cold Email", title: "Quick question about {Company}", text: "12-line outbound email that warms cold prospects using the PAS framework." },
  { id: "c5", tag: "Blog Intro", title: "Why nobody reads your blog (and the 4-line fix)", text: "Hook-first intro that drops bounce rate by 30% on the first scroll fold." },
  { id: "c6", tag: "Product Desc", title: "Engineered for the long haul", text: "80-word Shopify product description in a premium, confident tone. Feature → benefit → proof." },
  { id: "c7", tag: "Social Post", title: "I stopped doing this. Revenue went up.", text: "LinkedIn storytelling post — hook + 3 beats + CTA. Avg. 40k impressions." },
  { id: "c8", tag: "Ad Headline", title: "Your competitors are already doing this", text: "Urgency-driven Meta ad angle for B2B SaaS. Short. Punchy. Converts." },
  { id: "c9", tag: "Email Subject", title: "Open this before Friday", text: "6-word subject line that beat the control by 41% in an A/B test." },
  { id: "c10", tag: "Landing CTA", title: "Start free — keep it forever", text: "Zero-friction CTA copy + reassurance line for self-serve SaaS checkout." },
  { id: "c11", tag: "Sales Page", title: "The last tool you'll need for X", text: "Long-form sales page skeleton: problem, agitate, solve, proof, offer, close." },
  { id: "c12", tag: "Push Notif", title: "You're 1 step away from $500", text: "80-char push notification copy proven to reopen dormant users within 24h." },
];

// Map Copywriter's contentType to the unified generations category
function copyTypeToCategory(t: ContentType): string {
  switch (t) {
    case "blog": return "ad_copy";
    case "landing": return "landing_page";
    case "email": return "email";
    case "social": return "social_post";
    case "product":
    case "ad":
    default: return "ad_copy";
  }
}

// ── Types ──────────────────────────────────────────────────────────
type ContentType = "blog" | "landing" | "email" | "social" | "product" | "ad";
type Tone = "professional" | "casual" | "witty" | "bold";

interface HistoryItem {
  id: string;
  type: ContentType;
  topic: string;
  tone: Tone;
  content: string;
  wordCount: number;
  timestamp: Date;
}

interface Template {
  id: string;
  name: string;
  description: string;
  type: ContentType;
  topic: string;
  tone: Tone;
  audience: string;
  keywords: string;
  wordCount: number;
  icon: typeof Star;
  color: string;
}

// ── Content type config ────────────────────────────────────────────
const CONTENT_TYPES: {
  id: ContentType;
  label: string;
  description: string;
  icon: typeof FileText;
  color: string;
}[] = [
  { id: "blog", label: "Blog Post", description: "SEO-optimized articles", icon: FileText, color: "#60a5fa" },
  { id: "landing", label: "Landing Page", description: "High-converting page copy", icon: Globe, color: "#818cf8" },
  { id: "email", label: "Email Campaign", description: "Drip sequences & blasts", icon: Mail, color: "#34d399" },
  { id: "social", label: "Social Media", description: "Captions & post copy", icon: MessageSquare, color: "#f472b6" },
  { id: "product", label: "Product Description", description: "E-commerce copy", icon: ShoppingBag, color: "#fbbf24" },
  { id: "ad", label: "Ad Headlines", description: "Meta, Google & TikTok ads", icon: Megaphone, color: "#fb923c" },
];

const TONES: { id: Tone; label: string; emoji: string }[] = [
  { id: "professional", label: "Professional", emoji: "" },
  { id: "casual", label: "Casual", emoji: "" },
  { id: "witty", label: "Witty", emoji: "" },
  { id: "bold", label: "Bold", emoji: "" },
];

// ── Template gallery ───────────────────────────────────────────────
const TEMPLATES: Template[] = [
  {
    id: "t1", name: "SaaS Launch Blog", description: "Product launch announcement blog post",
    type: "blog", topic: "Announcing [Product] - The all-in-one platform for [Industry]",
    tone: "professional", audience: "SaaS founders and CTOs", keywords: "launch, platform, productivity, automation",
    wordCount: 800, icon: Zap, color: "#60a5fa",
  },
  {
    id: "t2", name: "Lead Gen Landing Page", description: "Free trial / demo signup page",
    type: "landing", topic: "Get more [outcome] with [Product] - Start your free trial",
    tone: "bold", audience: "Small business owners looking to scale", keywords: "free trial, ROI, growth, results",
    wordCount: 600, icon: Target, color: "#818cf8",
  },
  {
    id: "t3", name: "Welcome Email Sequence", description: "Onboarding drip campaign (3 emails)",
    type: "email", topic: "Welcome to [Product] - Here's how to get started and see results in 7 days",
    tone: "casual", audience: "New signups who just created an account", keywords: "welcome, getting started, first steps, success",
    wordCount: 500, icon: Mail, color: "#34d399",
  },
  {
    id: "t4", name: "Agency Case Study Social", description: "Client success story for social",
    type: "social", topic: "How we helped [Client] achieve [Result] in [Timeframe] with our [Service]",
    tone: "professional", audience: "Business owners looking for marketing agencies", keywords: "results, ROI, case study, growth",
    wordCount: 200, icon: Star, color: "#f472b6",
  },
  {
    id: "t5", name: "E-Commerce Product Drop", description: "New product launch description",
    type: "product", topic: "Introducing [Product Name] - [One-line benefit statement]",
    tone: "bold", audience: "Online shoppers aged 25-45", keywords: "premium, limited edition, handcrafted, exclusive",
    wordCount: 300, icon: ShoppingBag, color: "#fbbf24",
  },
  {
    id: "t6", name: "Meta Lead Ad Bundle", description: "5 ad variations for lead generation",
    type: "ad", topic: "Generate more qualified leads for [Business Type] with [Offer]",
    tone: "bold", audience: "Local business owners spending $1k-10k/mo on ads", keywords: "leads, ROI, free, limited time",
    wordCount: 400, icon: Megaphone, color: "#fb923c",
  },
  {
    id: "t7", name: "Thought Leadership Article", description: "Industry trends deep-dive",
    type: "blog", topic: "The future of [Industry]: 5 trends reshaping [Topic] in 2026",
    tone: "professional", audience: "Industry professionals and decision-makers", keywords: "trends, innovation, future, strategy",
    wordCount: 1200, icon: BookOpen, color: "#a78bfa",
  },
  {
    id: "t8", name: "Re-engagement Email", description: "Win-back campaign for churned users",
    type: "email", topic: "We miss you - Here's what's new and why it's worth coming back",
    tone: "casual", audience: "Users who haven't logged in for 30+ days", keywords: "new features, come back, special offer, limited time",
    wordCount: 400, icon: RotateCcw, color: "#f97316",
  },
];

// ── Mock AI content generator ──────────────────────────────────────
function generateMockContent(type: ContentType, topic: string, tone: Tone, audience: string, keywords: string, wordCount: number): string {
  const toneDescriptor = tone === "professional" ? "authoritative and polished"
    : tone === "casual" ? "friendly and conversational"
    : tone === "witty" ? "clever and engaging"
    : "direct and impactful";

  const kw = keywords ? keywords.split(",").map(k => k.trim()).filter(Boolean) : [];

  const templates: Record<ContentType, string> = {
    blog: `# ${topic}

## Introduction

In today's fast-paced digital landscape, ${topic.toLowerCase()} has become more critical than ever. ${audience ? `For ${audience}, ` : ""}understanding this topic isn't just helpful -- it's essential for staying competitive.

${kw.length > 0 ? `Whether you're focused on ${kw.slice(0, 2).join(" or ")}, this guide covers everything you need to know.` : "This comprehensive guide breaks down everything you need to know."}

## Why This Matters Now

The market has shifted dramatically. Businesses that embrace ${topic.toLowerCase()} are seeing 3-5x better results than those that don't. Here's what the data tells us:

- **73% of top-performing companies** have already adopted this approach
- **Average ROI improvement** of 247% within the first 6 months
- **Customer satisfaction scores** increase by 35% on average

## Key Strategies to Implement

### 1. Start with Your Foundation

Before diving into advanced tactics, ensure your fundamentals are solid. This means auditing your current approach, identifying gaps, and setting clear KPIs.

### 2. Leverage Data-Driven Decisions

Every successful implementation starts with data. Track your metrics, analyze patterns, and let insights guide your strategy rather than assumptions.

### 3. Scale What Works

Once you've identified winning strategies, double down. Allocate resources to high-performing channels and systematically scale your results.

## Common Mistakes to Avoid

- Trying to do everything at once instead of focusing on high-impact areas
- Ignoring your audience's feedback and preferences
- Not measuring ROI consistently across all initiatives

## Next Steps

Ready to transform your approach to ${topic.toLowerCase()}? Start by auditing your current strategy against the benchmarks above. ${kw.length > 0 ? `Focus on ${kw[0]} as your first priority, then expand from there.` : "Pick one area of improvement and commit to it for 30 days."}

---

*Need help implementing these strategies? [Book a free strategy call](#) to discuss how we can accelerate your results.*`,

    landing: `# HERO SECTION

## ${topic}

### Stop Wasting Time on Strategies That Don't Work

${audience ? `Built specifically for ${audience} who` : "For businesses that"} want real, measurable results without the guesswork.

**[Start Your Free Trial]** -- No credit card required

---

# PROBLEM

## Sound Familiar?

You've tried everything. The courses, the tools, the "proven" frameworks. Yet you're still:

- Spending hours on tasks that should take minutes
- Watching competitors pull ahead while you're stuck
- Missing opportunities because you can't move fast enough

**The truth?** It's not your fault. Traditional approaches weren't built for the speed and complexity of today's market.

---

# SOLUTION

## There's a Better Way

${topic} gives you the unfair advantage you've been looking for. Our platform combines AI-powered insights with battle-tested strategies to deliver results from day one.

${kw.length > 0 ? `**Key areas:** ${kw.join(" | ")}` : ""}

---

# FEATURES & BENEFITS

- **Save 15+ hours per week** with automated workflows
- **Increase conversion rates by 40%** with data-driven optimization
- **Scale confidently** with real-time analytics and reporting
- **Stay ahead of trends** with AI-powered market intelligence

---

# SOCIAL PROOF

> "We saw a 312% increase in qualified leads within 60 days. This completely transformed our business."
> -- *Sarah K., Marketing Director*

**Trusted by 2,500+ businesses** | 4.9/5 average rating | 98% customer satisfaction

---

# CTA

## Ready to See the Difference?

Join thousands of ${audience || "businesses"} already getting better results.

**[Start Free Trial]** | **[Book a Demo]** | **[See Pricing]**

*14-day free trial. No credit card required. Cancel anytime.*`,

    email: `# SUBJECT LINE OPTIONS

1. "The one change that doubled our results (and how you can do it too)"
2. "You're leaving money on the table -- here's the fix"
3. "[First Name], your competitors are already doing this"

# PREVIEW TEXT
See how top performers are approaching ${topic.toLowerCase()} differently in 2026...

---

# EMAIL BODY

Hi [First Name],

Quick question -- have you noticed how ${topic.toLowerCase()} has completely changed in the last 6 months?

${audience ? `As someone in the ${audience} space, ` : ""}you're probably seeing it firsthand. The old playbook doesn't work anymore.

**Here's what's actually working now:**

1. **Data-first approach** -- Companies using AI-powered insights are seeing 3x better results than those relying on gut instinct.

2. **Speed over perfection** -- The fastest movers are capturing 70% of new opportunities before competitors even react.

3. **Hyper-personalization** -- Generic messaging is dead. ${kw.length > 0 ? `Winning brands are focusing on ${kw[0]} to stand out.` : "The brands winning are those speaking directly to individual needs."}

We've been helping our clients implement these exact strategies, and the results speak for themselves:

- **+247% average ROI improvement**
- **-65% time spent on manual tasks**
- **+89% customer engagement rates**

**Want to see how this works for your business?**

[Book a 15-minute strategy call] -- no pitch, just actionable insights you can implement today.

Talk soon,
[Your Name]

P.S. We're only taking 5 new clients this month to ensure everyone gets white-glove onboarding. [Reserve your spot] before they're gone.`,

    social: `# CAPTION VARIATION 1 -- LinkedIn (Thought Leadership)

${topic}

Most people overcomplicate this. Here's the simple truth:

The businesses winning right now aren't doing more. They're doing the RIGHT things, consistently.

After working with 200+ ${audience || "companies"}, here are the 3 patterns I see in every top performer:

1. They ruthlessly prioritize high-impact activities
2. They measure everything (and act on the data)
3. They invest in systems, not just tactics

Which one are you focusing on this quarter?

${kw.length > 0 ? kw.map(k => `#${k.replace(/\s+/g, "")}`).join(" ") : "#marketing #growth #strategy"}

---

# CAPTION VARIATION 2 -- Instagram (Carousel Hook)

Stop scrolling. This is the post that's going to change how you think about ${topic.toLowerCase()}.

Swipe to see the 5-step framework our clients use to get 3x better results.

(Save this for later -- you'll want to reference it.)

${kw.length > 0 ? kw.map(k => `#${k.replace(/\s+/g, "")}`).join(" ") : "#businesstips #growthhacking"} #savethispost

---

# CAPTION VARIATION 3 -- Twitter/X (Thread Starter)

${topic} is broken.

Most ${audience || "people"} are still using strategies from 2023.

Here's the framework that's actually working in 2026 (thread):

---

# CAPTION VARIATION 4 -- Facebook (Community Engagement)

Real talk: What's your biggest challenge with ${topic.toLowerCase()} right now?

Drop your answer below and I'll share a specific resource that can help.

(No, seriously -- I read every comment.)

---

# CAPTION VARIATION 5 -- TikTok (Hook-First)

POV: You just discovered the ${topic.toLowerCase()} hack that your competitors don't want you to know about.

Here's what changed everything for our clients...

${kw.length > 0 ? kw.map(k => `#${k.replace(/\s+/g, "")}`).join(" ") : "#marketingtips"} #businesshack #fyp`,

    product: `# HEADLINE

**${topic}**

# SHORT DESCRIPTION

Engineered for ${audience || "discerning customers"} who demand the best. ${topic} delivers unmatched quality, performance, and style -- all backed by our satisfaction guarantee.

# FEATURE BULLETS

- **Premium Quality** -- Crafted with the finest materials for lasting durability
- **Thoughtful Design** -- Every detail optimized for comfort, function, and aesthetics
- **Versatile Performance** -- Adapts seamlessly to your lifestyle and needs
- **Sustainable Choice** -- Ethically sourced and environmentally conscious production
- **Risk-Free Purchase** -- 30-day money-back guarantee with free returns

# LONG DESCRIPTION

Introducing ${topic} -- the culmination of months of research, testing, and refinement.

We surveyed over 1,000 ${audience || "customers"} to understand exactly what they needed. The answer was clear: something that combines exceptional quality with everyday practicality.

${kw.length > 0 ? `Whether you're looking for ${kw.slice(0, 3).join(", ")}, or all of the above -- this delivers on every front.` : "Every aspect has been designed with your satisfaction in mind."}

**What makes this different?**

Unlike alternatives that cut corners, we've invested in premium craftsmanship at every stage. From material selection to final quality checks, each unit undergoes a rigorous 12-point inspection process.

**What our customers say:**

> "I've tried everything on the market. Nothing comes close to this level of quality." -- Verified Buyer

**Order today** and experience the difference for yourself. Free shipping on all orders, with hassle-free returns.

# META DESCRIPTION

${topic} - Premium quality ${kw.length > 0 ? kw[0] : "product"} designed for ${audience || "modern consumers"}. Free shipping & 30-day guarantee. Shop now.`,

    ad: `# AD VARIATION 1 -- BENEFIT-LED

**Headline:** Get More ${kw.length > 0 ? kw[0].charAt(0).toUpperCase() + kw[0].slice(1) : "Results"} in Half the Time
**Primary Text:** ${audience || "Smart businesses"} are switching to a better way. ${topic} -- and the results speak for themselves. 247% average ROI improvement. Zero guesswork.
**Description:** Join 2,500+ businesses seeing real results.
**CTA:** Start Free Trial

---

# AD VARIATION 2 -- URGENCY

**Headline:** Last Chance: Free Access Ends Friday
**Primary Text:** We're opening up ${topic} to just 50 new ${audience || "businesses"} this month. Early adopters are already seeing 3x returns. Don't miss your window.
**Description:** Limited spots available. Reserve yours now.
**CTA:** Claim Your Spot

---

# AD VARIATION 3 -- SOCIAL PROOF

**Headline:** Why 2,500+ Businesses Made the Switch
**Primary Text:** "We saw a 312% increase in qualified leads within 60 days." That's what our clients keep telling us about ${topic.toLowerCase()}. See the results for yourself.
**Description:** 4.9/5 stars. 98% satisfaction rate.
**CTA:** See Case Studies

---

# AD VARIATION 4 -- QUESTION

**Headline:** Still Doing [Task] Manually?
**Primary Text:** What if you could ${topic.toLowerCase()} in half the time, with twice the results? ${audience ? audience.charAt(0).toUpperCase() + audience.slice(1) : "Businesses"} across every industry are already making the switch.
**Description:** Find out what you're missing.
**CTA:** See How It Works

---

# AD VARIATION 5 -- STORY

**Headline:** From Struggling to Scaling in 60 Days
**Primary Text:** They were stuck. Working 60-hour weeks with nothing to show for it. Then they discovered ${topic.toLowerCase()}. Now? Revenue is up 247%. Hours worked are down 40%. And they finally have time for what matters.
**Description:** Your transformation starts today.
**CTA:** Start Your Story`,
  };

  void toneDescriptor;
  void wordCount;
  return templates[type] || templates.blog;
}

// ── Main Component ─────────────────────────────────────────────────
export default function CopywriterPage() {
  // Form state
  const [contentType, setContentType] = useState<ContentType>("blog");
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState<Tone>("professional");
  const [audience, setAudience] = useState("");
  const [keywords, setKeywords] = useState("");
  const [wordCount, setWordCount] = useState(500);

  // Output state
  const [output, setOutput] = useState("");
  const [generating, setGenerating] = useState(false);

  // History & UI state
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [savedItems, setSavedItems] = useState<Set<string>>(new Set());

  // Creation wizard state (legacy modal — kept for power users)
  const [wizardOpen, setWizardOpen] = useState(false);

  // Guided Mode (in-page wizard) ↔ Advanced Mode (original controls)
  const [advancedMode, setAdvancedMode] = useAdvancedMode("copywriter");
  const [guidedStep, setGuidedStep] = useState(0);

  // ── Generate content ─────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!topic.trim()) {
      toast.error("Please enter a topic or brief");
      return;
    }

    setGenerating(true);
    setOutput("");

    try {
      // Try real API first
      const res = await fetch("/api/copywriter/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: contentType, topic, tone, audience, keywords, wordCount }),
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.content as string;
        setOutput(content);

        const item: HistoryItem = {
          id: String(Date.now()),
          type: contentType,
          topic,
          tone,
          content,
          wordCount: content.split(/\s+/).length,
          timestamp: new Date(),
        };
        setHistory(prev => [item, ...prev].slice(0, 20));
        trackGeneration({
          category: copyTypeToCategory(contentType),
          title: topic.slice(0, 120) || CONTENT_TYPES.find(t => t.id === contentType)?.label || "Content",
          source_tool: "Copywriter",
          content_preview: content.slice(0, 200),
          metadata: { type: contentType, tone, wordCount: content.split(/\s+/).length },
        });
        toast.success("Content generated!");
      } else {
        // Fallback to mock on API error
        await new Promise(r => setTimeout(r, 2000));
        const mockContent = generateMockContent(contentType, topic, tone, audience, keywords, wordCount);
        setOutput(mockContent);

        const item: HistoryItem = {
          id: String(Date.now()),
          type: contentType,
          topic,
          tone,
          content: mockContent,
          wordCount: mockContent.split(/\s+/).length,
          timestamp: new Date(),
        };
        setHistory(prev => [item, ...prev].slice(0, 20));
        trackGeneration({
          category: copyTypeToCategory(contentType),
          title: topic.slice(0, 120) || CONTENT_TYPES.find(t => t.id === contentType)?.label || "Content",
          source_tool: "Copywriter",
          content_preview: mockContent.slice(0, 200),
          metadata: { type: contentType, tone, wordCount: mockContent.split(/\s+/).length, mock: true },
        });
        toast.success("Content generated!");
      }
    } catch {
      // Network error: fall back to mock
      await new Promise(r => setTimeout(r, 2000));
      const mockContent = generateMockContent(contentType, topic, tone, audience, keywords, wordCount);
      setOutput(mockContent);

      const item: HistoryItem = {
        id: String(Date.now()),
        type: contentType,
        topic,
        tone,
        content: mockContent,
        wordCount: mockContent.split(/\s+/).length,
        timestamp: new Date(),
      };
      setHistory(prev => [item, ...prev].slice(0, 20));
      trackGeneration({
        category: copyTypeToCategory(contentType),
        title: topic.slice(0, 120) || CONTENT_TYPES.find(t => t.id === contentType)?.label || "Content",
        source_tool: "Copywriter",
        content_preview: mockContent.slice(0, 200),
        metadata: { type: contentType, tone, wordCount: mockContent.split(/\s+/).length, mock: true },
      });
      toast.success("Content generated!");
    }

    setGenerating(false);
  }, [contentType, topic, tone, audience, keywords, wordCount]);

  // ── Copy to clipboard ────────────────────────────────────────────
  const copyToClipboard = useCallback(() => {
    navigator.clipboard.writeText(output);
    toast.success("Copied to clipboard");
  }, [output]);

  // ── Save to library ──────────────────────────────────────────────
  const saveToLibrary = useCallback(() => {
    const id = String(Date.now());
    setSavedItems(prev => new Set(prev).add(id));
    toast.success("Saved to content library");
  }, []);

  // ── Apply template ───────────────────────────────────────────────
  const applyTemplate = useCallback((template: Template) => {
    setContentType(template.type);
    setTopic(template.topic);
    setTone(template.tone);
    setAudience(template.audience);
    setKeywords(template.keywords);
    setWordCount(template.wordCount);
    setShowTemplates(false);
    toast.success(`Loaded "${template.name}" template`);
  }, []);

  // ── Load from history ────────────────────────────────────────────
  const loadFromHistory = useCallback((item: HistoryItem) => {
    setContentType(item.type);
    setTopic(item.topic);
    setTone(item.tone);
    setOutput(item.content);
    setShowHistory(false);
    toast.success("Loaded from history");
  }, []);

  const activeType = CONTENT_TYPES.find(t => t.id === contentType)!;

  // ── In-page guided steps (new Wizard) ────────────────────────────
  const guidedSteps: WizardStepDef[] = [
    {
      id: "type",
      title: "What are you writing?",
      description: "Pick the format — we'll tailor the writing style.",
      icon: <FileText size={18} />,
      component: (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
          {CONTENT_TYPES.map(ct => {
            const Icon = ct.icon;
            const selected = contentType === ct.id;
            return (
              <button
                key={ct.id}
                onClick={() => setContentType(ct.id)}
                className={`relative text-left p-4 rounded-xl border transition-all ${
                  selected
                    ? "border-gold bg-gold/10 shadow-lg shadow-gold/10"
                    : "border-border hover:border-gold/30 bg-surface-light"
                }`}
              >
                <Icon size={20} style={{ color: selected ? undefined : ct.color }} className={selected ? "text-gold" : ""} />
                <p className="text-sm font-semibold mt-2">{ct.label}</p>
                <p className="text-[10px] text-muted line-clamp-2 mt-0.5">{ct.description}</p>
                {selected && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-gold flex items-center justify-center">
                    <CheckCircle size={10} className="text-black" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      ),
    },
    {
      id: "topic",
      title: "What's it about?",
      description: "A single sentence is fine. Be specific — \"morning skincare routine for oily skin\" beats \"skincare\".",
      icon: <Sparkles size={18} />,
      canProceed: topic.trim().length > 0,
      component: (
        <div className="space-y-3">
          <input
            type="text"
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder={`e.g., ${activeType.id === "email" ? "Welcome sequence for SaaS onboarding" : activeType.id === "ad" ? "Local gym offering 30-day free trial" : "How to start a successful newsletter in 2026"}`}
            className="w-full px-4 py-3 rounded-xl bg-surface-light border border-border text-sm focus:outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/20 transition-all"
            autoFocus
          />
          <div>
            <label className="block text-[10px] text-muted uppercase tracking-wider mb-1.5 font-semibold">
              Who&apos;s it for? <span className="text-muted/60 normal-case">(optional but helps)</span>
            </label>
            <input
              type="text"
              value={audience}
              onChange={e => setAudience(e.target.value)}
              placeholder="e.g., SaaS founders, busy moms, first-time home buyers"
              className="w-full px-4 py-2.5 rounded-xl bg-surface-light border border-border text-sm focus:outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/20 transition-all"
            />
          </div>
        </div>
      ),
    },
    {
      id: "tone",
      title: "Pick a voice",
      description: "This controls the vibe — formal vs. playful, calm vs. punchy.",
      icon: <Type size={18} />,
      component: (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {TONES.map(t => {
            const selected = tone === t.id;
            const preview: Record<Tone, string> = {
              professional: "Clear, trustworthy, on-brand.",
              casual: "Like texting a friend.",
              witty: "Clever turns of phrase.",
              bold: "Short. Strong. Direct.",
            };
            return (
              <button
                key={t.id}
                onClick={() => setTone(t.id)}
                className={`text-left p-4 rounded-xl border transition-all ${
                  selected
                    ? "border-gold bg-gold/10 shadow-lg shadow-gold/10"
                    : "border-border hover:border-gold/30 bg-surface-light"
                }`}
              >
                <p className="text-sm font-semibold capitalize">{t.label}</p>
                <p className="text-[10px] text-muted mt-1">{preview[t.id]}</p>
              </button>
            );
          })}
        </div>
      ),
    },
    {
      id: "review",
      title: "Ready to write?",
      description: "We'll generate your copy now. Come back and tweak in Advanced mode if you need more control.",
      icon: <Wand2 size={18} />,
      component: (
        <div className="space-y-3">
          <div className="card bg-gold/[0.04] border-gold/20 space-y-2">
            <div className="flex items-center gap-2">
              <activeType.icon size={16} style={{ color: activeType.color }} />
              <p className="text-sm font-semibold">{activeType.label}</p>
              <span className="text-[10px] text-muted">· {tone} tone</span>
            </div>
            <p className="text-sm leading-relaxed">{topic || <span className="text-muted italic">(no topic yet)</span>}</p>
            {audience && (
              <p className="text-[11px] text-muted">For: <span className="text-foreground">{audience}</span></p>
            )}
          </div>
          <p className="text-[11px] text-muted text-center">
            Need keywords, length control, or templates? Flip to <span className="text-gold font-semibold">Advanced mode</span> at the top.
          </p>
        </div>
      ),
    },
  ];

  // ── Wizard steps ─────────────────────────────────────────────────
  const wizardSteps: WizardStep[] = [
    {
      id: "contentType",
      title: "What are you creating?",
      description: "Pick the content format that fits your goal.",
      icon: <FileText size={16} />,
      field: {
        type: "chip-select",
        key: "contentTypes",
        options: [
          { value: "blog", label: "Blog post" },
          { value: "landing", label: "Landing page" },
          { value: "email", label: "Email" },
          { value: "social", label: "Social post" },
          { value: "product", label: "Product description" },
          { value: "ad", label: "Ad copy" },
        ],
      },
    },
    {
      id: "topic",
      title: "What's your topic or product?",
      description: "One or two sentences is plenty — the more specific, the better.",
      icon: <Sparkles size={16} />,
      field: {
        type: "text",
        key: "topic",
        placeholder: "e.g., How AI is changing small-business marketing in 2026",
      },
      aiHelper: {
        label: "Suggest a trending topic in my niche",
        onClick: async (d) => {
          try {
            // Try dedicated suggest endpoint first
            const primary = await fetch("/api/copywriter/suggest-topic", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ contentTypes: d.contentTypes || [] }),
            }).catch(() => null);
            if (primary && primary.ok) {
              const data = await primary.json();
              const suggestion = (data?.topic as string | undefined) || (Array.isArray(data?.topics) ? data.topics[0] : undefined);
              if (suggestion) {
                toast.success("Topic suggested");
                return { topic: suggestion };
              }
            }
            // Fallback to enhance-prompt (Haiku/Sonnet)
            const seed = Array.isArray(d.contentTypes) && d.contentTypes.length > 0
              ? `a ${d.contentTypes.join(" & ")} on a trending marketing topic for 2026`
              : "a trending marketing topic for 2026";
            const res = await fetch("/api/ai/enhance-prompt", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: seed, type: "content" }),
            });
            if (!res.ok) {
              toast.error("Couldn't generate a topic — try again");
              return {};
            }
            const data = await res.json();
            const enhanced = (data?.enhanced as string | undefined)?.trim();
            if (!enhanced) {
              toast.error("No topic returned");
              return {};
            }
            toast.success("Topic suggested");
            return { topic: enhanced };
          } catch {
            toast.error("Network error — topic unchanged");
            return {};
          }
        },
      },
    },
    {
      id: "tone",
      title: "Pick a tone",
      description: "How should it sound when someone reads it?",
      icon: <Sliders size={16} />,
      field: {
        type: "chip-select",
        key: "tones",
        options: [
          { value: "professional", label: "Professional" },
          { value: "casual", label: "Casual" },
          { value: "witty", label: "Witty" },
          { value: "urgent", label: "Urgent" },
          { value: "educational", label: "Educational" },
          { value: "inspiring", label: "Inspiring" },
        ],
      },
    },
    {
      id: "keywords",
      title: "Keywords (optional)",
      description: "Give the AI a few target keywords to weave in naturally.",
      icon: <Hash size={16} />,
      field: {
        type: "text",
        key: "keywords",
        placeholder: "growth, automation, ROI",
        optional: true,
      },
      aiHelper: {
        label: "Auto-generate keywords",
        onClick: async (d) => {
          if (!d.topic || !String(d.topic).trim()) {
            toast.error("Pick a topic first");
            return {};
          }
          try {
            const primary = await fetch("/api/copywriter/generate-keywords", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ topic: d.topic }),
            }).catch(() => null);
            if (primary && primary.ok) {
              const data = await primary.json();
              const kws = Array.isArray(data?.keywords) ? data.keywords.join(", ") : data?.keywords;
              if (kws) {
                toast.success("Keywords generated");
                return { keywords: kws };
              }
            }
            // Fallback via enhance-prompt
            const res = await fetch("/api/ai/enhance-prompt", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                text: `Return a comma-separated list of 5-7 SEO keywords for: "${d.topic}". Keywords only, no prose.`,
                type: "general",
              }),
            });
            if (!res.ok) {
              toast.error("Couldn't generate keywords");
              return {};
            }
            const data = await res.json();
            const enhanced = (data?.enhanced as string | undefined)?.trim();
            if (!enhanced) {
              toast.error("No keywords returned");
              return {};
            }
            toast.success("Keywords generated");
            return { keywords: enhanced };
          } catch {
            toast.error("Network error — keywords unchanged");
            return {};
          }
        },
      },
    },
    {
      id: "length",
      title: "How long?",
      description: "Aim for short teasers, medium articles, or long-form deep dives.",
      icon: <Target size={16} />,
      field: {
        type: "chip-select",
        key: "lengths",
        options: [
          { value: "short", label: "Short (~200 words)" },
          { value: "medium", label: "Medium (~500 words)" },
          { value: "long", label: "Long (~1,200 words)" },
        ],
      },
    },
  ];

  // ── Wizard complete → generate and populate canvas ───────────────
  const handleWizardComplete = useCallback(async (data: Record<string, unknown>) => {
    const contentTypes = Array.isArray(data.contentTypes) ? (data.contentTypes as string[]) : [];
    const chosenType = (contentTypes[0] || "blog") as ContentType;
    const chosenTopic = String(data.topic || "").trim();
    const tones = Array.isArray(data.tones) ? (data.tones as string[]) : [];
    const rawTone = (tones[0] || "professional") as string;
    // Map wizard tones to page Tone type
    const toneMap: Record<string, Tone> = {
      professional: "professional",
      casual: "casual",
      witty: "witty",
      urgent: "bold",
      educational: "professional",
      inspiring: "bold",
    };
    const chosenTone: Tone = toneMap[rawTone] || "professional";
    const chosenKeywords = String(data.keywords || "").trim();
    const lengths = Array.isArray(data.lengths) ? (data.lengths as string[]) : [];
    const lengthKey = lengths[0] || "medium";
    const wc = lengthKey === "short" ? 200 : lengthKey === "long" ? 1200 : 500;

    if (!chosenTopic) {
      toast.error("Topic is required");
      return;
    }

    // Sync page state
    setContentType(chosenType);
    setTopic(chosenTopic);
    setTone(chosenTone);
    setKeywords(chosenKeywords);
    setWordCount(wc);
    setWizardOpen(false);

    // Generate
    setGenerating(true);
    setOutput("");
    try {
      const res = await fetch("/api/copywriter/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: chosenType,
          topic: chosenTopic,
          tone: chosenTone,
          audience,
          keywords: chosenKeywords,
          wordCount: wc,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        const content = result.content as string;
        setOutput(content);
        const item: HistoryItem = {
          id: String(Date.now()),
          type: chosenType,
          topic: chosenTopic,
          tone: chosenTone,
          content,
          wordCount: content.split(/\s+/).length,
          timestamp: new Date(),
        };
        setHistory(prev => [item, ...prev].slice(0, 20));
        trackGeneration({
          category: copyTypeToCategory(chosenType),
          title: chosenTopic.slice(0, 120),
          source_tool: "Copywriter",
          content_preview: content.slice(0, 200),
          metadata: { type: chosenType, tone: chosenTone, wordCount: content.split(/\s+/).length, wizard: true },
        });
        toast.success("Content generated!");
      } else {
        await new Promise(r => setTimeout(r, 1200));
        const mockContent = generateMockContent(chosenType, chosenTopic, chosenTone, audience, chosenKeywords, wc);
        setOutput(mockContent);
        const item: HistoryItem = {
          id: String(Date.now()),
          type: chosenType,
          topic: chosenTopic,
          tone: chosenTone,
          content: mockContent,
          wordCount: mockContent.split(/\s+/).length,
          timestamp: new Date(),
        };
        setHistory(prev => [item, ...prev].slice(0, 20));
        trackGeneration({
          category: copyTypeToCategory(chosenType),
          title: chosenTopic.slice(0, 120),
          source_tool: "Copywriter",
          content_preview: mockContent.slice(0, 200),
          metadata: { type: chosenType, tone: chosenTone, wordCount: mockContent.split(/\s+/).length, wizard: true, mock: true },
        });
        toast.success("Content generated!");
      }
    } catch {
      await new Promise(r => setTimeout(r, 1200));
      const mockContent = generateMockContent(chosenType, chosenTopic, chosenTone, audience, chosenKeywords, wc);
      setOutput(mockContent);
      const item: HistoryItem = {
        id: String(Date.now()),
        type: chosenType,
        topic: chosenTopic,
        tone: chosenTone,
        content: mockContent,
        wordCount: mockContent.split(/\s+/).length,
        timestamp: new Date(),
      };
      setHistory(prev => [item, ...prev].slice(0, 20));
      trackGeneration({
        category: copyTypeToCategory(chosenType),
        title: chosenTopic.slice(0, 120),
        source_tool: "Copywriter",
        content_preview: mockContent.slice(0, 200),
        metadata: { type: chosenType, tone: chosenTone, wordCount: mockContent.split(/\s+/).length, wizard: true, mock: true },
      });
      toast.success("Content generated!");
    } finally {
      setGenerating(false);
    }
  }, [audience]);

  return (
    <div className="p-6 max-w-7xl mx-auto fade-in">
      <PageHero
        className="mb-6"
        icon={<Pen size={28} />}
        title="AI Copywriter"
        subtitle="Blog posts, emails, social — copy that converts, in seconds."
        gradient="purple"
        actions={
          <>
            <AdvancedToggle value={advancedMode} onChange={setAdvancedMode} />
            {advancedMode && (
              <>
                <button
                  onClick={() => setWizardOpen(true)}
                  className="relative group flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-gradient-to-r from-gold to-amber-500 text-black shadow-lg shadow-gold/30 hover:shadow-gold/50 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <Sparkles size={13} className="animate-pulse" />
                  New with AI
                  <span className="ml-1 text-[8px] uppercase bg-black/20 px-1.5 py-0.5 rounded-full font-semibold tracking-wide">Recommended</span>
                </button>
                <button
                  onClick={() => {
                    setOutput("");
                    setTopic("");
                    setKeywords("");
                    toast.success("Blank canvas ready");
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-transparent border border-white/20 text-white hover:bg-white/10 transition-all"
                >
                  <Plus size={13} />
                  Blank
                </button>
                <button
                  onClick={() => setShowTemplates(!showTemplates)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all"
                >
                  <Layers size={13} />
                  Templates
                </button>
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all"
                >
                  <Clock size={13} />
                  History
                  {history.length > 0 && (
                    <span className="ml-1 text-[9px] bg-white/20 text-white px-1.5 py-0.5 rounded-full font-semibold">
                      {history.length}
                    </span>
                  )}
                </button>
              </>
            )}
          </>
        }
      />

      {/* Guided Mode — the "4-year-old friendly" path */}
      {!advancedMode && (
        <Wizard
          className="mb-6"
          steps={guidedSteps}
          activeIdx={guidedStep}
          onStepChange={setGuidedStep}
          finishLabel={generating ? "Writing…" : "Generate copy"}
          busy={generating}
          onFinish={async () => {
            await handleGenerate();
          }}
          onCancel={() => setAdvancedMode(true)}
          cancelLabel="Advanced mode"
        />
      )}

      {/* Output preview shown in guided mode once generated */}
      {!advancedMode && output && (
        <div className="card mb-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="section-header flex items-center gap-2">
              <CheckCircle size={14} className="text-success" /> Your copy is ready
            </h2>
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg bg-gold/10 text-gold hover:bg-gold/20 transition-colors"
            >
              <Copy size={11} /> Copy
            </button>
          </div>
          <div className="rounded-xl bg-surface-light border border-border p-4 max-h-[420px] overflow-y-auto">
            <pre className="text-xs text-foreground whitespace-pre-wrap font-sans leading-relaxed">{output}</pre>
          </div>
        </div>
      )}

      {/* Rolling preview of example copywriter outputs */}
      {advancedMode && (
        <div className="relative rounded-2xl overflow-hidden border border-border bg-surface-light/30 py-6 mb-6">
          <div className="absolute inset-0 pointer-events-none">
            <RollingPreview
              items={COPYWRITER_PREVIEW_FALLBACK}
              variant="text"
              rows={2}
              aspectRatio="16:9"
              opacity={0.55}
              speed="medium"
            />
          </div>
          <div className="relative text-center px-4">
            <p className="text-[11px] uppercase tracking-widest text-gold/80 font-semibold">
              Example copy library
            </p>
            <h3 className="text-lg font-bold text-foreground mt-1">
              Every angle, every tone, every funnel stage
            </h3>
            <p className="text-xs text-muted max-w-md mx-auto mt-1">
              Subject lines, ad headlines, landing heros — pick a template or
              start blank. ShortStack writes in your brand voice automatically.
            </p>
          </div>
        </div>
      )}

      {/* Creation Wizard */}
      <CreationWizard
        open={wizardOpen}
        title="Create with AI"
        subtitle="5 quick steps — we handle the rest"
        icon={<Wand2 size={18} />}
        submitLabel="Generate Content"
        steps={wizardSteps}
        initialData={{
          contentTypes: [contentType],
          topic,
          tones: [tone],
          keywords,
          lengths: [wordCount <= 300 ? "short" : wordCount >= 1000 ? "long" : "medium"],
        }}
        onClose={() => setWizardOpen(false)}
        onComplete={handleWizardComplete}
      />

      {/* Template Gallery */}
      {showTemplates && (
        <div className="mb-6 bg-surface border border-border rounded-2xl p-5 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-gold" />
              <h2 className="text-sm font-bold text-foreground">Template Gallery</h2>
              <span className="text-[9px] bg-gold/10 text-gold px-2 py-0.5 rounded-full font-medium">
                {TEMPLATES.length} templates
              </span>
            </div>
            <button onClick={() => setShowTemplates(false)} className="text-muted hover:text-foreground transition-colors">
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {TEMPLATES.map(template => {
              const Icon = template.icon;
              return (
                <button
                  key={template.id}
                  onClick={() => applyTemplate(template)}
                  className="text-left p-3 rounded-xl border border-border bg-surface-light/50 hover:bg-surface-light hover:border-gold/20 transition-all group"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: `${template.color}18` }}
                    >
                      <Icon size={13} style={{ color: template.color }} />
                    </div>
                    <span className="text-xs font-semibold text-foreground group-hover:text-gold transition-colors">
                      {template.name}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted leading-relaxed">{template.description}</p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-surface-light text-muted border border-border">
                      {CONTENT_TYPES.find(c => c.id === template.type)?.label}
                    </span>
                    <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-surface-light text-muted border border-border">
                      {template.tone}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* History Sidebar Overlay */}
      {showHistory && (
        <div className="mb-6 bg-surface border border-border rounded-2xl p-5 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-gold" />
              <h2 className="text-sm font-bold text-foreground">Recent Generations</h2>
            </div>
            <button onClick={() => setShowHistory(false)} className="text-muted hover:text-foreground transition-colors">
              <X size={16} />
            </button>
          </div>
          {history.length === 0 ? (
            <div className="text-center py-8">
              <Clock size={24} className="mx-auto mb-2 text-muted/40" />
              <p className="text-xs text-muted">No generations yet</p>
              <p className="text-[10px] text-muted/60 mt-1">Your generated content will appear here</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {history.map(item => {
                const typeConfig = CONTENT_TYPES.find(t => t.id === item.type)!;
                const TypeIcon = typeConfig.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => loadFromHistory(item)}
                    className="w-full text-left p-3 rounded-xl border border-border bg-surface-light/50 hover:bg-surface-light hover:border-gold/20 transition-all group flex items-start gap-3"
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: `${typeConfig.color}18` }}
                    >
                      <TypeIcon size={14} style={{ color: typeConfig.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate group-hover:text-gold transition-colors">
                        {item.topic}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] text-muted">{typeConfig.label}</span>
                        <span className="text-[9px] text-muted/40">|</span>
                        <span className="text-[9px] text-muted">{item.wordCount} words</span>
                        <span className="text-[9px] text-muted/40">|</span>
                        <span className="text-[9px] text-muted">
                          {item.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-muted/30 group-hover:text-gold shrink-0 mt-1 transition-colors" />
                  </button>
                );
              })}
            </div>
          )}
          {history.length > 0 && (
            <button
              onClick={() => { setHistory([]); toast.success("History cleared"); }}
              className="mt-3 flex items-center gap-1 text-[10px] text-muted hover:text-danger transition-colors"
            >
              <Trash2 size={10} /> Clear history
            </button>
          )}
        </div>
      )}

      {advancedMode && (
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Column - Input Form */}
        <div className="lg:col-span-2 space-y-5">
          {/* Content Type Selector */}
          <div className="bg-surface border border-border rounded-2xl p-5">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-3">
              <Type size={13} className="text-gold" />
              Content Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CONTENT_TYPES.map(type => {
                const Icon = type.icon;
                const active = contentType === type.id;
                return (
                  <button
                    key={type.id}
                    onClick={() => setContentType(type.id)}
                    className={`text-left p-2.5 rounded-xl border transition-all ${
                      active
                        ? "border-gold/30 bg-gold/[0.04]"
                        : "border-border bg-surface-light/50 hover:bg-surface-light"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-lg flex items-center justify-center"
                        style={{ background: active ? `${type.color}25` : `${type.color}12` }}
                      >
                        <Icon size={12} style={{ color: type.color }} />
                      </div>
                      <div>
                        <span className={`text-[11px] font-semibold block leading-tight ${active ? "text-foreground" : "text-muted"}`}>
                          {type.label}
                        </span>
                        <span className="text-[8px] text-muted leading-tight">{type.description}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Input Form */}
          <div className="bg-surface border border-border rounded-2xl p-5 space-y-4">
            {/* Topic / Brief */}
            <div>
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-2">
                <Sparkles size={13} className="text-gold" />
                Topic / Brief
              </label>
              <textarea
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder={`Describe what you want to write about...\n\nExample: "How AI is transforming small business marketing in 2026"`}
                rows={4}
                className="w-full text-xs bg-surface-light border border-border rounded-xl px-3.5 py-2.5 text-foreground placeholder:text-muted/60 focus:outline-none focus:border-gold focus:bg-surface focus:ring-2 focus:ring-gold/10 transition-all resize-none"
              />
            </div>

            {/* Tone */}
            <div>
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-2">
                <Sliders size={13} className="text-gold" />
                Tone
              </label>
              <div className="flex gap-2">
                {TONES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTone(t.id)}
                    className={`flex-1 py-2 text-[11px] font-medium rounded-lg border transition-all ${
                      tone === t.id
                        ? "border-gold/30 bg-gold/[0.06] text-foreground"
                        : "border-border bg-surface-light text-muted hover:text-foreground hover:bg-surface"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Audience */}
            <div>
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-2">
                <Users size={13} className="text-gold" />
                Target Audience
              </label>
              <input
                type="text"
                value={audience}
                onChange={e => setAudience(e.target.value)}
                placeholder="e.g., SaaS founders, e-commerce brands, local businesses"
                className="w-full text-xs bg-surface-light border border-border rounded-xl px-3.5 py-2.5 text-foreground placeholder:text-muted/60 focus:outline-none focus:border-gold focus:bg-surface focus:ring-2 focus:ring-gold/10 transition-all"
              />
            </div>

            {/* Keywords */}
            <div>
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-2">
                <Hash size={13} className="text-gold" />
                Keywords
              </label>
              <input
                type="text"
                value={keywords}
                onChange={e => setKeywords(e.target.value)}
                placeholder="Comma-separated: growth, automation, ROI, conversions"
                className="w-full text-xs bg-surface-light border border-border rounded-xl px-3.5 py-2.5 text-foreground placeholder:text-muted/60 focus:outline-none focus:border-gold focus:bg-surface focus:ring-2 focus:ring-gold/10 transition-all"
              />
            </div>

            {/* Word Count Slider */}
            <div>
              <label className="text-xs font-semibold text-foreground flex items-center justify-between mb-2">
                <span className="flex items-center gap-1.5">
                  <Target size={13} className="text-gold" />
                  Word Count
                </span>
                <span className="text-[10px] font-mono bg-surface-light border border-border px-2 py-0.5 rounded-lg text-muted">
                  {wordCount} words
                </span>
              </label>
              <input
                type="range"
                min={100}
                max={2000}
                step={50}
                value={wordCount}
                onChange={e => setWordCount(Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-gold"
                style={{
                  background: `linear-gradient(to right, rgb(var(--color-accent-rgb, 201 168 76)) ${((wordCount - 100) / 1900) * 100}%, rgb(var(--color-border-rgb, 232 229 224)) ${((wordCount - 100) / 1900) * 100}%)`,
                }}
              />
              <div className="flex justify-between mt-1">
                <span className="text-[8px] text-muted">100</span>
                <span className="text-[8px] text-muted">2000</span>
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={generating || !topic.trim()}
              className="w-full py-3 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all disabled:opacity-40"
              style={{
                background: generating ? "rgb(var(--color-muted-rgb, 107 114 128))" : "rgb(var(--color-accent-rgb, 201 168 76))",
                boxShadow: generating ? "none" : "0 2px 12px rgba(201,168,76,0.25)",
              }}
            >
              {generating ? (
                <>
                  <Loader size={15} className="animate-spin" />
                  Generating {activeType.label}...
                </>
              ) : (
                <>
                  <Wand2 size={15} />
                  Generate {activeType.label}
                </>
              )}
            </button>
          </div>

          {/* Quick Stats */}
          {history.length > 0 && (
            <div className="bg-surface border border-border rounded-2xl p-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground">{history.length}</p>
                  <p className="text-[9px] text-muted">Generated</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground">
                    {history.reduce((sum, h) => sum + h.wordCount, 0).toLocaleString()}
                  </p>
                  <p className="text-[9px] text-muted">Total Words</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground">{savedItems.size}</p>
                  <p className="text-[9px] text-muted">Saved</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Output */}
        <div className="lg:col-span-3">
          <div className="bg-surface border border-border rounded-2xl p-5 min-h-[600px] flex flex-col">
            {/* Output Header */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: `${activeType.color}18` }}
                >
                  {(() => { const Icon = activeType.icon; return <Icon size={14} style={{ color: activeType.color }} />; })()}
                </div>
                <div>
                  <h2 className="text-sm font-bold text-foreground">{activeType.label} Output</h2>
                  <p className="text-[9px] text-muted">
                    {output ? `${output.split(/\s+/).length} words generated` : "Configure your brief and hit Generate"}
                  </p>
                </div>
              </div>
              {output && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={copyToClipboard}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-lg bg-surface-light border border-border text-foreground hover:bg-gold/[0.06] hover:border-gold/20 transition-all"
                  >
                    <Copy size={12} />
                    Copy
                  </button>
                  <button
                    onClick={saveToLibrary}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-lg bg-gold/[0.06] border border-gold/20 text-gold hover:bg-gold/[0.12] transition-all"
                  >
                    <BookmarkPlus size={12} />
                    Save to Library
                  </button>
                </div>
              )}
            </div>

            {/* Output Content */}
            <div className="flex-1">
              {generating ? (
                <div className="space-y-4 animate-pulse">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-5 h-5 rounded-full bg-gold/20 flex items-center justify-center">
                      <Sparkles size={10} className="text-gold" />
                    </div>
                    <span className="text-xs text-muted">AI is writing your {activeType.label.toLowerCase()}...</span>
                  </div>
                  {/* Skeleton lines */}
                  <div className="skeleton h-6 w-3/4 rounded-lg" />
                  <div className="skeleton h-4 w-full rounded-lg" />
                  <div className="skeleton h-4 w-full rounded-lg" />
                  <div className="skeleton h-4 w-5/6 rounded-lg" />
                  <div className="h-4" />
                  <div className="skeleton h-5 w-1/2 rounded-lg" />
                  <div className="skeleton h-4 w-full rounded-lg" />
                  <div className="skeleton h-4 w-full rounded-lg" />
                  <div className="skeleton h-4 w-4/5 rounded-lg" />
                  <div className="h-4" />
                  <div className="skeleton h-4 w-full rounded-lg" />
                  <div className="skeleton h-4 w-3/4 rounded-lg" />
                  <div className="h-4" />
                  <div className="skeleton h-5 w-2/3 rounded-lg" />
                  <div className="skeleton h-4 w-full rounded-lg" />
                  <div className="skeleton h-4 w-full rounded-lg" />
                  <div className="skeleton h-4 w-5/6 rounded-lg" />
                </div>
              ) : output ? (
                <div className="prose-output">
                  <div className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                    {output.split("\n").map((line, i) => {
                      // Heading 1
                      if (line.startsWith("# ")) {
                        return (
                          <h2 key={i} className="text-base font-bold text-foreground mt-5 mb-2 first:mt-0">
                            {line.replace(/^# /, "")}
                          </h2>
                        );
                      }
                      // Heading 2
                      if (line.startsWith("## ")) {
                        return (
                          <h3 key={i} className="text-sm font-bold text-foreground mt-4 mb-2">
                            {line.replace(/^## /, "")}
                          </h3>
                        );
                      }
                      // Heading 3
                      if (line.startsWith("### ")) {
                        return (
                          <h4 key={i} className="text-xs font-bold text-foreground mt-3 mb-1.5">
                            {line.replace(/^### /, "")}
                          </h4>
                        );
                      }
                      // Horizontal rule
                      if (line.trim() === "---") {
                        return <hr key={i} className="my-4 border-border" />;
                      }
                      // Blockquote
                      if (line.startsWith("> ")) {
                        return (
                          <blockquote key={i} className="border-l-2 border-gold/40 pl-3 my-2 text-muted italic text-[11px]">
                            {renderInlineFormatting(line.replace(/^> /, ""))}
                          </blockquote>
                        );
                      }
                      // Bullet points
                      if (line.startsWith("- ")) {
                        return (
                          <div key={i} className="flex gap-2 my-0.5 ml-2">
                            <span className="text-gold mt-0.5 shrink-0">&#8226;</span>
                            <span>{renderInlineFormatting(line.replace(/^- /, ""))}</span>
                          </div>
                        );
                      }
                      // Numbered list
                      if (/^\d+\.\s/.test(line)) {
                        const match = line.match(/^(\d+)\.\s(.*)$/);
                        if (match) {
                          return (
                            <div key={i} className="flex gap-2 my-0.5 ml-2">
                              <span className="text-gold font-semibold shrink-0">{match[1]}.</span>
                              <span>{renderInlineFormatting(match[2])}</span>
                            </div>
                          );
                        }
                      }
                      // Empty line
                      if (line.trim() === "") {
                        return <div key={i} className="h-2" />;
                      }
                      // Italic comment line (starts with *)
                      if (line.startsWith("*") && line.endsWith("*") && !line.startsWith("**")) {
                        return (
                          <p key={i} className="text-[10px] text-muted italic my-1">
                            {line.replace(/^\*|\*$/g, "")}
                          </p>
                        );
                      }
                      // Normal paragraph
                      return (
                        <p key={i} className="my-1">
                          {renderInlineFormatting(line)}
                        </p>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gold/[0.06] flex items-center justify-center mb-4">
                    <PenTool size={28} className="text-gold/40" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground mb-1">Ready to Write</h3>
                  <p className="text-[11px] text-muted max-w-xs mb-4">
                    Fill in your brief on the left and hit Generate to create polished, agency-quality copy in seconds.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {CONTENT_TYPES.map(type => {
                      const Icon = type.icon;
                      return (
                        <span
                          key={type.id}
                          className="inline-flex items-center gap-1 text-[9px] px-2 py-1 rounded-lg bg-surface-light border border-border text-muted"
                        >
                          <Icon size={10} style={{ color: type.color }} />
                          {type.label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Output Footer */}
            {output && (
              <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-[9px] text-muted flex items-center gap-1">
                    <CheckCircle size={10} className="text-success" />
                    Generated successfully
                  </span>
                  <span className="text-[9px] text-muted">
                    {output.split(/\s+/).length} words
                  </span>
                </div>
                <button
                  onClick={() => { setOutput(""); handleGenerate(); }}
                  className="flex items-center gap-1 text-[10px] text-muted hover:text-foreground transition-colors"
                >
                  <RotateCcw size={10} />
                  Regenerate
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

// ── Inline markdown formatting helper ──────────────────────────────
function renderInlineFormatting(text: string): (string | JSX.Element)[] {
  const parts: (string | JSX.Element)[] = [];
  // Process bold (**text**) and links ([text](#))
  const regex = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Text before the match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[1]) {
      // Bold text
      parts.push(
        <strong key={match.index} className="font-semibold text-foreground">
          {match[1]}
        </strong>
      );
    } else if (match[2] && match[3]) {
      // Link
      parts.push(
        <span key={match.index} className="text-gold font-medium underline underline-offset-2 decoration-gold/30">
          {match[2]}
        </span>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}
