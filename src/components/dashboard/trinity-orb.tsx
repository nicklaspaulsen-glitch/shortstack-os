"use client";

/**
 * TrinityOrb — the dashboard centerpiece.
 *
 * A CSS-only 3D gradient sphere with pulsing glow sits at the top.
 * Below it: text input + mic button (Web Speech API) + quick-action chips.
 * When the user sends a message, the orb shrinks + moves aside, and the
 * conversation streams below as a chat thread. All messages persist via
 * /api/trinity-assistant.
 *
 * Works for both agency-admin and client-portal surfaces — pass `clientId`
 * to scope the assistant to a single client (client portal mode).
 */

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Send, Sparkles, Loader, CheckCircle, XCircle } from "lucide-react";

// Web Speech API types — browsers expose it unprefixed or as webkitSpeechRecognition.
// We declare the bits we use so TS is happy without pulling in @types/dom-speech-recognition.
interface SpeechRecognitionResultLite {
  0: { transcript: string };
  isFinal: boolean;
}
interface SpeechRecognitionEventLite extends Event {
  results: { [i: number]: SpeechRecognitionResultLite; length: number };
}
interface SpeechRecognitionLite {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechRecognitionEventLite) => void) | null;
  onerror: ((e: Event) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type SpeechCtor = new () => SpeechRecognitionLite;

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  actions?: Array<{ tool: string; ok: boolean; data?: unknown; error?: string }>;
}

interface Props {
  firstName?: string;
  clientId?: string | null;
  /** Quick-action chips shown below the input when the thread is empty. */
  suggestions?: string[];
}

const DEFAULT_SUGGESTIONS = [
  "How am I doing this month?",
  "Find new leads for fitness studios",
  "Generate a content plan for next week",
  "Draft a proposal for my newest client",
  "Create a task: follow up with Acme tomorrow",
  "Post on all my socials today",
];

export default function TrinityOrb({ firstName, clientId = null, suggestions = DEFAULT_SUGGESTIONS }: Props) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [micSupported, setMicSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLite | null>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Detect Web Speech API support once mounted (client-only).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as unknown as {
      SpeechRecognition?: SpeechCtor;
      webkitSpeechRecognition?: SpeechCtor;
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (Ctor) setMicSupported(true);
  }, []);

  // Auto-scroll thread on new messages.
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  // Auto-grow the textarea up to ~4 lines.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [input]);

  function toggleMic() {
    if (!micSupported) return;
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const w = window as unknown as {
      SpeechRecognition?: SpeechCtor;
      webkitSpeechRecognition?: SpeechCtor;
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;
    const recog = new Ctor();
    recog.continuous = false;
    recog.interimResults = true;
    recog.lang = "en-US";
    recog.onresult = (e) => {
      let transcript = "";
      for (let i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      setInput(transcript);
    };
    recog.onerror = () => setListening(false);
    recog.onend = () => setListening(false);
    recognitionRef.current = recog;
    recog.start();
    setListening(true);
  }

  async function send(overrideText?: string) {
    const text = (overrideText ?? input).trim();
    if (!text || sending) return;
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
    }

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
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Trinity failed");
      if (data.conversation_id) setConversationId(data.conversation_id);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply || "Done.", actions: data.actions || [] },
      ]);
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

      {/* ─── Header: orb + tagline ─────────────────────────────── */}
      <div className={`relative flex flex-col items-center text-center transition-all duration-500 ${active ? "py-4" : "py-8 sm:py-10"}`}>
        <TrinityOrbVisual size={active ? "small" : "large"} pulsing={sending} />
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

      {/* ─── Conversation thread ───────────────────────────────── */}
      {active && (
        <div className="relative px-4 sm:px-6 pb-3 max-h-[360px] overflow-y-auto space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-gold/15 text-foreground border border-gold/25 rounded-br-sm"
                    : "bg-surface-light text-foreground border border-border rounded-bl-sm"
                }`}
              >
                {m.content}
                {m.actions && m.actions.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border/60 space-y-1">
                    {m.actions.map((a, j) => (
                      <div key={j} className="flex items-center gap-1.5 text-[10px] text-muted">
                        {a.ok ? (
                          <CheckCircle size={10} className="text-success" />
                        ) : (
                          <XCircle size={10} className="text-danger" />
                        )}
                        <span className="font-mono">{a.tool}</span>
                        {a.error && <span className="text-danger">— {a.error}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="bg-surface-light border border-border rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-gold animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-gold animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-gold animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}
          <div ref={threadEndRef} />
        </div>
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
            {micSupported && (
              <button
                type="button"
                onClick={toggleMic}
                title={listening ? "Stop listening" : "Speak to Trinity"}
                className={`absolute right-2 bottom-2 w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                  listening
                    ? "bg-danger/15 text-danger animate-pulse"
                    : "bg-surface-light text-muted hover:text-gold hover:bg-gold/10"
                }`}
              >
                {listening ? <MicOff size={14} /> : <Mic size={14} />}
              </button>
            )}
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

        {/* ─── Quick-action chips ──────────────────────────────── */}
        {!active && (
          <div className="flex flex-wrap gap-1.5 justify-center mt-4 max-w-2xl mx-auto">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setInput(s);
                  inputRef.current?.focus();
                }}
                className="text-[11px] px-3 py-1.5 rounded-full border border-border bg-surface-light text-muted hover:text-gold hover:border-gold/30 hover:bg-gold/5 transition-all"
              >
                {s}
              </button>
            ))}
          </div>
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

/**
 * The actual CSS 3D orb — nested radial gradients + slow rotation + breathing.
 * Not Three.js. Pure CSS + Tailwind + inline styles, no extra deps.
 */
function TrinityOrbVisual({ size, pulsing }: { size: "large" | "small"; pulsing: boolean }) {
  const px = size === "large" ? 150 : 72;
  return (
    <div
      className="relative"
      style={{ width: px, height: px }}
      aria-hidden
    >
      {/* outer glow */}
      <div
        className={`absolute inset-[-30%] rounded-full blur-2xl ${pulsing ? "animate-pulse" : ""}`}
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(200,168,85,0.55), rgba(200,168,85,0.15) 45%, transparent 70%)",
          animation: pulsing ? undefined : "trinity-breath 4s ease-in-out infinite",
        }}
      />
      {/* rotating highlight ring */}
      <div
        className="absolute inset-[-6%] rounded-full opacity-60"
        style={{
          background:
            "conic-gradient(from 0deg, rgba(200,168,85,0) 0%, rgba(200,168,85,0.55) 25%, rgba(139,92,246,0.4) 50%, rgba(59,130,246,0.35) 75%, rgba(200,168,85,0) 100%)",
          filter: "blur(6px)",
          animation: "trinity-spin 12s linear infinite",
        }}
      />
      {/* core sphere */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 32% 28%, #fff6d8 0%, #e8c870 18%, #c8a855 42%, #8a7032 72%, #241b08 100%)",
          boxShadow:
            "inset 0 -14px 28px rgba(0,0,0,0.55), inset 0 14px 28px rgba(255,235,180,0.2), 0 18px 40px -12px rgba(200,168,85,0.55)",
          animation: pulsing ? "trinity-breath 1.2s ease-in-out infinite" : "trinity-breath 5s ease-in-out infinite",
        }}
      />
      {/* specular highlight */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          top: "12%",
          left: "22%",
          width: "34%",
          height: "22%",
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.75), rgba(255,255,255,0) 70%)",
          filter: "blur(4px)",
        }}
      />
      {/* faint inner swirl — purple/blue depth hint */}
      <div
        className="absolute inset-[8%] rounded-full mix-blend-screen opacity-40"
        style={{
          background:
            "radial-gradient(circle at 70% 80%, rgba(139,92,246,0.5), transparent 55%), radial-gradient(circle at 20% 80%, rgba(59,130,246,0.45), transparent 50%)",
          animation: "trinity-spin 18s linear infinite reverse",
        }}
      />

      {/* keyframes — scoped inline so the component is drop-in */}
      <style jsx>{`
        @keyframes trinity-breath {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
        @keyframes trinity-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
