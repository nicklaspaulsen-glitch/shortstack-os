"use client";

import { useCallback, useEffect, useState } from "react";
import { Hash, Lightbulb, Loader2, RefreshCcw, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import { ALL_PLATFORMS } from "@/lib/social-studio/constants";
import type { ContentIdea, SocialPlatform, TrendsResponse } from "@/lib/social-studio/types";
import PlatformChip from "./PlatformChip";

const PRESET_NICHES = [
  "digital marketing agency",
  "fitness coach",
  "ecommerce founder",
  "saas builder",
  "real estate agent",
  "personal brand",
];

export default function Tab3Trends() {
  const [niche, setNiche] = useState(PRESET_NICHES[0]);
  const [customNiche, setCustomNiche] = useState("");
  const [data, setData] = useState<TrendsResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchTrends = useCallback(async (effectiveNiche: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/social/trends?niche=${encodeURIComponent(effectiveNiche)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? "Couldn't load trends");
        return;
      }
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTrends(niche);
  }, [niche, fetchTrends]);

  const onApplyCustomNiche = () => {
    const trimmed = customNiche.trim();
    if (!trimmed) return;
    setNiche(trimmed);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border/40 bg-surface p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-gold" />
            <h3 className="text-sm font-semibold tracking-tight">Niche</h3>
          </div>
          <button
            type="button"
            onClick={() => fetchTrends(niche)}
            disabled={loading}
            className="text-[10px] inline-flex items-center gap-1 text-muted hover:text-foreground disabled:opacity-50"
          >
            <RefreshCcw size={10} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {PRESET_NICHES.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setNiche(n)}
              className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${
                niche === n
                  ? "bg-gold/20 border-gold/40 text-gold"
                  : "border-border/40 text-muted hover:bg-elevated"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={customNiche}
            onChange={(e) => setCustomNiche(e.target.value)}
            placeholder="Or type your own niche..."
            className="flex-1 px-3 py-1.5 rounded-md bg-elevated border border-border/40 text-sm"
          />
          <button
            type="button"
            onClick={onApplyCustomNiche}
            disabled={!customNiche.trim()}
            className="px-3 py-1.5 rounded-md text-xs border border-border/40 hover:bg-elevated disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border/40 bg-surface p-4">
        <div className="flex items-center gap-2 mb-3">
          <Hash size={14} className="text-gold" />
          <h3 className="text-sm font-semibold tracking-tight">Trending hashtags by platform</h3>
        </div>
        {loading && !data ? (
          <div className="flex items-center justify-center py-6 text-xs text-muted">
            <Loader2 size={12} className="animate-spin mr-2" />
            Pulling trends…
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ALL_PLATFORMS.map((platform) => {
              const tags = data?.hashtags_by_platform[platform as SocialPlatform] ?? [];
              if (tags.length === 0) return null;
              return (
                <div key={platform} className="rounded-lg border border-border/40 bg-elevated p-3">
                  <div className="flex items-center justify-between mb-2">
                    <PlatformChip platform={platform} />
                    <span className="text-[10px] text-muted">{tags.length} tags</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {tags.map((t, i) => (
                      <span
                        key={`${t}-${i}`}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-surface border border-border/30"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border/40 bg-surface p-4">
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb size={14} className="text-gold" />
          <h3 className="text-sm font-semibold tracking-tight">Content ideas for this week</h3>
        </div>
        {loading && !data ? (
          <div className="flex items-center justify-center py-6 text-xs text-muted">
            <Loader2 size={12} className="animate-spin mr-2" />
            Generating fresh ideas…
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(data?.ideas ?? []).map((idea: ContentIdea, i) => (
              <div
                key={`${idea.title}-${i}`}
                className="rounded-lg border border-border/40 bg-elevated p-3 hover:border-gold/40 transition-all"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h4 className="text-sm font-medium leading-snug flex-1">{idea.title}</h4>
                  <span className="text-[10px] uppercase tracking-wider text-muted whitespace-nowrap">
                    {idea.format}
                  </span>
                </div>
                <p className="text-xs text-muted leading-relaxed">{idea.hook}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {idea.platforms.map((p) => <PlatformChip key={p} platform={p} />)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
