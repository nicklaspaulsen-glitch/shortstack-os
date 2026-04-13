"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { TrinityLogEntry } from "@/lib/types";
import StatusBadge from "@/components/ui/status-badge";
import DataTable from "@/components/ui/data-table";
import { PageLoading } from "@/components/ui/loading";
import { formatRelativeTime } from "@/lib/utils";
import { Bot, Send, History, Terminal } from "lucide-react";

type Tab = "chat" | "log";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function TrinityPage() {
  const [tab, setTab] = useState<Tab>("chat");
  const [logs, setLogs] = useState<TrinityLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Hey, I am Trinity — ShortStack AI agent. I can build websites, set up AI receptionists, create chatbots, manage automations, set up Discord servers, and much more. What do you need?", timestamp: new Date() },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchLogs(); }, []);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function fetchLogs() {
    const { data } = await supabase.from("trinity_log").select("*").order("created_at", { ascending: false }).limit(100);
    setLogs(data || []);
    setLoading(false);
  }

  async function sendMessage() {
    if (!input.trim() || sending) return;

    const userMsg: ChatMessage = { role: "user", content: input, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/trinity/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input }),
      });
      const data = await res.json();

      setMessages((prev) => [...prev, {
        role: "assistant",
        content: data.reply || "I processed that command. Check the action log for details.",
        timestamp: new Date(),
      }]);
      fetchLogs();
    } catch {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "Sorry, I encountered an error processing that.",
        timestamp: new Date(),
      }]);
    }
    setSending(false);
  }

  return (
    <div className="fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-3">
            <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
              <Bot size={24} className="text-gold" />
            </div>
            Trinity AI
          </h1>
          <p className="text-muted text-sm">ShortStack autonomous AI agent — chat or use Telegram</p>
        </div>
      </div>

      <div className="flex gap-1 bg-surface rounded-lg p-1 w-fit">
        <button onClick={() => setTab("chat")}
          className={`px-4 py-2 text-sm rounded-md flex items-center gap-2 transition-all ${tab === "chat" ? "bg-gold text-black font-medium" : "text-muted hover:text-foreground"}`}
        ><Terminal size={16} /> Chat</button>
        <button onClick={() => setTab("log")}
          className={`px-4 py-2 text-sm rounded-md flex items-center gap-2 transition-all ${tab === "log" ? "bg-gold text-black font-medium" : "text-muted hover:text-foreground"}`}
        ><History size={16} /> Action Log</button>
      </div>

      {tab === "chat" && (
        <div className="card p-0 flex flex-col h-[calc(100vh-300px)] min-h-[400px]">
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-gold text-black rounded-br-sm"
                    : "bg-surface-light text-foreground rounded-bl-sm"
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  <p className={`text-xs mt-1 ${msg.role === "user" ? "text-black/50" : "text-muted"}`}>
                    {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-surface-light rounded-2xl rounded-bl-sm px-4 py-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gold rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 bg-gold rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 bg-gold rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border p-4">
            <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Tell Trinity what to do..."
                className="input flex-1"
                disabled={sending}
              />
              <button type="submit" disabled={sending || !input.trim()} className="btn-primary px-4 disabled:opacity-50">
                <Send size={18} />
              </button>
            </form>
            <div className="flex flex-wrap gap-2 mt-3">
              {["Build a website", "Set up AI receptionist", "Create Discord server", "Run email campaign", "Generate leads"].map((cmd) => (
                <button key={cmd} onClick={() => setInput(cmd)}
                  className="text-xs bg-surface-light px-3 py-1.5 rounded-full text-muted hover:text-foreground hover:bg-border transition-all"
                >{cmd}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "log" && (
        loading ? <PageLoading /> : (
          <DataTable
            columns={[
              { key: "action_type", label: "Action", render: (l: TrinityLogEntry) => (
                <span className="capitalize font-medium">{l.action_type.replace("_", " ")}</span>
              )},
              { key: "description", label: "Description", render: (l: TrinityLogEntry) => (
                <p className="text-sm max-w-md truncate">{l.description}</p>
              )},
              { key: "command", label: "Command", render: (l: TrinityLogEntry) => (
                <p className="text-xs text-muted max-w-xs truncate">{l.command || "-"}</p>
              )},
              { key: "status", label: "Status", render: (l: TrinityLogEntry) => <StatusBadge status={l.status} /> },
              { key: "created_at", label: "Time", render: (l: TrinityLogEntry) => formatRelativeTime(l.created_at) },
            ]}
            data={logs}
            emptyMessage="No actions taken yet."
          />
        )
      )}
    </div>
  );
}
