"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { MessageSquare, Send, Bot, Loader, Phone, Mail, Clock } from "lucide-react";
import { MotionPage } from "@/components/motion/motion-page";

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <MotionPage className="space-y-5"><div>
              <h1 className="page-header mb-0 flex items-center gap-2"><MessageSquare size={18} className="text-blue-400" /> Support</h1>
              <p className="text-xs text-text-muted mt-0.5">Chat with your AI assistant or contact your account manager</p>
            </div><div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Chat */}
              <div className="lg:col-span-2 card flex flex-col" style={{ minHeight: "500px" }}>
                <div className="flex items-center gap-2 pb-3 border-b border-border-subtle mb-3">
                  <div className="w-8 h-8 bg-blue-500/[0.10] rounded-lg flex items-center justify-center">
                    <Bot size={16} className="text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-text-primary">Trinity AI</p>
                    <p className="text-[9px] text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" /> Online
                    </p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 mb-3">
                  {messages.length === 0 && (
                    <div className="text-center py-12">
                      <Bot size={28} className="mx-auto mb-3 text-blue-400" />
                      <p className="text-xs text-text-muted mb-3">How can I help you today?</p>
                      <div className="flex flex-wrap justify-center gap-1.5">
                        {[
                          "What tasks are pending?",
                          "When is my next content going live?",
                          "How are my campaigns performing?",
                          "I have a question about my invoice",
                        ].map((s, i) => (
                          <button key={i} onClick={() => setInput(s)}
                            className="text-[10px] bg-white/[0.06] px-2.5 py-1.5 rounded-md text-text-muted hover:text-text-primary border border-border-subtle transition-all">
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
                          ? "bg-blue-500/[0.10] border border-blue-500/[0.20]"
                          : "bg-white/[0.06] border border-border-subtle"
                      }`}>
                        <p className="text-xs whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))}

                  {loading && (
                    <div className="flex justify-start">
                      <div className="bg-white/[0.06] border border-border-subtle rounded-lg px-3 py-2">
                        <Loader size={12} className="animate-spin text-blue-400" />
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
                  <input
                    type="text" value={input} onChange={(e) => setInput(e.target.value)}
                    placeholder="Type your message..."
                    aria-label="Support message"
                    className="input flex-1 text-xs" disabled={loading}
                  />
                  <button type="submit" disabled={!input.trim() || loading} className="btn-primary px-3 disabled:opacity-30" aria-label="Send message">
                    <Send size={13} />
                  </button>
                </form>
              </div>

              {/* Contact info */}
              <div className="space-y-3">
                <div className="glass rounded-xl p-4">
                  <h3 className="">Contact Your Team</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-blue-500/[0.10] rounded-lg flex items-center justify-center">
                        <Mail size={14} className="text-blue-400" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-text-primary">Email</p>
                        <p className="text-[10px] text-blue-400">support@shortstack.work</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-emerald-500/[0.10] rounded-lg flex items-center justify-center">
                        <Phone size={14} className="text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-text-primary">Phone</p>
                        <p className="text-[10px] text-text-muted">Available on request</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-amber-500/[0.10] rounded-lg flex items-center justify-center">
                        <Clock size={14} className="text-amber-400" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-text-primary">Response Time</p>
                        <p className="text-[10px] text-text-muted">Within 24 hours</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="glass rounded-xl p-4 bg-blue-500/[0.10] border-blue-500/[0.20]">
                  <div className="flex items-center gap-2 mb-2">
                    <Bot size={14} className="text-blue-400" />
                    <span className="text-xs font-semibold text-text-primary">AI Assistant</span>
                  </div>
                  <p className="text-[10px] text-text-muted">
                    Your AI assistant can answer questions about your services, check task status, and provide updates on your content and campaigns — instantly.
                  </p>
                </div>
              </div>
            </div></MotionPage>
  );
}
