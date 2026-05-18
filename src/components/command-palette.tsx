"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search, LayoutDashboard, BarChart3, Zap, Users, FileText,
  Sparkles, Bot, Film, Megaphone, Globe, Activity, Settings,
  Send, Star, Mail, Eye, PenTool, Target, Crown,
  Camera, Link2, Sun, Calendar, ImageIcon, Phone, Kanban,
  Headphones, Palette, BookOpen, Inbox, MessageSquare, GitBranch,
  Briefcase, Building2, UserCheck, Loader2,
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

interface SearchResult {
  type: string;
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

type FlatItem =
  | { kind: "command"; data: CommandItem }
  | { kind: "record"; data: SearchResult };

const RECORD_ICONS: Record<string, React.ReactNode> = {
  lead: <Zap size={14} className="text-amber-400" />,
  client: <Building2 size={14} className="text-[#60A5FA]" />,
  deal: <Briefcase size={14} className="text-emerald-400" />,
  content: <Film size={14} className="text-violet-400" />,
  team: <UserCheck size={14} className="text-slate-400" />,
  action: <Bot size={14} className="text-[#60A5FA]" />,
};

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [liveResults, setLiveResults] = useState<SearchResult[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const nav = (path: string) => { router.push(path); setOpen(false); };

  const commands: CommandItem[] = [
    // ── Navigation ──
    { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={14} />, action: () => nav("/dashboard"), category: "Navigate", keywords: "home main" },
    { id: "analytics", label: "Analytics", icon: <BarChart3 size={14} />, action: () => nav("/dashboard/analytics"), category: "Navigate", keywords: "charts stats metrics" },
    { id: "inbox", label: "Inbox", icon: <Inbox size={14} />, action: () => nav("/dashboard/inbox"), category: "Navigate", keywords: "messages unified notifications" },
    { id: "clients", label: "Clients", icon: <Users size={14} />, action: () => nav("/dashboard/clients"), category: "Navigate", keywords: "manage portal accounts" },
    { id: "crm", label: "CRM", icon: <Users size={14} />, action: () => nav("/dashboard/crm"), category: "Navigate", keywords: "contacts leads pipeline" },
    { id: "deals", label: "Deals Pipeline", icon: <Briefcase size={14} />, action: () => nav("/dashboard/deals"), category: "Navigate", keywords: "pipeline sales revenue won lost" },
    { id: "calendar", label: "Calendar", icon: <Calendar size={14} />, action: () => nav("/dashboard/calendar"), category: "Navigate", keywords: "schedule appointment meeting" },
    { id: "conversations", label: "Conversations", icon: <MessageSquare size={14} />, action: () => nav("/dashboard/conversations"), category: "Navigate", keywords: "chat sms replies" },
    { id: "reports", label: "AI Reports", icon: <FileText size={14} />, action: () => nav("/dashboard/reports"), category: "Navigate", keywords: "report client weekly monthly" },
    { id: "leads", label: "Lead Finder", icon: <Search size={14} />, action: () => nav("/dashboard/scraper"), category: "Navigate", keywords: "scrape search find google maps" },
    { id: "engine", label: "Lead Engine", icon: <Zap size={14} />, action: () => nav("/dashboard/leads"), category: "Navigate", keywords: "outreach dms pipeline" },
    { id: "outreach", label: "Outreach Hub", icon: <Target size={14} />, action: () => nav("/dashboard/outreach-hub"), category: "Navigate", keywords: "tiers hot warm cold" },
    { id: "proposals", label: "Proposals", icon: <FileText size={14} />, action: () => nav("/dashboard/proposals"), category: "Navigate", keywords: "pitch deck pdf" },
    { id: "agents", label: "AI Agents", icon: <Sparkles size={14} />, action: () => nav("/dashboard/services"), category: "Navigate", keywords: "tools services" },
    { id: "social", label: "Social Manager", icon: <Camera size={14} />, action: () => nav("/dashboard/social-manager"), category: "Navigate", keywords: "post schedule autopilot" },
    { id: "scriptlab", label: "Script Lab", icon: <Sparkles size={14} />, action: () => nav("/dashboard/script-lab"), category: "Navigate", keywords: "write viral framework hooks" },
    { id: "websites", label: "Website Builder", icon: <Globe size={14} />, action: () => nav("/dashboard/websites"), category: "Navigate", keywords: "build deploy site" },
    { id: "design", label: "Design Studio", icon: <PenTool size={14} />, action: () => nav("/dashboard/design"), category: "Navigate", keywords: "canva midjourney" },
    { id: "thumbnails", label: "Thumbnail Generator", icon: <ImageIcon size={14} />, action: () => nav("/dashboard/thumbnail-generator"), category: "Navigate", keywords: "thumbnail youtube cover image ai" },
    { id: "production", label: "Production", icon: <Film size={14} />, action: () => nav("/dashboard/production"), category: "Navigate", keywords: "edit video footage editors" },
    { id: "content", label: "Content AI", icon: <Film size={14} />, action: () => nav("/dashboard/content"), category: "Navigate", keywords: "scripts generate" },
    { id: "ads", label: "Ads Manager", icon: <Megaphone size={14} />, action: () => nav("/dashboard/ads-manager"), category: "Navigate", keywords: "meta google tiktok campaigns" },
    { id: "automations", label: "Automations", icon: <Zap size={14} />, action: () => nav("/dashboard/automations"), category: "Navigate", keywords: "dm manychat templates" },
    { id: "workflows", label: "Workflows", icon: <Zap size={14} />, action: () => nav("/dashboard/workflows"), category: "Navigate", keywords: "automation agent builder flow" },
    { id: "flow-builder", label: "Flow Builder", icon: <GitBranch size={14} />, action: () => nav("/dashboard/workflow-builder"), category: "Navigate", keywords: "flow workflow visual builder" },
    { id: "trinity", label: "Trinity AI", icon: <Bot size={14} />, action: () => nav("/dashboard/trinity"), category: "Navigate", keywords: "assistant chat voice" },
    { id: "reviews", label: "Reviews", icon: <Star size={14} />, action: () => nav("/dashboard/reviews"), category: "Navigate", keywords: "google review respond" },
    { id: "templates", label: "Email Templates", icon: <Mail size={14} />, action: () => nav("/dashboard/email-templates"), category: "Navigate", keywords: "email template copy" },
    { id: "spy", label: "Competitor Spy", icon: <Eye size={14} />, action: () => nav("/dashboard/competitor"), category: "Navigate", keywords: "analyze research competitor" },
    { id: "agenthq", label: "Agent HQ", icon: <Crown size={14} />, action: () => nav("/dashboard/agent-supervisor"), category: "Navigate", keywords: "supervisor nexus chief monitor" },
    { id: "integrations", label: "Integrations", icon: <Link2 size={14} />, action: () => nav("/dashboard/integrations-hub"), category: "Navigate", keywords: "connect oauth instagram facebook" },
    { id: "ai-studio", label: "AI Studio", icon: <Sparkles size={14} />, action: () => nav("/dashboard/ai-studio"), category: "Navigate", keywords: "image generate upscale transcribe" },
    { id: "domains", label: "Domains", icon: <Globe size={14} />, action: () => nav("/dashboard/domains"), category: "Navigate", keywords: "domain dns register" },
    { id: "ai-caller", label: "AI Caller", icon: <Phone size={14} />, action: () => nav("/dashboard/eleven-agents"), category: "Navigate", keywords: "elevenlabs voice call" },
    { id: "voice-ai", label: "Voice AI", icon: <Headphones size={14} />, action: () => nav("/dashboard/voice-receptionist"), category: "Navigate", keywords: "voice receptionist ai" },
    { id: "generations", label: "Generations", icon: <Sparkles size={14} />, action: () => nav("/dashboard/generations"), category: "Navigate", keywords: "ai history output" },
    { id: "content-plan", label: "Content Plan", icon: <Calendar size={14} />, action: () => nav("/dashboard/content-plan"), category: "Navigate", keywords: "content calendar schedule" },
    { id: "brand-kit", label: "Brand Kit", icon: <Palette size={14} />, action: () => nav("/dashboard/brand-kit"), category: "Navigate", keywords: "brand kit logo colors fonts" },
    { id: "brand-voice", label: "Brand Voice", icon: <BookOpen size={14} />, action: () => nav("/dashboard/brand-voice"), category: "Navigate", keywords: "brand voice tone writing style" },
    { id: "workspaces", label: "Workspaces", icon: <Kanban size={14} />, action: () => nav("/dashboard/workspaces"), category: "Navigate", keywords: "workspaces teams" },
    { id: "discord", label: "Discord", icon: <MessageSquare size={14} />, action: () => nav("/dashboard/discord"), category: "Navigate", keywords: "discord community chat" },
    { id: "monitor", label: "System Monitor", icon: <Activity size={14} />, action: () => nav("/dashboard/monitor"), category: "Navigate", keywords: "health integrations status" },
    { id: "briefing", label: "Morning Briefing", icon: <Sun size={14} />, action: () => nav("/dashboard/briefing"), category: "Navigate", keywords: "daily report morning" },
    { id: "invoices", label: "Invoices", icon: <FileText size={14} />, action: () => nav("/dashboard/invoices"), category: "Navigate", keywords: "billing payments stripe money" },
    { id: "sequences", label: "Email Sequences", icon: <Mail size={14} />, action: () => nav("/dashboard/sequences"), category: "Navigate", keywords: "drip campaign email followup" },
    { id: "forms", label: "Form Builder", icon: <FileText size={14} />, action: () => nav("/dashboard/forms"), category: "Navigate", keywords: "lead capture embed form" },
    { id: "team", label: "Team", icon: <Users size={14} />, action: () => nav("/dashboard/team"), category: "Navigate", keywords: "team members editors staff" },
    { id: "scheduling", label: "Scheduling", icon: <Calendar size={14} />, action: () => nav("/dashboard/scheduling"), category: "Navigate", keywords: "calendly meeting booking" },
    { id: "forecast", label: "Forecast", icon: <BarChart3 size={14} />, action: () => nav("/dashboard/forecast"), category: "Navigate", keywords: "forecast predict revenue" },
    { id: "community", label: "Community", icon: <Users size={14} />, action: () => nav("/dashboard/community"), category: "Navigate", keywords: "community posts discuss forum" },
    { id: "settings", label: "Settings", icon: <Settings size={14} />, action: () => nav("/dashboard/settings"), category: "Navigate", keywords: "theme zoom sound" },

    // ── Quick Actions ──
    { id: "new-client", label: "Add New Client", icon: <Users size={14} />, action: () => nav("/dashboard/onboard"), category: "Action", keywords: "create onboard new client" },
    { id: "new-proposal", label: "Generate Proposal", icon: <FileText size={14} />, action: () => nav("/dashboard/proposals"), category: "Action", keywords: "pitch create pdf proposal" },
    { id: "scrape-leads", label: "Scrape Leads", icon: <Search size={14} />, action: () => nav("/dashboard/scraper"), category: "Action", keywords: "find search google maps leads" },
    { id: "gen-script", label: "Generate Script", icon: <Sparkles size={14} />, action: () => nav("/dashboard/script-lab"), category: "Action", keywords: "write viral content script" },
    { id: "build-site", label: "Build Website", icon: <Globe size={14} />, action: () => nav("/dashboard/websites"), category: "Action", keywords: "create website deploy" },
    { id: "send-blast", label: "Send Email Blast", icon: <Send size={14} />, action: () => nav("/dashboard/leads"), category: "Action", keywords: "cold email outreach" },
    { id: "talk-nexus", label: "Talk to Nexus (Chief)", icon: <Crown size={14} />, action: () => nav("/dashboard/agent-supervisor"), category: "Action", keywords: "boss agent status" },
  ];

  // ── Live DB search (debounced 300ms) ──
  useEffect(() => {
    if (query.length < 2) { setLiveResults([]); return; }
    const timeout = setTimeout(async () => {
      setLiveLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setLiveResults(data.results || []);
      } catch { setLiveResults([]); }
      setLiveLoading(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  const filteredCommands = useMemo(() =>
    query.trim()
      ? commands.filter(c =>
          c.label.toLowerCase().includes(query.toLowerCase()) ||
          c.keywords.toLowerCase().includes(query.toLowerCase()) ||
          (c.description || "").toLowerCase().includes(query.toLowerCase())
        )
      : commands,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query]
  );

  // Flat unified list for keyboard navigation
  const allItems: FlatItem[] = useMemo(() => [
    ...filteredCommands.map(c => ({ kind: "command" as const, data: c })),
    ...liveResults.map(r => ({ kind: "record" as const, data: r })),
  ], [filteredCommands, liveResults]);

  // Grouped nav commands for visual sections
  const grouped = useMemo(() =>
    filteredCommands.reduce<Record<string, CommandItem[]>>((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {}),
    [filteredCommands]
  );

  // ── Keyboard shortcut: Cmd+K and custom event ──
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(prev => !prev);
        setQuery("");
        setSelectedIndex(0);
        setLiveResults([]);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // External trigger from header search button
  useEffect(() => {
    function handleOpen() {
      setOpen(true);
      setQuery("");
      setSelectedIndex(0);
      setLiveResults([]);
    }
    window.addEventListener("open-command-palette", handleOpen);
    return () => window.removeEventListener("open-command-palette", handleOpen);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  // Arrow key + Enter navigation across all items
  useEffect(() => {
    if (!open) return;
    function handleNav(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, allItems.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      }
      if (e.key === "Enter") {
        const item = allItems[selectedIndex];
        if (!item) return;
        if (item.kind === "command") item.data.action();
        else { router.push(item.data.href); setOpen(false); }
      }
    }
    window.addEventListener("keydown", handleNav);
    return () => window.removeEventListener("keydown", handleNav);
  }, [open, allItems, selectedIndex, router]);

  useEffect(() => { setSelectedIndex(0); }, [query]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.querySelector('[data-selected="true"]');
    selected?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[3px]"
        onClick={() => setOpen(false)}
      />

      {/* Panel */}
      <div className="relative max-w-xl mx-auto mt-[12vh] px-4">
        <div
          className="overflow-hidden rounded-2xl"
          style={{
            background: "rgba(9,13,24,0.95)",
            backdropFilter: "blur(20px) saturate(160%)",
            WebkitBackdropFilter: "blur(20px) saturate(160%)",
            border: "1px solid rgba(99,146,255,0.22)",
            boxShadow: "0 32px 72px rgba(0,0,0,0.6), 0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(99,146,255,0.08)",
          }}
        >
          {/* Input row */}
          <div
            className="flex items-center gap-3 px-4 py-3.5"
            style={{ borderBottom: "1px solid rgba(99,146,255,0.10)" }}
          >
            <Search size={16} className="text-[#4A4A5A] shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search commands, clients, deals, content…"
              className="flex-1 bg-transparent text-sm text-[#F0F0F4] placeholder-[#4A4A5A] outline-none"
            />
            {liveLoading && <Loader2 size={13} className="text-[#4A4A5A] animate-spin shrink-0" />}
            <kbd className="hidden sm:inline-flex text-[9px] text-[#4A4A5A] px-1.5 py-0.5 rounded font-mono"
              style={{ background: "rgba(99,146,255,0.08)", border: "1px solid rgba(99,146,255,0.12)" }}>
              ESC
            </kbd>
          </div>

          {/* Results list */}
          <div ref={listRef} className="max-h-[420px] overflow-y-auto py-1.5">

            {/* Nav commands — grouped by category */}
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <p className="text-[9px] text-[#4A4A5A] uppercase tracking-[0.18em] font-semibold px-4 pt-2.5 pb-1">
                  {category}
                </p>
                {items.map((item) => {
                  const flatIdx = allItems.findIndex(a => a.kind === "command" && a.data.id === item.id);
                  const isSelected = flatIdx === selectedIndex;
                  return (
                    <button
                      key={item.id}
                      data-selected={isSelected}
                      onClick={item.action}
                      onMouseEnter={() => setSelectedIndex(flatIdx)}
                      className="w-full flex items-center gap-3 px-4 py-2 text-left transition-colors"
                      style={{
                        background: isSelected ? "rgba(59,130,246,0.14)" : "transparent",
                      }}
                      onMouseLeave={() => {}}
                    >
                      <span className={`shrink-0 ${isSelected ? "text-[#60A5FA]" : "text-[#4A4A5A]"}`}>
                        {item.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium truncate ${isSelected ? "text-[#93C5FD]" : "text-[#A8A8B2]"}`}>
                          {item.label}
                        </p>
                        {item.description && (
                          <p className="text-[10px] text-[#4A4A5A] truncate">{item.description}</p>
                        )}
                      </div>
                      {isSelected && (
                        <kbd className="text-[8px] text-[#4A4A5A] px-1 py-0.5 rounded font-mono shrink-0"
                          style={{ background: "rgba(99,146,255,0.08)", border: "1px solid rgba(99,146,255,0.12)" }}>
                          ↵
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}

            {/* Live DB results */}
            {liveResults.length > 0 && (
              <>
                <div className="mx-4 my-1.5" style={{ borderTop: "1px solid rgba(99,146,255,0.08)" }} />
                <p className="text-[9px] text-[#4A4A5A] uppercase tracking-[0.18em] font-semibold px-4 pt-1.5 pb-1">
                  Records
                </p>
                {liveResults.map((r) => {
                  const flatIdx = allItems.findIndex(a => a.kind === "record" && a.data.id === r.id && a.data.type === r.type);
                  const isSelected = flatIdx === selectedIndex;
                  return (
                    <button
                      key={`${r.type}-${r.id}`}
                      data-selected={isSelected}
                      onClick={() => { router.push(r.href); setOpen(false); }}
                      onMouseEnter={() => setSelectedIndex(flatIdx)}
                      className="w-full flex items-center gap-3 px-4 py-2 text-left transition-colors"
                      style={{
                        background: isSelected ? "rgba(59,130,246,0.14)" : "transparent",
                      }}
                    >
                      <span className="shrink-0">{RECORD_ICONS[r.type] ?? <Search size={14} className="text-[#4A4A5A]" />}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium truncate ${isSelected ? "text-[#93C5FD]" : "text-[#A8A8B2]"}`}>
                          {r.title}
                        </p>
                        <p className="text-[10px] text-[#4A4A5A] truncate">{r.subtitle}</p>
                      </div>
                      <span className="text-[9px] text-[#4A4A5A] px-1.5 py-0.5 rounded capitalize shrink-0"
                        style={{ background: "rgba(99,146,255,0.08)", border: "1px solid rgba(99,146,255,0.10)" }}>
                        {r.type}
                      </span>
                    </button>
                  );
                })}
              </>
            )}

            {/* Empty state */}
            {allItems.length === 0 && !liveLoading && query.trim() && (
              <p className="text-xs text-[#4A4A5A] text-center py-10">
                No results for &ldquo;{query}&rdquo;
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 flex items-center justify-between"
            style={{ borderTop: "1px solid rgba(99,146,255,0.08)" }}>
            <div className="flex items-center gap-4 text-[9px] text-[#4A4A5A]">
              <span>↑↓ navigate</span>
              <span>↵ open</span>
              <span>esc close</span>
            </div>
            <span className="text-[9px] text-[#4A4A5A]">ShortStack OS</span>
          </div>
        </div>
      </div>
    </div>
  );
}
