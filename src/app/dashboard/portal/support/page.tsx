"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { MessageSquare, Send, Bot, Loader, Phone, Mail, Clock } from "lucide-react";

export default function ClientSupportPage() {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<Array<{ role: "user" | "bot"; content: string }>>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    if (profile) {
      Promise.resolve(supabase.from("clients").select("id").eq("profile_id", profile.id).single()).then(({ data }) => {
        if (data) setClientId(data.id);
      }).catch(() => {});
    }
  }, [profile]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: msg }]);
    setLoading(true);

    try {
      const res = await fetch("/api/trinity/client-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, client_id: clientId }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "bot", content: data.reply || "Sorry, I couldn't process that." }]);
    } catch {
      setMessages(prev => [...prev, { role: "bot", content: "Connection error. Please try again." }]);
    }
    setLoading(false);
  }

  return (
    <div className="fade-in space-y-5">
      <div>
        <h1 className="page-header mb-0 flex items-center gap-2"><MessageSquare size={18} className="text-gold" /> Support</h1>
        <p className="text-xs text-muted mt-0.5">Chat with your AI assistant or contact your account manager</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chat */}
        <div className="lg:col-span-2 card flex flex-col" style={{ minHeight: "500px" }}>
          <div className="flex items-center gap-2 pb-3 border-b border-border/20 mb-3">
            <div className="w-8 h-8 bg-gold/10 rounded-lg flex items-center justify-center">
              <Bot size={16} className="text-gold" />
            </div>
            <div>
              <p className="text-xs font-semibold">ShortStack AI</p>
              <p className="text-[9px] text-success flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" /> Online
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 mb-3">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <Bot size={28} className="mx-auto mb-3 text-gold/30" />
                <p className="text-xs text-muted mb-3">How can I help you today?</p>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {[
                    "What tasks are pending?",
                    "When is my next content going live?",
                    "How are my campaigns performing?",
                    "I have a question about my invoice",
                  ].map((s, i) => (
                    <button key={i} onClick={() => setInput(s)}
                      className="text-[10px] bg-surface-light/50 px-2.5 py-1.5 rounded-md text-muted hover:text-white border border-border/30 transition-all">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-lg px-3 py-2 ${
                  msg.role === "user"
                    ? "bg-gold/10 border border-gold/15"
                    : "bg-surface-light/50 border border-border/20"
                }`}>
                  <p className="text-xs whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-surface-light/50 border border-border/20 rounded-lg px-3 py-2">
                  <Loader size={12} className="animate-spin text-gold" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
            <input
              type="text" value={input} onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              className="input flex-1 text-xs" disabled={loading}
            />
            <button type="submit" disabled={!input.trim() || loading} className="btn-primary px-3 disabled:opacity-30">
              <Send size={13} />
            </button>
          </form>
        </div>

        {/* Contact info */}
        <div className="space-y-3">
          <div className="card">
            <h3 className="section-header">Contact Your Team</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center">
                  <Mail size={14} className="text-accent" />
                </div>
                <div>
                  <p className="text-xs font-medium">Email</p>
                  <p className="text-[10px] text-gold">support@shortstack.work</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-success/10 rounded-lg flex items-center justify-center">
                  <Phone size={14} className="text-success" />
                </div>
                <div>
                  <p className="text-xs font-medium">Phone</p>
                  <p className="text-[10px] text-muted">Available on request</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-warning/10 rounded-lg flex items-center justify-center">
                  <Clock size={14} className="text-warning" />
                </div>
                <div>
                  <p className="text-xs font-medium">Response Time</p>
                  <p className="text-[10px] text-muted">Within 24 hours</p>
                </div>
              </div>
            </div>
          </div>

          <div className="card bg-gold/[0.03] border-gold/10">
            <div className="flex items-center gap-2 mb-2">
              <Bot size={14} className="text-gold" />
              <span className="text-xs font-semibold">AI Assistant</span>
            </div>
            <p className="text-[10px] text-muted">
              Your AI assistant can answer questions about your services, check task status, and provide updates on your content and campaigns — instantly.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
