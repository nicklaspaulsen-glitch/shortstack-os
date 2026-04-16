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
} from "lucide-react";
import { useState, useEffect } from "react";
import AdminProfileSwitcher from "@/components/admin-profile-switcher";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles: string[];
  section?: string;
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
  { label: "CRM", href: "/dashboard/crm", icon: <Users size={16} />, roles: ["admin", "team_member"], section: "Sales" },
  { label: "Lead Finder", href: "/dashboard/scraper", icon: <Search size={16} />, roles: ["admin", "team_member"] },
  { label: "AI Caller", href: "/dashboard/eleven-agents", icon: <Phone size={16} />, roles: ["admin"] },
  { label: "Voice AI", href: "/dashboard/voice-receptionist", icon: <Headphones size={16} />, roles: ["admin"] },
  { label: "Outreach", href: "/dashboard/outreach-hub", icon: <Send size={16} />, roles: ["admin"] },
  { label: "Outreach Logs", href: "/dashboard/outreach-logs", icon: <ClipboardList size={16} />, roles: ["admin"] },
  { label: "Sequences", href: "/dashboard/sequences", icon: <ListOrdered size={16} />, roles: ["admin"] },
  { label: "Proposals", href: "/dashboard/proposals", icon: <FileCheck size={16} />, roles: ["admin", "team_member"] },
  { label: "Deals", href: "/dashboard/deals", icon: <CreditCard size={16} />, roles: ["admin", "team_member"] },
  { label: "Clients", href: "/dashboard/clients", icon: <Users size={16} />, roles: ["admin", "team_member"] },
  { label: "Calendar", href: "/dashboard/calendar", icon: <Calendar size={16} />, roles: ["admin", "team_member"] },
  { label: "Scheduling", href: "/dashboard/scheduling", icon: <Calendar size={16} />, roles: ["admin", "team_member"] },
  { label: "Forecast", href: "/dashboard/forecast", icon: <TrendingUp size={16} />, roles: ["admin"] },
  { label: "Commissions", href: "/dashboard/commission-tracker", icon: <Award size={16} />, roles: ["admin"] },

  // ── Create (content production) ──
  { label: "Ads Copy Lab", href: "/dashboard/ads", icon: <Megaphone size={16} />, roles: ["admin"], section: "Create" },
  { label: "AI Copywriter", href: "/dashboard/copywriter", icon: <Pen size={16} />, roles: ["admin", "team_member"] },
  { label: "Script Lab", href: "/dashboard/script-lab", icon: <Sparkles size={16} />, roles: ["admin", "team_member"] },
  { label: "Social Manager", href: "/dashboard/social-manager", icon: <Bot size={16} />, roles: ["admin", "team_member"] },
  { label: "Email Composer", href: "/dashboard/email-composer", icon: <Mail size={16} />, roles: ["admin", "team_member"] },
  { label: "Email Templates", href: "/dashboard/email-templates", icon: <MailPlus size={16} />, roles: ["admin"] },
  { label: "SMS Templates", href: "/dashboard/sms-templates", icon: <Smartphone size={16} />, roles: ["admin"] },
  { label: "Newsletter", href: "/dashboard/newsletter", icon: <Newspaper size={16} />, roles: ["admin"] },
  { label: "Carousel Gen", href: "/dashboard/carousel-generator", icon: <Layers size={16} />, roles: ["admin", "team_member"] },
  { label: "Video Editor", href: "/dashboard/video-editor", icon: <Film size={16} />, roles: ["admin", "team_member"] },
  { label: "AI Video Gen", href: "/dashboard/ai-video", icon: <Film size={16} />, roles: ["admin", "team_member"] },
  { label: "Design Studio", href: "/dashboard/design", icon: <PenTool size={16} />, roles: ["admin", "team_member"] },
  { label: "Thumbnails", href: "/dashboard/thumbnail-generator", icon: <ImageIcon size={16} />, roles: ["admin", "team_member"] },
  { label: "Brand Voice", href: "/dashboard/brand-voice", icon: <BookOpen size={16} />, roles: ["admin", "team_member"] },
  { label: "Brand Kit", href: "/dashboard/brand-kit", icon: <Palette size={16} />, roles: ["admin", "team_member"] },
  { label: "Content Library", href: "/dashboard/content-library", icon: <FolderOpen size={16} />, roles: ["admin", "team_member"] },
  { label: "Forms", href: "/dashboard/forms", icon: <ClipboardCheck size={16} />, roles: ["admin", "team_member"] },
  { label: "Surveys", href: "/dashboard/surveys", icon: <ClipboardList size={16} />, roles: ["admin"] },
  { label: "Websites", href: "/dashboard/websites", icon: <Globe size={16} />, roles: ["admin", "team_member"] },
  { label: "Landing Pages", href: "/dashboard/landing-pages", icon: <LayoutTemplate size={16} />, roles: ["admin", "team_member"] },

  // ── Automate (AI & workflows) ──
  { label: "AI Agents", href: "/dashboard/services", icon: <Sparkles size={16} />, roles: ["admin", "team_member"], section: "Automate" },
  { label: "Agent HQ", href: "/dashboard/agent-supervisor", icon: <Crown size={16} />, roles: ["admin"] },
  { label: "AI Studio", href: "/dashboard/ai-studio", icon: <Sparkles size={16} />, roles: ["admin", "team_member"] },
  { label: "Apps", href: "/dashboard/agent-desktop", icon: <Monitor size={16} />, roles: ["admin", "team_member"] },
  { label: "Workflows", href: "/dashboard/workflows", icon: <Zap size={16} />, roles: ["admin"] },
  { label: "Flow Builder", href: "/dashboard/workflow-builder", icon: <GitBranch size={16} />, roles: ["admin"] },
  { label: "Automations", href: "/dashboard/automations", icon: <RotateCcw size={16} />, roles: ["admin"] },
  { label: "WhatsApp", href: "/dashboard/whatsapp", icon: <MessageSquare size={16} />, roles: ["admin"] },
  { label: "Webhooks", href: "/dashboard/webhooks", icon: <Webhook size={16} />, roles: ["admin"] },
  { label: "API Docs", href: "/dashboard/api-docs", icon: <FileText size={16} />, roles: ["admin"] },
  { label: "Activity Log", href: "/dashboard/activity-log", icon: <ClipboardList size={16} />, roles: ["admin"] },

  // ── Manage (operations & finance) ──
  { label: "Workspaces", href: "/dashboard/workspaces", icon: <Building2 size={16} />, roles: ["admin"], section: "Manage" },
  { label: "Team", href: "/dashboard/team", icon: <UsersRound size={16} />, roles: ["admin"] },
  { label: "Production", href: "/dashboard/production", icon: <Kanban size={16} />, roles: ["admin", "team_member"] },
  { label: "Invoices", href: "/dashboard/invoices", icon: <Receipt size={16} />, roles: ["admin"] },
  { label: "Referrals", href: "/dashboard/referrals", icon: <Gift size={16} />, roles: ["admin"] },
  { label: "Client Health", href: "/dashboard/client-health", icon: <Heart size={16} />, roles: ["admin"] },
  { label: "Reviews", href: "/dashboard/reviews", icon: <Star size={16} />, roles: ["admin"] },
  { label: "Tickets", href: "/dashboard/tickets", icon: <LifeBuoy size={16} />, roles: ["admin"] },
  { label: "ROI Calculator", href: "/dashboard/roi-calculator", icon: <Calculator size={16} />, roles: ["admin"] },
  { label: "Financials", href: "/dashboard/financials", icon: <BarChart3 size={16} />, roles: ["admin"] },
  { label: "Monitor", href: "/dashboard/monitor", icon: <Activity size={16} />, roles: ["admin"] },
  { label: "Reports Gen", href: "/dashboard/report-generator", icon: <FileBarChart2 size={16} />, roles: ["admin"] },
  { label: "Marketplace", href: "/dashboard/marketplace", icon: <Store size={16} />, roles: ["admin"] },
  { label: "Pricing", href: "/dashboard/pricing", icon: <CreditCard size={16} />, roles: ["admin"] },

  // ── Connect (integrations) ──
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

  useEffect(() => {
    localStorage.setItem("sidebar_sections", JSON.stringify(expandedSections));
  }, [expandedSections]);

  const isSectionExpanded = (section: string | null): boolean => {
    if (!section) return true; // Core items always visible
    if (expandedSections[section] !== undefined) return expandedSections[section];
    // Default: expand only the section containing the active page
    return groups.find(g => g.section === section)?.items.some(item =>
      pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))
    ) || false;
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !isSectionExpanded(section) }));
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

      {/* Navigation — collapsible sections */}
      <nav className="flex-1 px-1.5 py-1 overflow-y-auto scrollbar-none">
        {groups.map((group) => {
          const expanded = isSectionExpanded(group.section);
          return (
            <div key={group.section || "_core"}>
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
              {/* Animated section wrapper — uses CSS grid for smooth height transition */}
              {group.section && !collapsed ? (
                <div
                  className="sidebar-section-items"
                  data-collapsed={!expanded}
                >
                  <div className="sidebar-section-inner">
                    {group.items.map((item) => {
                      const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                      return (
                        <div key={item.href} className="relative sidebar-item-anim">
                          <Link
                            href={item.href}
                            onMouseEnter={() => setHoveredItem(item.href)}
                            onMouseLeave={() => setHoveredItem(null)}
                            className={`flex items-center gap-2.5 px-2.5 py-[7px] my-[1px] rounded-xl text-[12px] transition-all duration-150 ${
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
                    })}
                  </div>
                </div>
              ) : (
                /* Core items (no section) or collapsed sidebar — render directly */
                group.items.map((item) => {
                  const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
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
                        title={collapsed ? item.label : undefined}
                      >
                        <span className={`shrink-0 transition-colors ${isActive ? "text-gold" : hoveredItem === item.href ? "text-foreground" : ""}`}>
                          {item.icon}
                        </span>
                        {!collapsed && <span className="truncate">{item.label}</span>}
                        {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] h-4 rounded-r bg-gold" />}
                      </Link>
                      {collapsed && hoveredItem === item.href && (
                        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 whitespace-nowrap">
                          <div className="bg-surface border border-border rounded-xl px-2.5 py-1.5 shadow-elevated text-xs font-medium text-foreground">
                            {item.label}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
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
