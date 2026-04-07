"use client";

import { useState, useRef, useEffect } from "react";
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

export default function PageAI({ pageName, context, suggestions, accentColor = "gold" }: PageAIProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

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

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className={`fixed bottom-20 right-6 z-40 w-12 h-12 rounded-full bg-${accentColor}/10 border border-${accentColor}/20 flex items-center justify-center text-${accentColor} hover:scale-110 hover:shadow-[0_0_20px_rgba(201,168,76,0.3)] transition-all duration-300 group`}
        style={{ background: "rgba(201,168,76,0.08)", borderColor: "rgba(201,168,76,0.2)" }}
      >
        <Sparkles size={20} className="text-gold group-hover:animate-spin" />
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-gold rounded-full animate-pulse" />
      </button>
    );
  }

  if (minimized) {
    return (
      <button onClick={() => setMinimized(false)}
        className="fixed bottom-20 right-6 z-40 flex items-center gap-2 px-3 py-2 rounded-full bg-surface border border-gold/20 text-xs text-gold hover:bg-surface-light transition-all"
      >
        <Bot size={14} /> {pageName} AI
        <span className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-20 right-6 z-40 w-[380px] max-h-[500px] flex flex-col bg-surface border border-border/50 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-surface-light/30">
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
          <button onClick={() => setMinimized(true)} className="p-1 rounded hover:bg-surface-light text-muted hover:text-white transition-colors">
            <Minimize2 size={12} />
          </button>
          <button onClick={() => { setOpen(false); setMessages([]); }} className="p-1 rounded hover:bg-surface-light text-muted hover:text-white transition-colors">
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
                  className="w-full text-left text-[10px] p-2 rounded-lg border border-border/20 hover:border-gold/20 text-muted hover:text-white transition-all">
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
                  className="mt-1 text-[8px] text-muted hover:text-white flex items-center gap-0.5">
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
