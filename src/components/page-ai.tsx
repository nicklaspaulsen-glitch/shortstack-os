"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, Send, X, Sparkles, Copy, Minimize2 } from "lucide-react";
import toast from "react-hot-toast";

interface PageAIProps {
  pageName: string;
  context: string;
  suggestions: string[];
  accentColor?: string;
}

interface Message {
  role: "user" | "ai";
  content: string;
  streaming?: boolean;
  displayed?: string; // partial text shown during streaming
}

// Typing dots indicator — 3 dots that pulse with theme color
function TypingDots() {
  return (
    <div className="flex items-center gap-1">
      <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse-dot" style={{ animationDelay: "0ms" }} />
      <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse-dot" style={{ animationDelay: "150ms" }} />
      <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse-dot" style={{ animationDelay: "300ms" }} />
      <style jsx>{`
        @keyframes pulse-dot {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.1); }
        }
        :global(.animate-pulse-dot) {
          animation: pulse-dot 1.2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

export default function PageAI({ pageName, context, suggestions, accentColor: _accentColor = "gold" }: PageAIProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Drag state
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null);
  const elRef = useRef<HTMLDivElement>(null);

  // Initialize position to bottom-right on first render
  useEffect(() => {
    if (!pos) {
      setPos({ x: window.innerWidth - 64, y: window.innerHeight - 120 });
    }
  }, [pos]);

  // Keep in bounds on resize
  useEffect(() => {
    const onResize = () => {
      setPos(prev => {
        if (!prev) return prev;
        return {
          x: Math.min(prev.x, window.innerWidth - 48),
          y: Math.min(prev.y, window.innerHeight - 48),
        };
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const el = elRef.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: pos?.x ?? 0,
      origY: pos?.y ?? 0,
      moved: false,
    };
  }, [pos]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragRef.current.moved = true;
    const newX = Math.max(0, Math.min(window.innerWidth - 48, dragRef.current.origX + dx));
    const newY = Math.max(0, Math.min(window.innerHeight - 48, dragRef.current.origY + dy));
    setPos({ x: newX, y: newY });
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const wasDrag = dragRef.current?.moved;
    dragRef.current = null;
    const el = elRef.current;
    if (el) el.releasePointerCapture(e.pointerId);
    // Only toggle open if it wasn't a drag
    if (!wasDrag && !open) setOpen(true);
  }, [open]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Character-by-character streaming effect for the latest AI message
  const streamText = useCallback((full: string) => {
    const chunkSize = 2; // characters per tick
    const interval = 12; // ms per tick
    let i = 0;
    const timer = setInterval(() => {
      i = Math.min(full.length, i + chunkSize);
      setMessages(prev => {
        const next = [...prev];
        const lastIdx = next.length - 1;
        if (lastIdx < 0 || next[lastIdx].role !== "ai") return prev;
        next[lastIdx] = { ...next[lastIdx], displayed: full.slice(0, i), streaming: i < full.length };
        return next;
      });
      if (i >= full.length) clearInterval(timer);
    }, interval);
  }, []);

  async function sendMessage(text?: string) {
    const msg = (text || input).trim();
    if (!msg || thinking) return;
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: msg }]);
    setThinking(true);

    try {
      const res = await fetch("/api/agents/chief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          history: messages.slice(-8),
          system_context: `You are an AI assistant embedded in the ${pageName} page of ShortStack OS (a digital marketing agency platform). The user is currently working on this page. Here is the current page context:\n\n${context}\n\nHelp the user with tasks related to this page. Be specific, actionable, and concise. No markdown formatting. If they ask you to generate content, actually generate it fully.`,
        }),
      });
      const data = await res.json();
      const reply = data.reply || "No response.";
      // Append AI message with empty displayed, then stream it in
      setMessages(prev => [...prev, { role: "ai", content: reply, streaming: true, displayed: "" }]);
      // Slight delay before streaming kicks in so the typing indicator is briefly visible
      setTimeout(() => streamText(reply), 80);
    } catch {
      setMessages(prev => [...prev, { role: "ai", content: "Connection error. Try again.", displayed: "Connection error. Try again." }]);
    }
    setThinking(false);
  }

  const bubbleStyle = pos ? { position: "fixed" as const, left: pos.x, top: pos.y, zIndex: 40 } : { position: "fixed" as const, bottom: 80, right: 24, zIndex: 40 };
  const panelStyle = pos ? { position: "fixed" as const, left: Math.min(pos.x - 340, window.innerWidth - 400), top: Math.max(16, pos.y - 460), zIndex: 40 } : { position: "fixed" as const, bottom: 80, right: 24, zIndex: 40 };

  if (!open) {
    return (
      <div
        ref={elRef}
        style={bubbleStyle}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="orb-launcher relative w-12 h-12 cursor-grab active:cursor-grabbing group touch-none select-none"
        role="button"
        aria-label={`Open ${pageName} AI`}
        tabIndex={0}
      >
        {/* Outer pulsing halo */}
        <span className="orb-halo pointer-events-none" />
        <span className="orb-halo orb-halo-delay pointer-events-none" />

        {/* Floating sparkle particles */}
        <span className="orb-sparkle orb-sparkle-1 pointer-events-none" />
        <span className="orb-sparkle orb-sparkle-2 pointer-events-none" />
        <span className="orb-sparkle orb-sparkle-3 pointer-events-none" />

        {/* Main gold-to-amber orb */}
        <div className="orb-body w-12 h-12 rounded-full flex items-center justify-center relative overflow-hidden">
          <Sparkles size={18} className="text-white drop-shadow-[0_0_6px_rgba(255,220,130,0.9)] pointer-events-none relative z-10 group-hover:rotate-12 transition-transform" />
          {/* Inner gloss highlight */}
          <span className="absolute top-1 left-2 w-3 h-2 bg-white/40 rounded-full blur-sm pointer-events-none" />
        </div>

        <style jsx>{`
          .orb-launcher {
            filter: drop-shadow(0 4px 18px rgba(201, 168, 76, 0.45));
          }
          .orb-body {
            background: radial-gradient(circle at 35% 30%, #ffe28a 0%, #f5c03c 35%, #c9a84c 70%, #8c6d1a 100%);
            border: 1px solid rgba(255, 220, 130, 0.6);
            box-shadow:
              inset 0 0 10px rgba(255, 240, 190, 0.4),
              0 0 20px rgba(201, 168, 76, 0.5);
            animation: orb-breathe 3.2s ease-in-out infinite;
            transition: transform 0.3s ease;
          }
          .orb-launcher:hover .orb-body {
            transform: rotate(8deg) scale(1.08);
            box-shadow:
              inset 0 0 14px rgba(255, 240, 190, 0.6),
              0 0 32px rgba(255, 200, 90, 0.7);
          }
          @keyframes orb-breathe {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
          }
          .orb-halo {
            position: absolute;
            inset: 0;
            border-radius: 9999px;
            background: radial-gradient(circle, rgba(201,168,76,0.5) 0%, transparent 70%);
            animation: orb-halo-pulse 2.4s ease-out infinite;
          }
          .orb-halo-delay {
            animation-delay: 1.2s;
          }
          @keyframes orb-halo-pulse {
            0% { transform: scale(1); opacity: 0.7; }
            100% { transform: scale(1.9); opacity: 0; }
          }
          .orb-sparkle {
            position: absolute;
            width: 3px;
            height: 3px;
            border-radius: 9999px;
            background: #ffe9a3;
            box-shadow: 0 0 6px #ffd86b;
          }
          .orb-sparkle-1 {
            top: -4px;
            left: 8px;
            animation: orb-float-1 3.8s ease-in-out infinite;
          }
          .orb-sparkle-2 {
            top: 10px;
            right: -4px;
            animation: orb-float-2 4.4s ease-in-out infinite;
            animation-delay: 0.6s;
          }
          .orb-sparkle-3 {
            bottom: -2px;
            left: 22px;
            animation: orb-float-3 3.2s ease-in-out infinite;
            animation-delay: 1.2s;
          }
          @keyframes orb-float-1 {
            0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.9; }
            50% { transform: translate(-6px, -10px) scale(0.6); opacity: 0.3; }
          }
          @keyframes orb-float-2 {
            0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.8; }
            50% { transform: translate(8px, -6px) scale(0.5); opacity: 0.2; }
          }
          @keyframes orb-float-3 {
            0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.9; }
            50% { transform: translate(-4px, 10px) scale(0.6); opacity: 0.3; }
          }
        `}</style>
      </div>
    );
  }

  if (minimized) {
    return (
      <div
        ref={elRef}
        style={bubbleStyle}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(e) => { const wasDrag = dragRef.current?.moved; dragRef.current = null; elRef.current?.releasePointerCapture(e.pointerId); if (!wasDrag) setMinimized(false); }}
        className="flex items-center gap-2 px-3 py-2 rounded-full bg-surface border border-gold/20 text-xs text-gold hover:bg-surface-light transition-all cursor-grab active:cursor-grabbing touch-none select-none"
      >
        <Bot size={14} /> {pageName} AI
        <span className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
      </div>
    );
  }

  return (
    <div style={panelStyle} className="w-[380px] max-h-[500px] flex flex-col bg-surface border border-border/50 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden fade-in">
      {/* Header — draggable */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-surface-light/30 cursor-grab active:cursor-grabbing"
        onMouseDown={(e) => {
          const startX = e.clientX;
          const startY = e.clientY;
          const origX = pos?.x ?? 0;
          const origY = pos?.y ?? 0;
          let moved = false;
          const onMove = (ev: MouseEvent) => {
            const dx = ev.clientX - startX;
            const dy = ev.clientY - startY;
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
            if (moved) {
              setPos({
                x: Math.max(0, Math.min(window.innerWidth - 380, origX + dx)),
                y: Math.max(0, Math.min(window.innerHeight - 100, origY + dy)),
              });
            }
          };
          const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
          document.addEventListener("mousemove", onMove);
          document.addEventListener("mouseup", onUp);
        }}
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gold/10 flex items-center justify-center">
            <Sparkles size={14} className="text-gold" />
          </div>
          <div>
            <p className="text-xs font-semibold">{pageName} AI</p>
            <p className="text-[9px] text-success flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-success" /> Ready
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setMinimized(true)} className="p-1 rounded hover:bg-surface-light text-muted hover:text-foreground transition-colors">
            <Minimize2 size={12} />
          </button>
          <button onClick={() => { setOpen(false); setMessages([]); }} className="p-1 rounded hover:bg-surface-light text-muted hover:text-foreground transition-colors">
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 max-h-[320px]">
        {messages.length === 0 && (
          <div className="text-center py-4">
            <Sparkles size={20} className="mx-auto mb-2 text-gold/30" />
            <p className="text-[10px] text-muted mb-3">Ask me anything about this page</p>
            <div className="space-y-1">
              {suggestions.map((s, i) => (
                <button key={i} onClick={() => sendMessage(s)}
                  className="w-full text-left text-[10px] p-2 rounded-lg border border-border/20 hover:border-gold/20 text-muted hover:text-foreground transition-all">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          const displayText = msg.role === "ai"
            ? (msg.displayed !== undefined ? msg.displayed : msg.content)
            : msg.content;
          const isStreaming = msg.streaming && msg.role === "ai";
          return (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-xl px-3 py-2 ${
                msg.role === "user"
                  ? "bg-gold/10 border border-gold/15"
                  : "bg-surface-light/50 border border-border/20"
              }`}>
                <p className="text-[11px] whitespace-pre-wrap leading-relaxed">
                  {displayText}
                  {isStreaming && (
                    <span className="stream-cursor inline-block align-middle ml-0.5 w-[2px] h-3 bg-gold" />
                  )}
                </p>
                {msg.role === "ai" && !isStreaming && (
                  <button onClick={() => { navigator.clipboard.writeText(msg.content); toast.success("Copied!"); }}
                    className="mt-1 text-[8px] text-muted hover:text-foreground flex items-center gap-0.5">
                    <Copy size={8} /> Copy
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {thinking && (
          <div className="flex justify-start">
            <div className="bg-surface-light/50 border border-border/20 rounded-xl px-3 py-2.5 flex items-center gap-1.5">
              <TypingDots />
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
        className="border-t border-border/30 px-3 py-2 flex gap-2">
        <input type="text" value={input} onChange={e => setInput(e.target.value)}
          placeholder={`Ask ${pageName} AI...`}
          className="flex-1 bg-transparent text-xs placeholder-muted/50 outline-none"
          disabled={thinking} />
        <button type="submit" disabled={!input.trim() || thinking}
          className="w-7 h-7 rounded-lg bg-gold/10 flex items-center justify-center text-gold disabled:opacity-30 hover:bg-gold/20 transition-colors">
          <Send size={12} />
        </button>
      </form>

      <style jsx>{`
        .stream-cursor {
          box-shadow: 0 0 6px rgba(201, 168, 76, 0.9), 0 0 10px rgba(255, 210, 100, 0.6);
          animation: stream-blink 0.8s step-end infinite;
        }
        @keyframes stream-blink {
          0%, 50% { opacity: 1; }
          50.01%, 100% { opacity: 0.15; }
        }
      `}</style>
    </div>
  );
}
