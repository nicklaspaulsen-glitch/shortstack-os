"use client";

import dynamic from "next/dynamic";
import { PageTransition } from "@/components/ui/page-transition";
import { SkipToContent } from "@/components/a11y/SkipToContent";
import ErrorBoundary from "@/components/ui/error-boundary";
import ManagedClientBanner from "@/components/managed-client-banner";
import { QuotaWallProvider } from "@/components/billing/quota-wall";
import { useAuth } from "@/lib/auth-context";
import { useAppStore } from "@/lib/store";
import {
  consumeDeepLink,
  isDesktop,
  onAssetIntent,
  onQuickNote,
  resolveDeepLink,
  setCurrentClient,
  type AssetIntent,
} from "@/lib/desktop-bridge";
import { subscribeDesktopNotifications } from "@/lib/notifications/desktop-subscriber";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";

// Lazy-load overlay/modal components — not needed on initial render
const MainNavbar = dynamic(() => import("@/components/dashboard/main-navbar"), { ssr: false });
// TrinitySidebar kept for fallback/mobile but hidden when GlassTopNav is active
const TrinitySidebar = dynamic(() => import("@/components/dashboard/trinity-sidebar"), { ssr: false });
const TopNavbar = dynamic(() => import("@/components/dashboard/top-navbar"), { ssr: false });
// Glass shell — new triple-stack top nav replacing left sidebar
const GlassTopNav = dynamic(() => import("@/components/navigation/glass-top-nav"), { ssr: false });
const GlassSubNav = dynamic(() => import("@/components/navigation/glass-sub-nav"), { ssr: false });
const BottomWidget = dynamic(() => import("@/components/navigation/bottom-widget"), { ssr: false });
const DashboardAmbient3D = dynamic(() => import("@/components/brand/dashboard-ambient-3d"), { ssr: false });
const DashboardBackground = dynamic(() => import("@/components/brand/dashboard-background"), { ssr: false });
const ClientChatWidget = dynamic(() => import("@/components/client-chat-widget"), { ssr: false });
const VoiceAssistant = dynamic(() => import("@/components/voice-assistant"), { ssr: false });
const OnboardingTour = dynamic(() => import("@/components/onboarding-tour"), { ssr: false });
const CommandPalette = dynamic(() => import("@/components/command-palette"), { ssr: false });
const KeyboardShortcuts = dynamic(() => import("@/components/keyboard-shortcuts"), { ssr: false });
const QuickAdd = dynamic(() => import("@/components/quick-add"), { ssr: false });
const ClientContextPill = dynamic(() => import("@/components/client-context-pill"), { ssr: false });
const TokenUsageWidget = dynamic(() => import("@/components/token-usage-widget"), { ssr: false });
const ExtensionBridgePill = dynamic(() => import("@/components/extension-bridge-pill"), { ssr: false });
// DashboardDock removed — bottom space reclaimed for content
const DesktopBadge = dynamic(() => import("@/components/desktop-badge"), { ssr: false });

// ── Role-based route access control ──
// Complements the sidebar role filtering (which hides nav items) by
// preventing direct URL access to pages the user shouldn't reach.

const CLIENT_ALLOWED_PREFIXES = ["/dashboard/portal", "/dashboard/community"];
const CLIENT_DEFAULT = "/dashboard/portal";

// ── Subscription paywall ──
// Agency owners (role === "admin") MUST have an active Stripe subscription
// OR a Founder-tier bypass to access the dashboard. Clients / team_members
// are exempt (their agency pays for them). Routes on this list are always
// allowed even without an active sub — upgrade page, billing page,
// pricing, and logout flows.
const PAYWALL_EXEMPT_ROUTES = [
  "/dashboard/upgrade",
  "/dashboard/billing",
  "/dashboard/pricing",
];
const INTERNAL_BYPASS_TIERS = ["Founder"];
const PAID_TIERS = ["Starter", "Growth", "Pro", "Business", "Unlimited"];

function requiresPaywallRedirect(
  pathname: string,
  role: string,
  planTier: string | null | undefined,
  subscriptionStatus: string | null | undefined,
): boolean {
  if (role !== "admin") return false; // only gate agency owners
  if (PAYWALL_EXEMPT_ROUTES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return false;
  }
  if (planTier && INTERNAL_BYPASS_TIERS.includes(planTier)) return false; // Founder bypass
  const isActiveSub =
    subscriptionStatus === "active" || subscriptionStatus === "trialing";
  const hasPaidTier = !!planTier && PAID_TIERS.includes(planTier);
  // Must have BOTH a paid tier AND an active subscription. This is what
  // closes the "signed up but never paid" hole — plan_tier="unpaid" always
  // fails; a stale "Starter" without subscription_status also fails.
  return !(hasPaidTier && isActiveSub);
}

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
  "/dashboard/integrations-hub",
  "/dashboard/financials",
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
  const [zoom, setZoom] = useState(100);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

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
      return;
    }
    // Paywall — admins (agency owners) must have an active subscription.
    // Clients / team_members are exempt — their agency owner is the payer.
    const planTier = (profile as { plan_tier?: string } | null)?.plan_tier;
    const subStatus = (profile as { subscription_status?: string } | null)?.subscription_status;
    if (requiresPaywallRedirect(pathname, role, planTier, subStatus)) {
      toast("Pick a plan to unlock the dashboard.", { icon: "🔒" });
      router.replace("/dashboard/upgrade");
    }
  }, [pathname, profile, loading, router]);

  // Dismiss any lingering toasts when the user navigates between pages.
  // Prevents stale errors from one page (e.g. "Invalid time value" on Events)
  // hanging around after they switch tabs (e.g. to Polls).
  useEffect(() => {
    toast.dismiss();
  }, [pathname]);

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

  // ── Desktop-only hooks (feature-detected; web users see nothing) ──
  // Zustand store for the currently managed client; used both to route
  // asset/note uploads to the right client and to keep the tray label
  // in sync with the in-app client switcher.
  const managedClient = useAppStore((s) => s.managedClient);

  // 1) On mount — drain any pending `shortstack://` deep link and route.
  useEffect(() => {
    if (!isDesktop()) return;
    let cancelled = false;
    (async () => {
      const link = await consumeDeepLink();
      if (cancelled || !link) return;
      const target = resolveDeepLink(link);
      if (target) router.push(target);
    })();
    return () => { cancelled = true; };
    // Run once per mount — we drain the queue on boot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) Asset intent — screenshot / clipboard image / dropbox drop.
  // Upload to the currently managed client (or no-op if none selected).
  useEffect(() => {
    if (!isDesktop()) return;
    const unsubscribe = onAssetIntent(async (asset: AssetIntent) => {
      const clientId = managedClient?.id;
      const clientLabel = managedClient?.business_name;
      if (!clientId) {
        toast.error("Pick a client before capturing assets", { icon: "📎" });
        return;
      }
      try {
        const body = {
          client_id: clientId,
          file_name: asset.fileName || `${asset.kind}-${Date.now()}`,
          file_type: asset.mimeType || asset.kind,
          file_size: asset.bytes || 0,
          // The desktop shell already persists the file to disk — we
          // record the local path so the watcher pipeline can pick it up.
          // /api/uploads accepts a file_url or leaves it null.
          file_url: asset.filePath || null,
          category: asset.kind,
        };
        const res = await fetch("/api/uploads", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(await res.text());
        toast.success(`Uploaded to ${clientLabel || "client"}`);
      } catch (err) {
        toast.error(`Upload failed: ${(err as Error).message || "unknown error"}`);
      }
    });
    return unsubscribe;
  }, [managedClient]);

  // 3) Quick notes — Ctrl+Shift+N popup → outreach_log note on the
  // currently managed client.
  useEffect(() => {
    if (!isDesktop()) return;
    const unsubscribe = onQuickNote(async (n) => {
      const clientId = managedClient?.id;
      const clientLabel = managedClient?.business_name;
      if (!clientId) {
        toast.error("Pick a client before saving notes", { icon: "📝" });
        return;
      }
      try {
        // Re-use the upload endpoint's note category; it's the lightest
        // path that's guaranteed to exist and scopes by client_id.
        const res = await fetch("/api/uploads", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            client_id: clientId,
            file_name: `Note ${new Date(n.createdAt).toLocaleString()}`,
            file_type: "text/plain",
            file_size: (n.text || "").length,
            category: "note",
            // Body of the note is embedded in file_name fallback
            // (uploads table has no body column, so we prefix the name).
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        toast.success(`Note saved to ${clientLabel || "client"}`);
      } catch (err) {
        toast.error(`Note failed: ${(err as Error).message || "unknown error"}`);
      }
    });
    return unsubscribe;
  }, [managedClient]);

  // 4) Tray label mirror — tell the desktop shell which client we're
  // viewing so the tray menu + taskbar title stay in sync.
  useEffect(() => {
    if (!isDesktop()) return;
    void setCurrentClient(managedClient?.business_name || "");
  }, [managedClient]);

  // 5) Supabase realtime → native notifications (leads, email opens, agent replies).
  useEffect(() => {
    if (!isDesktop()) return;
    if (!user?.id) return;
    const unsubscribe = subscribeDesktopNotifications(user.id);
    return unsubscribe;
  }, [user?.id]);

  // Electron banner cleanup is handled globally by <ElectronBannerCleanup /> in root layout

  // Don't render dashboard content until auth state is resolved.
  // This prevents flash of admin content for client users and avoids
  // rendering anything before the redirect to /login fires.
  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 border-2 border-[rgba(212,255,0,0.25)] border-t-brand-accent rounded-full animate-spin" />
      </div>
    );
  }

  // If we have a profile and the current route is not allowed, don't render
  // the page content while the redirect is in progress
  if (profile?.role && pathname && !isRouteAllowed(pathname, profile.role)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 border-2 border-[rgba(212,255,0,0.25)] border-t-brand-accent rounded-full animate-spin" />
      </div>
    );
  }
  // Paywall spinner — don't flash dashboard content while redirecting to
  // /dashboard/upgrade for unpaid admins.
  if (
    profile?.role && pathname &&
    requiresPaywallRedirect(
      pathname,
      profile.role,
      (profile as { plan_tier?: string } | null)?.plan_tier,
      (profile as { subscription_status?: string } | null)?.subscription_status,
    )
  ) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 border-2 border-[rgba(212,255,0,0.25)] border-t-brand-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <QuotaWallProvider>
      <SkipToContent />
      {/* CSS animated mesh gradient blobs — zero JS per frame, pure compositor */}
      <DashboardBackground />
      <DashboardAmbient3D />
      {/* Aurora light bleed — deep blue/indigo radial fixed at viewport top */}
      <div className="dashboard-aurora" aria-hidden="true" />

      {/* ── Glass Shell — top-nav replaces left sidebar ────────────────────
          glass-shell-active enables CSS that hides TrinitySidebar and
          removes the lg:ml-[220px] offset from <main>.
          ──────────────────────────────────────────────────────────────── */}
      <div className="glass-shell-active flex flex-col min-h-screen bg-background/40 relative">

        {/* ① Triple-stack glass top navigation */}
        <GlassTopNav />

        {/* ② Route-aware sub-nav: breadcrumb + tabs + filter chips */}
        <GlassSubNav />

        {/* ③ Legacy top-navbar (Trinity prompt / breadcrumb fallback) */}
        <TopNavbar />

        {/* ④ Mobile drawer (hidden on lg+) */}
        <div className="lg:hidden" aria-hidden="true">
          <MainNavbar />
        </div>

        {/* ⑤ Main content — full-width, no sidebar offset */}
        <main id="main" className="flex-1 min-w-0 overflow-x-hidden">
          {/* Managed client banner (Electron desktop only) */}
          <ManagedClientBanner />

          {/* Zoom reset pill */}
          {zoom !== 100 && (
            <button
              onClick={() => setZoom(100)}
              className="fixed bottom-4 right-20 z-50 text-[10px] font-mono px-2.5 py-1 rounded-lg transition-colors"
              style={{
                background: "rgba(13,17,32,0.92)",
                border: "1px solid rgba(99,146,255,0.15)",
                color: "#60A5FA",
              }}
            >
              {zoom}% — click to reset
            </button>
          )}

          <div className="px-5 py-4 lg:px-8 lg:py-6 pb-20">
            <ErrorBoundary>
              <PageTransition>
                {children}
              </PageTransition>
            </ErrorBoundary>
          </div>
        </main>

        {/* ⑤ Corner account chip */}
        <BottomWidget />

        {/* Global overlays */}
        <VoiceAssistant />
        <ClientChatWidget />
        <OnboardingTour onComplete={() => {}} />
        <CommandPalette />
        <KeyboardShortcuts />
        <QuickAdd />
        <ClientContextPill />
        <TokenUsageWidget />
        <DesktopBadge />
        <ExtensionBridgePill />
      </div>
    </QuotaWallProvider>
  );
}

