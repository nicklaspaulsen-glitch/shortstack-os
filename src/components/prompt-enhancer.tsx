"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Loader, Wand2 } from "lucide-react";

interface PromptEnhancerProps {
  value: string;
  onChange: (text: string) => void;
  type?: "thumbnail" | "design" | "video" | "content" | "general";
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  className?: string;
}

export default function PromptEnhancer({
  value,
  onChange,
  type = "general",
  placeholder = "Describe what you want...",
  rows = 4,
  maxLength,
  className = "",
}: PromptEnhancerProps) {
  const [enhancing, setEnhancing] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function enhance() {
    if (!value.trim() || enhancing) return;
    setEnhancing(true);
    setSuggestions([]);
    try {
      const res = await fetch("/api/ai/enhance-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value, type }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.enhanced) {
          onChange(data.enhanced);
        }
        if (data.suggestions?.length > 0) {
          setSuggestions(data.suggestions);
        }
      }
    } catch {
      // Silent fail — user can retry
    }
    setEnhancing(false);
  }

  function applySuggestion(text: string) {
    onChange(text);
    setShowSuggestions(false);
  }

  return (
    <div className={`relative ${className}`}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        className="input w-full text-sm resize-none pb-10"
      />

      {/* Bottom bar inside textarea */}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-1.5 border-t border-border/30 bg-surface/80 backdrop-blur-sm rounded-b-lg">
        <div className="flex items-center gap-2">
          {maxLength && (
            <span className={`text-[10px] font-mono ${value.length > (maxLength * 0.9) ? "text-warning" : "text-muted"}`}>
              {value.length}/{maxLength}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5" ref={dropdownRef}>
          {/* Suggestions dropdown */}
          {suggestions.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowSuggestions(!showSuggestions)}
                className="flex items-center gap-1 text-[10px] text-muted hover:text-foreground px-2 py-1 rounded-md hover:bg-surface-light transition-colors"
              >
                <ChevronDown size={10} className={showSuggestions ? "rotate-180" : ""} />
                {suggestions.length} alternatives
              </button>

              {showSuggestions && (
                <div className="absolute bottom-full right-0 mb-1 w-80 bg-surface border border-border rounded-lg shadow-xl shadow-black/50 z-50 max-h-60 overflow-y-auto">
                  <div className="p-2 border-b border-border/30">
                    <p className="text-[10px] text-muted font-medium">AI Suggestions</p>
                  </div>
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => applySuggestion(s)}
                      className="w-full text-left px-3 py-2 text-xs text-muted hover:text-foreground hover:bg-surface-light border-b border-border/10 last:border-0 transition-colors"
                    >
                      <span className="text-[9px] text-gold font-medium mr-1">#{i + 1}</span>
                      {s.length > 120 ? s.substring(0, 120) + "..." : s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Enhance button */}
          <button
            onClick={enhance}
            disabled={!value.trim() || enhancing}
            className="flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-md transition-all disabled:opacity-30
              bg-gold/10 text-gold border border-gold/20 hover:bg-gold/20 hover:border-gold/30"
          >
            {enhancing ? (
              <>
                <Loader size={10} className="animate-spin" />
                Enhancing...
              </>
            ) : (
              <>
                <Wand2 size={10} />
                Enhance with AI
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
