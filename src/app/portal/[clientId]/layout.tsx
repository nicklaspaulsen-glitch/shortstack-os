"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  FolderKanban,
  BarChart3,
  MessageSquare,
  FileText,
  HelpCircle,
  Menu,
  X,
  ChevronRight,
  LogOut,
} from "lucide-react";

/* ── Navigation items for the client portal ── */
const NAV_ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, segment: "" },
  { label: "Projects", icon: FolderKanban, segment: "/projects" },
  { label: "Reports", icon: BarChart3, segment: "/reports" },
  { label: "Messages", icon: MessageSquare, segment: "/messages", badge: 3 },
  { label: "Documents", icon: FileText, segment: "/documents" },
  { label: "Support", icon: HelpCircle, segment: "/support" },
];

export default function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { clientId: string };
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [showPoweredBy, _setShowPoweredBy] = useState(true);
  const basePath = `/portal/${params.clientId}`;

  function isActive(segment: string) {
    const full = basePath + segment;
    if (segment === "") return pathname === basePath || pathname === basePath + "/";
    return pathname?.startsWith(full);
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* ─── Mobile overlay ─── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative z-10 flex h-full w-64 flex-col border-r border-border bg-surface animate-slide-in">
            <SidebarContent
              basePath={basePath}
              isActive={isActive}
              showPoweredBy={showPoweredBy}
              onClose={() => setSidebarOpen(false)}
            />
          </aside>
        </div>
      )}

      {/* ─── Desktop sidebar ─── */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-border bg-surface">
        <SidebarContent
          basePath={basePath}
          isActive={isActive}
          showPoweredBy={showPoweredBy}
        />
      </aside>

      {/* ─── Main content area ─── */}
      <div className="flex-1 lg:pl-64">
        {/* Top bar (mobile only) */}
        <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 border-b border-border lg:hidden"
          style={{
            background: "color-mix(in srgb, var(--color-background) 85%, transparent)",
            backdropFilter: "blur(16px) saturate(1.2)",
          }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-surface-light transition-colors"
          >
            <Menu size={18} />
          </button>
          <div className="h-7 w-7 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center">
            <span className="text-gold text-xs font-bold">S</span>
          </div>
          <div className="w-9" />
        </header>

        {/* Page content */}
        <main className="p-5 lg:p-8 pb-24 min-h-[calc(100vh-3.5rem)] lg:min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   Sidebar content — shared between mobile and desktop
   ══════════════════════════════════════════════════════════════════ */
function SidebarContent({
  basePath,
  isActive,
  showPoweredBy,
  onClose,
}: {
  basePath: string;
  isActive: (segment: string) => boolean | undefined;
  showPoweredBy: boolean;
  onClose?: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* ─── Logo / brand area ─── */}
      <div className="flex items-center justify-between h-16 px-5 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center">
            <span className="text-gold font-bold text-sm">S</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground leading-tight">Client Portal</p>
            <p className="text-[10px] text-muted leading-tight">Your workspace</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-light transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* ─── Navigation links ─── */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.segment);
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={basePath + item.segment}
              className={active ? "sidebar-link-active" : "sidebar-link"}
              onClick={onClose}
            >
              <Icon size={16} />
              <span className="flex-1">{item.label}</span>
              {item.badge && item.badge > 0 && (
                <span className="flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-gold/15 text-gold text-[10px] font-semibold px-1">
                  {item.badge}
                </span>
              )}
              {active && <ChevronRight size={14} className="text-gold/50" />}
            </Link>
          );
        })}
      </nav>

      {/* ─── User section ─── */}
      <div className="border-t border-border px-4 py-3 space-y-3 shrink-0">
        {/* Profile mini-card */}
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center">
            <span className="text-gold text-xs font-semibold">AC</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">Acme Corp</p>
            <p className="text-[10px] text-muted truncate">admin@acmecorp.com</p>
          </div>
          <button className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger/5 transition-colors" title="Sign out">
            <LogOut size={14} />
          </button>
        </div>

        {/* Powered by */}
        {showPoweredBy && (
          <div className="text-center">
            <p className="text-[10px] text-muted/50">
              Powered by{" "}
              <span className="text-gold/40 font-medium">ShortStack</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
