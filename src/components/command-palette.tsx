"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search, LayoutDashboard, BarChart3, Zap, Users, FileText,
  Sparkles, Bot, Film, Megaphone, Globe, Activity, Settings,
  Send, Star, Mail, Eye, PenTool, Target, Crown,
  Camera, Link2, Sun, Calendar, ImageIcon, Phone, Kanban,
  Headphones, Palette, BookOpen, Inbox, MessageSquare, GitBranch
} from "lucide-react";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  category: string;
  keywords: string;
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const nav = (path: string) => { router.push(path); setOpen(false); };

  const commands: CommandItem[] = [
    // Navigation
    { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={14} />, action: () => nav("/dashboard"), category: "Navigate", keywords: "home main" },
    { id: "analytics", label: "Analytics", icon: <BarChart3 size={14} />, action: () => nav("/dashboard/analytics"), category: "Navigate", keywords: "charts stats metrics" },
    { id: "reports", label: "AI Reports", icon: <FileText size={14} />, action: () => nav("/dashboard/reports"), category: "Navigate", keywords: "report client weekly monthly ai generate" },
    { id: "leads", label: "Lead Finder", icon: <Search size={14} />, action: () => nav("/dashboard/scraper"), category: "Navigate", keywords: "scrape search find" },
    { id: "engine", label: "Lead Engine", icon: <Zap size={14} />, action: () => nav("/dashboard/leads"), category: "Navigate", keywords: "outreach dms pipeline" },
    { id: "outreach", label: "Outreach Hub", icon: <Target size={14} />, action: () => nav("/dashboard/outreach-hub"), category: "Navigate", keywords: "tiers hot warm cold" },
    { id: "logs", label: "Outreach Logs", icon: <Send size={14} />, action: () => nav("/dashboard/outreach-logs"), category: "Navigate", keywords: "dm email call log" },
    { id: "clients", label: "Clients", icon: <Users size={14} />, action: () => nav("/dashboard/clients"), category: "Navigate", keywords: "manage portal" },
    { id: "proposals", label: "Proposals", icon: <FileText size={14} />, action: () => nav("/dashboard/proposals"), category: "Navigate", keywords: "pitch deck pdf" },
    { id: "agents", label: "AI Agents", icon: <Sparkles size={14} />, action: () => nav("/dashboard/services"), category: "Navigate", keywords: "tools services" },
    { id: "social", label: "Social Manager", icon: <Camera size={14} />, action: () => nav("/dashboard/social-manager"), category: "Navigate", keywords: "post schedule autopilot" },
    { id: "scriptlab", label: "Script Lab", icon: <Sparkles size={14} />, action: () => nav("/dashboard/script-lab"), category: "Navigate", keywords: "write viral framework hooks" },
    { id: "websites", label: "Website Builder", icon: <Globe size={14} />, action: () => nav("/dashboard/websites"), category: "Navigate", keywords: "build deploy site" },
    { id: "design", label: "Design Studio", icon: <PenTool size={14} />, action: () => nav("/dashboard/design"), category: "Navigate", keywords: "canva midjourney" },
    { id: "thumbnails", label: "Thumbnail Generator", icon: <ImageIcon size={14} />, action: () => nav("/dashboard/thumbnail-generator"), category: "Navigate", keywords: "thumbnail pikzels youtube cover image ai" },
    { id: "production", label: "Production", icon: <Film size={14} />, action: () => nav("/dashboard/production"), category: "Navigate", keywords: "edit video footage editors" },
    { id: "content", label: "Content AI", icon: <Film size={14} />, action: () => nav("/dashboard/content"), category: "Navigate", keywords: "scripts generate" },
    { id: "ads", label: "Ads Manager", icon: <Megaphone size={14} />, action: () => nav("/dashboard/ads-manager"), category: "Navigate", keywords: "meta google tiktok campaigns oauth native ads" },
    { id: "automations", label: "Automations", icon: <Zap size={14} />, action: () => nav("/dashboard/automations"), category: "Navigate", keywords: "dm manychat templates" },
    { id: "workflows", label: "Workflows", icon: <Zap size={14} />, action: () => nav("/dashboard/workflows"), category: "Navigate", keywords: "automation agent builder flow workflow" },
    { id: "flow-builder", label: "Flow Builder", icon: <GitBranch size={14} />, action: () => nav("/dashboard/workflow-builder"), category: "Navigate", keywords: "flow workflow visual builder automate drag drop node canvas" },
    { id: "trinity", label: "Trinity AI", icon: <Bot size={14} />, action: () => nav("/dashboard/trinity"), category: "Navigate", keywords: "assistant chat voice" },
    { id: "reviews", label: "Reviews", icon: <Star size={14} />, action: () => nav("/dashboard/reviews"), category: "Navigate", keywords: "google review respond" },
    { id: "templates", label: "Email Templates", icon: <Mail size={14} />, action: () => nav("/dashboard/email-templates"), category: "Navigate", keywords: "email template copy" },
    { id: "spy", label: "Competitor Spy", icon: <Eye size={14} />, action: () => nav("/dashboard/competitor"), category: "Navigate", keywords: "analyze research competitor" },
    { id: "agenthq", label: "Agent HQ", icon: <Crown size={14} />, action: () => nav("/dashboard/agent-supervisor"), category: "Navigate", keywords: "supervisor nexus chief monitor" },
    { id: "socials", label: "Socials", icon: <Link2 size={14} />, action: () => nav("/dashboard/integrations"), category: "Navigate", keywords: "connect oauth instagram facebook" },
    { id: "integrations", label: "Integrations", icon: <Link2 size={14} />, action: () => nav("/dashboard/integrations"), category: "Navigate", keywords: "integrations zernio connect oauth platforms apps" },
    { id: "ai-studio", label: "AI Studio", icon: <Sparkles size={14} />, action: () => nav("/dashboard/ai-studio"), category: "Navigate", keywords: "ai studio image generate remove background upscale transcribe" },
    { id: "domains", label: "Domains", icon: <Globe size={14} />, action: () => nav("/dashboard/domains"), category: "Navigate", keywords: "domain buy godaddy dns register purchase" },
    { id: "ai-caller", label: "AI Caller", icon: <Phone size={14} />, action: () => nav("/dashboard/eleven-agents"), category: "Navigate", keywords: "eleven agents elevenlabs voice call ai caller" },
    { id: "voice-ai", label: "Voice AI", icon: <Headphones size={14} />, action: () => nav("/dashboard/voice-receptionist"), category: "Navigate", keywords: "voice receptionist ai answer call" },
    { id: "crm", label: "CRM", icon: <Users size={14} />, action: () => nav("/dashboard/crm"), category: "Navigate", keywords: "customers contacts leads pipeline" },
    { id: "inbox", label: "Inbox", icon: <Inbox size={14} />, action: () => nav("/dashboard/inbox"), category: "Navigate", keywords: "messages unified inbox notifications" },
    { id: "generations", label: "Generations", icon: <Sparkles size={14} />, action: () => nav("/dashboard/generations"), category: "Navigate", keywords: "ai history generations output" },
    { id: "content-plan", label: "Content Plan", icon: <Calendar size={14} />, action: () => nav("/dashboard/content-plan"), category: "Navigate", keywords: "content calendar schedule posts plan social" },
    { id: "brand-kit", label: "Brand Kit", icon: <Palette size={14} />, action: () => nav("/dashboard/brand-kit"), category: "Navigate", keywords: "brand kit logo colors fonts" },
    { id: "brand-voice", label: "Brand Voice", icon: <BookOpen size={14} />, action: () => nav("/dashboard/brand-voice"), category: "Navigate", keywords: "brand voice tone writing style" },
    { id: "workspaces", label: "Workspaces", icon: <Kanban size={14} />, action: () => nav("/dashboard/workspaces"), category: "Navigate", keywords: "workspaces teams multi-tenant" },
    { id: "discord", label: "Discord", icon: <MessageSquare size={14} />, action: () => nav("/dashboard/discord"), category: "Navigate", keywords: "discord community chat server" },
    { id: "monitor", label: "System Monitor", icon: <Activity size={14} />, action: () => nav("/dashboard/monitor"), category: "Navigate", keywords: "health integrations status" },
    { id: "briefing", label: "Morning Briefing", icon: <Sun size={14} />, action: () => nav("/dashboard/briefing"), category: "Navigate", keywords: "daily report morning" },
    { id: "settings", label: "Settings", icon: <Settings size={14} />, action: () => nav("/dashboard/settings"), category: "Navigate", keywords: "theme zoom sound sfx" },

    // Quick Actions
    { id: "new-client", label: "Add New Client", icon: <Users size={14} />, action: () => nav("/dashboard/onboard"), category: "Action", keywords: "create onboard new" },
    { id: "new-proposal", label: "Generate Proposal", icon: <FileText size={14} />, action: () => nav("/dashboard/proposals"), category: "Action", keywords: "pitch create pdf" },
    { id: "scrape-leads", label: "Scrape Leads", icon: <Search size={14} />, action: () => nav("/dashboard/scraper"), category: "Action", keywords: "find search google maps" },
    { id: "gen-script", label: "Generate Script", icon: <Sparkles size={14} />, action: () => nav("/dashboard/script-lab"), category: "Action", keywords: "write viral content" },
    { id: "build-site", label: "Build Website", icon: <Globe size={14} />, action: () => nav("/dashboard/websites"), category: "Action", keywords: "create website deploy" },
    { id: "send-blast", label: "Send Email Blast", icon: <Send size={14} />, action: () => nav("/dashboard/leads"), category: "Action", keywords: "cold email outreach" },
    { id: "talk-nexus", label: "Talk to Nexus (Chief)", icon: <Crown size={14} />, action: () => nav("/dashboard/agent-supervisor"), category: "Action", keywords: "boss agent status" },

    // More pages (accessible via search)
    { id: "calendar", label: "Calendar & Booking", icon: <Send size={14} />, action: () => nav("/dashboard/calendar"), category: "Navigate", keywords: "schedule appointment meeting call" },
    { id: "conversations", label: "Conversations", icon: <Send size={14} />, action: () => nav("/dashboard/conversations"), category: "Navigate", keywords: "chat sms messages replies" },
    { id: "deals", label: "Deals Pipeline", icon: <Send size={14} />, action: () => nav("/dashboard/deals"), category: "Navigate", keywords: "pipeline sales revenue won lost" },
    { id: "invoices", label: "Invoices", icon: <Send size={14} />, action: () => nav("/dashboard/invoices"), category: "Navigate", keywords: "billing payments stripe money" },
    { id: "sequences", label: "Email Sequences", icon: <Send size={14} />, action: () => nav("/dashboard/sequences"), category: "Navigate", keywords: "drip campaign email automation followup" },
    { id: "forms", label: "Form Builder", icon: <Send size={14} />, action: () => nav("/dashboard/forms"), category: "Navigate", keywords: "lead capture embed form" },
    { id: "tags", label: "Tags", icon: <Send size={14} />, action: () => nav("/dashboard/tags"), category: "Navigate", keywords: "tag label organize leads hot warm cold" },
    { id: "webhooks", label: "Webhooks", icon: <Send size={14} />, action: () => nav("/dashboard/webhooks"), category: "Navigate", keywords: "webhook zapier make api integration" },
    { id: "client-health", label: "Client Health", icon: <Send size={14} />, action: () => nav("/dashboard/client-health"), category: "Navigate", keywords: "health churn risk retention clients" },
    { id: "agent-controls", label: "Agent Controls", icon: <Settings size={14} />, action: () => nav("/dashboard/agent-controls"), category: "Navigate", keywords: "settings configure agents schedule leads outreach" },
    { id: "production", label: "Production", icon: <Film size={14} />, action: () => nav("/dashboard/production"), category: "Navigate", keywords: "video editing editors footage" },
    { id: "dm-controller", label: "DM Controller", icon: <Send size={14} />, action: () => nav("/dashboard/dm-controller"), category: "Navigate", keywords: "dm cold instagram tiktok browser" },
    { id: "email-templates", label: "Email Templates", icon: <Send size={14} />, action: () => nav("/dashboard/email-templates"), category: "Navigate", keywords: "email template cold outreach" },
    { id: "automations", label: "Automations", icon: <Zap size={14} />, action: () => nav("/dashboard/automations"), category: "Navigate", keywords: "manychat dm automation instagram" },
    { id: "forecast", label: "Forecast", icon: <BarChart3 size={14} />, action: () => nav("/dashboard/forecast"), category: "Navigate", keywords: "forecast predict revenue future" },
    { id: "team", label: "Team", icon: <Users size={14} />, action: () => nav("/dashboard/team"), category: "Navigate", keywords: "team members editors staff" },
    { id: "whatsapp", label: "WhatsApp", icon: <Send size={14} />, action: () => nav("/dashboard/whatsapp"), category: "Navigate", keywords: "whatsapp message sms text" },
    { id: "scheduling", label: "Scheduling", icon: <Calendar size={14} />, action: () => nav("/dashboard/scheduling"), category: "Navigate", keywords: "calendly calendar meeting booking schedule" },
    { id: "notion", label: "Notion Sync", icon: <FileText size={14} />, action: () => nav("/dashboard/notion-sync"), category: "Navigate", keywords: "notion database pages sync" },
    { id: "google-business", label: "Google Business", icon: <Globe size={14} />, action: () => nav("/dashboard/google-business"), category: "Navigate", keywords: "google business reviews gbp local seo maps" },
    { id: "community", label: "Community", icon: <Users size={14} />, action: () => nav("/dashboard/community"), category: "Navigate", keywords: "community posts discuss forum" },
  ];

  const filtered = query.trim()
    ? commands.filter(c =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        c.keywords.toLowerCase().includes(query.toLowerCase()) ||
        (c.description || "").toLowerCase().includes(query.toLowerCase())
      )
    : commands;

  const grouped = filtered.reduce<Record<string, CommandItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  // Keyboard shortcut to open
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(prev => !prev);
        setQuery("");
        setSelectedIndex(0);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  // Arrow key navigation
  useEffect(() => {
    if (!open) return;
    function handleNav(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filtered.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      }
      if (e.key === "Enter" && filtered[selectedIndex]) {
        filtered[selectedIndex].action();
      }
    }
    window.addEventListener("keydown", handleNav);
    return () => window.removeEventListener("keydown", handleNav);
  }, [open, filtered, selectedIndex]);

  useEffect(() => { setSelectedIndex(0); }, [query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative max-w-lg mx-auto mt-[15vh]">
        <div className="bg-surface border border-border/50 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden fade-in">
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30">
            <Search size={16} className="text-muted shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search commands, pages, actions..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder-muted/50 outline-none"
            />
            <kbd className="text-[8px] text-muted bg-surface-light px-1.5 py-0.5 rounded border border-border/30">ESC</kbd>
          </div>

          {/* Results */}
          <div className="max-h-[400px] overflow-y-auto py-2">
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <p className="text-[8px] text-muted/50 uppercase tracking-[0.2em] font-bold px-4 py-1">{category}</p>
                {items.map((item) => {
                  const globalIndex = filtered.indexOf(item);
                  return (
                    <button
                      key={item.id}
                      onClick={item.action}
                      onMouseEnter={() => setSelectedIndex(globalIndex)}
                      className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                        globalIndex === selectedIndex ? "bg-gold/[0.08] text-foreground" : "text-muted hover:text-foreground"
                      }`}
                    >
                      <span className={globalIndex === selectedIndex ? "text-gold" : ""}>{item.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium">{item.label}</p>
                        {item.description && <p className="text-[9px] text-muted truncate">{item.description}</p>}
                      </div>
                      {globalIndex === selectedIndex && (
                        <kbd className="text-[7px] text-muted bg-surface-light px-1 py-0.5 rounded">Enter</kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="text-xs text-muted text-center py-8">No results for &ldquo;{query}&rdquo;</p>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border/20 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-3 text-[8px] text-muted/40">
              <span>↑↓ navigate</span>
              <span>↵ select</span>
              <span>esc close</span>
            </div>
            <span className="text-[8px] text-muted/30">ShortStack OS</span>
          </div>
        </div>
      </div>
    </div>
  );
}
