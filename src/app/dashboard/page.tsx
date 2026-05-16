"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
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
import { MotionPage } from "@/components/motion/motion-page";
import { ShineBorder } from "@/components/ui/shine-border";
import { FlowButton } from "@/components/ui/flow-button";

/**
 * Dashboard home — Phase 3 command center.
 *
 * Layout order (bento IS the hero):
 *   1. UsageNudgeBanner + DowntimeBanner  — critical alerts, slim
 *   2. DashboardHeroStrip                  — slim editorial header, no PageHero
 *   3. BentoGrid                           — immediately in viewport on load
 *   4. OnboardingChecklist                 — below bento (veterans scroll past)
 *   5. TrinityOrb + TrinityHero3D + AgentOfficeTile — below fold, on scroll
 *   6. AiRecommender + RecentGenerations   — deep below fold
 *
 * Data wiring: client-side fetch from /api/dashboard-bento (RLS-gated).
 * The original /api/dashboard-data powers deeper stat panels on sub-routes.
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
    // refreshProfile is stable per-context
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch bento data. Safety timeout releases loading after 8s.
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

  // Client portal: separate shell
  if (profile?.role === "client") {
    return (
      <MotionPage>
        <ClientDashboard />
      </MotionPage>
    );
  }

  if (loading) return <PageSkeleton />;

  const firstName = profile?.nickname?.split(" ")[0] || profile?.full_name?.split(" ")[0];
  const microStats = bento?.microStats ?? { calls: 0, leads: 0, hot: 0 };

  return (
    <div className="fade-in space-y-4 max-w-[1400px] mx-auto">
      {/* Critical alert banners — kept at absolute top */}
      <UsageNudgeBanner planTier={profile?.plan_tier} />
      <DowntimeBanner />

      {/* Slim editorial command header — no PageHero. The bento IS the hero. */}
      <DashboardHeroStrip firstName={firstName} microStats={microStats} />

      {/* Bento grid — first major content block, immediately visible on load */}
      {bento ? (
        <BentoGrid data={bento} />
      ) : (
        <BentoFallback />
      )}

      {/* Onboarding checklist — below bento so it doesn't push data off-screen
          on repeat visits. New users will scroll down; veterans skip it. */}
      <OnboardingChecklist />

      {/* Below-the-fold enhancers — discoverable on scroll, not blocking data */}
      <TrinityOrb firstName={firstName} />
      <TrinityHero3D greeting={firstName} suggestionSurface="script_lab" />
      <ShineBorder
        borderWidth={1.5}
        borderRadius="16px"
        color={["#2563EB", "#93C5FD", "#DBEAFE", "#818CF8", "#2563EB"]}
        background="transparent"
      >
        <AgentOfficeTile />
      </ShineBorder>

      <AiRecommender />
      <RecentGenerations />

      <QuickCreateFab />
      <RouterPrefetch router={router} />
    </div>
  );
}

/**
 * Pre-warm the route cache for likely navigation targets.
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
        // prefetch is best-effort
      }
    }
  }, [router]);
  return null;
}

/**
 * Friendly fallback when the bento API failed entirely.
 */
function BentoFallback() {
  return (
    <div
      className="glass rounded-xl border border-border-subtle p-12 flex flex-col items-center justify-center text-center gap-4"
    >
      <p className="font-editorial text-base text-text-secondary max-w-md">
        Couldn&apos;t reach the dashboard service. Refresh the page or check the system status if this keeps happening.
      </p>
      <FlowButton
        text="Check system status"
        onClick={() => { window.location.href = "/dashboard/monitor"; }}
        className="text-sm"
      />
    </div>
  );
}

/**
 * ClientDashboard — client portal users see a simpler "your services" surface.
 * The agency-owner redesign doesn't touch this view.
 */
function ClientDashboard() {
  const { profile } = useAuth();
  const router = useRouter();
  const firstName = profile?.nickname?.split(" ")[0] || profile?.full_name?.split(" ")[0];

  return (
    <div className="fade-in space-y-6 max-w-[1000px] mx-auto">
      <div className="relative inline-block">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Welcome, {profile?.full_name}
        </h1>
        <div
          className="h-[2px] mt-1 rounded-full"
          style={{ background: "linear-gradient(90deg, var(--brand-accent, #2563EB) 0%, transparent 70%)" }}
          aria-hidden
        />
        <p className="text-sm text-text-muted mt-1.5">Your client portal</p>
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
        <p className="text-xs font-medium uppercase tracking-widest text-text-muted mb-3">
          Quick access
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "My Services", icon: <Briefcase size={22} />, color: "text-brand-accent", route: "/dashboard/portal" },
            { label: "Invoices", icon: <FileText size={22} />, color: "text-info", route: "/dashboard/portal/billing" },
            { label: "Content", icon: <Sparkles size={22} />, color: "text-brand-accent", route: "/dashboard/portal/content" },
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

