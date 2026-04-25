"use client";

/**
 * AiAssistButton — drop-in "✨ AI write this" button for any text input or
 * textarea. Sends the user's stated intent + optional context to Claude Haiku
 * and writes the result back into the bound field.
 *
 * Usage:
 *   const [subject, setSubject] = useState("");
 *   <input value={subject} onChange={e => setSubject(e.target.value)} />
 *   <AiAssistButton
 *     value={subject}
 *     onChange={setSubject}
 *     intent="email subject line"
 *     context={{ business: "Acme Corp", topic: "follow-up after demo" }}
 *   />
 *
 * The component handles the prompt construction, API call, loading state,
 * error toast, and (importantly) lets the user "regenerate" with the same
 * intent or "stop" mid-stream.
 *
 * Backed by /api/ai/inline-assist (created alongside this file).
 */

import { useState, useRef, useEffect } from "react";
import { Sparkles, Loader, X, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";

interface Props {
  /** Current value of the field this assist will write to. */
  value: string;
  /** Setter the assist will call with the AI-written text. */
  onChange: (next: string) => void;
  /** What this field is for, in plain English. e.g. "email subject line",
   *  "ad headline", "outreach DM opener". Used to bias the AI's output. */
  intent: string;
  /** Optional context object that gets serialized into the prompt. */
  context?: Record<string, string | number | boolean | null | undefined>;
  /** Optional max-length the AI should target (chars). */
  maxChars?: number;
  /** Compact mode — shrinks button to icon-only. */
  compact?: boolean;
  /** Override label text (defaults to "AI write"). */
  label?: string;
  /** Optional CSS class on the button itself. */
  className?: string;
}

export function AiAssistButton({
  value,
  onChange,
  intent,
  context,
  maxChars,
  compact = false,
  label = "AI write",
  className = "",
}: Props) {
  const [busy, setBusy] = useState(false);
  const [openMenu, setOpenMenu] = useState(false);
  const [briefHint, setBriefHint] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Click-outside to close the menu
  useEffect(() => {
    if (!openMenu) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [openMenu]);

  const run = async (extraHint?: string) => {
    if (busy) return;
    setBusy(true);
    setOpenMenu(false);
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/ai/inline-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          intent,
          current_value: value || null,
          hint: extraHint || briefHint || null,
          context: context || null,
          max_chars: maxChars || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Error ${res.status}`);
      }
      const data = (await res.json()) as { text: string };
      if (data.text) {
        onChange(data.text);
        toast.success("AI wrote it", { icon: "✨" });
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return; // user cancelled
      toast.error(`AI assist failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
      setBriefHint("");
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
    setBusy(false);
  };

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        type="button"
        onClick={busy ? cancel : () => setOpenMenu((v) => !v)}
        className={`inline-flex items-center gap-1.5 transition rounded-md px-2.5 py-1.5 text-[11px] font-semibold ${className}`}
        style={{
          background: busy
            ? "rgba(168,85,247,0.18)"
            : "rgba(200,168,85,0.10)",
          border: busy
            ? "1px solid rgba(168,85,247,0.35)"
            : "1px solid rgba(200,168,85,0.25)",
          color: busy ? "#d8b4fe" : "#c8a855",
        }}
        title={busy ? "Click to stop" : "Generate with AI"}
      >
        {busy ? (
          <>
            <Loader size={11} className="animate-spin" />
            {!compact && "Stop"}
          </>
        ) : (
          <>
            <Sparkles size={11} />
            {!compact && label}
          </>
        )}
      </button>

      {openMenu && !busy && (
        <div
          className="absolute z-50 right-0 mt-1.5 w-[280px] rounded-xl shadow-xl"
          style={{
            background: "var(--color-card, rgba(20,20,28,0.98))",
            border: "1px solid rgba(255,255,255,0.08)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div className="p-3">
            <div className="flex items-center gap-2 mb-2.5">
              <Sparkles size={11} style={{ color: "#c8a855" }} />
              <p className="text-[11px] font-bold text-foreground">
                AI Assist
              </p>
              <span className="text-[10px] text-muted">— {intent}</span>
              <button
                onClick={() => setOpenMenu(false)}
                className="ml-auto text-muted hover:text-foreground"
              >
                <X size={11} />
              </button>
            </div>
            <textarea
              value={briefHint}
              onChange={(e) => setBriefHint(e.target.value)}
              placeholder={`Optional hint — e.g. "make it shorter", "more casual"…`}
              rows={2}
              className="w-full bg-card border border-border rounded-md px-2 py-1.5 text-[11px] text-foreground placeholder:text-muted/60 focus:outline-none focus:border-gold/40 mb-2 resize-none"
              autoFocus
            />
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => run()}
                className="flex-1 px-3 py-1.5 rounded-md text-[11px] font-bold transition flex items-center justify-center gap-1.5"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(200,168,85,0.2), rgba(200,168,85,0.08))",
                  border: "1px solid rgba(200,168,85,0.35)",
                  color: "#e2c878",
                }}
              >
                <Sparkles size={10} /> Generate
              </button>
              {value && (
                <button
                  onClick={() => run("Same intent — try a different angle.")}
                  className="px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "var(--color-foreground)",
                  }}
                  title="Regenerate — try a different angle"
                >
                  <RefreshCw size={10} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AiAssistButton;
