"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeTime } from "@/lib/utils";
import {
  MessageSquare, Send, Loader, FileText,
  RefreshCw, ArrowUpRight, ArrowDownLeft, Inbox
} from "lucide-react";
import toast from "react-hot-toast";

interface Message {
  sid?: string;
  to: string;
  from: string;
  body: string;
  status: string;
  direction: string;
  date_sent: string;
}

interface Template {
  name: string;
  status: string;
  category: string;
  language: string;
  id: string;
}

export default function WhatsAppPage() {
  useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(true);
  const [tab, setTab] = useState<"inbox" | "send" | "templates">("inbox");
  const [sending, setSending] = useState(false);
  const [clients, setClients] = useState<Array<{ id: string; business_name: string; phone: string | null }>>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const supabase = createClient();

  // Send form state
  const [sendTo, setSendTo] = useState("");
  const [sendMessage, setSendMessage] = useState("");

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchData() {
    setLoading(true);

    // Fetch clients for quick-send
    const { data: cl } = await supabase.from("clients").select("id, business_name, phone").eq("is_active", true);
    setClients(cl || []);

    // Fetch WhatsApp data via Twilio (WhatsApp messages go through Twilio too)
    try {
      const [msgRes, tplRes] = await Promise.all([
        fetch("/api/integrations/twilio?action=messages&limit=30"),
        fetch("/api/integrations/whatsapp?action=templates"),
      ]);

      const msgData = await msgRes.json();
      const tplData = await tplRes.json();

      if (msgData.success) {
        // Filter to WhatsApp messages (from/to contain 'whatsapp:')
        setMessages(msgData.messages || []);
      }
      if (tplData.connected === false) {
        setConnected(false);
      } else {
        setTemplates(tplData.templates || []);
      }
    } catch {
      setConnected(false);
    }
    setLoading(false);
  }

  async function sendWhatsApp() {
    if (!sendTo || !sendMessage) { toast.error("Enter a number and message"); return; }
    setSending(true);
    try {
      const res = await fetch("/api/integrations/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_text",
          to: sendTo,
          message: sendMessage,
          client_id: selectedClient || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Message sent!");
        setSendMessage("");
        fetchData();
      } else {
        toast.error(data.error || "Failed to send");
      }
    } catch { toast.error("Error sending message"); }
    setSending(false);
  }

  async function sendTemplate(templateName: string) {
    if (!sendTo) { toast.error("Enter a recipient number first"); return; }
    setSending(true);
    try {
      const res = await fetch("/api/integrations/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_template",
          to: sendTo,
          template_name: templateName,
          client_id: selectedClient || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Template "${templateName}" sent!`);
      } else {
        toast.error(data.error || "Failed");
      }
    } catch { toast.error("Error"); }
    setSending(false);
  }

  if (!connected && !loading) {
    return (
      <div className="fade-in space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#25D366]/10 rounded-xl flex items-center justify-center">
            <MessageSquare size={20} className="text-[#25D366]" />
          </div>
          <div>
            <h1 className="page-header mb-0">WhatsApp Business</h1>
            <p className="text-xs text-muted">Send messages to clients via WhatsApp</p>
          </div>
        </div>
        <div className="card p-8 text-center">
          <MessageSquare size={32} className="text-muted/30 mx-auto mb-3" />
          <h2 className="text-sm font-semibold mb-1">WhatsApp Not Connected</h2>
          <p className="text-xs text-muted mb-3">Configure your WhatsApp Business API credentials in environment variables:</p>
          <code className="text-[10px] bg-surface-light rounded-lg p-3 block text-muted">
            WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_BUSINESS_ACCOUNT_ID
          </code>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#25D366]/10 rounded-xl flex items-center justify-center">
            <MessageSquare size={20} className="text-[#25D366]" />
          </div>
          <div>
            <h1 className="page-header mb-0">WhatsApp Business</h1>
            <p className="text-xs text-muted">Send messages, templates & media to clients</p>
          </div>
        </div>
        <button onClick={fetchData} className="btn-secondary text-xs flex items-center gap-1.5">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface rounded-lg p-1 w-fit">
        {([
          { id: "inbox", label: "Inbox", icon: <Inbox size={13} /> },
          { id: "send", label: "Send Message", icon: <Send size={13} /> },
          { id: "templates", label: "Templates", icon: <FileText size={13} /> },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-all ${
              tab === t.id ? "bg-[#25D366]/10 text-[#25D366] font-medium" : "text-muted hover:text-foreground"
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader size={20} className="animate-spin text-[#25D366]" /></div>
      ) : (
        <>
          {/* Inbox */}
          {tab === "inbox" && (
            <div className="space-y-2">
              {messages.length === 0 ? (
                <div className="card p-8 text-center text-muted text-sm">No messages yet</div>
              ) : (
                messages.map((msg, i) => (
                  <div key={i} className="card p-3 flex items-start gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                      msg.direction === "inbound" ? "bg-[#25D366]/10 text-[#25D366]" : "bg-info/10 text-info"
                    }`}>
                      {msg.direction === "inbound" ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-[10px] text-muted">
                        <span className="font-medium text-foreground">{msg.direction === "inbound" ? msg.from : msg.to}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] ${
                          msg.status === "delivered" || msg.status === "read" ? "bg-success/10 text-success" :
                          msg.status === "failed" || msg.status === "undelivered" ? "bg-danger/10 text-danger" :
                          "bg-surface-light text-muted"
                        }`}>{msg.status}</span>
                        <span>{msg.date_sent ? formatRelativeTime(msg.date_sent) : ""}</span>
                      </div>
                      <p className="text-xs mt-1 text-muted">{msg.body}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Send */}
          {tab === "send" && (
            <div className="card space-y-4">
              <h2 className="section-header">Send WhatsApp Message</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-muted uppercase tracking-wider mb-1">Recipient Phone *</label>
                  <input value={sendTo} onChange={e => setSendTo(e.target.value)}
                    className="input w-full text-xs" placeholder="+1234567890" />
                </div>
                <div>
                  <label className="block text-[10px] text-muted uppercase tracking-wider mb-1">Quick Select Client</label>
                  <select value={selectedClient} onChange={e => {
                    setSelectedClient(e.target.value);
                    const cl = clients.find(c => c.id === e.target.value);
                    if (cl?.phone) setSendTo(cl.phone);
                  }} className="input w-full text-xs">
                    <option value="">Select client...</option>
                    {clients.filter(c => c.phone).map(c => (
                      <option key={c.id} value={c.id}>{c.business_name} ({c.phone})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-muted uppercase tracking-wider mb-1">Message *</label>
                <textarea value={sendMessage} onChange={e => setSendMessage(e.target.value)}
                  className="input w-full h-24 text-xs" placeholder="Type your message..." />
              </div>
              <div className="flex gap-2">
                <button onClick={sendWhatsApp} disabled={sending || !sendTo || !sendMessage}
                  className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50">
                  {sending ? <Loader size={12} className="animate-spin" /> : <Send size={12} />}
                  Send Message
                </button>
              </div>
            </div>
          )}

          {/* Templates */}
          {tab === "templates" && (
            <div className="space-y-3">
              <div className="card p-3">
                <label className="block text-[10px] text-muted uppercase tracking-wider mb-1">Send template to:</label>
                <input value={sendTo} onChange={e => setSendTo(e.target.value)}
                  className="input w-full text-xs" placeholder="+1234567890 (enter number first, then click a template)" />
              </div>
              {templates.length === 0 ? (
                <div className="card p-8 text-center text-muted text-sm">No templates found. Create them in your WhatsApp Business Manager.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {templates.map((t, i) => (
                    <div key={i} className="card p-3 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium">{t.name}</p>
                        <div className="flex items-center gap-2 text-[9px] text-muted mt-0.5">
                          <span className={`px-1.5 py-0.5 rounded ${
                            t.status === "APPROVED" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                          }`}>{t.status}</span>
                          <span>{t.category}</span>
                          <span>{t.language}</span>
                        </div>
                      </div>
                      <button onClick={() => sendTemplate(t.name)} disabled={!sendTo || sending}
                        className="btn-secondary text-[10px] px-2 py-1 disabled:opacity-30">
                        <Send size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
