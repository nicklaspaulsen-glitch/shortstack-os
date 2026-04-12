"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
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
} from "lucide-react";
import { useState } from "react";
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
  { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard size={16} />, roles: ["admin", "team_member"] },
  { label: "Community", href: "/dashboard/community", icon: <Users size={16} />, roles: ["admin", "team_member", "client"] },
  { label: "Analytics", href: "/dashboard/analytics", icon: <BarChart3 size={16} />, roles: ["admin"] },
  { label: "Reports", href: "/dashboard/reports", icon: <FileText size={16} />, roles: ["admin"] },

  // ── Sales ──
  { label: "CRM", href: "/dashboard/crm", icon: <Users size={16} />, roles: ["admin", "team_member"], section: "Sales" },
  { label: "Lead Finder", href: "/dashboard/scraper", icon: <Search size={16} />, roles: ["admin", "team_member"] },
  { label: "Outreach", href: "/dashboard/outreach-hub", icon: <Send size={16} />, roles: ["admin"] },
  { label: "Clients", href: "/dashboard/clients", icon: <Users size={16} />, roles: ["admin", "team_member"] },
  { label: "Deals", href: "/dashboard/deals", icon: <CreditCard size={16} />, roles: ["admin", "team_member"] },
  { label: "Calendar", href: "/dashboard/calendar", icon: <Calendar size={16} />, roles: ["admin", "team_member"] },

  // ── Create ──
  { label: "Ads", href: "/dashboard/ads", icon: <Megaphone size={16} />, roles: ["admin"], section: "Create" },
  { label: "Script Lab", href: "/dashboard/script-lab", icon: <Sparkles size={16} />, roles: ["admin", "team_member"] },
  { label: "Social Manager", href: "/dashboard/social-manager", icon: <Bot size={16} />, roles: ["admin", "team_member"] },
  { label: "Video Editor", href: "/dashboard/video-editor", icon: <Film size={16} />, roles: ["admin", "team_member"] },
  { label: "Design Studio", href: "/dashboard/design", icon: <PenTool size={16} />, roles: ["admin", "team_member"] },
  { label: "Websites", href: "/dashboard/websites", icon: <Globe size={16} />, roles: ["admin", "team_member"] },

  // ── Automate ──
  { label: "AI Agents", href: "/dashboard/services", icon: <Sparkles size={16} />, roles: ["admin", "team_member"], section: "Automate" },
  { label: "Agent HQ", href: "/dashboard/agent-supervisor", icon: <Crown size={16} />, roles: ["admin"] },
  { label: "Workflows", href: "/dashboard/workflows", icon: <Zap size={16} />, roles: ["admin"] },
  { label: "AI Caller", href: "/dashboard/eleven-agents", icon: <Phone size={16} />, roles: ["admin"] },
  { label: "WhatsApp", href: "/dashboard/whatsapp", icon: <MessageSquare size={16} />, roles: ["admin"] },
  { label: "Scheduling", href: "/dashboard/scheduling", icon: <Calendar size={16} />, roles: ["admin", "team_member"] },

  // ── Connect ──
  { label: "Discord", href: "/dashboard/discord", icon: <MessageSquare size={16} />, roles: ["admin"], section: "Connect" },
  { label: "Notion", href: "/dashboard/notion-sync", icon: <FileText size={16} />, roles: ["admin"] },
  { label: "Google Biz", href: "/dashboard/google-business", icon: <Globe size={16} />, roles: ["admin"] },
  { label: "Socials", href: "/dashboard/integrations", icon: <Link2 size={16} />, roles: ["admin", "team_member"] },
  { label: "Monitor", href: "/dashboard/monitor", icon: <Activity size={16} />, roles: ["admin"] },
  { label: "Settings", href: "/dashboard/settings", icon: <Settings size={16} />, roles: ["admin"] },

  // ── Client Portal ──
  { label: "Overview", href: "/dashboard/portal", icon: <LayoutDashboard size={16} />, roles: ["client"] },
  { label: "Content", href: "/dashboard/portal/content", icon: <Film size={16} />, roles: ["client"] },
  { label: "Calendar", href: "/dashboard/portal/calendar", icon: <Calendar size={16} />, roles: ["client"] },
  { label: "Reports", href: "/dashboard/portal/reports", icon: <BarChart3 size={16} />, roles: ["client"] },
  { label: "Invoices", href: "/dashboard/portal/billing", icon: <CreditCard size={16} />, roles: ["client"] },
  { label: "Support", href: "/dashboard/portal/support", icon: <MessageSquare size={16} />, roles: ["client"] },
  { label: "Settings", href: "/dashboard/portal/settings", icon: <Settings size={16} />, roles: ["client"] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const userRole = profile?.role || "admin";
  const filteredNav = navItems.filter(
    (item) => item.roles.includes(userRole)
  );

  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  return (
    <aside
      className={`fixed left-0 top-[3px] h-[calc(100%-3px)] z-40 flex flex-col transition-all duration-300 ${
        collapsed ? "w-[56px]" : "w-56"
      }`}
      style={{
        background: "var(--color-surface, #FFFFFF)",
        borderRight: "1px solid var(--color-border, #E8E5E0)",
      }}
    >
      {/* Logo — compact and clean */}
      <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"} px-3 h-12 shrink-0`}>
        {!collapsed ? (
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image src="/icons/shortstack-logo.png" alt="ShortStack" width={24} height={24} />
            <span className="text-foreground font-bold text-[13px] tracking-tight">ShortStack</span>
          </Link>
        ) : (
          <Link href="/dashboard">
            <Image src="/icons/shortstack-logo.png" alt="SS" width={22} height={22} />
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

      {/* Navigation — clean with subtle hover */}
      <nav className="flex-1 px-1.5 py-1 overflow-y-auto scrollbar-none">
        {filteredNav.map((item, i) => {
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const showSection = !collapsed && item.section && (i === 0 || filteredNav[i - 1]?.section !== item.section);

          return (
            <div key={item.href}>
              {showSection && (
                <div className="flex items-center gap-2 px-2 pt-4 pb-1">
                  <span className="text-[8px] text-muted uppercase tracking-[0.2em] font-semibold">{item.section}</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              )}
              <div className="relative">
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
                  {/* Active indicator line */}
                  {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] h-4 rounded-r bg-gold" />}
                </Link>

                {/* Collapsed tooltip */}
                {collapsed && hoveredItem === item.href && (
                  <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 whitespace-nowrap">
                    <div className="bg-surface border border-border rounded-xl px-2.5 py-1.5 shadow-elevated text-xs font-medium text-foreground">
                      {item.label}
                    </div>
                  </div>
                )}
              </div>
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

      {/* User — cleaner profile section */}
      <div className="px-1.5 py-2 border-t border-border">
        {!collapsed ? (
          <div className="px-2.5 py-2 rounded-xl hover:bg-surface-light transition-colors">
            <div className="flex items-center gap-2.5">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-gold/10 flex items-center justify-center">
                  <span className="text-gold text-[10px] font-bold">{(profile?.nickname || profile?.full_name)?.charAt(0) || "?"}</span>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-foreground truncate">{profile?.nickname || profile?.full_name || "Loading..."}</p>
                <p className="text-[9px] text-muted capitalize">{profile?.role?.replace("_", " ") || "..."}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex justify-center py-1">
            <div className="w-7 h-7 rounded-full bg-gold/10 flex items-center justify-center">
              <span className="text-gold text-[9px] font-bold">{profile?.full_name?.charAt(0) || "?"}</span>
            </div>
          </div>
        )}
        <button onClick={signOut}
          className={`w-full flex items-center gap-2.5 px-2.5 py-[6px] my-[1px] rounded-xl text-[11px] text-muted hover:text-danger hover:bg-danger/5 transition-colors ${collapsed ? "justify-center" : ""}`}
          title={collapsed ? "Sign Out" : undefined}>
          <LogOut size={14} />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
