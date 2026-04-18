"use client";

import { useState } from "react";
import { Check, Sparkles, Loader2, CheckSquare, Square, Grid } from "lucide-react";
import { SIDEBAR_CATEGORIES, ALL_SIDEBAR_ITEMS } from "@/lib/user-types";

interface Props {
  /** Current enabled item hrefs */
  enabledItems: string[];
  /** Called whenever the selection changes */
  onChange: (hrefs: string[]) => void;
  /** User type — powers the "AI Recommended" button */
  userType: string;
  /** Additional context passed to the AI recommender */
  goals?: string | string[];
  niche?: string;
  businessInfo?: Record<string, unknown>;
  /** Optional sticky "selection summary" footer */
  showSummary?: boolean;
}

/**
 * Sidebar customization widget.
 * Used in onboarding and in Settings → Sidebar.
 */
export default function SidebarCustomizer({
  enabledItems,
  onChange,
  userType,
  goals,
  niche,
  businessInfo,
  showSummary = true,
}: Props) {
  const [aiLoading, setAiLoading] = useState(false);
  const [reasoning, setReasoning] = useState<string>("");

  const enabledSet = new Set(enabledItems);

  const toggle = (href: string) => {
    if (enabledSet.has(href)) {
      onChange(enabledItems.filter((h) => h !== href));
    } else {
      onChange([...enabledItems, href]);
    }
  };

  const selectAll = () => onChange([...ALL_SIDEBAR_ITEMS]);
  const selectNone = () => onChange([]);

  const selectCategory = (category: string) => {
    const catItems = SIDEBAR_CATEGORIES.find((c) => c.category === category)?.items || [];
    const catHrefs = catItems.map((i) => i.href);
    const allSelected = catHrefs.every((h) => enabledSet.has(h));
    if (allSelected) {
      onChange(enabledItems.filter((h) => !catHrefs.includes(h)));
    } else {
      onChange(Array.from(new Set([...enabledItems, ...catHrefs])));
    }
  };

  async function runAiRecommend() {
    setAiLoading(true);
    setReasoning("");
    try {
      const res = await fetch("/api/onboarding/recommend-sidebar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_type: userType, goals, niche, business_info: businessInfo }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.enabled_items)) {
        onChange(data.enabled_items);
        if (typeof data.reasoning === "string") setReasoning(data.reasoning);
      }
    } catch (err) {
      console.error("[SidebarCustomizer] AI recommend failed:", err);
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Top action bar ────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={runAiRecommend}
          disabled={aiLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-gold/20 to-amber-400/15 border border-gold/30 text-gold text-xs font-semibold hover:from-gold/30 hover:to-amber-400/20 transition-all disabled:opacity-50"
        >
          {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {aiLoading ? "Thinking..." : "AI Recommended"}
        </button>
        <button
          type="button"
          onClick={selectAll}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-light border border-border text-xs font-medium text-muted hover:text-foreground hover:border-gold/30 transition-all"
        >
          <CheckSquare size={12} /> Select All
        </button>
        <button
          type="button"
          onClick={selectNone}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-light border border-border text-xs font-medium text-muted hover:text-foreground hover:border-gold/30 transition-all"
        >
          <Square size={12} /> Select None
        </button>
        <div className="flex-1" />
        <span className="text-[11px] text-muted">
          <span className="text-gold font-semibold">{enabledItems.length}</span> of {ALL_SIDEBAR_ITEMS.length} enabled
        </span>
      </div>

      {reasoning && (
        <div className="px-3 py-2 rounded-lg bg-gold/5 border border-gold/15 text-[11px] text-muted italic">
          <span className="text-gold font-medium">AI: </span>
          {reasoning}
        </div>
      )}

      {/* ── Categories with checkboxes ────────────────────────── */}
      <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1 scrollbar-none">
        {SIDEBAR_CATEGORIES.map((cat) => {
          const catItems = cat.items;
          const catHrefs = catItems.map((i) => i.href);
          const allSelected = catHrefs.every((h) => enabledSet.has(h));
          const someSelected = catHrefs.some((h) => enabledSet.has(h));
          return (
            <div key={cat.category} className="rounded-xl border border-border bg-surface-light/30 overflow-hidden">
              <button
                type="button"
                onClick={() => selectCategory(cat.category)}
                className="w-full flex items-center justify-between px-3 py-2 bg-surface-light/50 hover:bg-surface-light transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Grid size={12} className="text-gold" />
                  <span className="text-xs font-semibold text-foreground">{cat.category}</span>
                  <span className="text-[10px] text-muted">
                    {catHrefs.filter((h) => enabledSet.has(h)).length}/{catHrefs.length}
                  </span>
                </div>
                <span
                  className={`w-4 h-4 rounded-md border flex items-center justify-center text-[9px] font-bold transition-all ${
                    allSelected
                      ? "bg-gold border-gold text-black"
                      : someSelected
                      ? "bg-gold/30 border-gold/50 text-gold"
                      : "border-border"
                  }`}
                >
                  {allSelected ? <Check size={9} /> : someSelected ? "—" : ""}
                </span>
              </button>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 p-2">
                {catItems.map((item) => {
                  const selected = enabledSet.has(item.href);
                  return (
                    <button
                      key={item.href}
                      type="button"
                      onClick={() => toggle(item.href)}
                      className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left transition-all ${
                        selected
                          ? "bg-gold/10 border border-gold/30 text-foreground"
                          : "bg-transparent border border-transparent text-muted hover:text-foreground hover:bg-surface-light"
                      }`}
                    >
                      <span className="truncate">{item.label}</span>
                      <span
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                          selected ? "bg-gold border-gold" : "border-border"
                        }`}
                      >
                        {selected && <Check size={9} className="text-black" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {showSummary && enabledItems.length > 0 && (
        <div className="text-[11px] text-muted">
          Tip: sections become invisible in the sidebar when all their items are unchecked. Core navigation like{" "}
          <span className="text-foreground font-medium">Dashboard</span> and{" "}
          <span className="text-foreground font-medium">Settings</span> should stay enabled so you can still navigate.
        </div>
      )}
    </div>
  );
}
