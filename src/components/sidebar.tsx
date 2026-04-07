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
  Target,
  Crown,
  Globe,
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
  { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard size={16} />, roles: ["admin", "team_member", "client"] },
  { label: "Analytics", href: "/dashboard/analytics", icon: <BarChart3 size={16} />, roles: ["admin"] },

  // ── Sales ──
  { label: "CRM", href: "/dashboard/crm", icon: <Users size={16} />, roles: ["admin", "team_member"], section: "Sales" },
  { label: "Lead Finder", href: "/dashboard/scraper", icon: <Search size={16} />, roles: ["admin", "team_member"] },
  { label: "Outreach", href: "/dashboard/outreach-hub", icon: <Send size={16} />, roles: ["admin"] },
  { label: "DM Controller", href: "/dashboard/dm-controller", icon: <Target size={16} />, roles: ["admin"] },
  { label: "Clients", href: "/dashboard/clients", icon: <Users size={16} />, roles: ["admin", "team_member"] },
  { label: "Proposals", href: "/dashboard/proposals", icon: <FileText size={16} />, roles: ["admin", "team_member"] },

  // ── Create ──
  { label: "AI Agents", href: "/dashboard/services", icon: <Sparkles size={16} />, roles: ["admin", "team_member"], section: "Create" },
  { label: "Script Lab", href: "/dashboard/script-lab", icon: <Sparkles size={16} />, roles: ["admin", "team_member"] },
  { label: "Social Manager", href: "/dashboard/social-manager", icon: <Bot size={16} />, roles: ["admin", "team_member"] },
  { label: "Video Editor", href: "/dashboard/video-editor", icon: <Film size={16} />, roles: ["admin", "team_member"] },
  { label: "Production", href: "/dashboard/production", icon: <Film size={16} />, roles: ["admin", "team_member", "client"] },
  { label: "Design Studio", href: "/dashboard/design", icon: <PenTool size={16} />, roles: ["admin", "team_member"] },
  { label: "Websites", href: "/dashboard/websites", icon: <Globe size={16} />, roles: ["admin", "team_member"] },
  { label: "Ads", href: "/dashboard/ads", icon: <Megaphone size={16} />, roles: ["admin"] },

  // ── Automate ──
  { label: "Workflows", href: "/dashboard/workflows", icon: <Zap size={16} />, roles: ["admin"], section: "Automate" },
  { label: "Automations", href: "/dashboard/automations", icon: <Zap size={16} />, roles: ["admin", "team_member"] },
  { label: "Agent HQ", href: "/dashboard/agent-supervisor", icon: <Crown size={16} />, roles: ["admin"] },
  { label: "Agent Controls", href: "/dashboard/agent-controls", icon: <Settings size={16} />, roles: ["admin"] },

  // ── System ──
  { label: "Socials", href: "/dashboard/integrations", icon: <Link2 size={16} />, roles: ["admin", "team_member"], section: "System" },
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

  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-gradient-sidebar border-r border-border/50 z-40 flex flex-col transition-all duration-300 ${
        collapsed ? "w-[60px]" : "w-60"
      }`}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-border/30">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <Image src="/icons/shortstack-logo.png" alt="ShortStack" width={28} height={28} />
            <div className="flex flex-col">
              <span className="text-white font-bold text-sm tracking-tight">ShortStack</span>
              <span className="text-[9px] text-muted font-medium tracking-[0.15em] uppercase -mt-0.5">OS</span>
            </div>
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-md hover:bg-surface-light text-muted hover:text-white transition-colors"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Admin Profile Switcher */}
      {!collapsed && <AdminProfileSwitcher />}

      {/* Navigation */}
      <nav className="flex-1 px-2 py-1.5 overflow-y-auto">
        {filteredNav.map((item, i) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          const showSection = !collapsed && item.section && (i === 0 || filteredNav[i - 1]?.section !== item.section);

          return (
            <div key={item.href}>
              {showSection && (
                <p className="text-[8px] text-muted/50 uppercase tracking-[0.2em] font-bold px-3 pt-3 pb-1">{item.section}</p>
              )}
              <Link
                href={item.href}
                className={isActive ? "sidebar-link-active" : "sidebar-link"}
                title={collapsed ? item.label : undefined}
              >
                <span className={isActive ? "text-gold" : ""}>{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </Link>
            </div>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-2 py-2 border-t border-border/30">
        {!collapsed && (
          <div className="px-3 py-2 mb-1">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-gold/15 flex items-center justify-center">
                <span className="text-gold text-[10px] font-bold">
                  {profile?.full_name?.charAt(0) || "?"}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-white truncate">{profile?.full_name || "Loading..."}</p>
                <p className="text-[10px] text-muted capitalize">{profile?.role?.replace("_", " ") || "..."}</p>
              </div>
            </div>
          </div>
        )}
        <button
          onClick={signOut}
          className="sidebar-link w-full text-muted hover:text-danger"
          title={collapsed ? "Sign Out" : undefined}
        >
          <LogOut size={16} />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
