"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Sparkles, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import { useQuotaWall } from "@/components/billing/quota-wall";

/**
 * AITopicSuggest — surface-aware AI topic suggestions as one-click pills.
 *
 * Drop next to any topic / prompt input. The first time it mounts (or when
 * the user clicks the refresh icon) it calls `/api/ai/suggest-topics`,
 * which gathers the agency's recent activity + niche + (optional) client
 * context and returns N ranked topic ideas. Click a pill → `onSelect`
 * fires with that topic string.
 *
 * Use when the input is a "what should I make / write about?" field.
 *
 * Example:
 *   <AITopicSuggest
 *     surface="script_lab"
 *     onSelect={(topic) => setConfig(c => ({ ...c, topic }))}
 *   />
 *
 * Props:
 *   - surface (required): which tool is asking. Drives the system prompt
 *     and the cache key.
 *   - onSelect (required): called with the picked topic string.
 *   - clientId (optional): narrow context to a single client.
 *   - max (default 6): suggestion count, 1..10.
 *   - autoLoad (default true): fetch on mount.
 *   - title (optional): heading text — default depends on surface.
 *   - className (optional): wrapper class override.
 */

export type SuggestSurface =
  | "script_lab"
  | "cold_email"
  | "copywriter"
  | "thumbnail"
  | "ad_copy"
  | "email_composer"
  | "social_post"
  | "voice_studio";

interface SuggestedTopic {
  topic: string;
  reason: string;
  impact: "high" | "medium" | "low";
  category?: string;
}

export interface AITopicSuggestProps {
  surface: SuggestSurface;
  onSelect: (topic: string) => void;
  clientId?: string;
  max?: number;
  autoLoad?: boolean;
  title?: string;
  className?: string;
}

const DEFAULT_TITLE: Record<SuggestSurface, string> = {
  script_lab: "AI script ideas based on your niche",
  cold_email: "AI cold-email angles tailored to your prospects",
  copywriter: "AI long-form topics worth writing",
  thumbnail: "AI thumbnail concepts that match your audience",
  ad_copy: "AI ad-copy hooks to test",
  email_composer: "AI newsletter topics your list will open",
  social_post: "AI social-post angles to grab attention",
  voice_studio: "AI voice-script ideas under 30 seconds",
};

const IMPACT_BADGE: Record<SuggestedTopic["impact"], string> = {
  high: "bg-emerald-500/15 text-emerald-700 border border-emerald-500/30",
  medium: "bg-[rgba(59,130,246,0.12)] text-[#2563EB] border border-[rgba(59,130,246,0.25)]",
  low: "bg-muted/15 text-muted border border-border/40",
};

export default function AITopicSuggest({
  surface,
  onSelect,
  clientId,
  max = 6,
  autoLoad = true,
  title,
  className = "",
}: AITopicSuggestProps) {
  const [suggestions, setSuggestions] = useState<SuggestedTopic[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { fetchWithWall } = useQuotaWall();

  const fetchSuggestions = useCallback(
    async (regenerate = false): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchWithWall("/api/ai/suggest-topics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ surface, clientId, max, regenerate }),
        });
        if (res.status === 402) {
          setError("Token limit reached — upgrade to keep suggesting");
          setLoading(false);
          return;
        }
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? `Request failed (${res.status})`);
          setLoading(false);
          return;
        }
        const data = (await res.json()) as { suggestions?: SuggestedTopic[] };
        setSuggestions(data.suggestions ?? []);
      } catch {
        setError("Could not reach AI — try again");
      } finally {
        setLoading(false);
      }
    },
    [surface, clientId, max, fetchWithWall],
  );

  useEffect(() => {
    if (autoLoad) {
      void fetchSuggestions(false);
    }
  }, [autoLoad, fetchSuggestions]);

  function handlePick(topic: string): void {
    onSelect(topic);
    toast.success("Topic applied");
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-foreground/80">
          <Sparkles size={12} className="text-[#2563EB]" />
          <span>{title ?? DEFAULT_TITLE[surface]}</span>
        </div>
        <button
          type="button"
          onClick={() => void fetchSuggestions(true)}
          disabled={loading}
          className="flex items-center gap-1 text-[10px] text-muted hover:text-foreground disabled:opacity-40 transition-colors"
          title="Regenerate suggestions"
        >
          {loading ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
          <span>{loading ? "Thinking…" : "Refresh"}</span>
        </button>
      </div>

      {error && (
        <p className="text-[11px] text-red-400/90 italic">{error}</p>
      )}

      {!error && loading && suggestions.length === 0 && (
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: max }).map((_, i) => (
            <div
              key={i}
              className="h-6 w-32 animate-pulse rounded-full bg-surface-light"
            />
          ))}
        </div>
      )}

      {!error && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((s, i) => (
            <button
              key={`${s.topic}-${i}`}
              type="button"
              onClick={() => handlePick(s.topic)}
              title={s.reason || s.topic}
              className="group inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-surface-light px-3 py-1 text-[11px] text-foreground/80 transition-all hover:border-[rgba(59,130,246,0.25)] hover:bg-[rgba(59,130,246,0.08)] hover:text-foreground"
            >
              <span className={`h-1.5 w-1.5 rounded-full ${
                s.impact === "high" ? "bg-emerald-400" :
                s.impact === "medium" ? "bg-[#2563EB]" : "bg-muted"
              }`} aria-hidden="true" />
              <span>{s.topic}</span>
              <span className={`ml-0.5 rounded-full px-1 py-px text-[8px] uppercase tracking-wide opacity-0 transition-opacity group-hover:opacity-100 ${IMPACT_BADGE[s.impact]}`}>
                {s.impact}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
