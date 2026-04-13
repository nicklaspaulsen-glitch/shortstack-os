"use client";

import dynamic from "next/dynamic";
import Sidebar from "@/components/sidebar";
import GlobalSearch from "@/components/global-search";
import ClientSwitcher from "@/components/client-switcher";
import Notifications from "@/components/notifications";
import ErrorBoundary from "@/components/ui/error-boundary";
import { useAuth } from "@/lib/auth-context";
import { getPlanConfig } from "@/lib/plan-config";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { Menu, X, Crown } from "lucide-react";
import Link from "next/link";

// Lazy-load overlay/modal components — not needed on initial render
const ClientChatWidget = dynamic(() => import("@/components/client-chat-widget"), { ssr: false });
const VoiceAssistant = dynamic(() => import("@/components/voice-assistant"), { ssr: false });
const OnboardingTour = dynamic(() => import("@/components/onboarding-tour"), { ssr: false });
const CommandPalette = dynamic(() => import("@/components/command-palette"), { ssr: false });
const KeyboardShortcuts = dynamic(() => import("@/components/keyboard-shortcuts"), { ssr: false });
const QuickAdd = dynamic(() => import("@/components/quick-add"), { ssr: false });

// ── Role-based route access control ──
// Complements the sidebar role filtering (which hides nav items) by
// preventing direct URL access to pages the user shouldn't reach.

const CLIENT_ALLOWED_PREFIXES = ["/dashboard/portal", "/dashboard/community"];
const CLIENT_DEFAULT = "/dashboard/portal";

const TEAM_MEMBER_BLOCKED: string[] = [
  "/dashboard/analytics",
  "/dashboard/reports",
  "/dashboard/client-health",
  "/dashboard/monitor",
  "/dashboard/discord",
  "/dashboard/pricing",
  "/dashboard/settings",
  "/dashboard/outreach-hub",
  "/dashboard/ads",
  "/dashboard/agent-supervisor",
  "/dashboard/workflows",
  "/dashboard/whatsapp",
  "/dashboard/eleven-agents",
];
const TEAM_MEMBER_DEFAULT = "/dashboard";

function isRouteAllowed(pathname: string, role: string): boolean {
  if (role === "admin") return true;

  if (role === "client") {
    // Clients can only access /dashboard/portal/* and /dashboard/community
    return CLIENT_ALLOWED_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
    );
  }

  if (role === "team_member") {
    // Team members are blocked from specific admin-only pages
    return !TEAM_MEMBER_BLOCKED.some(
      (blocked) => pathname === blocked || pathname.startsWith(blocked + "/")
    );
  }

  return false;
}

function getDefaultRoute(role: string): string {
  if (role === "client") return CLIENT_DEFAULT;
  if (role === "team_member") return TEAM_MEMBER_DEFAULT;
  return "/dashboard";
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Role-based route guard — redirect if user accesses a page they shouldn't
  useEffect(() => {
    if (loading || !profile?.role || !pathname) return;
    const role = profile.role;
    if (!isRouteAllowed(pathname, role)) {
      router.replace(getDefaultRoute(role));
    }
  }, [pathname, profile?.role, loading, router]);

  // Ctrl+scroll zoom — applies CSS transform instead of zoom to not break fixed positioning
  const handleWheel = useCallback((e: WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      setZoom(prev => {
        const next = prev + (e.deltaY > 0 ? -5 : 5);
        return Math.max(60, Math.min(140, next));
      });
    }
  }, []);

  useEffect(() => {
    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  // Apply zoom via CSS variable on body so fixed elements scale properly
  useEffect(() => {
    document.documentElement.style.fontSize = `${zoom}%`;
    return () => { document.documentElement.style.fontSize = "100%"; };
  }, [zoom]);

  // Don't render dashboard content until auth state is resolved.
  // This prevents flash of admin content for client users and avoids
  // rendering anything before the redirect to /login fires.
  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
      </div>
    );
  }

  // If we have a profile and the current route is not allowed, don't render
  // the page content while the redirect is in progress
  if (profile?.role && pathname && !isRouteAllowed(pathname, profile.role)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="flex min-h-screen">

        {/* Desktop sidebar */}
        <div className="hidden lg:block">
          <Sidebar />
        </div>

        {/* Mobile sidebar overlay */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
            <div className="relative w-56 h-full">
              <Sidebar />
              <button onClick={() => setMobileMenuOpen(false)}
                className="absolute top-3 right-3 p-1.5 rounded-lg bg-surface-light text-muted hover:text-foreground z-50">
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 lg:ml-56">
          {/* Header */}
          <div className="sticky top-0 z-30 border-y border-border electron-drag"
            style={{ background: "color-mix(in srgb, var(--color-background) 85%, transparent)", backdropFilter: "blur(16px) saturate(1.2)" }}>
            <div className="flex items-center justify-between px-5 lg:px-6 h-12">
              {/* Left — mobile menu */}
              <div className="electron-no-drag flex items-center gap-2 lg:hidden">
                <button onClick={() => setMobileMenuOpen(true)} className="p-1.5 rounded-md text-muted hover:text-foreground hover:bg-surface-light transition-colors">
                  <Menu size={16} />
                </button>
              </div>

              <div className="flex-1" />

              {/* Right — actions */}
              <div className="electron-no-drag flex items-center gap-1.5">
                {zoom !== 100 && (
                  <button onClick={() => setZoom(100)} className="text-[9px] text-muted bg-surface-light px-2 py-0.5 rounded hover:text-foreground transition-colors font-mono">
                    {zoom}%
                  </button>
                )}
                {/* Subscription badge for admin */}
                {profile?.role === "admin" && (
                  <PlanBadge planTier={profile.plan_tier || undefined} />
                )}
                <ClientSwitcher />
                <Notifications />
                <GlobalSearch />
              </div>
            </div>
          </div>

          {/* Page content */}
          <div className="p-4 lg:p-6">
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </div>
        </main>
        <VoiceAssistant />
        <ClientChatWidget />
        <OnboardingTour onComplete={() => {}} />
        <CommandPalette />
        <KeyboardShortcuts />
        <QuickAdd />
      </div>
    </>
  );
}

/* ─── Plan Badge (header) ───────────────────────────────────────── */
function PlanBadge({ planTier }: { planTier?: string }) {
  const plan = getPlanConfig(planTier);
  if (!planTier) {
    return (
      <Link href="/dashboard/pricing"
        className="flex items-center gap-1 text-[10px] text-muted bg-surface-light hover:bg-surface-light/80 px-2 py-1 rounded-lg border border-border transition-colors">
        <Crown size={10} /> Free
      </Link>
    );
  }
  return (
    <Link href="/dashboard/settings"
      className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg transition-colors"
      style={{ background: `${plan.color}12`, color: plan.color, border: `1px solid ${plan.color}25` }}>
      <Crown size={10} /> {plan.badge_label}
    </Link>
  );
}
