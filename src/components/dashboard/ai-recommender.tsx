"use client";

/**
 * AI Recommender — the big visible "Ready to make AI do your job?" button on
 * the dashboard. Opens a beautiful modal with AI-generated recommendations
 * tailored to the user's business. Can schedule recurring recommendations.
 *
 * States:
 * 1. First-time (no cached recommendations): button says "✨ Recommended to do"
 * 2. After first use: button says "Ready to make AI do your job?" with pulsing glow
 * 3. Regenerate: "Show me different ideas" button inside modal
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  Sparkles, X, Film, Image as ImageIcon, FileText, Mail, Send, Megaphone,
  Phone, LayoutTemplate, Layers, Loader2, RefreshCw, Calendar, Clock,
  Zap, ArrowRight, TrendingUp, Info,
} from "lucide-react";
import toast from "react-hot-toast";

interface Recommendation {
  id: string;
  type: string;
  title: string;
  description: string;
  reason: string;
  impact: "high" | "medium" | "low";
  effort: "quick" | "medium" | "deep";
  icon: string;
  action_href: string;
  prefilled?: Record<string, unknown>;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  Film: <Film size={16} />, Image: <ImageIcon size={16} />, FileText: <FileText size={16} />,
  Mail: <Mail size={16} />, Send: <Send size={16} />, Megaphone: <Megaphone size={16} />,
  Phone: <Phone size={16} />, LayoutTemplate: <LayoutTemplate size={16} />, Layers: <Layers size={16} />,
};

const TYPE_INFO: Record<string, { label: string; description: string; emoji: string }> = {
  video: { label: "AI Video", description: "Text-to-video via Higgsfield — 2-6s clips for Reels/Shorts/TikTok", emoji: "🎬" },
  thumbnail: { label: "Thumbnail", description: "Click-worthy YouTube/social thumbnails with AI text + backgrounds", emoji: "🖼️" },
  script: { label: "Script", description: "Video/reel scripts with hook, body, and CTA — any length", emoji: "📝" },
  email: { label: "Email", description: "Cold, nurture, or promotional emails with subject line variants", emoji: "📧" },
  social_post: { label: "Social Post", description: "Platform-tailored posts with captions, hashtags, emoji", emoji: "📱" },
  blog: { label: "Blog / Newsletter", description: "Long-form articles with SEO structure", emoji: "📰" },
  carousel: { label: "Carousel", description: "Multi-slide Instagram/LinkedIn carousels", emoji: "🔀" },
  landing_page: { label: "Landing Page", description: "Conversion-optimized landing page with AI copy", emoji: "🌐" },
  cold_call: { label: "AI Caller", description: "Outbound AI phone calls that qualify leads", emoji: "📞" },
  dm_campaign: { label: "DM Campaign", description: "Cold DMs on Instagram, LinkedIn, TikTok", emoji: "💬" },
};

export default function AiRecommender() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [theme, setTheme] = useState("");
  const [priorityFocus, setPriorityFocus] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasCached, setHasCached] = useState(false);
  const [lastGeneratedAt, setLastGeneratedAt] = useState<string | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [schedule, setSchedule] = useState({
    enabled: false,
    frequency: "weekly" as "once" | "daily" | "every_other_day" | "weekdays" | "weekly" | "monthly",
    time_of_day: "09:00",
    auto_execute_top_pick: false,
  });
  const [savingSchedule, setSavingSchedule] = useState(false);

  // Check onboarding status + load cached recs
  const onboardingComplete = (profile as { onboarding_completed_at?: string | null } | null)?.onboarding_completed_at;

  useEffect(() => {
    // Load cached recommendations
    fetch("/api/ai-recommender/recommend")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.has_cached && data.recommendations?.length > 0) {
          setHasCached(true);
          setLastGeneratedAt(data.last_generated_at);
        }
      })
      .catch(() => {});
    // Load schedule
    fetch("/api/ai-recommender/schedule")
      .then(r => r.ok ? r.json() : null)
      .then(data => data?.schedule && setSchedule(data.schedule))
      .catch(() => {});
  }, []);

  async function generate(regenerate = false) {
    setLoading(true);
    try {
      const res = await fetch("/api/ai-recommender/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerate }),
      });
      const data = await res.json();
      if (data.success) {
        setRecommendations(data.recommendations || []);
        setTheme(data.overall_theme || "");
        setPriorityFocus(data.priority_focus || "");
        setHasCached(true);
        setLastGeneratedAt(new Date().toISOString());
        if (regenerate) toast.success("Fresh recommendations generated");
      } else {
        toast.error(data.error || "Failed to generate");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }

  function handleOpen() {
    setOpen(true);
    // Load cached on open if we haven't already
    if (recommendations.length === 0) {
      fetch("/api/ai-recommender/recommend")
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.recommendations?.length > 0) {
            setRecommendations(data.recommendations);
            setTheme(data.overall_theme || "");
            setPriorityFocus(data.priority_focus || "");
          } else {
            // No cache — auto-generate
            generate(false);
          }
        });
    }
  }

  async function saveSchedule(newSchedule: typeof schedule) {
    setSavingSchedule(true);
    try {
      await fetch("/api/ai-recommender/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schedule: newSchedule }),
      });
      setSchedule(newSchedule);
      toast.success(newSchedule.enabled ? "Schedule enabled" : "Schedule disabled");
    } catch {
      toast.error("Failed to save schedule");
    } finally {
      setSavingSchedule(false);
    }
  }

  // Don't show button until onboarding is complete
  if (!onboardingComplete) return null;

  /* ─── The big button ─── */
  return (
    <>
      <button
        onClick={handleOpen}
        className={`group relative w-full md:w-auto rounded-2xl overflow-hidden transition-all hover-lift ${
          hasCached
            ? "bg-gradient-to-r from-gold via-amber-400 to-gold shadow-lg shadow-gold/40"
            : "bg-gradient-to-r from-gold to-amber-500 shadow-lg shadow-gold/30"
        }`}
      >
        {/* Glow pulse */}
        <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
        {/* Animated background shimmer for ready state */}
        {hasCached && (
          <span className="absolute inset-0 bg-[length:200%_100%] bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_3s_ease-in-out_infinite]" />
        )}
        <div className="relative flex items-center gap-3 px-5 py-3.5">
          <div className="w-9 h-9 rounded-xl bg-black/15 backdrop-blur-sm flex items-center justify-center">
            <Sparkles size={18} className="text-black" />
          </div>
          <div className="text-left flex-1">
            <p className="text-sm font-bold text-black">
              {hasCached ? "Ready to make AI do your job?" : "✨ Recommended to do"}
            </p>
            <p className="text-[11px] text-black/70">
              {hasCached
                ? `Pick up where you left off · ${lastGeneratedAt ? `Last ideas ${relativeTime(lastGeneratedAt)}` : "Tailored to your business"}`
                : "AI picks your next best content & outreach actions"}
            </p>
          </div>
          <ArrowRight size={16} className="text-black shrink-0 group-hover:translate-x-1 transition-transform" />
        </div>
      </button>

      {/* ─── Modal ─── */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 fade-in"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative px-6 py-4 border-b border-border bg-gradient-to-br from-gold/[0.12] via-transparent to-amber-500/[0.06] overflow-hidden">
              <div className="absolute inset-0 opacity-30">
                <div className="absolute top-0 left-1/4 w-32 h-32 rounded-full bg-gold/30 blur-3xl" />
                <div className="absolute bottom-0 right-1/3 w-40 h-40 rounded-full bg-amber-500/20 blur-3xl" />
              </div>
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-gold to-amber-500 flex items-center justify-center shadow-lg shadow-gold/30">
                    <Sparkles size={22} className="text-black" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-foreground">AI Task Commander</h2>
                    <p className="text-[11px] text-muted">
                      Your personal AI strategist. Picks the highest-leverage content & outreach for your business.
                    </p>
                  </div>
                </div>
                <button onClick={() => setOpen(false)} className="p-2 rounded-lg hover:bg-surface-light text-muted hover:text-foreground transition-colors">
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Strategy banner */}
            {theme && (
              <div className="mx-6 mt-4 p-3 rounded-xl bg-gradient-to-r from-gold/8 to-amber-500/5 border border-gold/20 flex items-start gap-3">
                <TrendingUp size={14} className="text-gold shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-[11px] font-semibold text-foreground">{theme}</p>
                  {priorityFocus && <p className="text-[10px] text-muted mt-0.5">💡 {priorityFocus}</p>}
                </div>
                <button
                  onClick={() => generate(true)}
                  disabled={loading}
                  className="shrink-0 text-[10px] text-muted hover:text-gold flex items-center gap-1 transition-colors"
                >
                  <RefreshCw size={10} className={loading ? "animate-spin" : ""} /> Different ideas
                </button>
              </div>
            )}

            {/* Body — recommendations grid */}
            <div className="flex-1 overflow-y-auto p-6">
              {loading && recommendations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 size={32} className="animate-spin text-gold" />
                  <p className="text-xs text-muted">AI is analyzing your business...</p>
                  <p className="text-[10px] text-muted/70 max-w-md text-center">
                    Checking your recent activity, business type, goals, and what would move the needle most.
                  </p>
                </div>
              ) : recommendations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gold/15 flex items-center justify-center">
                    <Sparkles size={28} className="text-gold" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold mb-1">Ready when you are</p>
                    <p className="text-[11px] text-muted max-w-sm">
                      AI will generate 6-8 personalized tasks based on your business, recent activity, and what will grow revenue.
                    </p>
                  </div>
                  <button onClick={() => generate(false)} className="btn-primary text-xs flex items-center gap-1.5">
                    <Sparkles size={12} /> Generate recommendations
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {recommendations.map((rec, i) => (
                    <RecommendationCard key={rec.id} rec={rec} index={i} />
                  ))}
                </div>
              )}
            </div>

            {/* Footer — schedule + close */}
            <div className="px-6 py-4 border-t border-border bg-surface-light/30 flex items-center justify-between flex-wrap gap-2">
              <button
                onClick={() => setShowSchedule(!showSchedule)}
                className="flex items-center gap-1.5 text-[11px] text-muted hover:text-foreground transition-colors"
              >
                <Calendar size={12} />
                {schedule.enabled
                  ? `Scheduled — ${formatScheduleLabel(schedule)}`
                  : "Set up auto-schedule"}
              </button>
              <div className="flex items-center gap-2">
                {recommendations.length > 0 && (
                  <button
                    onClick={() => generate(true)}
                    disabled={loading}
                    className="btn-secondary text-xs flex items-center gap-1.5"
                  >
                    {loading ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                    Generate new
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="btn-primary text-xs">
                  {hasCached ? "Close" : "Maybe later"}
                </button>
              </div>
            </div>

            {/* Schedule panel */}
            {showSchedule && (
              <div className="px-6 py-4 border-t border-border bg-gold/[0.03]">
                <div className="flex items-start gap-3 mb-3">
                  <Clock size={14} className="text-gold shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold">Auto-run recommendations</p>
                    <p className="text-[10px] text-muted">AI regenerates fresh ideas on a schedule so you always have what to do next.</p>
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={schedule.enabled}
                      onChange={e => saveSchedule({ ...schedule, enabled: e.target.checked })}
                      className="accent-gold"
                    />
                    <span className="text-[10px]">{schedule.enabled ? "On" : "Off"}</span>
                  </label>
                </div>
                {schedule.enabled && (
                  <div className="space-y-2.5">
                    <div>
                      <label className="text-[10px] text-muted uppercase tracking-wider">Frequency</label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(["daily", "every_other_day", "weekdays", "weekly", "monthly"] as const).map(f => (
                          <button
                            key={f}
                            onClick={() => saveSchedule({ ...schedule, frequency: f })}
                            className={`text-[10px] px-2.5 py-1 rounded-full border ${
                              schedule.frequency === f
                                ? "bg-gold/15 border-gold/30 text-gold"
                                : "bg-surface-light border-border text-muted"
                            }`}
                          >
                            {f.replace(/_/g, " ")}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="text-[10px] text-muted">Time</label>
                      <input
                        type="time"
                        value={schedule.time_of_day}
                        onChange={e => saveSchedule({ ...schedule, time_of_day: e.target.value })}
                        className="input text-xs py-1 px-2"
                      />
                      <label className="flex items-center gap-1.5 text-[10px] text-muted">
                        <input
                          type="checkbox"
                          checked={schedule.auto_execute_top_pick}
                          onChange={e => saveSchedule({ ...schedule, auto_execute_top_pick: e.target.checked })}
                          className="accent-gold"
                        />
                        Auto-execute top pick
                      </label>
                    </div>
                    <p className="text-[9px] text-muted flex items-center gap-1">
                      <Info size={9} />
                      {savingSchedule ? "Saving..." : `Next run: ${formatScheduleLabel(schedule)}`}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Individual recommendation card ─── */
function RecommendationCard({ rec, index }: { rec: Recommendation; index: number }) {
  const typeInfo = TYPE_INFO[rec.type] || { label: rec.type, description: "", emoji: "✨" };
  const icon = ICON_MAP[rec.icon] || <Sparkles size={16} />;
  const [showInfo, setShowInfo] = useState(false);

  const impactColor = rec.impact === "high" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
    rec.impact === "medium" ? "text-amber-400 bg-amber-500/10 border-amber-500/20" :
    "text-muted bg-white/5 border-white/10";

  const effortColor = rec.effort === "quick" ? "text-blue-400" : rec.effort === "medium" ? "text-purple-400" : "text-pink-400";

  return (
    <div
      className="relative group rounded-xl border border-border bg-surface-light/30 hover:border-gold/30 hover:bg-surface-light/60 transition-all overflow-hidden"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="p-4 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gold/15 text-gold flex items-center justify-center shrink-0">
              {icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] uppercase tracking-wider text-muted">{typeInfo.emoji} {typeInfo.label}</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full border capitalize ${impactColor}`}>
                  {rec.impact}
                </span>
              </div>
              <h3 className="text-sm font-semibold mt-0.5 leading-tight">{rec.title}</h3>
            </div>
          </div>
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="p-1 rounded hover:bg-white/5 text-muted hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
            title="What is this?"
          >
            <Info size={11} />
          </button>
        </div>

        <p className="text-[11px] text-muted leading-relaxed">{rec.description}</p>

        {showInfo && (
          <div className="p-2 rounded-lg bg-surface-light/80 border border-border">
            <p className="text-[10px] text-muted leading-relaxed">{typeInfo.description}</p>
          </div>
        )}

        <div className="flex items-start gap-1.5 pt-1">
          <Zap size={10} className="text-gold shrink-0 mt-0.5" />
          <p className="text-[10px] text-gold/90 leading-relaxed italic">{rec.reason}</p>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <span className={`text-[10px] capitalize ${effortColor}`}>
            ⏱ {rec.effort === "quick" ? "5 min" : rec.effort === "medium" ? "~30 min" : "2+ hrs"}
          </span>
          <Link
            href={rec.action_href}
            className="flex items-center gap-1 text-[11px] font-semibold text-gold hover:text-amber-400 transition-colors"
          >
            Start <ArrowRight size={10} />
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ─── Helpers ─── */
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatScheduleLabel(s: { enabled: boolean; frequency: string; time_of_day: string }): string {
  if (!s.enabled) return "Off";
  const freq = s.frequency.replace(/_/g, " ");
  return `${freq} at ${s.time_of_day}`;
}
