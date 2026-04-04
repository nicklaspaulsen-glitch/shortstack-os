"use client";

import { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, X, Minimize2 } from "lucide-react";
import Image from "next/image";

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
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/trinity/client-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.reply || "Sorry, I couldn't process that." }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "I'm having trouble connecting. Please try again." }]);
    }
    setSending(false);
  }

  if (!isOpen) {
    return (
      <button onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-gold rounded-full shadow-lg shadow-gold/20 flex items-center justify-center hover:bg-gold-light transition-all hover:scale-105 active:scale-95">
        <MessageSquare size={24} className="text-black" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[380px] h-[520px] bg-surface border border-border rounded-2xl shadow-2xl shadow-black/50 flex flex-col overflow-hidden fade-in">
      {/* Header */}
      <div className="bg-surface-light px-4 py-3 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gold/10 rounded-full flex items-center justify-center">
            <Image src="/icons/shortstack-logo.png" alt="Trinity" width={20} height={20} />
          </div>
          <div>
            <p className="text-sm font-medium text-white">Trinity AI</p>
            <p className="text-[10px] text-success">Online</p>
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setIsOpen(false)} className="p-1 rounded hover:bg-border text-muted hover:text-white transition-colors">
            <Minimize2 size={14} />
          </button>
          <button onClick={() => setIsOpen(false)} className="p-1 rounded hover:bg-border text-muted hover:text-white transition-colors">
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
                : "bg-surface-light text-white rounded-bl-sm"
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
              className="text-[10px] bg-surface-light px-2.5 py-1 rounded-full text-muted hover:text-white hover:bg-border transition-colors">
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
            className="flex-1 bg-surface-light border border-border rounded-full px-4 py-2 text-sm text-white placeholder-muted focus:outline-none focus:border-gold/50"
            disabled={sending}
          />
          <button type="submit" disabled={sending || !input.trim()}
            className="w-9 h-9 bg-gold rounded-full flex items-center justify-center hover:bg-gold-light disabled:opacity-30 transition-all shrink-0">
            <Send size={14} className="text-black" />
          </button>
        </form>
      </div>
    </div>
  );
}
