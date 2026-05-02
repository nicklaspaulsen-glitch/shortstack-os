"use client";

/**
 * TrinityPrompt — Cmd+K quick-prompt modal for the top navbar.
 *
 * A lightweight overlay that lets users fire a quick message to
 * Trinity without navigating away from their current page.
 * Opens on Cmd+K (Mac) / Ctrl+K (Win/Linux) or via the button
 * in the top navbar. Closes on Escape or backdrop click.
 *
 * Deliberately simpler than TrinityOrb (no voice, no suggestions,
 * no history) — just a fast text prompt → streamed reply.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { Sparkles, Send, Loader, X } from "lucide-react";

export default function TrinityPrompt() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Open / close keyboard shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Auto-focus input when modal opens; clear state on close
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 60);
    } else {
      setInput("");
      setReply(null);
      setSending(false);
    }
  }, [open]);

  // Auto-grow textarea
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [input]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setReply(null);
    try {
      const res = await fetch("/api/trinity-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Trinity failed");
      setReply(data.reply || "Done.");
    } catch (err) {
      setReply(
        err instanceof Error ? err.message : "Something went wrong."
      );
    }
    setSending(false);
  }, [input, sending]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={() => setOpen(false)}
        aria-hidden
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Trinity quick prompt"
        className="fixed left-1/2 top-[15%] z-50 -translate-x-1/2 w-full max-w-xl mx-4"
        style={{ maxWidth: "min(96vw, 560px)" }}
      >
        <div
          className="rounded-2xl border bg-background shadow-2xl overflow-hidden"
          style={{
            borderColor: "rgba(99,102,241,0.25)",
            boxShadow:
              "0 0 0 1px rgba(99,102,241,0.12), 0 24px 60px rgba(0,0,0,0.45)",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-2 px-4 py-3 border-b"
            style={{ borderColor: "rgba(99,102,241,0.12)" }}
          >
            <Sparkles
              size={14}
              className="shrink-0"
              style={{ color: "#6366F1" }}
            />
            <span className="text-xs font-semibold tracking-wide text-muted uppercase">
              Ask Trinity
            </span>
            <span
              className="ml-auto text-[10px] text-muted/60 font-mono border rounded px-1.5 py-0.5"
              style={{ borderColor: "rgba(99,102,241,0.15)" }}
            >
              esc
            </span>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded-md text-muted hover:text-foreground hover:bg-surface-light transition-colors"
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </div>

          {/* Input */}
          <div className="px-4 pt-3 pb-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={1}
              placeholder="Ask anything about your business..."
              disabled={sending}
              className="w-full resize-none bg-transparent text-sm placeholder:text-muted/60 focus:outline-none"
              style={{ maxHeight: 120 }}
            />
          </div>

          {/* Reply */}
          {(reply || sending) && (
            <div
              className="mx-4 mb-3 rounded-xl px-4 py-3 text-sm"
              style={{
                background: "rgba(99,102,241,0.07)",
                border: "1px solid rgba(99,102,241,0.15)",
              }}
            >
              {sending ? (
                <span className="flex items-center gap-2 text-muted text-xs">
                  <Loader size={12} className="animate-spin" style={{ color: "#6366F1" }} />
                  Trinity is thinking…
                </span>
              ) : (
                <p className="text-text-primary whitespace-pre-wrap leading-relaxed">
                  {reply}
                </p>
              )}
            </div>
          )}

          {/* Footer */}
          <div
            className="flex items-center justify-between px-4 py-2.5 border-t"
            style={{ borderColor: "rgba(99,102,241,0.08)" }}
          >
            <span className="text-[10px] text-muted/60">
              Enter to send · Shift+Enter for new line
            </span>
            <button
              onClick={() => void send()}
              disabled={sending || !input.trim()}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: "#6366F1",
                color: "#fff",
              }}
            >
              {sending ? (
                <Loader size={12} className="animate-spin" />
              ) : (
                <Send size={12} />
              )}
              Send
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
