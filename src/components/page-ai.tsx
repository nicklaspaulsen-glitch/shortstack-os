"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, Send, X, Sparkles, Loader, Copy, Minimize2 } from "lucide-react";
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
      setMessages(prev => [...prev, { role: "ai", content: data.reply || "No response." }]);
    } catch {
      setMessages(prev => [...prev, { role: "ai", content: "Connection error. Try again." }]);
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
        className="w-12 h-12 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing hover:scale-110 hover:shadow-[0_0_20px_rgba(201,168,76,0.3)] transition-all duration-300 group touch-none select-none"
        role="button"
        aria-label={`Open ${pageName} AI`}
        tabIndex={0}
      >
        <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.2)" }}>
          <Sparkles size={20} className="text-gold group-hover:animate-spin pointer-events-none" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-gold rounded-full animate-pulse pointer-events-none" />
        </div>
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

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-xl px-3 py-2 ${
              msg.role === "user"
                ? "bg-gold/10 border border-gold/15"
                : "bg-surface-light/50 border border-border/20"
            }`}>
              <p className="text-[11px] whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              {msg.role === "ai" && (
                <button onClick={() => { navigator.clipboard.writeText(msg.content); toast.success("Copied!"); }}
                  className="mt-1 text-[8px] text-muted hover:text-foreground flex items-center gap-0.5">
                  <Copy size={8} /> Copy
                </button>
              )}
            </div>
          </div>
        ))}

        {thinking && (
          <div className="flex justify-start">
            <div className="bg-surface-light/50 border border-border/20 rounded-xl px-3 py-2 flex items-center gap-1.5">
              <Loader size={10} className="animate-spin text-gold" />
              <span className="text-[10px] text-muted">Thinking...</span>
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
    </div>
  );
}
