"use client";
import { CaretRight, ChartBar, Chat, FileText, Folder, List, Question, SignOut, SquaresFour, X } from "@phosphor-icons/react";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useWhiteLabel } from "@/lib/white-label-context";

/* ── Navigation items for the client portal ── */
const NAV_ITEMS = [
  { label: "Dashboard", icon: SquaresFour, segment: "" },
  { label: "Projects", icon: Folder, segment: "/projects" },
  { label: "Reports", icon: ChartBar, segment: "/reports" },
  { label: "Messages", icon: Chat, segment: "/messages", badge: 3 },
  { label: "Documents", icon: FileText, segment: "/documents" },
  { label: "Support", icon: Question, segment: "/support" },
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
  const { config } = useWhiteLabel();
  // Agency owner controls this via /dashboard/settings → White-label
  const showPoweredBy = config.show_powered_by;
  const companyName = config.company_name || "ShortStack";
  // First letter of the agency's brand for the square logo tile when
  // no explicit logo_url is uploaded. Falls back to "S" for ShortStack.
  const logoLetter = companyName.charAt(0).toUpperCase() || "S";
  const logoUrl = config.logo_url && !config.logo_url.includes("shortstack-logo")
    ? config.logo_url
    : null;
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
          <aside className="relative z-10 flex h-full w-64 flex-col border-r border-border-subtle bg-surface animate-slide-in">
            <SidebarContent
              basePath={basePath}
              isActive={isActive}
              showPoweredBy={showPoweredBy}
              companyName={companyName}
              logoLetter={logoLetter}
              logoUrl={logoUrl}
              onClose={() => setSidebarOpen(false)}
            />
          </aside>
        </div>
      )}

      {/* ─── Desktop sidebar ─── */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-border-subtle bg-surface">
        <SidebarContent
          basePath={basePath}
          isActive={isActive}
          showPoweredBy={showPoweredBy}
          companyName={companyName}
          logoLetter={logoLetter}
          logoUrl={logoUrl}
        />
      </aside>

      {/* ─── Main content area ─── */}
      <div className="flex-1 lg:pl-64">
        {/* Top bar (mobile only) */}
        <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 border-b border-border-subtle lg:hidden"
          style={{
            background: "color-mix(in srgb, var(--color-background) 85%, transparent)",
            backdropFilter: "blur(16px) saturate(1.2)",
          }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-light transition-colors"
          >
            <List size={18} />
          </button>
          <div className="h-7 w-7 rounded-lg bg-[rgba(212,255,0,0.08)] border border-[rgba(212,255,0,0.2)] flex items-center justify-center overflow-hidden">
            {logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={logoUrl} alt={companyName} className="w-full h-full object-contain" />
            ) : (
              <span className="text-[#D4FF00] text-xs font-bold">{logoLetter}</span>
            )}
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
  companyName,
  logoLetter,
  logoUrl,
  onClose,
}: {
  basePath: string;
  isActive: (segment: string) => boolean | undefined;
  showPoweredBy: boolean;
  companyName: string;
  logoLetter: string;
  logoUrl: string | null;
  onClose?: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* ─── Logo / brand area ─── */}
      <div className="flex items-center justify-between h-16 px-5 border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-[rgba(212,255,0,0.08)] border border-[rgba(212,255,0,0.2)] flex items-center justify-center overflow-hidden">
            {logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={logoUrl} alt={companyName} className="w-full h-full object-contain" />
            ) : (
              <span className="text-[#D4FF00] font-bold text-sm">{logoLetter}</span>
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary leading-tight">Client Portal</p>
            <p className="text-[10px] text-text-muted leading-tight">{companyName}</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-light transition-colors"
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
                <span className="flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-[rgba(212,255,0,0.08)] text-[#D4FF00] text-[10px] font-semibold px-1">
                  {item.badge}
                </span>
              )}
              {active && <CaretRight size={14} className="text-[rgba(212,255,0,0.6)]" />}
            </Link>
          );
        })}
      </nav>

      {/* ─── User section ─── */}
      <div className="border-t border-border-subtle px-4 py-3 space-y-3 shrink-0">
        {/* Profile mini-card */}
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-[rgba(212,255,0,0.08)] border border-[rgba(212,255,0,0.2)] flex items-center justify-center">
            <span className="text-[#D4FF00] text-xs font-semibold">AC</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-text-primary truncate">Acme Corp</p>
            <p className="text-[10px] text-text-muted truncate">admin@acmecorp.com</p>
          </div>
          <button className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/5 transition-colors" title="Sign out">
            <SignOut size={14} />
          </button>
        </div>

        {/* Powered by — hidden when white-label agency flips the switch */}
        {showPoweredBy && (
          <div className="text-center">
            <p className="text-[10px] text-text-muted/50">
              Powered by{" "}
              <span className="text-[rgba(212,255,0,0.6)] font-medium">{companyName}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
