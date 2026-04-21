"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import { useQuotaWall } from "@/components/billing/quota-wall";

/**
 * AIEnhanceButton — a small "AI Enhance" pill that sits next to any text
 * input / textarea. Reads the current value, calls Claude via
 * /api/ai/enhance-prompt (or the dedicated copywriter route), and writes
 * the improved version back through `onResult`.
 *
 * Usage:
 *   <AIEnhanceButton
 *     value={prompt}
 *     onResult={setPrompt}
 *     context="YouTube thumbnail prompt"
 *   />
 *
 * Shows a QuotaWall modal on 402 token-limit responses via fetchWithWall.
 */

export interface AIEnhanceButtonProps {
  /** Current text to enhance. */
  value: string;
  /** Called with the enhanced text. */
  onResult: (next: string) => void;
  /** Short description of what's being enhanced — feeds into the prompt. */
  context?: string;
  /** Visual variant. `pill` = small rounded button; `inline` = flush with
   *  an input's trailing edge. Default pill. */
  variant?: "pill" | "inline";
  /** Override the label. Default "AI Enhance". */
  label?: string;
  /** Optional CSS class override for container. */
  className?: string;
  /** Disable the button (e.g. while parent is doing another async op). */
  disabled?: boolean;
}

export default function AIEnhanceButton({
  value,
  onResult,
  context = "text",
  variant = "pill",
  label = "AI Enhance",
  className = "",
  disabled = false,
}: AIEnhanceButtonProps) {
  const [loading, setLoading] = useState(false);
  const { fetchWithWall } = useQuotaWall();

  async function enhance() {
    if (!value.trim()) {
      toast.error("Type something first");
      return;
    }
    setLoading(true);
    try {
      // Try the dedicated enhance-prompt route first — faster + tuned for
      // short prompts. Falls back to copywriter/generate if the first
      // endpoint isn't available.
      let improved: string | null = null;
      try {
        const res = await fetchWithWall("/api/ai/enhance-prompt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: value, type: "general", context }),
        });
        if (res.status === 402) {
          toast.error("You hit your token limit — upgrade to continue", { duration: 5000 });
          setLoading(false);
          return;
        }
        if (res.ok) {
          const data = await res.json();
          improved = data.enhanced || data.content || data.text || null;
        }
      } catch {
        /* fall through */
      }

      if (!improved) {
        const res = await fetchWithWall("/api/copywriter/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "custom",
            topic: `Improve this ${context}: "${value}"`,
            tone: "professional",
            audience: "business owners",
            keywords: "",
            wordCount: Math.max(value.split(" ").length * 2, 50),
          }),
        });
        if (res.status === 402) {
          toast.error("You hit your token limit — upgrade to continue", { duration: 5000 });
          setLoading(false);
          return;
        }
        if (res.ok) {
          const data = await res.json();
          improved = data.content || data.text || null;
        }
      }

      if (improved) {
        onResult(improved.trim());
        toast.success("Enhanced with AI");
      } else {
        toast.error("No result returned");
      }
    } catch {
      toast.error("Error connecting to AI");
    }
    setLoading(false);
  }

  const baseClass =
    variant === "inline"
      ? "text-[10px] px-2 py-1 rounded bg-gold/10 text-gold hover:bg-gold/20 disabled:opacity-30 flex items-center gap-1 transition-colors"
      : "text-[10px] px-2.5 py-1 rounded-lg bg-gold/10 text-gold hover:bg-gold/20 disabled:opacity-30 flex items-center gap-1 transition-all border border-gold/10 hover:border-gold/20";

  return (
    <button
      type="button"
      onClick={enhance}
      disabled={loading || disabled || !value.trim()}
      className={`${baseClass} ${className}`}
      title="Improve this text with AI"
    >
      {loading ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
      <span>{loading ? "Enhancing…" : label}</span>
    </button>
  );
}
