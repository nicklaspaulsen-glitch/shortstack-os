"use client";

/**
 * Vertical SaaS Templates — index page.
 *
 * Renders three big visual cards (Real Estate / Coaches / E-com) with
 * pre-computed counts. Click → opens the detail page where the user
 * picks which modules to apply.
 */

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Briefcase,
  Home,
  GraduationCap,
  ShoppingBag,
  ArrowRight,
  Check,
  type LucideIcon,
} from "lucide-react";
import { MotionPage } from "@/components/motion/motion-page";

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
  blue: "from-[rgba(212,255,0,0.12)] via-[rgba(212,255,0,0.06)] to-transparent border-[rgba(212,255,0,0.25)] hover:border-[rgba(212,255,0,0.50)]",
  purple: "from-[rgba(212,255,0,0.12)] via-[rgba(212,255,0,0.06)] to-transparent border-[rgba(212,255,0,0.25)] hover:border-[rgba(212,255,0,0.50)]",
  sunset: "from-orange-500/20 via-rose-400/10 to-transparent border-orange-400/30 hover:border-orange-400/60",
  gold: "from-[rgba(212,255,0,0.12)] via-[rgba(212,255,0,0.06)] to-transparent border-[rgba(212,255,0,0.25)] hover:border-[rgba(212,255,0,0.50)]",
  green: "from-emerald-500/20 via-emerald-400/10 to-transparent border-emerald-400/30 hover:border-emerald-400/60",
  ocean: "from-cyan-500/20 via-cyan-400/10 to-transparent border-cyan-400/30 hover:border-cyan-400/60",
};

const ACCENT_ICON_BG: Record<string, string> = {
  blue: "bg-[rgba(212,255,0,0.10)] text-brand-accent",
  purple: "bg-[rgba(212,255,0,0.08)] text-brand-accent",
  sunset: "bg-orange-500/15 text-orange-400",
  gold: "bg-[rgba(212,255,0,0.08)] text-brand-accent",
  green: "bg-emerald-500/15 text-emerald-400",
  ocean: "bg-cyan-500/15 text-cyan-400",
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
    <MotionPage className="min-h-screen">{/* -- Vertical Templates command strip -- */}
    <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
      <div className="min-w-0">
        <p className="font-editorial text-[11px] italic text-text-muted mb-0.5">VERTICAL TEMPLATES</p>
        <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-primary leading-none">Vertical Templates</h1>
      </div>
    </div><div className="max-w-7xl mx-auto px-6 py-10">
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className=" bg-white/5 h-72 animate-pulse" />
                  ))}
                </div>
              ) : verticals.length === 0 ? (
                <div className="text-center py-24 text-text-muted">
                  <Briefcase size={48} className="mx-auto mb-4 opacity-30" />
                  <p className="text-lg">No vertical templates available</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {verticals.map((v, i) => {
                    const Icon = ICON_MAP[v.icon] ?? Briefcase;
                    const appliedModules = appliedByVertical[v.vertical] ?? [];
                    const isApplied = appliedModules.length > 0;

                    return (
                      <motion.div
                        key={v.vertical}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06, duration: 0.4 }}
                        whileHover={{ y: -4, scale: 1.01 }}
                      >
                      <Link
                        href={`/dashboard/verticals/${v.vertical}`}
                        onMouseMove={(e) => { const rect = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`); e.currentTarget.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`); }}
                        className={`group relative block glass border bg-gradient-to-br spotlight-card ${
                          ACCENT_RING[v.accent] ?? ACCENT_RING.gold
                        } p-6 transition-shadow`}
                      >
                        {isApplied && (
                          <div className="absolute top-4 right-4 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 px-2.5 py-1 text-xs text-emerald-600">
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

                        <h2 className="text-xl font-semibold text-text-primary mb-1">
                          {v.display_name}
                        </h2>
                        <p className="text-sm text-text-muted mb-5">{v.tagline}</p>

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
                          <span className="text-text-muted">
                            Course: {v.counts.course_modules} modules · {v.counts.course_lessons} lessons
                          </span>
                          <span className="inline-flex items-center gap-1 text-text-secondary group-hover:text-text-primary">
                            Configure
                            <ArrowRight
                              size={14}
                              className="transition-transform group-hover:translate-x-0.5"
                            />
                          </span>
                        </div>
                      </Link>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div></MotionPage>
  );
}

function CountTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass rounded-lg px-3 py-2">
      <div className="text-lg font-semibold text-text-primary">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-text-muted">{label}</div>
    </div>
  );
}
