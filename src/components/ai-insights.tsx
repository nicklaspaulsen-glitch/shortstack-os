"use client";

import { useEffect, useState } from "react";
import {
  Sparkles, TrendingUp, Zap, Target, Film,
  Search, CheckCircle, ArrowRight, RefreshCw
} from "lucide-react";

interface Insight {
  type: string;
  title: string;
  description: string;
  action: string;
  priority: string;
  category: string;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  content_idea: <Film size={14} />,
  strategy: <Target size={14} />,
  action_item: <Zap size={14} />,
  competitor_insight: <Search size={14} />,
  growth_tip: <TrendingUp size={14} />,
  quick_win: <CheckCircle size={14} />,
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "border-gold/20 bg-gold/[0.03]",
  medium: "border-accent/15 bg-accent/[0.02]",
  low: "border-border/30",
};

const CATEGORY_BADGES: Record<string, string> = {
  content: "bg-pink-400/10 text-pink-400",
  ads: "bg-blue-400/10 text-blue-400",
  seo: "bg-emerald-400/10 text-emerald-400",
  social: "bg-purple-400/10 text-purple-400",
  operations: "bg-amber-400/10 text-amber-400",
  growth: "bg-gold/10 text-gold",
};

export default function AIInsights({ clientId }: { clientId?: string }) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionedIds, setActionedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchInsights();
  }, [clientId]);

  async function fetchInsights() {
    setLoading(true);
    try {
      const url = clientId ? `/api/insights/generate?client_id=${clientId}` : "/api/insights/generate";
      const res = await fetch(url);
      const data = await res.json();
      if (data.insights && Array.isArray(data.insights)) {
        setInsights(data.insights);
      }
    } catch {}
    setLoading(false);
  }

  function markActioned(index: number) {
    setActionedIds(prev => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="card border-gold/10">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={14} className="text-gold animate-pulse" />
          <span className="text-xs font-semibold">AI is analyzing your business...</span>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 rounded-xl shimmer bg-surface-light/30" />
          ))}
        </div>
      </div>
    );
  }

  if (insights.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-gold" />
          <h2 className="text-sm font-semibold">AI Recommendations</h2>
          <span className="text-[9px] bg-gold/10 text-gold px-1.5 py-0.5 rounded font-medium">
            {insights.length - actionedIds.size} active
          </span>
        </div>
        <button onClick={() => { setInsights([]); fetchInsights(); }} className="text-muted hover:text-white transition-colors">
          <RefreshCw size={12} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {insights.map((insight, i) => {
          const isActioned = actionedIds.has(i);
          return (
            <div
              key={i}
              className={`rounded-xl p-3 border transition-all duration-300 ${
                isActioned ? "opacity-40 scale-[0.98]" : PRIORITY_COLORS[insight.priority] || "border-border/30"
              }`}
            >
              <div className="flex items-start justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-gold">{TYPE_ICONS[insight.type] || <Zap size={14} />}</span>
                  <span className={`text-[8px] px-1.5 py-0.5 rounded-md font-medium ${CATEGORY_BADGES[insight.category] || "bg-surface-light text-muted"}`}>
                    {insight.category}
                  </span>
                </div>
                {insight.priority === "high" && (
                  <span className="text-[8px] text-gold font-bold uppercase">Priority</span>
                )}
              </div>

              <h3 className="text-[11px] font-semibold mb-1 leading-tight">{insight.title}</h3>
              <p className="text-[10px] text-muted leading-relaxed mb-2">{insight.description}</p>

              <div className="flex items-center justify-between">
                <p className="text-[9px] text-gold/80 flex items-center gap-1">
                  <ArrowRight size={8} /> {insight.action}
                </p>
                {!isActioned && (
                  <button onClick={() => markActioned(i)}
                    className="text-[8px] text-muted hover:text-success transition-colors flex items-center gap-0.5">
                    <CheckCircle size={9} /> Done
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
