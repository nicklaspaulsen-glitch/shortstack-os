"use client";

import { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, X, Minimize2 } from "lucide-react";
import Image from "next/image";
import Draggable from "@/components/ui/draggable";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function ClientChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Hey! I'm Trinity, your personal AI assistant. Ask me anything about your account, services, content, or marketing strategy." },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    if (!input.trim() || sending) return;

    const userMsg: ChatMessage = { role: "user", content: input };
    setMessages(prev => [...prev, userMsg]);
    const msg = input;
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/trinity/client-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "text/event-stream" },
        body: JSON.stringify({ message: msg }),
      });

      if (res.headers.get("content-type")?.includes("text/event-stream") && res.body) {
        // Streaming response
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";
        setMessages(prev => [...prev, { role: "assistant", content: "..." }]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            try {
              const event = JSON.parse(line.slice(6));
              if (event.text) {
                fullText += event.text;
                setMessages(prev => {
                  const copy = [...prev];
                  copy[copy.length - 1] = { role: "assistant", content: fullText };
                  return copy;
                });
              }
              if (event.done && event.fullText) fullText = event.fullText;
            } catch {}
          }
        }
      } else {
        const data = await res.json();
        setMessages(prev => [...prev, { role: "assistant", content: data.reply || "Sorry, I couldn't process that." }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "I'm having trouble connecting. Please try again." }]);
    }
    setSending(false);
  }

  // Check if hidden via settings
  const [hidden] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("hide_chat_bubble") === "true";
  });
  if (hidden) return null;

  if (!isOpen) {
    const unreadCount = messages.filter(m => m.role === "assistant").length - 1; // excluding the initial greeting; could be wired to real unread later
    return (
      <Draggable
        dragAnywhere
        defaultX={typeof window !== "undefined" ? window.innerWidth - 438 : 800}
        defaultY={typeof window !== "undefined" ? window.innerHeight - 80 : 700}
        storageKey="chat_bubble_v2"
      >
        <button
          onClick={() => setIsOpen(true)}
          aria-label="Open Trinity AI chat"
          className="trinity-orb relative w-14 h-14 rounded-full flex items-center justify-center cursor-pointer group"
        >
          {/* Pulsing halos */}
          <span className="trinity-halo pointer-events-none" />
          <span className="trinity-halo trinity-halo-delay pointer-events-none" />

          {/* Main gradient orb */}
          <div className="trinity-body w-14 h-14 rounded-full flex items-center justify-center relative overflow-hidden">
            <MessageSquare size={22} className="text-black relative z-10 group-hover:rotate-6 transition-transform" />
            {/* Inner gloss */}
            <span className="absolute top-1.5 left-2 w-3.5 h-2 bg-white/50 rounded-full blur-sm pointer-events-none" />
          </div>

          {/* Unread dot */}
          {unreadCount > 0 && (
            <span className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full bg-red-500 border-2 border-black animate-pulse z-20" />
          )}

          <style jsx>{`
            .trinity-orb {
              filter: drop-shadow(0 4px 18px rgba(201, 168, 76, 0.45));
            }
            .trinity-body {
              background: radial-gradient(circle at 35% 30%, #ffe28a 0%, #f5c03c 35%, #c9a84c 70%, #8c6d1a 100%);
              border: 1px solid rgba(255, 220, 130, 0.6);
              box-shadow:
                inset 0 0 10px rgba(255, 240, 190, 0.4),
                0 0 20px rgba(201, 168, 76, 0.5);
              animation: trinity-breathe 3.2s ease-in-out infinite;
              transition: transform 0.3s ease;
            }
            .trinity-orb:hover .trinity-body {
              transform: rotate(6deg) scale(1.08);
              box-shadow:
                inset 0 0 14px rgba(255, 240, 190, 0.6),
                0 0 32px rgba(255, 200, 90, 0.7);
            }
            .trinity-orb:active .trinity-body {
              transform: scale(0.95);
            }
            @keyframes trinity-breathe {
              0%, 100% { transform: scale(1); }
              50%      { transform: scale(1.05); }
            }
            .trinity-halo {
              position: absolute;
              inset: 0;
              border-radius: 9999px;
              background: radial-gradient(circle, rgba(201, 168, 76, 0.5) 0%, transparent 70%);
              animation: trinity-halo-pulse 2.4s ease-out infinite;
            }
            .trinity-halo-delay { animation-delay: 1.2s; }
            @keyframes trinity-halo-pulse {
              0%   { transform: scale(1);   opacity: 0.7; }
              100% { transform: scale(1.9); opacity: 0; }
            }
          `}</style>
        </button>
      </Draggable>
    );
  }

  return (
    <Draggable defaultX={typeof window !== "undefined" ? window.innerWidth - 400 : 600} defaultY={typeof window !== "undefined" ? window.innerHeight - 540 : 200} storageKey="chat_panel">
    <div className="w-[380px] h-[520px] bg-surface border border-border rounded-2xl shadow-2xl shadow-black/50 flex flex-col overflow-hidden fade-in">
      {/* Header */}
      <div className="bg-surface-light px-4 py-3 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gold/10 rounded-full flex items-center justify-center">
            <Image src="/icons/shortstack-logo.png" alt="Trinity" width={20} height={20} />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Trinity AI</p>
            <p className="text-[10px] text-success">Online</p>
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setIsOpen(false)} className="p-1 rounded hover:bg-border text-muted hover:text-foreground transition-colors">
            <Minimize2 size={14} />
          </button>
          <button onClick={() => setIsOpen(false)} className="p-1 rounded hover:bg-border text-muted hover:text-foreground transition-colors">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${
              msg.role === "user"
                ? "bg-gold text-black rounded-br-sm"
                : "bg-surface-light text-foreground rounded-bl-sm"
            }`}>
              <p className="text-sm leading-relaxed">{msg.content}</p>
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-surface-light rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-gold rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-1.5 h-1.5 bg-gold rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-1.5 h-1.5 bg-gold rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Quick suggestions */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {["My tasks", "Invoice status", "Content progress", "How are my ads?"].map(q => (
            <button key={q} onClick={() => { setInput(q); }}
              className="text-[10px] bg-surface-light px-2.5 py-1 rounded-full text-muted hover:text-foreground hover:bg-border transition-colors">
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-border">
        <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Trinity anything..."
            className="flex-1 bg-surface-light border border-border rounded-full px-4 py-2 text-sm text-foreground placeholder-muted focus:outline-none focus:border-gold/50"
            disabled={sending}
          />
          <button type="submit" disabled={sending || !input.trim()}
            className="w-9 h-9 bg-gold rounded-full flex items-center justify-center hover:bg-gold-light disabled:opacity-30 transition-all shrink-0">
            <Send size={14} className="text-black" />
          </button>
        </form>
      </div>
    </div>
    </Draggable>
  );
}
