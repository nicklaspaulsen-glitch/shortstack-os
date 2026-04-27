"use client";

/**
 * Onboarding — vertical pick.
 *
 * Surfaced for new users: "What kind of agency are you?" → big buttons →
 * pre-applies the entire vertical bundle in the background and routes
 * straight into the dashboard.
 *
 * Skip option for users who want to configure manually.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Home,
  GraduationCap,
  ShoppingBag,
  ArrowRight,
  Loader2,
  SkipForward,
  Sparkles,
  Briefcase,
  type LucideIcon,
} from "lucide-react";
import toast from "react-hot-toast";

interface VerticalSummary {
  vertical: "real_estate" | "coaches" | "ecommerce";
  display_name: string;
  tagline: string;
  description: string;
  accent: "gold" | "blue" | "purple" | "green" | "sunset" | "ocean";
  icon: string;
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

const ACCENT_BG: Record<string, string> = {
  blue: "from-blue-600/40 via-blue-500/20 to-blue-900/30 border-blue-400/40 hover:border-blue-300",
  purple: "from-purple-600/40 via-purple-500/20 to-purple-900/30 border-purple-400/40 hover:border-purple-300",
  sunset: "from-orange-500/40 via-rose-500/20 to-orange-900/30 border-orange-400/40 hover:border-orange-300",
  gold: "from-amber-500/40 via-yellow-400/20 to-amber-900/30 border-amber-400/40 hover:border-amber-300",
  green: "from-emerald-500/40 via-emerald-400/20 to-emerald-900/30 border-emerald-400/40 hover:border-emerald-300",
  ocean: "from-cyan-500/40 via-cyan-400/20 to-cyan-900/30 border-cyan-400/40 hover:border-cyan-300",
};

const ALL_MODULES = [
  "automations",
  "sms",
  "email",
  "scripts",
  "scoring",
  "course",
  "funnel",
] as const;

export default function OnboardingVerticalPage() {
  const router = useRouter();
  const [verticals, setVerticals] = useState<VerticalSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/verticals", { cache: "no-store" });
        if (!res.ok) {
          if (res.status === 401) {
            router.push("/login");
            return;
          }
          throw new Error("Failed to load");
        }
        const json = (await res.json()) as { verticals: VerticalSummary[] };
        if (!cancelled) setVerticals(json.verticals);
      } catch {
        if (!cancelled) toast.error("Failed to load vertical templates");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const pick = async (vertical: VerticalSummary["vertical"]) => {
    if (applying) return;
    setApplying(vertical);
    try {
      const res = await fetch("/api/verticals/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vertical,
          modules: ALL_MODULES,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "Apply failed");
      }
      const json = (await res.json()) as { total_created: number };
      toast.success(
        `Set up your account — ${json.total_created} items ready in your dashboard.`,
      );
      router.push("/dashboard");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to set up");
      setApplying(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex flex-col">
      {/* Decorative gradient background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full bg-purple-500/10 blur-3xl" />
      </div>

      <main className="flex-1 max-w-6xl mx-auto px-6 py-16 w-full">
        <header className="text-center mb-12">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium tracking-widest uppercase text-amber-300 mb-4">
            <Sparkles size={12} />
            One more step
          </span>
          <h1 className="text-3xl md:text-5xl font-semibold text-white mb-4 tracking-tight">
            What kind of agency are you?
          </h1>
          <p className="text-base md:text-lg text-white/60 max-w-2xl mx-auto">
            Pick a niche and we&apos;ll pre-configure your account with automations, content, scripts, lead scoring, a course, and a funnel — all tailored for your vertical. You can edit anything after.
          </p>
        </header>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-white/5 h-80 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {verticals.map((v) => {
              const Icon = ICON_MAP[v.icon] ?? Briefcase;
              const isApplying = applying === v.vertical;
              const isDisabled = applying !== null && !isApplying;
              return (
                <button
                  key={v.vertical}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => void pick(v.vertical)}
                  className={`group relative text-left rounded-2xl border bg-gradient-to-br ${
                    ACCENT_BG[v.accent] ?? ACCENT_BG.gold
                  } p-7 transition-all hover:-translate-y-1 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0`}
                >
                  <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-black/30 backdrop-blur-sm text-white mb-5">
                    <Icon size={24} />
                  </div>
                  <h2 className="text-2xl font-semibold text-white mb-2">
                    {v.display_name}
                  </h2>
                  <p className="text-sm text-white/70 mb-6 leading-relaxed">
                    {v.tagline}
                  </p>

                  <ul className="space-y-1.5 text-xs text-white/70 mb-6">
                    <li>· {v.counts.automations} automations</li>
                    <li>· {v.counts.sms} SMS + {v.counts.email} email templates</li>
                    <li>· {v.counts.scripts} cold-call scripts</li>
                    <li>
                      · {v.counts.course_modules}-module course ({v.counts.course_lessons} lessons)
                    </li>
                    <li>· {v.counts.funnel_steps}-step funnel</li>
                  </ul>

                  <div className="inline-flex items-center gap-2 text-sm font-medium text-white">
                    {isApplying ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Setting up your account…
                      </>
                    ) : (
                      <>
                        Use this template
                        <ArrowRight
                          size={14}
                          className="transition-transform group-hover:translate-x-1"
                        />
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Skip */}
        <div className="text-center mt-12">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            disabled={applying !== null}
            className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white/80 transition-colors disabled:opacity-40"
          >
            <SkipForward size={14} />
            Skip — I&apos;ll set it up myself
          </button>
        </div>
      </main>
    </div>
  );
}
