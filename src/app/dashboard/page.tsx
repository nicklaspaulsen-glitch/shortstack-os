"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { Briefcase, FileText, Send, Sparkles } from "lucide-react";

import { useAuth } from "@/lib/auth-context";
import { PageSkeleton } from "@/components/ui/skeleton";
import UsageNudgeBanner from "@/components/billing/usage-nudge-banner";
import TrinityOrb from "@/components/dashboard/trinity-orb";
import TrinityHero3D from "@/components/dashboard-home/trinity-hero-3d";
import AgentOfficeTile from "@/components/dashboard-home/agent-office-tile";
import DashboardHeroStrip from "@/components/dashboard-home/dashboard-hero-strip";
import BentoGrid from "@/components/dashboard-home/bento-grid";
import OnboardingChecklist from "@/components/dashboard-home/onboarding-checklist";
import type { BentoData } from "@/components/dashboard-home/types";

/**
 * Dashboard home — the editorial-bento redesign (Phase 2B).
 *
 * Above the bento grid:
 *   - UsageNudgeBanner (Starter only, >70% usage)
 *   - DashboardHeroStrip — slim editorial header with greeting + clock + micro-stats
 *   - DowntimeBanner — alerts when an integration is down
 *
 * The bento grid (8 tiles) is the centerpiece. Trinity orb + the
 * AI recommender sit below it for users who want to take action.
 *
 * Data wiring: client-side fetch from `/api/dashboard-bento` (RLS-gated
 * server route). The original `/api/dashboard-data` is left intact — it
 * powers the deeper stats/pipeline/agent panels we removed from the home
 * (those still exist on `/dashboard/leads`, `/dashboard/agent-supervisor`,
 * etc.) so no wiring is broken downstream.
 */

// Lazy below-the-fold components
const DowntimeBanner = dynamic(() => import("@/components/dashboard/downtime-banner"), { ssr: false });
const QuickCreateFab = dynamic(() => import("@/components/dashboard/quick-create-fab"), { ssr: false });
const AiRecommender = dynamic(() => import("@/components/dashboard/ai-recommender"), { ssr: false });
const RecentGenerations = dynamic(() => import("@/components/dashboard/recent-generations"), { ssr: false });

export default function DashboardPage() {
  const { profile, refreshProfile } = useAuth();
  const router = useRouter();
  const [bento, setBento] = useState<BentoData | null>(null);
  const [loading, setLoading] = useState(true);

  // Show success toast after Stripe checkout redirect.
  // The webhook activates the plan server-side; refreshProfile() pulls the
  // fresh plan_tier so gated features unlock immediately.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const subscribed = params.get("subscribed");
    if (subscribed) {
      const planLabel = subscribed.charAt(0).toUpperCase() + subscribed.slice(1);
      toast.success(`Welcome to ${planLabel}! Your plan is active.`, { duration: 5000 });
      const t = setTimeout(() => {
        refreshProfile().catch(() => {});
      }, 1500);
      window.history.replaceState({}, "", "/dashboard");
      return () => clearTimeout(t);
    }
  // refreshProfile is stable per-context — no need to re-run on identity change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch bento data on mount. Safety timeout clears the loading state if
  // the API hangs (degraded networks, RLS misconfigured, etc.).
  useEffect(() => {
    let cancelled = false;
    const fetchBento = async () => {
      try {
        const res = await fetch("/api/dashboard-bento");
        if (!res.ok) throw new Error(`API ${res.status}`);
        const data = (await res.json()) as BentoData;
        if (!cancelled) setBento(data);
      } catch (err) {
        console.error("[dashboard] bento fetch failed", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchBento();
    const safety = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 8000);
    return () => {
      cancelled = true;
      clearTimeout(safety);
    };
  }, []);

  // Client portal users get a different shell. Keep the existing client view
  // intact — only the agency owner home is redesigned in this phase.
  if (profile?.role === "client") {
    return <ClientDashboard />;
  }

  if (loading) return <PageSkeleton />;

  const firstName = profile?.nickname?.split(" ")[0] || profile?.full_name?.split(" ")[0];

  // Defensive fallback: the API failed and we have no data. Still render the
  // hero + Trinity orb so the page isn't a blank surface.
  const microStats = bento?.microStats ?? { calls: 0, leads: 0, hot: 0 };

  return (
    <div className="fade-in space-y-4 max-w-[1400px] mx-auto">
      <UsageNudgeBanner planTier={profile?.plan_tier} />

      {/* Getting-started checklist — shown to new users until all 5 items
          are complete OR the user dismisses it. Hides itself via localStorage
          (14-day auto-expire). completedFromApi can be wired to real data
          once the dashboard-bento API surface exposes setup flags. */}
      <OnboardingChecklist />

      <DashboardHeroStrip firstName={firstName} microStats={microStats} />

      <DowntimeBanner />

      {/* Trinity 3D speaking hero — replaces the orb for the new
          monochrome direction. R3F crystal lazy-loads + lip-syncs
          to AI suggestions piped from /api/ai/suggest-topics. */}
      <TrinityHero3D greeting={firstName} suggestionSurface="script_lab" />

      {/* Agent Office preview — smooth premium tile (replaces the
          pixelated PixiJS preview that used to live here). Each agent
          gets a circular disc + name + role. Live pulse rings when
          the agent has recent activity. Links into the full office
          page for the live PixiJS experience. */}
      <AgentOfficeTile />

      {/* Legacy ask-anything orb stays available below the hero — keeps
          the chat-prompt entry point that some users rely on. */}
      <TrinityOrb firstName={firstName} />

      {/* The bento grid */}
      {bento ? (
        <BentoGrid data={bento} />
      ) : (
        <BentoFallback />
      )}

      {/* Below-the-fold AI helpers — kept from the previous dashboard */}
      <AiRecommender />
      <RecentGenerations />

      <QuickCreateFab />
      <RouterPrefetch router={router} />
    </div>
  );
}

/**
 * Pre-warm the route cache for likely navigation targets — keeps the bento
 * "View →" links instant. Wrapped as a no-render component so the prefetch
 * effect runs after the bento mounts.
 */
function RouterPrefetch({ router }: { router: ReturnType<typeof useRouter> }) {
  useEffect(() => {
    const targets = [
      "/dashboard/leads",
      "/dashboard/conversations",
      "/dashboard/voice-receptionist",
      "/dashboard/agent-office",
      "/dashboard/calendar",
      "/dashboard/settings",
    ];
    for (const t of targets) {
      try {
        router.prefetch(t);
      } catch {
        // prefetch is best-effort; ignore failures
      }
    }
  }, [router]);
  return null;
}

/**
 * Render a friendly fallback when the bento API failed entirely. Surfaces
 * the brand mark, a one-line editorial copy, and a primary CTA — matches
 * the per-tile empty-state design language so the page never feels broken.
 */
function BentoFallback() {
  return (
    <div className=" border border-[rgba(255,255,255,0.08)] bg-[#15141A] p-12 flex flex-col items-center justify-center text-center gap-4">
      <p className="font-editorial text-base text-[#9F9DAA] max-w-md">
        Couldn&apos;t reach the dashboard service. Refresh the page or check the system status if this keeps happening.
      </p>
      <Link
        href="/dashboard/monitor"
        className="text-[11px] font-medium px-3 py-1.5 rounded-full bg-[#FF2D2D] text-white"
      >
        Check system status
      </Link>
    </div>
  );
}

/**
 * ClientDashboard — unchanged from the previous home. Client portal users
 * see a simpler "your services" surface. The agency-owner redesign doesn't
 * touch this view; portal pages have their own design language.
 */
function ClientDashboard() {
  const { profile } = useAuth();
  const router = useRouter();
  const firstName = profile?.nickname?.split(" ")[0] || profile?.full_name?.split(" ")[0];

  return (
    <div className="fade-in space-y-6 max-w-[1000px] mx-auto">
      <div className="relative inline-block">
        <h1 className="font-display text-3xl font-bold tracking-tight">Welcome, {profile?.full_name}</h1>
        {/* Acid Lime underline accent */}
        <div
          className="h-[2px] mt-1 rounded-full"
          style={{ background: "linear-gradient(90deg, var(--brand-accent, #CC2424) 0%, transparent 70%)" }}
          aria-hidden
        />
        <p className="text-sm text-muted mt-1.5">Your client portal</p>
      </div>

      <TrinityOrb
        firstName={firstName}
        suggestions={[
          "Show me what's happening with my account",
          "What's in my content plan this week?",
          "Draft a message to my account manager",
          "When's my next scheduled post?",
          "Summarise my latest results",
        ]}
      />

      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-muted mb-3">Quick access</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "My Services", icon: <Briefcase size={22} />, color: "text-[var(--brand-accent)]", route: "/dashboard/portal" },
            { label: "Invoices", icon: <FileText size={22} />, color: "text-info", route: "/dashboard/portal/billing" },
            { label: "Content", icon: <Sparkles size={22} />, color: "text-[var(--brand-accent-soft)]", route: "/dashboard/portal/content" },
            { label: "Contact Us", icon: <Send size={22} />, color: "text-success", route: "/dashboard/portal/support" },
          ].map((item, i) => (
            <button
              key={i}
              onClick={() => router.push(item.route)}
              className="card-hover p-6 text-center group"
            >
              <span className={`${item.color} inline-block mb-2 group-hover:scale-110 transition-transform`}>
                {item.icon}
              </span>
              <span className="text-sm font-medium block">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
