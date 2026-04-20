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
 */

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Mic, MicOff, Send, Sparkles, Loader, CheckCircle, XCircle, Volume2, VolumeX, Square } from "lucide-react";

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
  "Search for plumber leads in Dallas",
  "Send a $500 invoice to my newest client",
  "Schedule an Instagram post for tomorrow",
  "Generate a 30-day content plan for Acme",
  "What are my latest replies?",
];

export default function TrinityOrb({ firstName, clientId = null, suggestions = DEFAULT_SUGGESTIONS }: Props) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [micSupported, setMicSupported] = useState(false);
  // Text-to-speech state. `muted` persists in localStorage so the user's
  // mute choice sticks across sessions. `ttsSupported` gates the button.
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLite | null>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Audio element used to play ElevenLabs MP3. Kept in a ref so we can
  // cancel/stop it when the user mutes or sends a new message.
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Extract the current dashboard page slug (e.g. "script-lab", "ads-manager")
  // so Trinity can bias tool choice toward the page the user is viewing.
  const pathname = usePathname();
  const currentPage =
    pathname && pathname.startsWith("/dashboard/")
      ? pathname.replace(/^\/dashboard\//, "").split("/")[0] || null
      : null;

  // TTS is "supported" if the browser can play audio OR has SpeechSynthesis
  // as a fallback. We prefer ElevenLabs via /api/tts/speak (natural voice),
  // and fall back to the browser's built-in SpeechSynthesis only if the
  // ElevenLabs call fails (e.g. the env var isn't set on this deploy).
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
      stopAllAudio();
    };
    // stopAllAudio is stable (closure only reads refs) so no dep needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopAllAudio() {
    if (typeof window === "undefined") return;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
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
      // Hitting mute while speaking should stop immediately.
      if (next) stopAllAudio();
      return next;
    });
  }

  // Fallback path: browser SpeechSynthesis. Used when ALL server providers
  // (XTTS, OpenAI, ElevenLabs) are down. Picks the best available voice —
  // avoiding the robotic Microsoft David/Zira Desktop voices if at all
  // possible by preferring Windows neural voices ("Microsoft Aria Online
  // (Natural)"), Google voices, and Apple premium voices.
  function speakViaBrowser(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);

    const voices = window.speechSynthesis.getVoices();

    // Strongly prefer female neural voices. "Aria", "Jenny", "Nova" = natural.
    // Avoid "David", "Mark", "Zira Desktop" = robotic.
    const blocklist = /David|Mark|Zira Desktop|Zira - English|Microsoft Desktop|James|Richard|George|Hazel/i;
    const pickers: Array<(v: SpeechSynthesisVoice) => boolean> = [
      // Tier 1: Windows 11 neural voices (highest quality on Windows)
      (v) => /Aria.*Online.*Natural|Jenny.*Online.*Natural|Guy.*Online.*Natural/i.test(v.name),
      // Tier 2: Any "Natural" or "Neural" voice tagged English
      (v) => /Natural|Neural/i.test(v.name) && v.lang.startsWith("en") && !blocklist.test(v.name),
      // Tier 3: Apple premium voices (macOS / iOS)
      (v) => /Samantha|Serena|Ava|Allison/.test(v.name),
      // Tier 4: Google voices (Chrome on any OS)
      (v) => /Google.*US English|Google.*UK English.*Female/i.test(v.name),
      (v) => v.name.startsWith("Google") && v.lang.startsWith("en"),
      // Tier 5: Any en-US voice that isn't blocklisted
      (v) => v.lang === "en-US" && !blocklist.test(v.name),
      // Tier 6: Any English voice that isn't blocklisted
      (v) => v.lang.startsWith("en") && !blocklist.test(v.name),
      // Last resort: any English voice
      (v) => v.lang.startsWith("en"),
    ];
    let pickedName: string | null = null;
    for (const pick of pickers) {
      const found = voices.find(pick);
      if (found) {
        utter.voice = found;
        pickedName = found.name;
        break;
      }
    }

    // Debug: tell the user which fallback voice we landed on. Makes the
    // "why do I hear Microsoft David" question answerable from the console.
    console.log(`[trinity/tts] browser fallback voice: ${pickedName || "(default)"}`);

    utter.rate = 1.0;
    utter.pitch = 1.0;
    utter.volume = 1.0;
    utter.onstart = () => setSpeaking(true);
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utter);
  }

  // Strip characters that TTS engines mispronounce: emoji (read as their
  // CLDR name like "waving hand"), markdown symbols, and URLs.
  // Built via `new RegExp()` so we don't need the ES2018 `u` flag.
  const EMOJI_RE = new RegExp(
    // Surrogate pairs (most modern emoji live above U+FFFF)
    "[\\uD800-\\uDBFF][\\uDC00-\\uDFFF]" +
      "|" +
      // BMP pictograph ranges + variation selector + zero-width joiner
      "[\\u2600-\\u27BF\\uFE0F\\u200D]",
    "g",
  );
  function sanitizeForSpeech(text: string): string {
    return text
      .replace(EMOJI_RE, "")
      // Strip markdown emphasis/code/link markers that get read as "asterisk"
      .replace(/\*\*|__|`{1,3}|~~/g, "")
      // Collapse markdown links [text](url) → text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      // Replace bare URLs with "link" so TTS doesn't spell out the whole URL
      .replace(/https?:\/\/\S+/g, "link")
      // Collapse whitespace
      .replace(/\s+/g, " ")
      .trim();
  }

  // Primary path: /api/tts/speak. Provider cascade on the server:
  // XTTS (free) → OpenAI → ElevenLabs → 501. Falls back to browser only
  // if ALL server providers fail.
  async function speak(text: string) {
    if (muted || !text) return;
    if (typeof window === "undefined") return;

    const cleaned = sanitizeForSpeech(text);
    if (!cleaned) return;

    // Stop anything that's already playing.
    stopAllAudio();

    try {
      const res = await fetch("/api/tts/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cleaned }),
      });
      if (!res.ok) {
        const debug = await res.json().catch(() => ({}));
        console.error(
          `[trinity/tts] /api/tts/speak ${res.status} — server providers all failed. See attempts below. Falling back to browser voice.`,
          debug,
        );
        throw new Error(`tts returned ${res.status}`);
      }
      const provider = res.headers.get("x-tts-provider") || "unknown";
      console.log(`[trinity/tts] ✓ audio via ${provider}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.volume = 1.0;
      audioRef.current = audio;
      setSpeaking(true);
      audio.onended = () => {
        setSpeaking(false);
        URL.revokeObjectURL(url);
        if (audioRef.current === audio) audioRef.current = null;
      };
      audio.onerror = () => {
        setSpeaking(false);
        URL.revokeObjectURL(url);
        if (audioRef.current === audio) audioRef.current = null;
      };
      await audio.play();
    } catch {
      // All server providers unavailable — fall back to browser
      // SpeechSynthesis with the sanitized text (no emoji mispronunciation).
      speakViaBrowser(cleaned);
    }
  }

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

  // Auto-scroll thread on new messages. Scroll the thread container only,
  // not the document — otherwise the whole page jumps when a new message
  // arrives or while the user is typing.
  useEffect(() => {
    const end = threadEndRef.current;
    const container = end?.parentElement;
    if (container) container.scrollTop = container.scrollHeight;
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
      speak(replyText);
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

      {/* ─── Stop-speaking + mute controls for Trinity's voice ──── */}
      {ttsSupported && (
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
          {speaking && !muted && (
            <button
              type="button"
              onClick={stopAllAudio}
              title="Stop speaking"
              className="w-8 h-8 rounded-xl flex items-center justify-center bg-danger/15 text-danger hover:bg-danger/25 transition-all"
            >
              <Square size={12} fill="currentColor" />
            </button>
          )}
          <button
            type="button"
            onClick={toggleMute}
            title={muted ? "Unmute Trinity's voice" : "Mute Trinity's voice"}
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
              muted
                ? "bg-surface-light text-muted hover:text-gold"
                : speaking
                ? "bg-gold/15 text-gold animate-pulse"
                : "bg-surface-light text-gold hover:bg-gold/10"
            }`}
          >
            {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
        </div>
      )}

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
 * Trinity Persona — a stylized faceted low-poly 3D head built with SVG.
 *
 * No Three.js, no extra deps. Just SVG polygons shaded with brand-gold
 * gradients, plus a cursor-tracked subtle head turn, glowing eyes, and
 * a jaw that animates when "thinking" / "listening".
 *
 * States:
 *  - idle      : slow breathing, slow ambient ring rotation, eyes track cursor
 *  - thinking  : faster ring spin, scanline sweep across face, jaw murmurs
 *  - listening : wide concentric voice rings, brightened eyes, alert posture
 *
 * Honors prefers-reduced-motion (animations damped or stilled).
 */
type TrinityState = "idle" | "thinking" | "listening";

function TrinityOrbVisual({
  size,
  pulsing,
  state = "idle",
}: {
  size: "large" | "small";
  pulsing: boolean;
  state?: TrinityState;
}) {
  const px = size === "large" ? 170 : 80;
  const wrapRef = useRef<HTMLDivElement>(null);
  // Head turn (-1..1 on each axis) driven by cursor position relative to component.
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [reduced, setReduced] = useState(false);

  // Detect reduced motion preference once.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  // Cursor-tracked head turn — subtle parallax, capped at ~12deg.
  useEffect(() => {
    if (reduced) return;
    function onMove(e: MouseEvent) {
      const el = wrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      // Distance falloff so far-away cursors don't pin the head sideways.
      const dx = (e.clientX - cx) / Math.max(window.innerWidth / 2, 1);
      const dy = (e.clientY - cy) / Math.max(window.innerHeight / 2, 1);
      setTilt({
        x: Math.max(-1, Math.min(1, dx)),
        y: Math.max(-1, Math.min(1, dy)),
      });
    }
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [reduced]);

  // Animation timing knobs per state.
  const ringSpeed = state === "thinking" ? "5s" : state === "listening" ? "8s" : "16s";
  const breathSpeed = pulsing ? "1.4s" : state === "listening" ? "2.2s" : "5s";
  const eyeIntensity = state === "listening" ? 1 : state === "thinking" ? 0.8 : 0.55;
  const tiltDeg = reduced ? { x: 0, y: 0 } : { x: tilt.x * 10, y: tilt.y * -8 };
  const eyeOffset = reduced ? { x: 0, y: 0 } : { x: tilt.x * 1.2, y: tilt.y * 1.0 };

  // Voice listening rings render only in listening mode.
  const voiceRings = state === "listening" ? [0, 1, 2] : [];

  const ariaLabel =
    state === "thinking"
      ? "Trinity is thinking"
      : state === "listening"
      ? "Trinity is listening"
      : "Trinity AI assistant";

  return (
    <div
      ref={wrapRef}
      className="relative select-none"
      style={{ width: px, height: px, perspective: 600 }}
      role="img"
      aria-label={ariaLabel}
    >
      {/* outer aurora glow — always behind */}
      <div
        className="absolute inset-[-32%] rounded-full blur-2xl pointer-events-none"
        style={{
          background:
            state === "listening"
              ? "radial-gradient(circle at 50% 50%, rgba(200,168,85,0.55), rgba(139,92,246,0.25) 45%, transparent 72%)"
              : state === "thinking"
              ? "radial-gradient(circle at 50% 50%, rgba(200,168,85,0.50), rgba(59,130,246,0.20) 50%, transparent 75%)"
              : "radial-gradient(circle at 50% 50%, rgba(200,168,85,0.40), rgba(200,168,85,0.10) 50%, transparent 70%)",
          animation: reduced ? undefined : `trinity-breath ${breathSpeed} ease-in-out infinite`,
        }}
        aria-hidden
      />

      {/* rotating conic ring — accent halo */}
      <div
        className="absolute inset-[-4%] rounded-full opacity-70 pointer-events-none"
        style={{
          background:
            "conic-gradient(from 0deg, rgba(200,168,85,0) 0%, rgba(200,168,85,0.55) 22%, rgba(139,92,246,0.40) 50%, rgba(59,130,246,0.35) 78%, rgba(200,168,85,0) 100%)",
          filter: "blur(5px)",
          animation: reduced ? undefined : `trinity-spin ${ringSpeed} linear infinite`,
        }}
        aria-hidden
      />

      {/* voice-reactive concentric rings (listening only) */}
      {voiceRings.map((i) => (
        <div
          key={i}
          aria-hidden
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            border: "1px solid rgba(200,168,85,0.55)",
            animation: reduced
              ? undefined
              : `trinity-voicering 1.6s ease-out ${i * 0.5}s infinite`,
            opacity: 0,
          }}
        />
      ))}

      {/* The faceted head — wrapped in a 3D-tilt container */}
      <div
        className="absolute inset-0"
        style={{
          transformStyle: "preserve-3d",
          transform: `rotateY(${tiltDeg.x}deg) rotateX(${tiltDeg.y}deg)`,
          transition: "transform 350ms cubic-bezier(0.22, 1, 0.36, 1)",
          animation: reduced ? undefined : `trinity-breath ${breathSpeed} ease-in-out infinite`,
        }}
      >
        <svg
          viewBox="0 0 100 100"
          width={px}
          height={px}
          className="overflow-visible block"
          aria-hidden
        >
          <defs>
            {/* Brand-gold gradient for facets — light side */}
            <linearGradient id="trinity-facet-light" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fff1c2" />
              <stop offset="55%" stopColor="#e8c870" />
              <stop offset="100%" stopColor="#c8a855" />
            </linearGradient>
            <linearGradient id="trinity-facet-mid" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#d8b766" />
              <stop offset="55%" stopColor="#c8a855" />
              <stop offset="100%" stopColor="#8a7032" />
            </linearGradient>
            <linearGradient id="trinity-facet-dark" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8a7032" />
              <stop offset="55%" stopColor="#5a4720" />
              <stop offset="100%" stopColor="#241b08" />
            </linearGradient>
            {/* Eye glow */}
            <radialGradient id="trinity-eye" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
              <stop offset="40%" stopColor="#ffe9a8" stopOpacity={eyeIntensity} />
              <stop offset="100%" stopColor="#c8a855" stopOpacity="0" />
            </radialGradient>
            {/* Scanline mask for "thinking" */}
            <linearGradient id="trinity-scan" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(255,247,210,0)" />
              <stop offset="50%" stopColor="rgba(255,247,210,0.7)" />
              <stop offset="100%" stopColor="rgba(255,247,210,0)" />
            </linearGradient>
          </defs>

          {/* ─── Head silhouette (low-poly facets, viewed 3/4) ────────── */}
          <g>
            {/* Forehead/crown — light */}
            <polygon points="32,22 50,12 68,22 60,32 40,32" fill="url(#trinity-facet-light)" />
            {/* Top-right temple — mid */}
            <polygon points="68,22 78,34 70,42 60,32" fill="url(#trinity-facet-mid)" />
            {/* Top-left temple — light */}
            <polygon points="32,22 22,34 30,42 40,32" fill="url(#trinity-facet-light)" opacity="0.92" />
            {/* Right cheek — dark (shadow side) */}
            <polygon points="78,34 80,52 70,58 70,42" fill="url(#trinity-facet-dark)" />
            {/* Left cheek — mid */}
            <polygon points="22,34 20,52 30,58 30,42" fill="url(#trinity-facet-mid)" opacity="0.95" />
            {/* Mid-face plane (around eyes / nose bridge) — light */}
            <polygon points="40,32 60,32 70,42 65,52 50,50 35,52 30,42" fill="url(#trinity-facet-light)" />
            {/* Nose ridge — light triangle */}
            <polygon points="50,42 54,56 46,56" fill="url(#trinity-facet-light)" opacity="0.9" />
            {/* Right cheek-to-jaw — mid */}
            <polygon points="65,52 70,58 64,68 54,64" fill="url(#trinity-facet-mid)" />
            {/* Left cheek-to-jaw — mid */}
            <polygon points="35,52 30,58 36,68 46,64" fill="url(#trinity-facet-mid)" opacity="0.95" />
            {/* Mouth plane — dark */}
            <polygon points="46,64 54,64 50,72" fill="url(#trinity-facet-dark)" />
            {/* Jaw — animates open/close on thinking & listening */}
            <g
              style={{
                transformOrigin: "50px 64px",
                animation:
                  reduced || state === "idle"
                    ? undefined
                    : state === "listening"
                    ? "trinity-jaw 0.6s ease-in-out infinite"
                    : "trinity-jaw 1.1s ease-in-out infinite",
              }}
            >
              <polygon points="36,68 64,68 58,80 50,84 42,80" fill="url(#trinity-facet-dark)" />
              <polygon points="50,72 58,80 50,84" fill="url(#trinity-facet-mid)" opacity="0.85" />
              <polygon points="50,72 42,80 50,84" fill="url(#trinity-facet-mid)" opacity="0.75" />
            </g>

            {/* Wireframe edge overlay — gives the "AI lattice" feel */}
            <g
              fill="none"
              stroke="rgba(255,235,180,0.18)"
              strokeWidth="0.4"
              strokeLinejoin="round"
            >
              <polyline points="32,22 50,12 68,22" />
              <polyline points="22,34 32,22" />
              <polyline points="68,22 78,34" />
              <polyline points="22,34 20,52 30,58 36,68 42,80 50,84 58,80 64,68 70,58 80,52 78,34" />
              <line x1="40" y1="32" x2="60" y2="32" />
              <line x1="30" y1="42" x2="70" y2="42" />
              <line x1="35" y1="52" x2="65" y2="52" />
              <line x1="46" y1="64" x2="54" y2="64" />
              <line x1="50" y1="42" x2="50" y2="56" />
              <line x1="40" y1="32" x2="30" y2="42" />
              <line x1="60" y1="32" x2="70" y2="42" />
              <line x1="35" y1="52" x2="30" y2="58" />
              <line x1="65" y1="52" x2="70" y2="58" />
            </g>

            {/* ─── Eyes — glowing gold orbs that follow the cursor ─── */}
            <g
              style={{
                transform: `translate(${eyeOffset.x}px, ${eyeOffset.y}px)`,
                transition: "transform 220ms ease-out",
              }}
            >
              {/* Halo */}
              <circle cx="42" cy="46" r="5" fill="url(#trinity-eye)" />
              <circle cx="58" cy="46" r="5" fill="url(#trinity-eye)" />
              {/* Iris core */}
              <circle
                cx="42"
                cy="46"
                r="1.6"
                fill="#fff7d8"
                style={{
                  animation: reduced
                    ? undefined
                    : state === "thinking"
                    ? "trinity-blink 2.4s ease-in-out infinite"
                    : "trinity-blink 5.5s ease-in-out infinite",
                  transformOrigin: "42px 46px",
                }}
              />
              <circle
                cx="58"
                cy="46"
                r="1.6"
                fill="#fff7d8"
                style={{
                  animation: reduced
                    ? undefined
                    : state === "thinking"
                    ? "trinity-blink 2.4s ease-in-out infinite"
                    : "trinity-blink 5.5s ease-in-out infinite",
                  transformOrigin: "58px 46px",
                }}
              />
            </g>

            {/* Specular highlight on the brow — sells the 3D form */}
            <ellipse
              cx="44"
              cy="22"
              rx="9"
              ry="2.4"
              fill="rgba(255,247,210,0.45)"
              transform="rotate(-15 44 22)"
            />

            {/* Scanline (thinking only) */}
            {state === "thinking" && !reduced && (
              <rect
                x="18"
                y="0"
                width="64"
                height="6"
                fill="url(#trinity-scan)"
                style={{
                  animation: "trinity-scan 2.6s linear infinite",
                  mixBlendMode: "screen",
                }}
              />
            )}
          </g>
        </svg>
      </div>

      {/* keyframes — scoped to the visual */}
      <style jsx>{`
        @keyframes trinity-breath {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.045); }
        }
        @keyframes trinity-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes trinity-voicering {
          0% { transform: scale(0.85); opacity: 0.65; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes trinity-jaw {
          0%, 100% { transform: scaleY(1) translateY(0); }
          50% { transform: scaleY(1.18) translateY(1px); }
        }
        @keyframes trinity-blink {
          0%, 92%, 100% { transform: scaleY(1); }
          95% { transform: scaleY(0.1); }
        }
        @keyframes trinity-scan {
          0% { transform: translateY(10px); opacity: 0; }
          15% { opacity: 0.9; }
          85% { opacity: 0.9; }
          100% { transform: translateY(95px); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          :global(*) { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; }
        }
      `}</style>
    </div>
  );
}
