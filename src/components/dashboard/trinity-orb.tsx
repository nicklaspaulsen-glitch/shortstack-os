"use client";

/**
 * TrinityOrb — the dashboard centerpiece.
 *
 * A faceted low-poly 3D head ("Trinity Persona") sits at the top — built
 * with SVG polygons + CSS so there's no Three.js bundle cost. It breathes
 * when idle, focuses + spins faster when thinking, and pulses with a
 * voice-reactive halo when listening. Eyes follow the cursor subtly.
 *
 * Below the head: text input + mic button (Web Speech API) + quick-action
 * chips. When the user sends a message, the head shrinks + moves aside and
 * the conversation streams below as a chat thread. All messages persist
 * via /api/trinity-assistant.
 *
 * Works for both agency-admin and client-portal surfaces — pass `clientId`
 * to scope the assistant to a single client (client portal mode).
 *
 * Sub-features are lazy-loaded via Next.js dynamic() so the initial bundle
 * only ships the orb shell (animated sphere + prompt input).
 */

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { Send, Sparkles, Loader } from "lucide-react";
import TrinityOrbVisual from "@/components/trinity/TrinityVisual";
import type { ChatMsg } from "@/components/trinity/types";
import { speak as ttsSpeak, stopAllAudio as ttsStop } from "@/components/trinity/tts";

// ── Lazy-loaded sub-features ──────────────────────────────────────────────
// Each chunk only ships to browsers that actually open that feature.

function OrbSkeleton() {
  return <div className="h-8 w-8 rounded-xl bg-surface-light animate-pulse" />;
}

const TrinityVoice = dynamic(() => import("@/components/trinity/TrinityVoice"), {
  ssr: false,
  loading: () => <OrbSkeleton />,
});

const TrinitySettings = dynamic(() => import("@/components/trinity/TrinitySettings"), {
  ssr: false,
  loading: () => null,
});

const TrinityHistory = dynamic(() => import("@/components/trinity/TrinityHistory"), {
  ssr: false,
  loading: () => (
    <div className="px-4 sm:px-6 pb-3 space-y-3">
      {[1, 2].map((i) => (
        <div key={i} className="h-10 rounded-2xl bg-surface-light animate-pulse" />
      ))}
    </div>
  ),
});

const TrinitySuggestions = dynamic(() => import("@/components/trinity/TrinitySuggestions"), {
  ssr: false,
  loading: () => null,
});

const TrinityWebSearch = dynamic(() => import("@/components/trinity/TrinityWebSearch"), {
  ssr: false,
  loading: () => null,
});

// ── Types ─────────────────────────────────────────────────────────────────

interface Props {
  firstName?: string;
  clientId?: string | null;
  /** Quick-action chips shown below the input when the thread is empty. */
  suggestions?: string[];
}

const DEFAULT_SUGGESTIONS = [
  "How am I doing this month?",
  "Search for plumber leads in Dallas",
  "Send a $500 invoice to my newest client",
  "Schedule an Instagram post for tomorrow",
  "Generate a 30-day content plan for Acme",
  "What are my latest replies?",
];

// ── Component ─────────────────────────────────────────────────────────────

export default function TrinityOrb({ firstName, clientId = null, suggestions = DEFAULT_SUGGESTIONS }: Props) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [listening, setListening] = useState(false);

  // Text-to-speech state. `muted` persists in localStorage so the user's
  // mute choice sticks across sessions.
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(false);

  // Show web-search notice when user picks that suggestion
  const [showWebSearch, setShowWebSearch] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Extract the current dashboard page slug so Trinity can bias tool choice.
  const pathname = usePathname();
  const currentPage =
    pathname && pathname.startsWith("/dashboard/")
      ? pathname.replace(/^\/dashboard\//, "").split("/")[0] || null
      : null;

  // Detect TTS support and load persisted mute pref.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setTtsSupported(typeof Audio !== "undefined" || "speechSynthesis" in window);
    try {
      const saved = window.localStorage.getItem("trinity_muted");
      if (saved === "1") setMuted(true);
    } catch {
      // localStorage can throw in incognito — ignore
    }
  }, []);

  // Stop all audio on unmount.
  useEffect(() => {
    return () => {
      ttsStop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopAllAudio() {
    ttsStop();
    setSpeaking(false);
  }

  function toggleMute() {
    setMuted((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem("trinity_muted", next ? "1" : "0");
      } catch {
        // ignore
      }
      if (next) stopAllAudio();
      return next;
    });
  }

  // Auto-grow the textarea up to ~4 lines.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [input]);

  async function send(overrideText?: string) {
    const text = (overrideText ?? input).trim();
    if (!text || sending) return;
    if (listening) setListening(false);

    // If Trinity is mid-reply out loud, cancel it so we don't talk over the user.
    stopAllAudio();

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setSending(true);
    try {
      const res = await fetch("/api/trinity-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          conversation_id: conversationId,
          client_id: clientId,
          current_page: currentPage,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Trinity failed");
      if (data.conversation_id) setConversationId(data.conversation_id);
      const replyText = data.reply || "Done.";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: replyText, actions: data.actions || [] },
      ]);
      // Speak the reply out loud if TTS is on and not muted.
      if (!muted) {
        ttsSpeak(replyText, {
          isMuted: () => muted,
          onSpeakingChange: setSpeaking,
        });
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: err instanceof Error ? err.message : "Something went wrong.",
        },
      ]);
    }
    setSending(false);
  }

  function handleSuggestionPick(s: string) {
    // If the suggestion is web-search related, show the web-search panel.
    if (s.toLowerCase().includes("search")) {
      setShowWebSearch(true);
    }
    setInput(s);
    inputRef.current?.focus();
  }

  const active = messages.length > 0;

  return (
    <div className="card-static overflow-hidden relative" style={{ borderColor: "rgba(200,168,85,0.18)" }}>
      {/* ─── Ambient aurora behind the orb ────────────────────── */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute top-[-60px] left-1/2 -translate-x-1/2 w-[500px] h-[280px] rounded-full blur-3xl"
             style={{ background: "radial-gradient(ellipse, rgba(200,168,85,0.20), transparent 60%)" }} />
        <div className="absolute top-[120px] left-[20%] w-[160px] h-[160px] rounded-full blur-3xl"
             style={{ background: "radial-gradient(circle, rgba(139,92,246,0.15), transparent 70%)" }} />
        <div className="absolute top-[120px] right-[20%] w-[160px] h-[160px] rounded-full blur-3xl"
             style={{ background: "radial-gradient(circle, rgba(59,130,246,0.12), transparent 70%)" }} />
      </div>

      {/* ─── TTS controls (lazy) ───────────────────────────────── */}
      <TrinitySettings
        ttsSupported={ttsSupported}
        muted={muted}
        speaking={speaking}
        onToggleMute={toggleMute}
        onStop={stopAllAudio}
      />

      {/* ─── Header: orb + tagline ─────────────────────────────── */}
      <div className={`relative flex flex-col items-center text-center transition-all duration-500 ${active ? "py-4" : "py-8 sm:py-10"}`}>
        <TrinityOrbVisual
          size={active ? "small" : "large"}
          pulsing={sending}
          state={sending ? "thinking" : listening ? "listening" : "idle"}
        />
        <div className={`mt-3 transition-all ${active ? "opacity-80" : "opacity-100"}`}>
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted flex items-center gap-1.5 justify-center">
            <Sparkles size={10} className="text-gold" />
            Trinity
          </p>
          <h2 className={`font-bold tracking-tight mt-1 ${active ? "text-sm" : "text-xl sm:text-2xl"}`}>
            {active ? "Trinity is with you" : `Hey ${firstName || "there"}, I can help you with:`}
          </h2>
          {!active && (
            <p className="text-xs text-muted mt-1 max-w-md mx-auto">
              Ask anything about your business — leads, revenue, content, outreach, tasks. I see it all and can take action.
            </p>
          )}
        </div>
      </div>

      {/* ─── Conversation thread (lazy) ───────────────────────── */}
      {active && (
        <TrinityHistory messages={messages} sending={sending} />
      )}

      {/* ─── Web search notice (lazy, shown on demand) ─────────── */}
      {showWebSearch && (
        <TrinityWebSearch onDismiss={() => setShowWebSearch(false)} />
      )}

      {/* ─── Input row ─────────────────────────────────────────── */}
      <div className="relative px-4 sm:px-6 pb-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="relative flex items-end gap-2 max-w-2xl mx-auto"
        >
          <div className="flex-1 relative rounded-2xl border border-gold/20 bg-surface focus-within:border-gold/50 focus-within:shadow-[0_0_0_3px_rgba(200,168,85,0.12)] transition-all">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder="Ask Trinity anything about your business..."
              disabled={sending}
              className="w-full resize-none bg-transparent px-4 py-3 pr-12 text-sm placeholder:text-muted/70 focus:outline-none"
              style={{ maxHeight: 120 }}
            />
            {/* Mic button — lazy-loaded; only users who need voice ship this chunk */}
            <TrinityVoice
              listening={listening}
              onListeningChange={setListening}
              onTranscript={(t) => setInput(t)}
            />
          </div>
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="h-[46px] px-4 rounded-2xl bg-gold text-black font-semibold text-xs flex items-center gap-1.5 hover:bg-gold-dark disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {sending ? <Loader size={14} className="animate-spin" /> : <Send size={14} />}
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>

        {/* ─── Quick-action chips (lazy) ───────────────────────── */}
        {!active && (
          <TrinitySuggestions suggestions={suggestions} onPick={handleSuggestionPick} />
        )}
        {active && (
          <div className="flex items-center justify-between mt-2 max-w-2xl mx-auto text-[10px] text-muted/80">
            <button
              onClick={() => {
                setMessages([]);
                setConversationId(null);
              }}
              className="hover:text-gold transition-colors"
            >
              New conversation
            </button>
            <span>Enter to send · Shift+Enter for new line</span>
          </div>
        )}
      </div>
    </div>
  );
}
