"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useWhiteLabel } from "@/lib/white-label-context";
import { getPlanConfig } from "@/lib/plan-config";
import { BRAND } from "@/lib/brand-config";
import type { LucideIcon } from "lucide-react";
import {
  Pin,
  DollarSign,
  Briefcase,
  Home,
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
  Settings,
  Bell,
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
  Headphones,
  LayoutTemplate,
  GitBranch,
  FileBarChart2,
  Store,
  Inbox,
  Puzzle,
  X,
  Download,
  ShieldCheck,
  ArrowUpRight,
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
  { label: "Generations", href: "/dashboard/generations", icon: <Sparkles size={16} />, roles: ["admin", "team_member"] },
  { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard size={16} />, roles: ["admin", "team_member"] },
  { label: "Community", href: "/dashboard/community", icon: <Users size={16} />, roles: ["admin", "team_member", "client"] },
  { label: "Analytics", href: "/dashboard/analytics", icon: <BarChart3 size={16} />, roles: ["admin"] },
  { label: "Reports", href: "/dashboard/reports", icon: <FileText size={16} />, roles: ["admin"] },

  // ── Sales (full revenue pipeline) ──
  { label: "Outreach", href: "/dashboard/outreach-hub", icon: <Send size={16} />, roles: ["admin"], section: "Sales", sub: "Leads & Outreach" },
  { label: "Lead Finder", href: "/dashboard/scraper", icon: <Search size={16} />, roles: ["admin", "team_member"], sub: "Leads & Outreach" },
  { label: "AI Caller", href: "/dashboard/eleven-agents", icon: <Phone size={16} />, roles: ["admin"], sub: "Leads & Outreach" },
  { label: "Voice AI", href: "/dashboard/voice-receptionist", icon: <Headphones size={16} />, roles: ["admin"], sub: "Leads & Outreach" },
  { label: "DM Controller", href: "/dashboard/dm-controller", icon: <Send size={16} />, roles: ["admin"], sub: "Leads & Outreach" },
  { label: "Conversations", href: "/dashboard/conversations", icon: <MessagesSquare size={16} />, roles: ["admin"], sub: "Leads & Outreach" },
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
  { label: "AI Copywriter", href: "/dashboard/copywriter", icon: <Pen size={16} />, roles: ["admin", "team_member"], section: "Create", sub: "Writing" },
  { label: "Script Lab", href: "/dashboard/script-lab", icon: <Sparkles size={16} />, roles: ["admin", "team_member"], sub: "Writing" },
  { label: "Email Composer", href: "/dashboard/email-composer", icon: <Mail size={16} />, roles: ["admin", "team_member"], sub: "Writing" },
  { label: "Email Templates", href: "/dashboard/email-templates", icon: <MailPlus size={16} />, roles: ["admin"], sub: "Writing" },
  { label: "SMS Templates", href: "/dashboard/sms-templates", icon: <Smartphone size={16} />, roles: ["admin"], sub: "Writing" },
  { label: "Newsletter", href: "/dashboard/newsletter", icon: <Newspaper size={16} />, roles: ["admin"], sub: "Writing" },
  { label: "Brand Voice", href: "/dashboard/brand-voice", icon: <BookOpen size={16} />, roles: ["admin", "team_member"], sub: "Brand & Web" },
  { label: "Brand Kit", href: "/dashboard/brand-kit", icon: <Palette size={16} />, roles: ["admin", "team_member"], sub: "Brand & Web" },
  { label: "Content Library", href: "/dashboard/content-library", icon: <FolderOpen size={16} />, roles: ["admin", "team_member"], sub: "Brand & Web" },
  { label: "Websites", href: "/dashboard/websites", icon: <Globe size={16} />, roles: ["admin", "team_member"], sub: "Brand & Web" },
  { label: "Landing Pages", href: "/dashboard/landing-pages", icon: <LayoutTemplate size={16} />, roles: ["admin", "team_member"], sub: "Brand & Web" },
  { label: "Forms", href: "/dashboard/forms", icon: <ClipboardCheck size={16} />, roles: ["admin", "team_member"], sub: "Brand & Web" },
  { label: "Surveys", href: "/dashboard/surveys", icon: <ClipboardList size={16} />, roles: ["admin"], sub: "Brand & Web" },
  { label: "Social Manager", href: "/dashboard/social-manager", icon: <Bot size={16} />, roles: ["admin", "team_member"], sub: "Social" },
  { label: "Content Plan", href: "/dashboard/content-plan", icon: <Calendar size={16} />, roles: ["admin", "team_member"], sub: "Social" },

  // ── Visual (image, video, design) ──
  { label: "Thumbnails", href: "/dashboard/thumbnail-generator", icon: <ImageIcon size={16} />, roles: ["admin", "team_member"], section: "Visual", sub: "Image" },
  { label: "AI Studio", href: "/dashboard/ai-studio", icon: <Sparkles size={16} />, roles: ["admin", "team_member"], sub: "Image" },
  { label: "Design Studio", href: "/dashboard/design", icon: <PenTool size={16} />, roles: ["admin", "team_member"], sub: "Image" },
  { label: "Carousel Gen", href: "/dashboard/carousel-generator", icon: <Layers size={16} />, roles: ["admin", "team_member"], sub: "Image" },
  { label: "Video Editor", href: "/dashboard/video-editor", icon: <Film size={16} />, roles: ["admin", "founder", "agency", "team_member"], sub: "Video" },
  { label: "Preset Library", href: "/dashboard/video-editor/library", icon: <LayoutTemplate size={16} />, roles: ["admin", "founder", "agency", "team_member"], sub: "Video" },
  { label: "AI Video Gen", href: "/dashboard/ai-video", icon: <Film size={16} />, roles: ["admin", "founder", "agency", "team_member"], sub: "Video" },

  // ── Automate (AI & workflows) ──
  { label: "AI Agents", href: "/dashboard/services", icon: <Sparkles size={16} />, roles: ["admin", "team_member"], section: "Automate", sub: "AI" },
  { label: "Agent HQ", href: "/dashboard/agent-supervisor", icon: <Crown size={16} />, roles: ["admin"], sub: "AI" },
  { label: "Apps", href: "/dashboard/agent-desktop", icon: <Monitor size={16} />, roles: ["admin", "team_member"], sub: "AI" },
  { label: "Workflows", href: "/dashboard/workflows", icon: <Zap size={16} />, roles: ["admin"], sub: "Workflows" },
  { label: "Flow Builder", href: "/dashboard/workflow-builder", icon: <GitBranch size={16} />, roles: ["admin"], sub: "Workflows" },
  { label: "Triggers", href: "/dashboard/triggers", icon: <Zap size={16} />, roles: ["admin"], sub: "Workflows" },
  { label: "Automations", href: "/dashboard/automations", icon: <RotateCcw size={16} />, roles: ["admin"], sub: "Workflows" },
  { label: "WhatsApp", href: "/dashboard/whatsapp", icon: <MessageSquare size={16} />, roles: ["admin"], sub: "Channels" },
  { label: "Webhooks", href: "/dashboard/webhooks", icon: <Webhook size={16} />, roles: ["admin"], sub: "Channels" },
  { label: "API Docs", href: "/dashboard/api-docs", icon: <FileText size={16} />, roles: ["admin"], sub: "Channels" },
  { label: "Activity Log", href: "/dashboard/activity-log", icon: <ClipboardList size={16} />, roles: ["admin"], sub: "Channels" },

  // ── Manage (operations & finance) ──
  { label: "Workspaces", href: "/dashboard/workspaces", icon: <Building2 size={16} />, roles: ["admin"], section: "Manage", sub: "Business" },
  { label: "Team", href: "/dashboard/team", icon: <UsersRound size={16} />, roles: ["admin"], sub: "Business" },
  { label: "Production", href: "/dashboard/production", icon: <Kanban size={16} />, roles: ["admin", "team_member"], sub: "Business" },
  { label: "Projects", href: "/dashboard/projects", icon: <Kanban size={16} />, roles: ["admin", "team_member"], sub: "Business" },
  { label: "Financials", href: "/dashboard/financials", icon: <BarChart3 size={16} />, roles: ["admin"], sub: "Business" },
  { label: "Invoices", href: "/dashboard/invoices", icon: <Receipt size={16} />, roles: ["admin"], sub: "Business" },
  { label: "Billing", href: "/dashboard/billing", icon: <CreditCard size={16} />, roles: ["admin", "founder", "agency", "team_member"], sub: "Business" },
  { label: "Pricing", href: "/dashboard/pricing", icon: <CreditCard size={16} />, roles: ["admin"], sub: "Business" },
  { label: "Usage & Tokens", href: "/dashboard/usage", icon: <Zap size={16} />, roles: ["admin", "team_member"], sub: "Business" },
  { label: "Phone & Email", href: "/dashboard/phone-email", icon: <Phone size={16} />, roles: ["admin", "founder", "agency", "team_member"], sub: "Business" },
  { label: "Phone Setup", href: "/dashboard/phone-setup", icon: <Phone size={16} />, roles: ["admin", "founder", "agency", "team_member"], sub: "Business" },
  { label: "Mail Setup", href: "/dashboard/mail-setup", icon: <Mail size={16} />, roles: ["admin", "founder", "agency", "team_member"], sub: "Business" },
  { label: "Domains", href: "/dashboard/domains", icon: <Link2 size={16} />, roles: ["admin"], sub: "Business" },
  { label: "Client Health", href: "/dashboard/client-health", icon: <Heart size={16} />, roles: ["admin"], sub: "Support" },
  { label: "Reviews", href: "/dashboard/reviews", icon: <Star size={16} />, roles: ["admin"], sub: "Support" },
  { label: "Tickets", href: "/dashboard/tickets", icon: <LifeBuoy size={16} />, roles: ["admin"], sub: "Support" },
  { label: "Referrals", href: "/dashboard/referrals", icon: <Gift size={16} />, roles: ["admin"], sub: "Support" },
  { label: "ROI Calculator", href: "/dashboard/roi-calculator", icon: <Calculator size={16} />, roles: ["admin"], sub: "Support" },
  { label: "Monitor", href: "/dashboard/monitor", icon: <Activity size={16} />, roles: ["admin"], sub: "Tools" },
  { label: "Reports Gen", href: "/dashboard/report-generator", icon: <FileBarChart2 size={16} />, roles: ["admin"], sub: "Tools" },
  { label: "Marketplace", href: "/dashboard/marketplace", icon: <Store size={16} />, roles: ["admin"], sub: "Tools" },
  { label: "Download Desktop", href: "/dashboard/download", icon: <Download size={16} />, roles: ["admin", "team_member"], sub: "Tools" },

  // ── Connect (integrations) — no sub-groups ──
  { label: "Google Biz", href: "/dashboard/google-business", icon: <Globe size={16} />, roles: ["admin"], section: "Connect" },
  { label: "Discord", href: "/dashboard/discord", icon: <MessageSquare size={16} />, roles: ["admin"] },
  { label: "Notion", href: "/dashboard/notion-sync", icon: <FileText size={16} />, roles: ["admin"] },
  { label: "Socials", href: "/dashboard/integrations", icon: <Link2 size={16} />, roles: ["admin"] },
  { label: "Competitors", href: "/dashboard/competitive-monitor", icon: <Target size={16} />, roles: ["admin"] },
  { label: "Telegram Bot", href: "/dashboard/telegram-bot", icon: <Bot size={16} />, roles: ["admin"] },
  { label: "Notifications", href: "/dashboard/notifications", icon: <Bell size={16} />, roles: ["admin", "team_member"] },
  { label: "System Status", href: "/dashboard/system-status", icon: <ShieldCheck size={16} />, roles: ["admin"] },
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

/* ─── Section header → hub page mapping. Sections with a value here
 * render as a clickable <Link> (expand/collapse moves to a chevron
 * button). Sections without a hub (Manage / Connect / Grow) keep the
 * all-button behavior. ─────────────────────────────────────────── */
const SECTION_HUB_HREF: Record<string, string> = {
  Sales: "/dashboard/sales",
  Create: "/dashboard/create",
  Visual: "/dashboard/visual",
  Automate: "/dashboard/automate",
  Manage: "/dashboard/manage",
  Connect: "/dashboard/connect",
};

/* ─── Icon name → Lucide component (curated list that matches the
 * icon picker in the sidebar customizer). Unknown names fall back. ── */
const CUSTOM_ICON_MAP: Record<string, LucideIcon> = {
  Home, Film, Users, Phone, DollarSign, BarChart3, Briefcase, Mail,
  Globe, Bot, Zap, Target, Crown, LayoutDashboard, Inbox, MessageSquare,
  Star, Calendar, FileText, Send, Gift, Heart, Calculator, Award, Bell,
  Layers, Sparkles, Settings,
};

function renderCustomIcon(iconName: string | undefined, size = 16): React.ReactNode | null {
  if (!iconName) return null;
  const Cmp = CUSTOM_ICON_MAP[iconName];
  if (!Cmp) return null;
  return <Cmp size={size} />;
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
  // ── User sidebar preferences (enabled_items + customizations) ───
  // Load asynchronously; while loading or empty, we show the default nav.
  const [enabledHrefs, setEnabledHrefs] = useState<string[] | null>(null);
  type SubGroup = { id: string; name: string; items: string[] };
  type CustomGroupShape = {
    id: string;
    name?: string;
    label?: string;
    icon?: string;
    color?: string;
    order?: number;
    items: string[];
    subgroups?: SubGroup[];
  };
  const [customGroups, setCustomGroups] = useState<CustomGroupShape[]>([]);
  const [pins, setPins] = useState<string[]>([]);
  const [renames, setRenames] = useState<Record<string, string>>({});
  const [iconOverrides, setIconOverrides] = useState<Record<string, string>>({});

  // ── Unread counts per nav path (Discord-style red dots) ───────────
  const [unread, setUnread] = useState<Record<string, number>>({});

  useEffect(() => {
    if (authLoading || !userRole) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const fetchUnread = async () => {
      try {
        const res = await fetch("/api/user/sidebar-unread", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (data?.unread && typeof data.unread === "object") {
          setUnread(data.unread as Record<string, number>);
        }
      } catch {
        // Silent — dots simply won't appear
      }
    };

    fetchUnread();
    // Refetch every 30s for live updates (tab visible only)
    timer = setInterval(() => {
      if (typeof document === "undefined" || !document.hidden) fetchUnread();
    }, 30_000);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [authLoading, userRole]);

  // Debounced "mark visited" — fires when user navigates to a tracked path.
  // We piggyback off pathname changes so any nav method (link click, back/fwd,
  // programmatic push) all flow through here.
  useEffect(() => {
    if (!pathname) return;
    if (!(pathname in unread)) return; // not tracked or already 0
    const handle = setTimeout(() => {
      void fetch("/api/user/sidebar-unread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nav_path: pathname }),
        cache: "no-store",
      })
        .then(() => {
          // Optimistically clear the count locally so the dot disappears immediately.
          setUnread((prev) => {
            if (!(pathname in prev)) return prev;
            const next = { ...prev };
            delete next[pathname];
            return next;
          });
        })
        .catch(() => {});
    }, 400);
    return () => clearTimeout(handle);
    // We only want this firing on pathname change, not whenever unread updates,
    // otherwise typing into a different page could re-fire spuriously.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (authLoading || !userRole) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/user/sidebar-preferences", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const prefs = data?.preferences;
        if (Array.isArray(prefs?.enabled_items) && prefs.enabled_items.length > 0) {
          setEnabledHrefs(prefs.enabled_items as string[]);
        } else {
          setEnabledHrefs([]); // explicit "no overrides, show all defaults"
        }
        if (Array.isArray(prefs?.custom_groups)) {
          setCustomGroups(prefs.custom_groups as CustomGroupShape[]);
        }
        if (Array.isArray(prefs?.pins)) setPins(prefs.pins as string[]);
        if (prefs?.renames && typeof prefs.renames === "object") setRenames(prefs.renames as Record<string, string>);
        if (prefs?.icon_overrides && typeof prefs.icon_overrides === "object") setIconOverrides(prefs.icon_overrides as Record<string, string>);
      } catch {
        // Silent fail — default nav will continue to render.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, userRole]);

  const filteredNav = navItems.filter((item) => {
    if (!userRole || !item.roles.includes(userRole)) return false;
    // Apply user-level enable list only for admin/team_member (client portal is untouched).
    if ((userRole === "admin" || userRole === "team_member") && enabledHrefs && enabledHrefs.length > 0) {
      return enabledHrefs.includes(item.href);
    }
    return true;
  });

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
    const customIcon = renderCustomIcon(iconOverrides[item.href], 16);
    const label = renames[item.href] || item.label;
    const unreadCount = unread[item.href] || 0;
    return (
      <div key={item.href} className="relative sidebar-item-anim">
        <Link
          href={item.href}
          onMouseEnter={() => setHoveredItem(item.href)}
          onMouseLeave={() => setHoveredItem(null)}
          className={`nav-item-hover flex items-center gap-2.5 py-[7px] my-[1px] rounded-xl text-[12px] transition-all duration-100 ${
            indented ? "px-3.5" : "px-2.5"
          } ${
            isActive
              ? "active text-gold font-semibold bg-gradient-to-r from-gold/[0.14] to-gold/[0.06] border border-gold/20 shadow-[0_0_14px_rgba(201,168,76,0.1),0_1px_0_rgba(255,255,255,0.04)_inset]"
              : "text-muted hover:text-foreground hover:bg-surface-light hover:shadow-[0_1px_0_rgba(255,255,255,0.03)_inset] border border-transparent"
          }`}
        >
          <span className={`shrink-0 transition-colors nav-icon-alive ${isActive ? "text-gold drop-shadow-[0_0_4px_rgba(201,168,76,0.5)]" : hoveredItem === item.href ? "text-foreground" : ""}`}>
            {customIcon || item.icon}
          </span>
          <span className="truncate flex-1">{label}</span>
          {unreadCount > 0 && <UnreadBadge count={unreadCount} />}
          {isActive && <div className="absolute -left-px top-1/2 -translate-y-1/2 w-[3px] h-[60%] rounded-r bg-gold shadow-[0_0_8px_rgba(201,168,76,0.6)]" />}
        </Link>
      </div>
    );
  };

  /* ─── Render a collapsed-sidebar nav link (icon + tooltip) ───── */
  const renderCollapsedLink = (item: NavItem) => {
    const isActive = isItemActive(item.href, pathname);
    const customIcon = renderCustomIcon(iconOverrides[item.href], 16);
    const label = renames[item.href] || item.label;
    const unreadCount = unread[item.href] || 0;
    return (
      <div key={item.href} className="relative">
        <Link
          href={item.href}
          onMouseEnter={() => setHoveredItem(item.href)}
          onMouseLeave={() => setHoveredItem(null)}
          className={`nav-item-hover flex items-center gap-2.5 px-2.5 py-[7px] my-[1px] rounded-xl text-[12px] transition-all duration-100 ${
            isActive
              ? "active text-gold font-semibold bg-gradient-to-r from-gold/[0.14] to-gold/[0.06] border border-gold/20 shadow-[0_0_14px_rgba(201,168,76,0.1),0_1px_0_rgba(255,255,255,0.04)_inset]"
              : "text-muted hover:text-foreground hover:bg-surface-light hover:shadow-[0_1px_0_rgba(255,255,255,0.03)_inset] border border-transparent"
          }`}
          title={unreadCount > 0 ? `${label} (${unreadCount})` : label}
        >
          <span className={`relative shrink-0 transition-colors nav-icon-alive ${isActive ? "text-gold drop-shadow-[0_0_4px_rgba(201,168,76,0.5)]" : hoveredItem === item.href ? "text-foreground" : ""}`}>
            {customIcon || item.icon}
            {unreadCount > 0 && <UnreadDotMini />}
          </span>
          {isActive && <div className="absolute -left-px top-1/2 -translate-y-1/2 w-[3px] h-[60%] rounded-r bg-gold shadow-[0_0_8px_rgba(201,168,76,0.6)]" />}
        </Link>
        {hoveredItem === item.href && (
          <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 whitespace-nowrap">
            <div className="bg-surface border border-border rounded-xl px-2.5 py-1.5 shadow-elevated text-xs font-medium text-foreground">
              {label}
              {unreadCount > 0 && <span className="ml-1.5 text-[10px] text-red-500 font-bold">{unreadCount > 9 ? "9+" : unreadCount}</span>}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      className={`sidebar-fade-in fixed inset-y-0 left-0 z-40 flex flex-col transition-all duration-300 ${
        collapsed ? "w-[56px]" : "w-56"
      }`}
      style={{
        background: "var(--color-surface, #FFFFFF)",
        borderRight: "1px solid var(--color-border, #E8E5E0)",
      }}
    >
      {/* LED light strip — lives on the sidebar's right edge, theme-colored */}
      <span className="sidebar-led-strip" aria-hidden />
      {/* Logo — uses white label config when available; otherwise falls back to
          the Trinity product brand (by ShortStack). If an agency white-labels
          the product they can override company_name/logo_url via settings. */}
      <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"} px-3 h-14 shrink-0`}>
        {(() => {
          // A white-label override is active when the tenant set their own
          // company_name (anything other than the ShortStack parent default).
          const wlOverride = !!wl.company_name && wl.company_name !== BRAND.company_name;
          const displayName = wlOverride ? wl.company_name! : BRAND.product_name;
          const subtext = wlOverride ? null : `by ${BRAND.company_name}`;
          const logoSrc = wlOverride
            ? (wl.logo_url || "/icons/shortstack-logo.svg")
            : BRAND.logo_svg;

          if (collapsed) {
            return (
              <Link href="/dashboard">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoSrc} alt={displayName} width={22} height={22} className="rounded object-contain" />
              </Link>
            );
          }

          return (
            <Link href="/dashboard" className="flex items-center gap-2 min-w-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoSrc} alt={displayName} width={26} height={26} className="shrink-0 object-contain" />
              <div className="min-w-0 leading-tight">
                <div className="text-foreground font-bold text-[13px] tracking-tight truncate">{displayName}</div>
                {subtext && (
                  <div className="text-[9px] text-gold/80 font-medium tracking-wide truncate">{subtext}</div>
                )}
              </div>
            </Link>
          );
        })()}
        {!collapsed && (
          <button onClick={() => setCollapsed(!collapsed)} className="p-1 rounded-md text-muted hover:text-foreground hover:bg-surface-light transition-colors shrink-0">
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
            <a href="/downloads/shortstack-extension.zip" download
              className="text-[11px] text-gold/90 hover:text-gold font-medium transition-colors"
              title="Download → Unzip → chrome://extensions → Load unpacked">
              Install Extension
            </a>
            <span className="text-muted/30">|</span>
            <ExtInstallTooltip />
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

      {/* Navigation — collapsible sections with smart sub-groups.
          When the user has defined custom_groups, use those as the primary
          layout (plus "Other" for any remaining items). */}
      <nav className="flex-1 px-1.5 py-1 overflow-y-auto scrollbar-none">
        {/* Pinned items (always at top if any) */}
        {!collapsed && pins.length > 0 && (() => {
          const pinnedNavItems = pins
            .map(href => navItems.find(i => i.href === href))
            .filter((x): x is NavItem => !!x && userRole ? x.roles.includes(userRole) : false)
            .filter(i => !enabledHrefs || enabledHrefs.length === 0 || enabledHrefs.includes(i.href));
          if (pinnedNavItems.length === 0) return null;
          return (
            <div>
              <div className="w-full flex items-center gap-2 px-2 pt-1 pb-1">
                <Pin size={8} className="text-gold" />
                <span className="text-[8px] text-gold uppercase tracking-[0.2em] font-semibold">Pinned</span>
                <div className="flex-1 h-px bg-gold/15" />
              </div>
              {pinnedNavItems.map(item => renderNavLink(item))}
            </div>
          );
        })()}

        {customGroups.length > 0 && !collapsed ? (
          <>
            {/* Render user-defined groups first */}
            {customGroups
              .slice()
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
              .map((cg) => {
                const groupName = cg.name || cg.label || "Group";
                const groupIconNode = renderCustomIcon(cg.icon, 10);
                const pinnedSet = new Set(pins);
                const directItems = cg.items
                  .filter(h => !pinnedSet.has(h))
                  .map(h => navItems.find(i => i.href === h))
                  .filter((x): x is NavItem => !!x && userRole ? x.roles.includes(userRole) : false)
                  .filter(i => !enabledHrefs || enabledHrefs.length === 0 || enabledHrefs.includes(i.href));
                const subs = (cg.subgroups || []).map(sg => ({
                  id: sg.id,
                  name: sg.name,
                  items: sg.items
                    .filter(h => !pinnedSet.has(h))
                    .map(h => navItems.find(i => i.href === h))
                    .filter((x): x is NavItem => !!x && userRole ? x.roles.includes(userRole) : false)
                    .filter(i => !enabledHrefs || enabledHrefs.length === 0 || enabledHrefs.includes(i.href)),
                })).filter(s => s.items.length > 0);
                if (directItems.length === 0 && subs.length === 0) return null;
                return (
                  <div key={`cg-${cg.id}`}>
                    <div className="w-full flex items-center gap-2 px-2 pt-3 pb-1">
                      {groupIconNode ? (
                        <span className="shrink-0" style={{ color: cg.color || "#C9A84C" }}>{groupIconNode}</span>
                      ) : null}
                      <span className="text-[8px] uppercase tracking-[0.2em] font-semibold" style={{ color: cg.color || "#C9A84C" }}>
                        {groupName}
                      </span>
                      <div className="flex-1 h-px" style={{ backgroundColor: `${cg.color || "#C9A84C"}33` }} />
                    </div>
                    {directItems.map(item => renderNavLink(item))}
                    {subs.map(sg => (
                      <div key={`sg-${sg.id}`}>
                        <div className="w-full flex items-center gap-1.5 pl-3 pr-2 pt-1 pb-0.5">
                          <span className="text-[7px] text-muted/60">&bull;</span>
                          <span className="text-[10px] text-muted/70 font-medium select-none">{sg.name}</span>
                        </div>
                        {sg.items.map(item => renderNavLink(item, true))}
                      </div>
                    ))}
                  </div>
                );
              })}

            {/* "Other" bucket — items not in any custom group (collapsible) */}
            {(() => {
              const assigned = new Set<string>();
              customGroups.forEach(cg => {
                cg.items.forEach(h => assigned.add(h));
                (cg.subgroups || []).forEach(sg => sg.items.forEach(h => assigned.add(h)));
              });
              pins.forEach(h => assigned.add(h));
              const otherItems = filteredNav.filter(i => !assigned.has(i.href));
              if (otherItems.length === 0) return null;
              const otherExpanded = expandedSections["_other"] !== false;
              return (
                <div>
                  <button
                    onClick={() => setExpandedSections(p => ({ ...p, _other: !otherExpanded }))}
                    className="w-full flex items-center gap-2 px-2 pt-3 pb-1 group/sec cursor-pointer"
                  >
                    <span className="text-[8px] text-muted uppercase tracking-[0.2em] font-semibold group-hover/sec:text-foreground transition-colors">
                      Other
                    </span>
                    <div className="flex-1 h-px bg-border" />
                    <ChevronDown
                      size={10}
                      className={`text-muted group-hover/sec:text-foreground transition-transform duration-200 ${otherExpanded ? "" : "-rotate-90"}`}
                    />
                  </button>
                  {otherExpanded && otherItems.map(item => renderNavLink(item))}
                </div>
              );
            })()}
          </>
        ) : groups.map((group) => {
          const expanded = isSectionExpanded(group.section);
          const sectionSubs = group.section ? subGroupsForSection[group.section] : null;

          return (
            <div key={group.section || "_core"}>
              {/* Section header (e.g. Sales, Create, etc.).
                  If the section has a hub page, we split the header into
                  a <Link> (the label) + a separate chevron button (the
                  expand/collapse toggle) so both behaviors coexist.
                  Otherwise the whole row is a toggle button as before. */}
              {group.section && !collapsed && (
                (() => {
                  const hubHref = SECTION_HUB_HREF[group.section!];
                  const hubActive = hubHref ? pathname === hubHref : false;
                  if (hubHref) {
                    // Hub-bearing section: label is a clickable Link that
                    // routes to /dashboard/<section>. A tiny arrow icon +
                    // gold accent makes it visibly distinct from plain
                    // non-hub section headers, so users learn they can
                    // click it to see the full section dashboard.
                    return (
                      <div className="w-full flex items-center gap-1.5 px-2 pt-3 pb-1 group/sec">
                        <Link
                          href={hubHref}
                          className={`group/hub flex items-center gap-1 rounded px-1 py-0.5 text-[9px] uppercase tracking-[0.2em] font-bold transition-colors ${
                            hubActive
                              ? "text-gold bg-gold/10"
                              : "text-gold/70 hover:text-gold hover:bg-gold/5"
                          }`}
                          title={`Open ${group.section} hub →`}
                        >
                          <span>{group.section}</span>
                          <ArrowUpRight
                            size={9}
                            className="opacity-60 transition-all group-hover/hub:opacity-100 group-hover/hub:-translate-y-0.5 group-hover/hub:translate-x-0.5"
                          />
                        </Link>
                        <div className="flex-1 h-px bg-border" />
                        <button
                          type="button"
                          onClick={() => toggleSection(group.section!)}
                          className="p-0.5 rounded text-muted hover:text-foreground transition-colors cursor-pointer"
                          aria-label={expanded ? `Collapse ${group.section}` : `Expand ${group.section}`}
                        >
                          <ChevronDown
                            size={10}
                            className={`transition-transform duration-200 ${expanded ? "" : "-rotate-90"}`}
                          />
                        </button>
                      </div>
                    );
                  }
                  return (
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
                  );
                })()
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

/* ─── Extension Install Tooltip ───────────────────────────────────── */
function ExtInstallTooltip() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="text-[10px] text-muted hover:text-gold transition-colors"
        title="How to install the Chrome extension"
      >
        How to install
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-2 z-50 w-56 bg-surface border border-border rounded-xl shadow-elevated p-3">
            <p className="text-[11px] font-semibold text-foreground mb-1.5">Install Steps</p>
            <ol className="text-[10px] text-muted space-y-1 list-decimal list-inside leading-relaxed">
              <li>Download the .zip file</li>
              <li>Unzip to a folder</li>
              <li>Open <span className="font-mono text-[9px] text-gold/80">chrome://extensions</span> in your browser</li>
              <li>Enable Developer mode</li>
              <li>Click &quot;Load unpacked&quot; and select the folder</li>
              <li>Pin the extension to your toolbar</li>
            </ol>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Unread Badge (Discord-style red pill with count) ───────────── */
function UnreadBadge({ count }: { count: number }) {
  const display = count > 9 ? "9+" : String(count);
  return (
    <span
      className="ml-auto shrink-0 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none unread-pulse"
      aria-label={`${count} unread`}
    >
      {display}
    </span>
  );
}

/* ─── Mini dot for the collapsed sidebar (overlays the icon) ─────── */
function UnreadDotMini() {
  return (
    <span
      className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 ring-1 ring-surface unread-pulse"
      aria-hidden
    />
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
