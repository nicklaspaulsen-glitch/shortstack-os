"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import toast from "react-hot-toast";
import {
  Film, Megaphone, Globe, Search, Phone, Zap,
  Camera, Send, Sparkles,
  Loader, CheckCircle, PenTool
} from "lucide-react";

interface ServiceAgent {
  id: string;
  name: string;
  tagline: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  capabilities: string[];
  actions: Array<{ label: string; prompt: string }>;
}

const AGENTS: ServiceAgent[] = [
  {
    id: "short-form",
    name: "Short-Form Content",
    tagline: "Reels, TikToks & Shorts that go viral",
    description: "AI agent that generates scroll-stopping short-form video scripts, hooks, captions, and posting schedules. Designed to capture attention in under 60 seconds.",
    icon: <Camera size={22} />,
    color: "text-pink-400",
    bg: "from-pink-500/10 to-purple-500/10 border-pink-400/15",
    capabilities: [
      "Generate viral hooks and scripts",
      "Write captions with hashtags",
      "Create 30-day content calendars",
      "Repurpose long-form into shorts",
      "A/B test different hooks",
      "Platform-specific formatting (IG, TT, YT)",
    ],
    actions: [
      { label: "Generate 10 hooks", prompt: "Generate 10 viral short-form video hooks for a {industry} business targeting {audience}. Make them scroll-stopping and curiosity-driven." },
      { label: "Write a script", prompt: "Write a 30-second short-form video script for {topic}. Include hook, body, and CTA. Make it engaging and fast-paced." },
      { label: "30-day calendar", prompt: "Create a 30-day short-form content calendar for {business_name}. Include video topics, hooks, and best posting times for each platform." },
      { label: "Caption + hashtags", prompt: "Write an Instagram Reel caption for a video about {topic}. Include a strong CTA and 20 relevant hashtags." },
    ],
  },
  {
    id: "long-form",
    name: "Long-Form Content",
    tagline: "Full video production & scripting",
    description: "AI agent for full-length video scripting, YouTube SEO, production planning, and repurposing long content into short clips.",
    icon: <Film size={22} />,
    color: "text-red-400",
    bg: "from-red-500/10 to-orange-500/10 border-red-400/15",
    capabilities: [
      "Full video scripts with timestamps",
      "YouTube SEO titles & descriptions",
      "Thumbnail concept ideas",
      "Repurpose into 5-10 short clips",
      "Production shot lists",
      "Podcast episode outlines",
    ],
    actions: [
      { label: "YouTube script", prompt: "Write a full 10-minute YouTube video script about {topic} for a {industry} business. Include intro hook, chapters, and end CTA." },
      { label: "SEO optimization", prompt: "Generate a YouTube SEO-optimized title, description, and 30 tags for a video about {topic}." },
      { label: "Repurpose plan", prompt: "Take this long-form video concept '{topic}' and create a repurposing plan: extract 5 short-form clips, 3 quote graphics, and 2 blog post outlines." },
      { label: "Thumbnail ideas", prompt: "Generate 5 YouTube thumbnail concepts for a video titled '{title}'. Describe the visual layout, text overlay, and emotion for each." },
    ],
  },
  {
    id: "paid-ads",
    name: "Paid Ads",
    tagline: "Meta, Google & TikTok ad campaigns",
    description: "AI agent that designs ad campaigns, writes copy, creates audience targeting strategies, and optimizes for ROAS across Meta, Google, and TikTok.",
    icon: <Megaphone size={22} />,
    color: "text-blue-400",
    bg: "from-blue-500/10 to-indigo-500/10 border-blue-400/15",
    capabilities: [
      "Ad copy for Meta, Google, TikTok",
      "Audience targeting strategies",
      "Campaign architecture & funnel mapping",
      "A/B test variations",
      "Budget allocation recommendations",
      "ROAS optimization suggestions",
    ],
    actions: [
      { label: "Meta ad copy", prompt: "Write 5 Facebook/Instagram ad copy variations for {business_name} promoting {offer}. Include primary text, headline, and CTA for each." },
      { label: "Campaign strategy", prompt: "Design a full-funnel ad campaign for a {industry} business with a ${budget}/month budget. Include targeting, placements, and creative recommendations." },
      { label: "Google Ads", prompt: "Write 10 Google Ads headlines and 4 descriptions for a {industry} business targeting '{keywords}'. Follow Google Ads character limits." },
      { label: "TikTok ads", prompt: "Create 3 TikTok Spark Ad concepts for {business_name}. Include hook, script, and why it would perform well in the TikTok algorithm." },
    ],
  },
  {
    id: "seo",
    name: "SEO & Content Marketing",
    tagline: "Organic traffic & search rankings",
    description: "AI agent for technical SEO audits, keyword research, blog content, and local SEO optimization to drive consistent organic traffic.",
    icon: <Search size={22} />,
    color: "text-emerald-400",
    bg: "from-emerald-500/10 to-green-500/10 border-emerald-400/15",
    capabilities: [
      "Keyword research & clustering",
      "SEO blog articles",
      "Technical SEO audit checklists",
      "Local SEO optimization",
      "Google Business Profile optimization",
      "Competitor gap analysis",
    ],
    actions: [
      { label: "Keyword research", prompt: "Do keyword research for a {industry} business in {location}. Find 20 keywords with search volume estimates, difficulty, and content intent." },
      { label: "Blog article", prompt: "Write a 1500-word SEO-optimized blog article about '{topic}' for a {industry} business. Include H2/H3 headers, meta description, and internal linking suggestions." },
      { label: "Local SEO audit", prompt: "Create a local SEO audit checklist for a {industry} business in {location}. Include Google Business Profile, citations, reviews, and on-page optimizations." },
      { label: "Content strategy", prompt: "Create a 3-month SEO content strategy for {business_name}. Include 12 blog topics, target keywords, and publishing schedule." },
    ],
  },
  {
    id: "web-design",
    name: "Web Design & Funnels",
    tagline: "Websites & landing pages that convert",
    description: "AI agent that designs website layouts, writes conversion copy, plans funnel architectures, and creates landing page content.",
    icon: <Globe size={22} />,
    color: "text-cyan-400",
    bg: "from-cyan-500/10 to-blue-500/10 border-cyan-400/15",
    capabilities: [
      "Website copy & layout planning",
      "Landing page copy",
      "Sales funnel architecture",
      "Conversion rate optimization",
      "Call-to-action optimization",
      "Wireframe descriptions",
    ],
    actions: [
      { label: "Website copy", prompt: "Write all website copy for a {industry} business homepage. Include hero section, services, about, testimonials, and CTA sections." },
      { label: "Landing page", prompt: "Write a high-converting landing page for {offer}. Include headline, subheadline, benefits, social proof, FAQ, and CTA." },
      { label: "Funnel strategy", prompt: "Design a sales funnel for {business_name} selling {service}. Include traffic source, landing page, email sequence, and follow-up strategy." },
      { label: "CRO audit", prompt: "Audit this website concept for {business_name} and suggest 10 conversion rate optimizations. Focus on copy, layout, trust signals, and CTAs." },
    ],
  },
  {
    id: "ai-receptionist",
    name: "AI Receptionist",
    tagline: "24/7 call & text handling",
    description: "AI-powered phone and text agent that answers calls, qualifies leads, books appointments, and handles inquiries around the clock.",
    icon: <Phone size={22} />,
    color: "text-amber-400",
    bg: "from-amber-500/10 to-yellow-500/10 border-amber-400/15",
    capabilities: [
      "24/7 call answering",
      "Lead qualification scripts",
      "Appointment booking",
      "FAQ handling",
      "Text message follow-ups",
      "Voicemail drops",
    ],
    actions: [
      { label: "Call script", prompt: "Write an AI receptionist call script for a {industry} business. Include greeting, qualification questions, booking flow, and objection handling." },
      { label: "SMS sequences", prompt: "Create a 5-message SMS follow-up sequence for leads who called but didn't book. Space messages over 7 days." },
      { label: "FAQ responses", prompt: "Write 15 FAQ responses for a {industry} business AI receptionist. Cover pricing, hours, services, location, and booking." },
      { label: "Voicemail script", prompt: "Write 3 AI voicemail drop scripts for {business_name}. Make them natural, friendly, and include a callback CTA." },
    ],
  },
  {
    id: "automation",
    name: "Automation Workflows",
    tagline: "Connect your tools & automate everything",
    description: "AI agent that designs and deploys custom automation workflows connecting your CRM, email, social media, and other tools.",
    icon: <Zap size={22} />,
    color: "text-gold",
    bg: "from-gold/10 to-amber-500/10 border-gold/15",
    capabilities: [
      "CRM automation sequences",
      "Email drip campaigns",
      "Lead scoring & routing",
      "Task automation",
      "Cross-platform workflows",
      "Trigger-based actions",
    ],
    actions: [
      { label: "Onboarding flow", prompt: "Design a new client onboarding automation for {business_name}. Include welcome email, task creation, CRM update, team notification, and 7-day check-in." },
      { label: "Lead nurture", prompt: "Create a 14-day lead nurture email sequence for a {industry} business. Include subject lines, email body, and send timing." },
      { label: "Review request", prompt: "Design an automated Google Review request workflow. Trigger after service completion, send SMS then email, follow up after 3 days." },
      { label: "Pipeline automation", prompt: "Map out a full sales pipeline automation: lead comes in → qualification → proposal → follow-up → close. Define triggers and actions for each stage." },
    ],
  },
  {
    id: "branding",
    name: "Branding & Creative",
    tagline: "Brand identity & style guides",
    description: "AI agent for brand strategy, visual identity concepts, messaging frameworks, and creative direction.",
    icon: <PenTool size={22} />,
    color: "text-purple-400",
    bg: "from-purple-500/10 to-pink-500/10 border-purple-400/15",
    capabilities: [
      "Brand voice & tone guides",
      "Messaging frameworks",
      "Brand story development",
      "Competitive positioning",
      "Color & style recommendations",
      "Tagline generation",
    ],
    actions: [
      { label: "Brand voice guide", prompt: "Create a brand voice and tone guide for {business_name} in the {industry} industry. Include dos/don'ts, example phrases, and tone spectrum." },
      { label: "Tagline options", prompt: "Generate 20 tagline options for {business_name}. Mix between professional, bold, and creative styles." },
      { label: "Brand story", prompt: "Write a compelling brand story for {business_name}. Include origin, mission, values, and what makes them different." },
      { label: "Positioning", prompt: "Create a competitive positioning statement for {business_name} vs their competitors in {location}. Include unique value proposition and differentiators." },
    ],
  },
  {
    id: "cold-outreach",
    name: "Cold DM Outreach",
    tagline: "AI-powered lead generation via DMs",
    description: "AI agent that crafts personalized cold DM sequences for Instagram, LinkedIn, and Facebook to generate leads at scale. Admin only.",
    icon: <Send size={22} />,
    color: "text-green-400",
    bg: "from-green-500/10 to-emerald-500/10 border-green-400/15",
    capabilities: [
      "Personalized DM scripts",
      "Multi-step follow-up sequences",
      "Industry-specific templates",
      "A/B test message variations",
      "Reply handling scripts",
      "Lead qualification in DMs",
    ],
    actions: [
      { label: "DM sequence", prompt: "Write a 4-message cold DM outreach sequence for reaching {industry} business owners on Instagram. Include initial message, follow-up, value offer, and soft close." },
      { label: "LinkedIn outreach", prompt: "Write 5 LinkedIn connection request messages and follow-up sequences for targeting {industry} business owners. Be professional but personable." },
      { label: "Reply scripts", prompt: "Write response scripts for common replies to cold DMs: 'not interested', 'what's the price', 'tell me more', 'already have someone', 'maybe later'." },
      { label: "DM templates", prompt: "Create 10 cold DM templates for different industries: dentist, lawyer, gym, restaurant, plumber, roofer, accountant, chiropractor, real estate, salon." },
    ],
  },
];

export default function ServicesPage() {
  const auth = useAuth();
  const userRole = auth.profile?.role;
  const [activeAgent, setActiveAgent] = useState<ServiceAgent | null>(null);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState("");
  const [variables, setVariables] = useState<Record<string, string>>({});

  async function runAction(prompt: string) {
    setGenerating(true);
    setResult("");
    toast.loading("AI is generating... this takes 5-15 seconds");

    // Replace variables in prompt — use smart defaults if empty
    let finalPrompt = prompt;
    const defaults: Record<string, string> = {
      industry: "dental", business_name: "a local business", audience: "business owners aged 30-55",
      location: "Miami, FL", topic: "getting more clients", keywords: "local services",
      offer: "free consultation", service: "digital marketing", budget: "$2000/month",
      platform: "Instagram and TikTok", client: "the client",
    };
    // First apply user-entered variables
    Object.entries(variables).forEach(([k, v]) => {
      if (v) finalPrompt = finalPrompt.replace(new RegExp(`\\{${k}\\}`, "g"), v);
    });
    // Then fill remaining with defaults
    Object.entries(defaults).forEach(([k, v]) => {
      finalPrompt = finalPrompt.replace(new RegExp(`\\{${k}\\}`, "g"), v);
    });
    // Clean any remaining unfilled vars
    finalPrompt = finalPrompt.replace(/\{(\w+)\}/g, (_, key) => key.replace(/_/g, " "));

    try {
      const res = await fetch("/api/agents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: finalPrompt,
          agent_name: activeAgent ? `${activeAgent.name} — ${activeAgent.tagline}` : "AI Agent",
        }),
      });
      const data = await res.json();
      toast.dismiss();
      setResult(data.result || data.error || "No response");
    } catch {
      toast.dismiss();
      setResult("Error generating content. Try again.");
    }
    setGenerating(false);
  }

  // Extract variables from prompt
  function getVars(prompt: string): string[] {
    const vars: string[] = [];
    const regex = /\{(\w+)\}/g;
    let match;
    while ((match = regex.exec(prompt)) !== null) {
      vars.push(match[1]);
    }
    return vars;
  }

  const QUICK_NAV = [
    { task: "Write video scripts", tool: "Script Lab", href: "/dashboard/script-lab", icon: <Sparkles size={12} />, color: "text-gold" },
    { task: "Manage social media", tool: "Social Manager", href: "/dashboard/social-manager", icon: <Camera size={12} />, color: "text-pink-400" },
    { task: "Run ad campaigns", tool: "Ads Manager", href: "/dashboard/ads", icon: <Megaphone size={12} />, color: "text-blue-400" },
    { task: "Build automations", tool: "Workflows", href: "/dashboard/workflows", icon: <Zap size={12} />, color: "text-warning" },
    { task: "Generate images", tool: "Script Lab → MJ Prompts", href: "/dashboard/script-lab", icon: <PenTool size={12} />, color: "text-purple-400" },
    { task: "Build websites", tool: "Ask Trinity AI", href: "/dashboard/trinity", icon: <Globe size={12} />, color: "text-cyan-400" },
    { task: "Cold outreach", tool: "Lead Engine", href: "/dashboard/leads", icon: <Send size={12} />, color: "text-green-400" },
    { task: "Spy on competitors", tool: "Spy Tool", href: "/dashboard/competitor", icon: <Search size={12} />, color: "text-red-400" },
    { task: "Generate proposals", tool: "Proposals", href: "/dashboard/proposals", icon: <Film size={12} />, color: "text-amber-400" },
    { task: "AI phone calls", tool: "Lead Engine → GHL", href: "/dashboard/leads", icon: <Phone size={12} />, color: "text-emerald-400" },
  ];

  return (
    <div className="fade-in space-y-5">
      <div>
        <h1 className="page-header mb-0 flex items-center gap-2">
          <Sparkles size={18} className="text-gold" /> AI Service Agents
        </h1>
        <p className="text-xs text-muted mt-0.5">Each service has a dedicated AI agent — click to generate content, strategies, and campaigns</p>
      </div>

      {/* Quick nav — what tool for what */}
      <div className="card border-gold/10">
        <h2 className="text-[10px] text-muted uppercase tracking-[0.15em] font-bold mb-2">I want to...</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-1.5">
          {QUICK_NAV.map((item, i) => (
            <a key={i} href={item.href}
              className="flex items-center gap-2 p-2 rounded-lg border border-border/20 hover:border-gold/15 transition-all group">
              <span className={item.color}>{item.icon}</span>
              <div className="min-w-0">
                <p className="text-[10px] font-medium group-hover:text-white transition-colors truncate">{item.task}</p>
                <p className="text-[8px] text-muted truncate">{item.tool}</p>
              </div>
            </a>
          ))}
        </div>
      </div>

      <div className="flex gap-4">
        {/* Agent list */}
        <div className={`${activeAgent ? "w-1/3" : "w-full"} transition-all`}>
          <div className={`grid ${activeAgent ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"} gap-2.5`}>
            {AGENTS.filter(a => {
              if (a.id === "cold-outreach" && userRole === "client") return false;
              return true;
            }).map(agent => (
              <button
                key={agent.id}
                onClick={() => { setActiveAgent(agent); setResult(""); setVariables({}); }}
                className={`text-left rounded-xl p-4 border transition-all hover:-translate-y-[1px] ${
                  activeAgent?.id === agent.id
                    ? `bg-gradient-to-br ${agent.bg} shadow-card-hover`
                    : "border-border/30 bg-surface hover:border-gold/15 hover:shadow-card-hover"
                }`}
              >
                <div className="flex items-center gap-2.5 mb-1.5">
                  <span className={activeAgent?.id === agent.id ? agent.color : "text-muted"}>{agent.icon}</span>
                  <div>
                    <p className="text-xs font-semibold">{agent.name}</p>
                    <p className="text-[9px] text-muted">{agent.tagline}</p>
                  </div>
                </div>
                {!activeAgent && (
                  <p className="text-[10px] text-muted leading-relaxed mt-1">{agent.description}</p>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Agent workspace */}
        {activeAgent && (
          <div className="w-2/3 space-y-4 fade-in">
            {/* Header */}
            <div className={`card bg-gradient-to-br ${activeAgent.bg} border`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-surface/50 rounded-xl flex items-center justify-center border border-border/20">
                    <span className={activeAgent.color}>{activeAgent.icon}</span>
                  </div>
                  <div>
                    <h2 className="text-sm font-bold">{activeAgent.name} Agent</h2>
                    <p className="text-[10px] text-muted">{activeAgent.description}</p>
                  </div>
                </div>
                <button onClick={() => setActiveAgent(null)} className="text-muted hover:text-white text-xs">Close</button>
              </div>
            </div>

            {/* Capabilities */}
            <div className="card">
              <h3 className="text-[10px] text-muted uppercase tracking-wider font-medium mb-2">Capabilities</h3>
              <div className="grid grid-cols-2 gap-1.5">
                {activeAgent.capabilities.map((cap, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[10px]">
                    <CheckCircle size={10} className="text-success shrink-0" />
                    <span>{cap}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick actions */}
            <div className="card">
              <h3 className="text-[10px] text-muted uppercase tracking-wider font-medium mb-2">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-2">
                {activeAgent.actions.map((action, i) => {
                  return (
                    <div key={i} className="space-y-1.5">
                      <button
                        onClick={() => runAction(action.prompt)}
                        disabled={generating}
                        className="w-full text-left p-2.5 rounded-lg border border-border/30 hover:border-gold/20 transition-all text-xs disabled:opacity-50"
                      >
                        <div className="flex items-center gap-1.5">
                          <Sparkles size={11} className="text-gold shrink-0" />
                          <span className="font-medium">{action.label}</span>
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>

              <p className="text-[8px] text-muted mt-2 flex items-center gap-1">
                <CheckCircle size={8} className="text-success" /> Just click — smart defaults auto-fill everything
              </p>

              {/* Variable inputs — collapsed by default */}
              {activeAgent.actions.length > 0 && (
                <details className="mt-2 pt-2 border-t border-border/20">
                  <summary className="text-[9px] text-muted cursor-pointer hover:text-white transition-colors">
                    Customize variables (optional)
                  </summary>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {Array.from(new Set(activeAgent.actions.flatMap(a => getVars(a.prompt)))).map(v => (
                      <div key={v}>
                        <label className="text-[9px] text-muted capitalize">{v.replace(/_/g, " ")}</label>
                        <input
                          value={variables[v] || ""}
                          onChange={e => setVariables({ ...variables, [v]: e.target.value })}
                          placeholder={`Default: ${({
                            industry: "dental", business_name: "local business", audience: "owners 30-55",
                            location: "Miami, FL", topic: "more clients", service: "digital marketing",
                          } as Record<string, string>)[v] || v.replace(/_/g, " ")}`}
                          className="input w-full text-[10px] py-1"
                        />
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>

            {/* Result */}
            {(generating || result) && (
              <div className="card">
                <h3 className="text-[10px] text-muted uppercase tracking-wider font-medium mb-2">Output</h3>
                {generating ? (
                  <div className="flex items-center gap-2 py-4 justify-center">
                    <Loader size={14} className="animate-spin text-gold" />
                    <span className="text-xs text-muted">Generating...</span>
                  </div>
                ) : (
                  <div className="bg-surface-light/30 rounded-lg p-3 border border-border/20 max-h-[400px] overflow-y-auto">
                    <pre className="text-xs whitespace-pre-wrap leading-relaxed">{result}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
