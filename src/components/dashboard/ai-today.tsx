"use client";

/**
 * AI Today widget — surfaces the top 3 most useful actions for THIS user
 * RIGHT NOW based on their actual data. Calls /api/dashboard/ai-today which
 * uses Claude Haiku to reason over a snapshot of leads / content / calls /
 * deals / inbox state and propose concrete next steps.
 *
 * Lives at the top of /dashboard, just under TodaysPriority. Pairs with
 * the existing one-priority card to give the user three diverse next steps
 * without forcing them to scroll for ideas.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Target,
  PenTool,
  Phone,
  TrendingUp,
  MessageSquare,
  SlidersHorizontal,
  DollarSign,
  ArrowRight,
  RefreshCw,
} from "lucide-react";

interface Action {
  title: string;
  why: string;
  cta_label: string;
  cta_href: string;
  urgency: "high" | "medium" | "low";
  icon: "leads" | "content" | "calls" | "deals" | "inbox" | "setup" | "money";
}

const ICON_MAP = {
  leads: Target,
  content: PenTool,
  calls: Phone,
  deals: TrendingUp,
  inbox: MessageSquare,
  setup: SlidersHorizontal,
  money: DollarSign,
} as const;

const URGENCY_COLORS = {
  high: { glow: "rgba(239,68,68,0.18)", accent: "#ef4444", text: "text-red-300", border: "rgba(239,68,68,0.25)" },
  medium: { glow: "rgba(200,168,85,0.16)", accent: "#c8a855", text: "text-amber-300", border: "rgba(200,168,85,0.25)" },
  low: { glow: "rgba(59,130,246,0.14)", accent: "#3b82f6", text: "text-blue-300", border: "rgba(59,130,246,0.22)" },
} as const;

export default function AiToday() {
  const [actions, setActions] = useState<Action[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (force = false) => {
    if (force) setRefreshing(true);
    try {
      const res = await fetch(force ? "/api/dashboard/ai-today?bust=1" : "/api/dashboard/ai-today", {
        cache: force ? "no-store" : "default",
      });
      if (res.ok) {
        const data = await res.json();
        setActions(data.actions || []);
      }
    } catch {
      /* silent — widget self-hides on error */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl p-5 bg-card border border-border">
        <div className="flex items-center gap-2 mb-4">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center animate-pulse"
            style={{ background: "rgba(200,168,85,0.08)" }}
          >
            <Sparkles size={14} style={{ color: "#c8a855" }} />
          </div>
          <div className="flex-1">
            <div className="h-3 w-24 bg-white/[0.04] rounded animate-pulse mb-1.5" />
            <div className="h-2 w-40 bg-white/[0.03] rounded animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-28 rounded-xl bg-white/[0.02] border border-white/[0.04] animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!actions || actions.length === 0) return null;

  return (
    <section className="relative rounded-2xl p-5 bg-card border border-border overflow-hidden">
      {/* Ambient gold glow keyed to the AI vibe */}
      <div
        className="absolute -top-12 -right-12 w-48 h-48 rounded-full pointer-events-none blur-3xl opacity-50"
        style={{
          background:
            "radial-gradient(circle, rgba(200,168,85,0.12) 0%, transparent 70%)",
        }}
      />

      <div className="flex items-center justify-between mb-4 relative">
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{
              background:
                "linear-gradient(135deg, rgba(200,168,85,0.14), rgba(200,168,85,0.04))",
              border: "1px solid rgba(200,168,85,0.25)",
            }}
          >
            <Sparkles size={15} style={{ color: "#c8a855" }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-foreground">AI Today</h3>
              <span
                className="text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                style={{
                  background: "rgba(200,168,85,0.12)",
                  color: "#c8a855",
                }}
              >
                Live
              </span>
            </div>
            <p className="text-[11px] text-muted">
              Three things AI thinks you should do right now, based on your data.
            </p>
          </div>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="text-[11px] text-muted hover:text-foreground flex items-center gap-1 px-2 py-1 rounded-md hover:bg-white/[0.03] transition disabled:opacity-50"
          title="Re-run AI suggestions"
        >
          <RefreshCw
            size={11}
            className={refreshing ? "animate-spin" : ""}
          />
          {refreshing ? "Thinking…" : "Refresh"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 relative">
        {actions.slice(0, 3).map((action, i) => (
          <ActionCard key={`${action.title}-${i}`} action={action} />
        ))}
      </div>
    </section>
  );
}

function ActionCard({ action }: { action: Action }) {
  const Icon = ICON_MAP[action.icon] || SlidersHorizontal;
  const colors = URGENCY_COLORS[action.urgency];
  return (
    <Link
      href={action.cta_href}
      className="group relative rounded-xl p-4 transition-all hover:-translate-y-0.5 overflow-hidden flex flex-col"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: `1px solid ${colors.border}`,
      }}
    >
      {/* Hover glow keyed to urgency */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none -z-0"
        style={{
          background: `radial-gradient(circle at 30% 0%, ${colors.glow} 0%, transparent 60%)`,
        }}
      />

      <div className="flex items-start justify-between mb-2.5 relative">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{
            background: `${colors.accent}14`,
            border: `1px solid ${colors.accent}30`,
          }}
        >
          <Icon size={14} style={{ color: colors.accent }} />
        </div>
        <span
          className={`text-[9px] font-bold uppercase tracking-wider ${colors.text}`}
        >
          {action.urgency === "high"
            ? "Urgent"
            : action.urgency === "medium"
            ? "Today"
            : "Soon"}
        </span>
      </div>

      <h4 className="text-[13px] font-bold text-foreground leading-snug mb-1 relative">
        {action.title}
      </h4>
      <p className="text-[11px] text-muted leading-relaxed flex-1 mb-3 relative">
        {action.why}
      </p>

      <div
        className="flex items-center justify-between text-[11px] font-semibold relative"
        style={{ color: colors.accent }}
      >
        {action.cta_label}
        <ArrowRight
          size={11}
          className="group-hover:translate-x-0.5 transition-transform"
        />
      </div>
    </Link>
  );
}
