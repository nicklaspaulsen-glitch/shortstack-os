"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  Zap,
  Users,
  Briefcase,
  Film,
  Bot,
  Activity,
  Sun,
  LayoutDashboard,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Megaphone,
  User,
} from "lucide-react";
import { useState } from "react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles: string[];
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard size={20} />, roles: ["admin", "team_member", "client"] },
  { label: "Lead Engine", href: "/dashboard/leads", icon: <Zap size={20} />, roles: ["admin", "team_member"] },
  { label: "Clients", href: "/dashboard/clients", icon: <Users size={20} />, roles: ["admin", "team_member"] },
  { label: "My Portal", href: "/dashboard/portal", icon: <User size={20} />, roles: ["client"] },
  { label: "Team & Payroll", href: "/dashboard/team", icon: <Briefcase size={20} />, roles: ["admin"] },
  { label: "Content AI", href: "/dashboard/content", icon: <Film size={20} />, roles: ["admin", "team_member"] },
  { label: "Ads Manager", href: "/dashboard/ads", icon: <Megaphone size={20} />, roles: ["admin"] },
  { label: "Workflows", href: "/dashboard/workflows", icon: <Zap size={20} />, roles: ["admin"] },
  { label: "Trinity AI", href: "/dashboard/trinity", icon: <Bot size={20} />, roles: ["admin"] },
  { label: "System Monitor", href: "/dashboard/monitor", icon: <Activity size={20} />, roles: ["admin"] },
  { label: "Briefing", href: "/dashboard/briefing", icon: <Sun size={20} />, roles: ["admin"] },
  { label: "Settings", href: "/dashboard/settings", icon: <LayoutDashboard size={20} />, roles: ["admin"] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const filteredNav = navItems.filter(
    (item) => profile && item.roles.includes(profile.role)
  );

  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-surface border-r border-border z-40 flex flex-col transition-all duration-300 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Logo */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image src="/icons/shortstack-logo.png" alt="ShortStack" width={32} height={32} className="rounded-lg" />
            <span className="text-white font-semibold text-lg">ShortStack</span>
          </Link>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg hover:bg-surface-light text-muted hover:text-white transition-colors"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {filteredNav.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={isActive ? "sidebar-link-active" : "sidebar-link"}
              title={collapsed ? item.label : undefined}
            >
              {item.icon}
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-border">
        {profile && !collapsed && (
          <div className="px-3 py-2 mb-2">
            <p className="text-sm font-medium text-white truncate">{profile.full_name}</p>
            <p className="text-xs text-muted capitalize">{profile.role.replace("_", " ")}</p>
          </div>
        )}
        <button
          onClick={signOut}
          className="sidebar-link w-full"
          title={collapsed ? "Sign Out" : undefined}
        >
          <LogOut size={20} />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
