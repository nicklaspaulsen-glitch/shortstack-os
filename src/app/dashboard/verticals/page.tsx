"use client";

/**
 * Vertical SaaS Templates — index page.
 *
 * Renders three big visual cards (Real Estate / Coaches / E-com) with
 * pre-computed counts. Click → opens the detail page where the user
 * picks which modules to apply.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Briefcase,
  Home,
  GraduationCap,
  ShoppingBag,
  ArrowRight,
  Check,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import PageHero from "@/components/ui/page-hero";

interface VerticalSummary {
  vertical: "real_estate" | "coaches" | "ecommerce";
  display_name: string;
  tagline: string;
  description: string;
  accent: "gold" | "blue" | "purple" | "green" | "sunset" | "ocean";
  icon: string;
  preview_image: string | null;
  counts: {
    automations: number;
    sms: number;
    email: number;
    scripts: number;
    scoring: number;
    course_modules: number;
    course_lessons: number;
    funnel_steps: number;
  };
}

const ICON_MAP: Record<string, LucideIcon> = {
  Home,
  GraduationCap,
  ShoppingBag,
  Briefcase,
};

const ACCENT_RING: Record<string, string> = {
  blue: "from-blue-500/20 via-blue-400/10 to-transparent border-blue-400/30 hover:border-blue-400/60",
  purple: "from-purple-500/20 via-purple-400/10 to-transparent border-purple-400/30 hover:border-purple-400/60",
  sunset: "from-orange-500/20 via-rose-400/10 to-transparent border-orange-400/30 hover:border-orange-400/60",
  gold: "from-amber-500/20 via-yellow-400/10 to-transparent border-amber-400/30 hover:border-amber-400/60",
  green: "from-emerald-500/20 via-emerald-400/10 to-transparent border-emerald-400/30 hover:border-emerald-400/60",
  ocean: "from-cyan-500/20 via-cyan-400/10 to-transparent border-cyan-400/30 hover:border-cyan-400/60",
};

const ACCENT_ICON_BG: Record<string, string> = {
  blue: "bg-blue-500/15 text-blue-300",
  purple: "bg-purple-500/15 text-purple-300",
  sunset: "bg-orange-500/15 text-orange-300",
  gold: "bg-amber-500/15 text-amber-300",
  green: "bg-emerald-500/15 text-emerald-300",
  ocean: "bg-cyan-500/15 text-cyan-300",
};

export default function VerticalsIndexPage() {
  const [verticals, setVerticals] = useState<VerticalSummary[]>([]);
  const [appliedByVertical, setAppliedByVertical] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [vRes, mRes] = await Promise.all([
          fetch("/api/verticals", { cache: "no-store" }),
          fetch("/api/user/me", { cache: "no-store" }).catch(() => null),
        ]);

        const vJson = (await vRes.json().catch(() => ({}))) as {
          verticals?: VerticalSummary[];
        };
        if (!cancelled && Array.isArray(vJson.verticals)) {
          setVerticals(vJson.verticals);
        }

        // Look up the caller's id, then their applies. /api/user/me may
        // not exist on every install; fall back gracefully.
        let userId: string | null = null;
        if (mRes && mRes.ok) {
          const mJson = (await mRes.json().catch(() => ({}))) as {
            user?: { id?: string };
            id?: string;
          };
          userId = mJson?.user?.id ?? mJson?.id ?? null;
        }

        if (userId) {
          const aRes = await fetch(`/api/verticals/applies/${userId}`, {
            cache: "no-store",
          });
          if (aRes.ok) {
            const aJson = (await aRes.json().catch(() => ({}))) as {
              applied_modules_by_vertical?: Record<string, string[]>;
            };
            if (!cancelled && aJson.applied_modules_by_vertical) {
              setAppliedByVertical(aJson.applied_modules_by_vertical);
            }
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#0d0d0d]">
      <PageHero
        title="Vertical Templates"
        subtitle="Pre-configured ShortStack OS bundles for specific agency niches. Pick a vertical, choose modules, and we provision automations, content, scripts, and a course in your tenant — typically a 5-day onboarding compressed into 5 minutes."
        icon={<Briefcase size={28} />}
        gradient="gold"
        eyebrow={
          <span className="inline-flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase opacity-90">
            <Sparkles size={12} />
            Niche-ready setup
          </span>
        }
      />

      <div className="max-w-7xl mx-auto px-6 py-10">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-white/5 h-72 animate-pulse" />
            ))}
          </div>
        ) : verticals.length === 0 ? (
          <div className="text-center py-24 text-white/40">
            <Briefcase size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg">No vertical templates available</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {verticals.map((v) => {
              const Icon = ICON_MAP[v.icon] ?? Briefcase;
              const appliedModules = appliedByVertical[v.vertical] ?? [];
              const isApplied = appliedModules.length > 0;

              return (
                <Link
                  key={v.vertical}
                  href={`/dashboard/verticals/${v.vertical}`}
                  className={`group relative rounded-2xl border bg-gradient-to-br ${
                    ACCENT_RING[v.accent] ?? ACCENT_RING.gold
                  } p-6 transition-all hover:-translate-y-0.5`}
                >
                  {isApplied && (
                    <div className="absolute top-4 right-4 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 px-2.5 py-1 text-xs text-emerald-300">
                      <Check size={11} />
                      Applied
                    </div>
                  )}

                  <div
                    className={`inline-flex h-12 w-12 items-center justify-center rounded-xl mb-4 ${
                      ACCENT_ICON_BG[v.accent] ?? ACCENT_ICON_BG.gold
                    }`}
                  >
                    <Icon size={22} />
                  </div>

                  <h2 className="text-xl font-semibold text-white mb-1">
                    {v.display_name}
                  </h2>
                  <p className="text-sm text-white/60 mb-5">{v.tagline}</p>

                  {/* Counts grid */}
                  <div className="grid grid-cols-3 gap-2 mb-5">
                    <CountTile label="Automations" value={v.counts.automations} />
                    <CountTile label="SMS" value={v.counts.sms} />
                    <CountTile label="Emails" value={v.counts.email} />
                    <CountTile label="Scripts" value={v.counts.scripts} />
                    <CountTile label="Scoring" value={v.counts.scoring} />
                    <CountTile label="Funnel" value={v.counts.funnel_steps} />
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/40">
                      Course: {v.counts.course_modules} modules · {v.counts.course_lessons} lessons
                    </span>
                    <span className="inline-flex items-center gap-1 text-white/80 group-hover:text-white">
                      Configure
                      <ArrowRight
                        size={14}
                        className="transition-transform group-hover:translate-x-0.5"
                      />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function CountTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-black/30 border border-white/5 px-3 py-2">
      <div className="text-lg font-semibold text-white">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-white/50">{label}</div>
    </div>
  );
}
