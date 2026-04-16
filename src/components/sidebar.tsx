"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useWhiteLabel } from "@/lib/white-label-context";
import { getPlanConfig } from "@/lib/plan-config";
import {
  Zap,
  Search,
  Users,
  Film,
  Bot,
  Activity,
  LayoutDashboard,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Megaphone,
  Settings,
  BarChart3,
  CreditCard,
  MessageSquare,
  Link2,
  Sparkles,
  Calendar,
  FileText,
  Send,
  PenTool,
  Crown,
  Globe,
  Phone,
  Monitor,
  ChevronDown,
  ImageIcon,
  Heart,
  Upload,
  BookOpen,
  FolderOpen,
  Target,
  Receipt,
  Palette,
  Mail,
  MailPlus,
  Smartphone,
  ListOrdered,
  FileCheck,
  TrendingUp,
  Star,
  LifeBuoy,
  Calculator,
  Gift,
  Kanban,
  UsersRound,
  Webhook,
  ClipboardList,
  MessagesSquare,
  ClipboardCheck,
  RotateCcw,
  Pen,
  Newspaper,
  Layers,
  Award,
  Building2,
  LayoutGrid,
  Headphones,
  LayoutTemplate,
  GitBranch,
  FileBarChart2,
  Store,
  Inbox,
  Puzzle,
  ExternalLink,
  X,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import AdminProfileSwitcher from "@/components/admin-profile-switcher";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles: string[];
  section?: string;
  sub?: string;
}

const navItems: NavItem[] = [
  // ── Core ──
  { label: "Inbox", href: "/dashboard/inbox", icon: <Inbox size={16} />, roles: ["admin", "team_member"] },
  { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard size={16} />, roles: ["admin", "team_member"] },
  { label: "Community", href: "/dashboard/community", icon: <Users size={16} />, roles: ["admin", "team_member", "client"] },
  { label: "Analytics", href: "/dashboard/analytics", icon: <BarChart3 size={16} />, roles: ["admin"] },
  { label: "Reports", href: "/dashboard/reports", icon: <FileText size={16} />, roles: ["admin"] },
  { label: "Dashboards", href: "/dashboard/custom-dashboard", icon: <LayoutGrid size={16} />, roles: ["admin"] },

  // ── Sales (full revenue pipeline) ──
  { label: "Lead Finder", href: "/dashboard/scraper", icon: <Search size={16} />, roles: ["admin", "team_member"], section: "Sales", sub: "Leads & Outreach" },
  { label: "AI Caller", href: "/dashboard/eleven-agents", icon: <Phone size={16} />, roles: ["admin"], sub: "Leads & Outreach" },
  { label: "Voice AI", href: "/dashboard/voice-receptionist", icon: <Headphones size={16} />, roles: ["admin"], sub: "Leads & Outreach" },
  { label: "Outreach", href: "/dashboard/outreach-hub", icon: <Send size={16} />, roles: ["admin"], sub: "Leads & Outreach" },
  { label: "Outreach Logs", href: "/dashboard/outreach-logs", icon: <ClipboardList size={16} />, roles: ["admin"], sub: "Leads & Outreach" },
  { label: "Sequences", href: "/dashboard/sequences", icon: <ListOrdered size={16} />, roles: ["admin"], sub: "Leads & Outreach" },
  { label: "CRM", href: "/dashboard/crm", icon: <Users size={16} />, roles: ["admin", "team_member"], sub: "Pipeline" },
  { label: "Deals", href: "/dashboard/deals", icon: <CreditCard size={16} />, roles: ["admin", "team_member"], sub: "Pipeline" },
  { label: "Proposals", href: "/dashboard/proposals", icon: <FileCheck size={16} />, roles: ["admin", "team_member"], sub: "Pipeline" },
  { label: "Forecast", href: "/dashboard/forecast", icon: <TrendingUp size={16} />, roles: ["admin"], sub: "Pipeline" },
  { label: "Commissions", href: "/dashboard/commission-tracker", icon: <Award size={16} />, roles: ["admin"], sub: "Pipeline" },
  { label: "Ads Manager", href: "/dashboard/ads-manager", icon: <Target size={16} />, roles: ["admin"], sub: "Pipeline" },
  { label: "Calendar", href: "/dashboard/calendar", icon: <Calendar size={16} />, roles: ["admin", "team_member"], sub: "Scheduling" },
  { label: "Scheduling", href: "/dashboard/scheduling", icon: <Calendar size={16} />, roles: ["admin", "team_member"], sub: "Scheduling" },
  { label: "Clients", href: "/dashboard/clients", icon: <Users size={16} />, roles: ["admin", "team_member"], sub: "Scheduling" },

  // ── Create (content production) ──
  { label: "Ads Copy Lab", href: "/dashboard/ads", icon: <Megaphone size={16} />, roles: ["admin"], section: "Create", sub: "Writing" },
  { label: "AI Copywriter", href: "/dashboard/copywriter", icon: <Pen size={16} />, roles: ["admin", "team_member"], sub: "Writing" },
  { label: "Script Lab", href: "/dashboard/script-lab", icon: <Sparkles size={16} />, roles: ["admin", "team_member"], sub: "Writing" },
  { label: "Email Composer", href: "/dashboard/email-composer", icon: <Mail size={16} />, roles: ["admin", "team_member"], sub: "Writing" },
  { label: "Email Templates", href: "/dashboard/email-templates", icon: <MailPlus size={16} />, roles: ["admin"], sub: "Writing" },
  { label: "SMS Templates", href: "/dashboard/sms-templates", icon: <Smartphone size={16} />, roles: ["admin"], sub: "Writing" },
  { label: "Newsletter", href: "/dashboard/newsletter", icon: <Newspaper size={16} />, roles: ["admin"], sub: "Writing" },
  { label: "Video Editor", href: "/dashboard/video-editor", icon: <Film size={16} />, roles: ["admin", "team_member"], sub: "Visual" },
  { label: "AI Video Gen", href: "/dashboard/ai-video", icon: <Film size={16} />, roles: ["admin", "team_member"], sub: "Visual" },
  { label: "Design Studio", href: "/dashboard/design", icon: <PenTool size={16} />, roles: ["admin", "team_member"], sub: "Visual" },
  { label: "Thumbnails", href: "/dashboard/thumbnail-generator", icon: <ImageIcon size={16} />, roles: ["admin", "team_member"], sub: "Visual" },
  { label: "Carousel Gen", href: "/dashboard/carousel-generator", icon: <Layers size={16} />, roles: ["admin", "team_member"], sub: "Visual" },
  { label: "Brand Voice", href: "/dashboard/brand-voice", icon: <BookOpen size={16} />, roles: ["admin", "team_member"], sub: "Brand & Web" },
  { label: "Brand Kit", href: "/dashboard/brand-kit", icon: <Palette size={16} />, roles: ["admin", "team_member"], sub: "Brand & Web" },
  { label: "Content Library", href: "/dashboard/content-library", icon: <FolderOpen size={16} />, roles: ["admin", "team_member"], sub: "Brand & Web" },
  { label: "Websites", href: "/dashboard/websites", icon: <Globe size={16} />, roles: ["admin", "team_member"], sub: "Brand & Web" },
  { label: "Landing Pages", href: "/dashboard/landing-pages", icon: <LayoutTemplate size={16} />, roles: ["admin", "team_member"], sub: "Brand & Web" },
  { label: "Forms", href: "/dashboard/forms", icon: <ClipboardCheck size={16} />, roles: ["admin", "team_member"], sub: "Brand & Web" },
  { label: "Surveys", href: "/dashboard/surveys", icon: <ClipboardList size={16} />, roles: ["admin"], sub: "Brand & Web" },
  { label: "Social Manager", href: "/dashboard/social-manager", icon: <Bot size={16} />, roles: ["admin", "team_member"], sub: "Social" },

  // ── Automate (AI & workflows) ──
  { label: "AI Agents", href: "/dashboard/services", icon: <Sparkles size={16} />, roles: ["admin", "team_member"], section: "Automate", sub: "AI" },
  { label: "Agent HQ", href: "/dashboard/agent-supervisor", icon: <Crown size={16} />, roles: ["admin"], sub: "AI" },
  { label: "AI Studio", href: "/dashboard/ai-studio", icon: <Sparkles size={16} />, roles: ["admin", "team_member"], sub: "AI" },
  { label: "Apps", href: "/dashboard/agent-desktop", icon: <Monitor size={16} />, roles: ["admin", "team_member"], sub: "AI" },
  { label: "Workflows", href: "/dashboard/workflows", icon: <Zap size={16} />, roles: ["admin"], sub: "Workflows" },
  { label: "Flow Builder", href: "/dashboard/workflow-builder", icon: <GitBranch size={16} />, roles: ["admin"], sub: "Workflows" },
  { label: "Automations", href: "/dashboard/automations", icon: <RotateCcw size={16} />, roles: ["admin"], sub: "Workflows" },
  { label: "WhatsApp", href: "/dashboard/whatsapp", icon: <MessageSquare size={16} />, roles: ["admin"], sub: "Channels" },
  { label: "Webhooks", href: "/dashboard/webhooks", icon: <Webhook size={16} />, roles: ["admin"], sub: "Channels" },
  { label: "API Docs", href: "/dashboard/api-docs", icon: <FileText size={16} />, roles: ["admin"], sub: "Channels" },
  { label: "Activity Log", href: "/dashboard/activity-log", icon: <ClipboardList size={16} />, roles: ["admin"], sub: "Channels" },

  // ── Manage (operations & finance) ──
  { label: "Workspaces", href: "/dashboard/workspaces", icon: <Building2 size={16} />, roles: ["admin"], section: "Manage", sub: "Business" },
  { label: "Team", href: "/dashboard/team", icon: <UsersRound size={16} />, roles: ["admin"], sub: "Business" },
  { label: "Production", href: "/dashboard/production", icon: <Kanban size={16} />, roles: ["admin", "team_member"], sub: "Business" },
  { label: "Financials", href: "/dashboard/financials", icon: <BarChart3 size={16} />, roles: ["admin"], sub: "Business" },
  { label: "Invoices", href: "/dashboard/invoices", icon: <Receipt size={16} />, roles: ["admin"], sub: "Business" },
  { label: "Pricing", href: "/dashboard/pricing", icon: <CreditCard size={16} />, roles: ["admin"], sub: "Business" },
  { label: "Phone & Email", href: "/dashboard/phone-email", icon: <Phone size={16} />, roles: ["admin"], sub: "Business" },
  { label: "Client Health", href: "/dashboard/client-health", icon: <Heart size={16} />, roles: ["admin"], sub: "Support" },
  { label: "Reviews", href: "/dashboard/reviews", icon: <Star size={16} />, roles: ["admin"], sub: "Support" },
  { label: "Tickets", href: "/dashboard/tickets", icon: <LifeBuoy size={16} />, roles: ["admin"], sub: "Support" },
  { label: "Referrals", href: "/dashboard/referrals", icon: <Gift size={16} />, roles: ["admin"], sub: "Support" },
  { label: "ROI Calculator", href: "/dashboard/roi-calculator", icon: <Calculator size={16} />, roles: ["admin"], sub: "Support" },
  { label: "Monitor", href: "/dashboard/monitor", icon: <Activity size={16} />, roles: ["admin"], sub: "Tools" },
  { label: "Reports Gen", href: "/dashboard/report-generator", icon: <FileBarChart2 size={16} />, roles: ["admin"], sub: "Tools" },
  { label: "Marketplace", href: "/dashboard/marketplace", icon: <Store size={16} />, roles: ["admin"], sub: "Tools" },

  // ── Connect (integrations) — no sub-groups ──
  { label: "Google Biz", href: "/dashboard/google-business", icon: <Globe size={16} />, roles: ["admin"], section: "Connect" },
  { label: "Discord", href: "/dashboard/discord", icon: <MessageSquare size={16} />, roles: ["admin"] },
  { label: "Notion", href: "/dashboard/notion-sync", icon: <FileText size={16} />, roles: ["admin"] },
  { label: "Socials", href: "/dashboard/integrations", icon: <Link2 size={16} />, roles: ["admin"] },
  { label: "Competitors", href: "/dashboard/competitive-monitor", icon: <Target size={16} />, roles: ["admin"] },
  { label: "Telegram Bot", href: "/dashboard/telegram-bot", icon: <Bot size={16} />, roles: ["admin"] },
  { label: "Conversations", href: "/dashboard/conversations", icon: <MessagesSquare size={16} />, roles: ["admin"] },
  { label: "DM Controller", href: "/dashboard/dm-controller", icon: <Send size={16} />, roles: ["admin"] },
  { label: "Settings", href: "/dashboard/settings", icon: <Settings size={16} />, roles: ["admin"] },

  // ── Client Portal ──
  { label: "Overview", href: "/dashboard/portal", icon: <LayoutDashboard size={16} />, roles: ["client"] },
  { label: "Lead Engine", href: "/dashboard/portal/leads", icon: <Sparkles size={16} />, roles: ["client"], section: "Grow" },
  { label: "Outreach", href: "/dashboard/portal/outreach", icon: <Send size={16} />, roles: ["client"] },
  { label: "Socials", href: "/dashboard/portal/socials", icon: <Link2 size={16} />, roles: ["client"] },
  { label: "Content", href: "/dashboard/portal/content", icon: <Film size={16} />, roles: ["client"], section: "Manage" },
  { label: "Uploads", href: "/dashboard/portal/uploads", icon: <Upload size={16} />, roles: ["client"] },
  { label: "Calendar", href: "/dashboard/portal/calendar", icon: <Calendar size={16} />, roles: ["client"] },
  { label: "Reports", href: "/dashboard/portal/reports", icon: <BarChart3 size={16} />, roles: ["client"] },
  { label: "Invoices", href: "/dashboard/portal/billing", icon: <CreditCard size={16} />, roles: ["client"] },
  { label: "Support", href: "/dashboard/portal/support", icon: <MessageSquare size={16} />, roles: ["client"] },
  { label: "Settings", href: "/dashboard/portal/settings", icon: <Settings size={16} />, roles: ["client"] },
];

/* ─── Helper: check if a nav item is active ─────────────────────── */
function isItemActive(href: string, pathname: string) {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
}

export default function Sidebar() {
  const pathname = usePathname() || "";
  const { profile, signOut, loading: authLoading } = useAuth();
  const { config: wl } = useWhiteLabel();
  const [collapsed, setCollapsed] = useState(false);

  // Use profile role when available. If profile hasn't loaded yet but auth
  // loading is complete (user is logged in, profile just failed to fetch),
  // fall back to the cached role from localStorage, or default to "admin"
  // to avoid showing an empty sidebar. The dashboard layout already blocks
  // rendering until user exists, so we know we're authenticated here.
  const userRole = profile?.role || (() => {
    // If still loading auth, show nothing (prevents flash of admin nav for clients)
    if (authLoading) return "";
    // Auth done but profile null — try cached role
    try {
      const cached = typeof window !== "undefined" ? localStorage.getItem("ss_profile") : null;
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.role) return parsed.role;
      }
    } catch {}
    // Ultimate fallback — admin (most users are admin, and the route guard in layout.tsx
    // will redirect non-admin users anyway)
    return "admin";
  })();
  const filteredNav = navItems.filter(
    (item) => userRole && item.roles.includes(userRole)
  );

  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  // Chrome Extension banner dismiss state
  const [extDismissed, setExtDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    try { return localStorage.getItem("sidebar_ext_dismissed") === "1"; } catch { return false; }
  });

  // Group nav items by section for collapsible sidebar
  const groups: { section: string | null; items: NavItem[] }[] = [];
  let currentGroup: (typeof groups)[0] | null = null;
  filteredNav.forEach(item => {
    if (item.section) {
      currentGroup = { section: item.section, items: [item] };
      groups.push(currentGroup);
    } else if (!currentGroup) {
      if (groups.length === 0 || groups[0].section !== null) {
        groups.unshift({ section: null, items: [] });
      }
      groups[0].items.push(item);
    } else {
      currentGroup.items.push(item);
    }
  });

  // Collapsible section state — persisted to localStorage
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try { return JSON.parse(localStorage.getItem("sidebar_sections") || "{}"); } catch { return {}; }
  });

  // Sub-group collapse state — persisted to localStorage
  const [expandedSubs, setExpandedSubs] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try { return JSON.parse(localStorage.getItem("sidebar_subs") || "{}"); } catch { return {}; }
  });

  useEffect(() => {
    localStorage.setItem("sidebar_sections", JSON.stringify(expandedSections));
  }, [expandedSections]);

  useEffect(() => {
    localStorage.setItem("sidebar_subs", JSON.stringify(expandedSubs));
  }, [expandedSubs]);

  const isSectionExpanded = (section: string | null): boolean => {
    if (!section) return true; // Core items always visible
    if (expandedSections[section] !== undefined) return expandedSections[section];
    // Default: expand only the section containing the active page
    return groups.find(g => g.section === section)?.items.some(item =>
      isItemActive(item.href, pathname)
    ) || false;
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !isSectionExpanded(section) }));
  };

  // Sub-group expand/collapse: default to expanded if active page is in the sub-group
  const isSubExpanded = (subKey: string, items: NavItem[]): boolean => {
    if (expandedSubs[subKey] !== undefined) return expandedSubs[subKey];
    // Default: expand if the active page is in this sub-group
    return items.some(item => isItemActive(item.href, pathname));
  };

  const toggleSub = (subKey: string, items: NavItem[]) => {
    setExpandedSubs(prev => ({ ...prev, [subKey]: !isSubExpanded(subKey, items) }));
  };

  // Pre-compute sub-groups for each section
  const subGroupsForSection = useMemo(() => {
    const map: Record<string, { sub: string; items: NavItem[] }[]> = {};
    groups.forEach(group => {
      if (!group.section) return;
      const hasSubs = group.items.some(item => item.sub);
      if (!hasSubs) return;
      // Preserve ordering: iterate items, collect unique sub names in order
      const seen = new Set<string>();
      const subGroups: { sub: string; items: NavItem[] }[] = [];
      // Items without a sub go into a "_none" bucket rendered directly
      const noBucket: NavItem[] = [];
      group.items.forEach(item => {
        if (!item.sub) {
          noBucket.push(item);
          return;
        }
        if (!seen.has(item.sub)) {
          seen.add(item.sub);
          subGroups.push({ sub: item.sub, items: [] });
        }
        subGroups.find(sg => sg.sub === item.sub)!.items.push(item);
      });
      // Prepend no-sub items as a virtual group if any
      if (noBucket.length > 0) {
        subGroups.unshift({ sub: "", items: noBucket });
      }
      map[group.section] = subGroups;
    });
    return map;
  }, [groups, pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Render a single nav link ────────────────────────────────── */
  const renderNavLink = (item: NavItem, indented?: boolean) => {
    const isActive = isItemActive(item.href, pathname);
    return (
      <div key={item.href} className="relative sidebar-item-anim">
        <Link
          href={item.href}
          onMouseEnter={() => setHoveredItem(item.href)}
          onMouseLeave={() => setHoveredItem(null)}
          className={`flex items-center gap-2.5 py-[7px] my-[1px] rounded-xl text-[12px] transition-all duration-150 ${
            indented ? "px-3.5" : "px-2.5"
          } ${
            isActive
              ? "text-gold font-medium bg-gold/[0.06] border border-gold/10"
              : "text-muted hover:text-foreground hover:bg-surface-light border border-transparent"
          }`}
        >
          <span className={`shrink-0 transition-colors ${isActive ? "text-gold" : hoveredItem === item.href ? "text-foreground" : ""}`}>
            {item.icon}
          </span>
          <span className="truncate">{item.label}</span>
          {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] h-4 rounded-r bg-gold" />}
        </Link>
      </div>
    );
  };

  /* ─── Render a collapsed-sidebar nav link (icon + tooltip) ───── */
  const renderCollapsedLink = (item: NavItem) => {
    const isActive = isItemActive(item.href, pathname);
    return (
      <div key={item.href} className="relative">
        <Link
          href={item.href}
          onMouseEnter={() => setHoveredItem(item.href)}
          onMouseLeave={() => setHoveredItem(null)}
          className={`flex items-center gap-2.5 px-2.5 py-[7px] my-[1px] rounded-xl text-[12px] transition-all duration-150 ${
            isActive
              ? "text-gold font-medium bg-gold/[0.06] border border-gold/10"
              : "text-muted hover:text-foreground hover:bg-surface-light border border-transparent"
          }`}
          title={item.label}
        >
          <span className={`shrink-0 transition-colors ${isActive ? "text-gold" : hoveredItem === item.href ? "text-foreground" : ""}`}>
            {item.icon}
          </span>
          {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] h-4 rounded-r bg-gold" />}
        </Link>
        {hoveredItem === item.href && (
          <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 whitespace-nowrap">
            <div className="bg-surface border border-border rounded-xl px-2.5 py-1.5 shadow-elevated text-xs font-medium text-foreground">
              {item.label}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex flex-col transition-all duration-300 ${
        collapsed ? "w-[56px]" : "w-56"
      }`}
      style={{
        background: "var(--color-surface, #FFFFFF)",
        borderRight: "1px solid var(--color-border, #E8E5E0)",
      }}
    >
      {/* Logo — uses white label config when available */}
      <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"} px-3 h-12 shrink-0`}>
        {!collapsed ? (
          <Link href="/dashboard" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={wl.logo_url || "/icons/shortstack-logo.png"} alt={wl.company_name || "ShortStack"} width={24} height={24} className="rounded object-contain" />
            <span className="text-foreground font-bold text-[13px] tracking-tight">{wl.company_name || "ShortStack"}</span>
          </Link>
        ) : (
          <Link href="/dashboard">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={wl.logo_url || "/icons/shortstack-logo.png"} alt={wl.company_name || "SS"} width={22} height={22} className="rounded object-contain" />
          </Link>
        )}
        {!collapsed && (
          <button onClick={() => setCollapsed(!collapsed)} className="p-1 rounded-md text-muted hover:text-foreground hover:bg-surface-light transition-colors">
            <ChevronLeft size={14} />
          </button>
        )}
      </div>

      {/* Admin Profile Switcher */}
      {!collapsed && <AdminProfileSwitcher />}

      {/* Chrome Extension banner — admin only, dismissible */}
      {!collapsed && userRole === "admin" && !extDismissed && (
        <div className="mx-2 mb-1">
          <div className="flex items-center gap-1.5 h-[34px] px-2.5 rounded-lg bg-gold/[0.07] border border-gold/15">
            <Puzzle size={13} className="shrink-0 text-gold" />
            <a
              href="#"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] text-gold/90 hover:text-gold font-medium truncate transition-colors"
            >
              <span>Chrome Extension</span>
              <ExternalLink size={10} className="shrink-0 opacity-60" />
            </a>
            <button
              onClick={() => { setExtDismissed(true); localStorage.setItem("sidebar_ext_dismissed", "1"); }}
              className="ml-auto shrink-0 p-0.5 rounded text-muted hover:text-foreground transition-colors"
              aria-label="Dismiss"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Navigation — collapsible sections with smart sub-groups */}
      <nav className="flex-1 px-1.5 py-1 overflow-y-auto scrollbar-none">
        {groups.map((group) => {
          const expanded = isSectionExpanded(group.section);
          const sectionSubs = group.section ? subGroupsForSection[group.section] : null;

          return (
            <div key={group.section || "_core"}>
              {/* Section header (e.g. Sales, Create, etc.) */}
              {group.section && !collapsed && (
                <button
                  onClick={() => toggleSection(group.section!)}
                  className="w-full flex items-center gap-2 px-2 pt-3 pb-1 group/sec cursor-pointer"
                >
                  <span className="text-[8px] text-muted uppercase tracking-[0.2em] font-semibold group-hover/sec:text-foreground transition-colors">
                    {group.section}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                  <ChevronDown
                    size={10}
                    className={`text-muted group-hover/sec:text-foreground transition-transform duration-200 ${expanded ? "" : "-rotate-90"}`}
                  />
                </button>
              )}

              {/* Section content */}
              {group.section && !collapsed ? (
                <div
                  className="sidebar-section-items"
                  data-collapsed={!expanded}
                >
                  <div className="sidebar-section-inner">
                    {sectionSubs ? (
                      /* ── Render sub-grouped items ── */
                      sectionSubs.map((sg) => {
                        if (!sg.sub) {
                          // Items without a sub-group — render directly
                          return sg.items.map(item => renderNavLink(item));
                        }
                        const subKey = `${group.section}::${sg.sub}`;
                        const subOpen = isSubExpanded(subKey, sg.items);
                        return (
                          <div key={subKey}>
                            <button
                              onClick={() => toggleSub(subKey, sg.items)}
                              className="w-full flex items-center gap-1.5 pl-3 pr-2 pt-2 pb-0.5 group/sub cursor-pointer"
                            >
                              <span className="text-[7px] text-muted/60 group-hover/sub:text-muted transition-colors select-none">&bull;</span>
                              <span className="text-[10px] text-muted/70 font-medium group-hover/sub:text-foreground transition-colors select-none">
                                {sg.sub}
                              </span>
                              <ChevronDown
                                size={8}
                                className={`ml-auto text-muted/40 group-hover/sub:text-muted transition-transform duration-150 ${subOpen ? "" : "-rotate-90"}`}
                              />
                            </button>
                            <div
                              className="sidebar-sub-items"
                              data-collapsed={!subOpen}
                            >
                              <div className="sidebar-sub-inner">
                                {sg.items.map(item => renderNavLink(item, true))}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      /* ── No sub-groups (e.g. Connect) — render flat ── */
                      group.items.map(item => renderNavLink(item))
                    )}
                  </div>
                </div>
              ) : (
                /* Core items (no section) or collapsed sidebar — render directly */
                group.items.map(item =>
                  collapsed ? renderCollapsedLink(item) : renderNavLink(item)
                )
              )}
            </div>
          );
        })}
      </nav>

      {/* Collapse button when collapsed */}
      {collapsed && (
        <div className="px-1.5 py-1">
          <button onClick={() => setCollapsed(false)} className="w-full p-2 rounded-xl text-muted hover:text-foreground hover:bg-surface-light flex items-center justify-center transition-colors">
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* User — cleaner profile section (click to open settings) */}
      <div className="px-1.5 py-2 border-t border-border">
        {!collapsed ? (
          <Link href="/dashboard/settings" className="block px-2.5 py-2 rounded-xl hover:bg-surface-light transition-colors cursor-pointer" title="Open settings">
            <div className="flex items-center gap-2.5">
              {(() => {
                const plan = getPlanConfig(profile?.plan_tier);
                const glow = profile?.plan_tier ? `0 0 8px ${plan.glow}` : undefined;
                return profile?.avatar_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={profile.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" style={{ boxShadow: glow }} />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gold/10 flex items-center justify-center" style={{ boxShadow: glow }}>
                    <span className="text-gold text-[10px] font-bold">{(profile?.nickname || profile?.full_name)?.charAt(0) || "?"}</span>
                  </div>
                );
              })()}
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-foreground truncate">{profile?.nickname || profile?.full_name || "Loading..."}</p>
                <RoleBadge role={profile?.role} planTier={profile?.plan_tier || undefined} />
              </div>
            </div>
          </Link>
        ) : (
          <Link href="/dashboard/settings" className="flex justify-center py-1" title="Open settings">
            <div className="w-7 h-7 rounded-full bg-gold/10 flex items-center justify-center">
              <span className="text-gold text-[9px] font-bold">{profile?.full_name?.charAt(0) || "?"}</span>
            </div>
          </Link>
        )}
        <button onClick={signOut}
          className={`w-full flex items-center gap-2.5 px-2.5 py-[6px] my-[1px] rounded-xl text-[11px] text-muted hover:text-danger hover:bg-danger/5 transition-colors ${collapsed ? "justify-center" : ""}`}
          title={collapsed ? "Sign Out" : undefined}>
          <LogOut size={14} />
          {!collapsed && <span>Sign Out</span>}
        </button>
        {/* White label: Powered by footer */}
        {wl.show_powered_by && !collapsed && (wl.company_name && wl.company_name !== "ShortStack") && (
          <div className="text-center pt-1">
            <span className="text-[8px] text-muted">Powered by ShortStack</span>
          </div>
        )}
      </div>
    </aside>
  );
}

/* ─── Role Badge ──────────────────────────────────────────────────── */
function RoleBadge({ role, planTier }: { role?: string; planTier?: string }) {
  if (role === "admin") {
    const plan = getPlanConfig(planTier);
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] text-muted">Founder</span>
        {planTier && (
          <span
            className="text-[7px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
            style={{
              background: `${plan.color}18`,
              color: plan.color,
              boxShadow: `0 0 6px ${plan.glow}`,
            }}
          >
            {plan.badge_label}
          </span>
        )}
      </div>
    );
  }

  if (role === "client") {
    // Show "Member" instead of "client" + plan badge if available
    const plan = getPlanConfig(planTier);
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] text-muted">Member</span>
        {planTier && (
          <span
            className="text-[7px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
            style={{
              background: `${plan.color}18`,
              color: plan.color,
              boxShadow: `0 0 6px ${plan.glow}`,
            }}
          >
            {plan.badge_label}
          </span>
        )}
      </div>
    );
  }

  // team_member
  return <span className="text-[9px] text-muted capitalize">{role?.replace("_", " ") || "..."}</span>;
}
