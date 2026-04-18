"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Zap, Users, Briefcase, Film, Bot, ArrowRight, Compass } from "lucide-react";

interface SearchResult {
  type: string;
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

// ── Page nav entries — kept in sync with command-palette.tsx so typing
//    "notifications" / "ai studio" / "domain" in the top-bar search returns
//    direct navigation links even though those aren't leads/clients/content.
interface NavEntry {
  id: string;
  label: string;
  href: string;
  keywords: string;
}

const NAV_PAGES: NavEntry[] = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard", keywords: "home main" },
  { id: "analytics", label: "Analytics", href: "/dashboard/analytics", keywords: "charts stats metrics" },
  { id: "reports", label: "AI Reports", href: "/dashboard/reports", keywords: "report client weekly monthly ai generate" },
  { id: "leads", label: "Lead Finder", href: "/dashboard/scraper", keywords: "scrape search find" },
  { id: "engine", label: "Lead Engine", href: "/dashboard/leads", keywords: "outreach dms pipeline" },
  { id: "outreach", label: "Outreach Hub", href: "/dashboard/outreach-hub", keywords: "tiers hot warm cold" },
  { id: "logs", label: "Outreach Logs", href: "/dashboard/outreach-logs", keywords: "dm email call log" },
  { id: "clients", label: "Clients", href: "/dashboard/clients", keywords: "manage portal" },
  { id: "proposals", label: "Proposals", href: "/dashboard/proposals", keywords: "pitch deck pdf" },
  { id: "services", label: "AI Agents", href: "/dashboard/services", keywords: "tools services ai" },
  { id: "social", label: "Social Manager", href: "/dashboard/social-manager", keywords: "post schedule autopilot social" },
  { id: "scriptlab", label: "Script Lab", href: "/dashboard/script-lab", keywords: "write viral framework hooks script" },
  { id: "websites", label: "Website Builder", href: "/dashboard/websites", keywords: "build deploy site website" },
  { id: "design", label: "Design Studio", href: "/dashboard/design", keywords: "canva midjourney design" },
  { id: "thumbnails", label: "Thumbnail Generator", href: "/dashboard/thumbnail-generator", keywords: "thumbnail pikzels youtube cover image ai" },
  { id: "production", label: "Production", href: "/dashboard/production", keywords: "edit video footage editors production" },
  { id: "content", label: "Content AI", href: "/dashboard/content", keywords: "scripts generate content" },
  { id: "ads", label: "Ads Manager", href: "/dashboard/ads-manager", keywords: "meta google tiktok campaigns oauth native ads" },
  { id: "automations", label: "Automations", href: "/dashboard/automations", keywords: "dm manychat templates automation" },
  { id: "workflows", label: "Workflows", href: "/dashboard/workflows", keywords: "automation agent builder flow workflow" },
  { id: "flow-builder", label: "Flow Builder", href: "/dashboard/workflow-builder", keywords: "flow workflow visual builder automate drag drop node canvas" },
  { id: "trinity", label: "Trinity AI", href: "/dashboard/trinity", keywords: "assistant chat voice trinity ai" },
  { id: "reviews", label: "Reviews", href: "/dashboard/reviews", keywords: "google review respond" },
  { id: "email-templates", label: "Email Templates", href: "/dashboard/email-templates", keywords: "email template cold outreach" },
  { id: "spy", label: "Competitor Spy", href: "/dashboard/competitor", keywords: "analyze research competitor spy" },
  { id: "agenthq", label: "Agent HQ", href: "/dashboard/agent-supervisor", keywords: "supervisor nexus chief monitor agent" },
  { id: "integrations", label: "Integrations", href: "/dashboard/integrations", keywords: "integrations zernio connect oauth platforms apps" },
  { id: "ai-studio", label: "AI Studio", href: "/dashboard/ai-studio", keywords: "ai studio image generate remove background upscale transcribe" },
  { id: "domains", label: "Domains", href: "/dashboard/domains", keywords: "domain buy godaddy dns register purchase" },
  { id: "ai-caller", label: "AI Caller", href: "/dashboard/eleven-agents", keywords: "eleven agents elevenlabs voice call ai caller" },
  { id: "voice-ai", label: "Voice AI", href: "/dashboard/voice-receptionist", keywords: "voice receptionist ai answer call" },
  { id: "crm", label: "CRM", href: "/dashboard/crm", keywords: "customers contacts leads pipeline crm" },
  { id: "inbox", label: "Inbox", href: "/dashboard/inbox", keywords: "messages unified inbox notifications" },
  { id: "generations", label: "Generations", href: "/dashboard/generations", keywords: "ai history generations output" },
  { id: "content-plan", label: "Content Plan", href: "/dashboard/content-plan", keywords: "content calendar schedule posts plan social" },
  { id: "brand-kit", label: "Brand Kit", href: "/dashboard/brand-kit", keywords: "brand kit logo colors fonts" },
  { id: "brand-voice", label: "Brand Voice", href: "/dashboard/brand-voice", keywords: "brand voice tone writing style" },
  { id: "workspaces", label: "Workspaces", href: "/dashboard/workspaces", keywords: "workspaces teams multi-tenant" },
  { id: "discord", label: "Discord", href: "/dashboard/discord", keywords: "discord community chat server" },
  { id: "monitor", label: "System Monitor", href: "/dashboard/monitor", keywords: "health integrations status" },
  { id: "briefing", label: "Morning Briefing", href: "/dashboard/briefing", keywords: "daily report morning briefing" },
  { id: "settings", label: "Settings", href: "/dashboard/settings", keywords: "theme zoom sound sfx settings" },
  { id: "notifications", label: "Notifications", href: "/dashboard/notifications", keywords: "notifications alerts badges" },
  { id: "calendar", label: "Calendar & Booking", href: "/dashboard/calendar", keywords: "schedule appointment meeting call calendar" },
  { id: "conversations", label: "Conversations", href: "/dashboard/conversations", keywords: "chat sms messages replies" },
  { id: "deals", label: "Deals Pipeline", href: "/dashboard/deals", keywords: "pipeline sales revenue won lost deals" },
  { id: "invoices", label: "Invoices", href: "/dashboard/invoices", keywords: "billing payments stripe money invoice" },
  { id: "sequences", label: "Email Sequences", href: "/dashboard/sequences", keywords: "drip campaign email automation followup sequence" },
  { id: "forms", label: "Form Builder", href: "/dashboard/forms", keywords: "lead capture embed form" },
  { id: "tags", label: "Tags", href: "/dashboard/tags", keywords: "tag label organize leads hot warm cold" },
  { id: "webhooks", label: "Webhooks", href: "/dashboard/webhooks", keywords: "webhook zapier make api integration" },
  { id: "client-health", label: "Client Health", href: "/dashboard/client-health", keywords: "health churn risk retention clients" },
  { id: "agent-controls", label: "Agent Controls", href: "/dashboard/agent-controls", keywords: "settings configure agents schedule leads outreach" },
  { id: "dm-controller", label: "DM Controller", href: "/dashboard/dm-controller", keywords: "dm cold instagram tiktok browser" },
  { id: "forecast", label: "Forecast", href: "/dashboard/forecast", keywords: "forecast predict revenue future" },
  { id: "team", label: "Team", href: "/dashboard/team", keywords: "team members editors staff" },
  { id: "whatsapp", label: "WhatsApp", href: "/dashboard/whatsapp", keywords: "whatsapp message sms text" },
  { id: "scheduling", label: "Scheduling", href: "/dashboard/scheduling", keywords: "calendly calendar meeting booking schedule" },
  { id: "notion", label: "Notion Sync", href: "/dashboard/notion-sync", keywords: "notion database pages sync" },
  { id: "google-business", label: "Google Business", href: "/dashboard/google-business", keywords: "google business reviews gbp local seo maps" },
  { id: "community", label: "Community", href: "/dashboard/community", keywords: "community posts discuss forum" },
  { id: "copywriter", label: "Copywriter", href: "/dashboard/copywriter", keywords: "copy write ai blog email landing page ad" },
  { id: "email-composer", label: "Email Composer", href: "/dashboard/email-composer", keywords: "email compose ai subject body" },
  { id: "carousel-generator", label: "Carousel Generator", href: "/dashboard/carousel-generator", keywords: "carousel slides instagram linkedin" },
  { id: "video-editor", label: "Video Editor", href: "/dashboard/video-editor", keywords: "video edit clip trim" },
  { id: "ai-video", label: "AI Video", href: "/dashboard/ai-video", keywords: "ai video sora runway generate" },
];

const typeIcons: Record<string, React.ReactNode> = {
  lead: <Zap size={14} className="text-gold" />,
  client: <Users size={14} className="text-info" />,
  deal: <Briefcase size={14} className="text-success" />,
  content: <Film size={14} className="text-warning" />,
  team: <Users size={14} className="text-muted" />,
  action: <Bot size={14} className="text-gold" />,
};

export default function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.results || []);
      } catch { setResults([]); }
      setLoading(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  // Local page matches — runs instantly on every keystroke so nav queries
  // like "notifications", "ai studio", "domain", "flow builder" surface
  // a direct link at the top of results even when the CRM search is empty.
  const pageMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return NAV_PAGES.filter(
      (p) =>
        p.label.toLowerCase().includes(q) ||
        p.keywords.toLowerCase().includes(q) ||
        p.href.toLowerCase().includes(q)
    ).slice(0, 6);
  }, [query]);

  if (!isOpen) {
    return (
      <button
        onClick={() => { setIsOpen(true); setTimeout(() => inputRef.current?.focus(), 100); }}
        className="flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-muted hover:border-gold/30 transition-colors"
      >
        <Search size={14} />
        <span>Search...</span>
        <kbd className="text-xs bg-surface-light px-1.5 py-0.5 rounded">Ctrl+K</kbd>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
      <div className="relative w-full max-w-xl mx-4 bg-surface border border-border rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search size={18} className="text-muted" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search leads, clients, content, team..."
            className="flex-1 bg-transparent text-foreground placeholder-muted outline-none"
            autoFocus
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-muted hover:text-foreground">
              <X size={16} />
            </button>
          )}
          <kbd className="text-xs text-muted bg-surface-light px-1.5 py-0.5 rounded">ESC</kbd>
        </div>

        {(pageMatches.length > 0 || results.length > 0) && (
          <div className="max-h-80 overflow-y-auto">
            {pageMatches.length > 0 && (
              <>
                <p className="text-[9px] text-muted/60 uppercase tracking-[0.2em] font-bold px-4 pt-3 pb-1">
                  Navigate to
                </p>
                {pageMatches.map((p) => (
                  <button
                    key={`page-${p.id}`}
                    onClick={() => { router.push(p.href); setIsOpen(false); setQuery(""); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-light transition-colors text-left border-b border-border/30 last:border-0"
                  >
                    <Compass size={14} className="text-gold" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.label}</p>
                      <p className="text-xs text-muted truncate">{p.href}</p>
                    </div>
                    <ArrowRight size={12} className="text-muted" />
                  </button>
                ))}
              </>
            )}
            {results.length > 0 && (
              <>
                {pageMatches.length > 0 && (
                  <p className="text-[9px] text-muted/60 uppercase tracking-[0.2em] font-bold px-4 pt-3 pb-1">
                    Results
                  </p>
                )}
                {results.map((r, i) => (
                  <button
                    key={`${r.type}-${r.id}-${i}`}
                    onClick={() => { router.push(r.href); setIsOpen(false); setQuery(""); }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-light transition-colors text-left border-b border-border/30 last:border-0"
                  >
                    {typeIcons[r.type] || <Search size={14} />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.title}</p>
                      <p className="text-xs text-muted truncate">{r.subtitle}</p>
                    </div>
                    <span className="text-xs text-muted capitalize bg-surface-light px-2 py-0.5 rounded">{r.type}</span>
                  </button>
                ))}
              </>
            )}
          </div>
        )}

        {query.length >= 2 && results.length === 0 && pageMatches.length === 0 && !loading && (
          <div className="px-4 py-8 text-center text-muted text-sm">No results found</div>
        )}

        {loading && (
          <div className="px-4 py-6 text-center">
            <div className="w-5 h-5 border-2 border-gold/20 border-t-gold rounded-full animate-spin mx-auto" />
          </div>
        )}
      </div>
    </div>
  );
}
