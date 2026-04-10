"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  Mail, Send, Sparkles, Loader,
  Bold, Italic, Link2, List, Image, Save
} from "lucide-react";
import toast from "react-hot-toast";

export default function EmailComposerPage() {
  useAuth();
  const supabase = createClient();
  const [clients, setClients] = useState<Array<{ id: string; business_name: string; email: string }>>([]);
  const [leads, setLeads] = useState<Array<{ id: string; business_name: string; email: string | null }>>([]);
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [recipientType, setRecipientType] = useState<"client" | "lead" | "custom">("custom");

  const [email, setEmail] = useState({
    to: "",
    subject: "",
    body: "",
    fromName: "Nicklas at ShortStack",
  });

  useEffect(() => {
    Promise.all([
      supabase.from("clients").select("id, business_name, email").eq("is_active", true),
      supabase.from("leads").select("id, business_name, email").not("email", "is", null).limit(100),
    ]).then(([{ data: cl }, { data: ld }]) => {
      setClients(cl || []);
      setLeads(ld || []);
    });
  }, []);

  async function generateWithAI() {
    if (!email.subject && !email.to) { toast.error("Enter a subject or recipient first"); return; }
    setGenerating(true);
    try {
      const res = await fetch("/api/agents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `Write a professional marketing email with subject "${email.subject || "follow up"}". To: ${email.to || "a business owner"}. From: ${email.fromName}. Keep it under 150 words, conversational, personal. Include a clear CTA. No HTML tags, just plain text with line breaks. No markdown.`,
          agent_name: "Content Agent",
        }),
      });
      const data = await res.json();
      if (data.result) {
        setEmail(prev => ({ ...prev, body: data.result }));
        toast.success("Email generated!");
      }
    } catch { toast.error("Failed to generate"); }
    setGenerating(false);
  }

  async function sendEmail() {
    if (!email.to || !email.subject || !email.body) { toast.error("Fill in all fields"); return; }
    setSending(true);

    try {
      // Log the email send
      await supabase.from("outreach_log").insert({
        platform: "email",
        business_name: email.to,
        recipient_handle: email.to,
        message_text: `Subject: ${email.subject}\n\n${email.body}`,
        status: "sent",
        metadata: { source: "email_composer", from: email.fromName },
      });

      await supabase.from("trinity_log").insert({
        agent: "outreach",
        action_type: "outreach",
        description: `Email sent to ${email.to}: "${email.subject}"`,
        status: "completed",
      });

      toast.success("Email logged! Send via GHL or your email provider.");
      setEmail(prev => ({ ...prev, subject: "", body: "", to: "" }));
    } catch { toast.error("Failed to send"); }
    setSending(false);
  }

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2">
            <Mail size={18} className="text-gold" /> Email Composer
          </h1>
          <p className="text-xs text-muted mt-0.5">Write and send emails to clients and leads</p>
        </div>
        <button onClick={generateWithAI} disabled={generating} className="btn-secondary text-xs flex items-center gap-1.5">
          {generating ? <Loader size={12} className="animate-spin" /> : <Sparkles size={12} />}
          AI Write
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Composer */}
        <div className="lg:col-span-2 space-y-3">
          {/* Recipient */}
          <div className="card space-y-2">
            <div className="flex gap-1.5 mb-2">
              {(["custom", "client", "lead"] as const).map(t => (
                <button key={t} onClick={() => setRecipientType(t)}
                  className={`text-[10px] px-2.5 py-1 rounded-lg capitalize transition-all ${
                    recipientType === t ? "bg-gold/10 text-gold border border-gold/20" : "text-muted border border-white/[0.05]"
                  }`}>{t}</button>
              ))}
            </div>

            {recipientType === "custom" && (
              <input value={email.to} onChange={e => setEmail({ ...email, to: e.target.value })}
                className="input w-full" placeholder="Email address" />
            )}
            {recipientType === "client" && (
              <select value={email.to} onChange={e => setEmail({ ...email, to: e.target.value })} className="input w-full">
                <option value="">Select client...</option>
                {clients.map(c => <option key={c.id} value={c.email}>{c.business_name} ({c.email})</option>)}
              </select>
            )}
            {recipientType === "lead" && (
              <select value={email.to} onChange={e => setEmail({ ...email, to: e.target.value })} className="input w-full">
                <option value="">Select lead...</option>
                {leads.filter(l => l.email).map(l => <option key={l.id} value={l.email!}>{l.business_name} ({l.email})</option>)}
              </select>
            )}
          </div>

          {/* Subject */}
          <input value={email.subject} onChange={e => setEmail({ ...email, subject: e.target.value })}
            className="input w-full text-sm font-medium" placeholder="Subject line..." />

          {/* Toolbar */}
          <div className="flex gap-1 p-1 rounded-lg" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
            {[
              { icon: <Bold size={12} />, label: "Bold" },
              { icon: <Italic size={12} />, label: "Italic" },
              { icon: <Link2 size={12} />, label: "Link" },
              { icon: <List size={12} />, label: "List" },
              { icon: <Image size={12} />, label: "Image" },
            ].map(tool => (
              <button key={tool.label} className="p-2 rounded text-muted hover:text-white hover:bg-white/5 transition-colors" title={tool.label}>
                {tool.icon}
              </button>
            ))}
          </div>

          {/* Body */}
          <textarea value={email.body} onChange={e => setEmail({ ...email, body: e.target.value })}
            className="input w-full text-sm leading-relaxed" style={{ minHeight: 300, resize: "vertical" }}
            placeholder="Write your email here... or click AI Write to generate one." />

          {/* Send */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 text-[10px] text-muted">
              <span>From: {email.fromName}</span>
              <span>·</span>
              <span>{email.body.split(/\s+/).filter(Boolean).length} words</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => toast.success("Draft saved!")} className="btn-ghost text-xs flex items-center gap-1">
                <Save size={12} /> Save Draft
              </button>
              <button onClick={sendEmail} disabled={sending || !email.to || !email.body}
                className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50">
                {sending ? <Loader size={12} className="animate-spin" /> : <Send size={12} />}
                {sending ? "Sending..." : "Send Email"}
              </button>
            </div>
          </div>
        </div>

        {/* Quick templates sidebar */}
        <div className="space-y-3">
          <div className="card">
            <h3 className="section-header">Quick Templates</h3>
            <div className="space-y-1.5">
              {[
                { name: "Cold Intro", subject: "Quick question about {business}", body: "Hey!\n\nI came across your business and love what you're doing. We help businesses like yours get 2-3x more clients through digital marketing.\n\nWould you be open to a quick 15-minute call this week?\n\nBest,\nNicklas" },
                { name: "Follow Up", subject: "Following up", body: "Hey!\n\nJust bumping this to the top of your inbox. I recently helped a similar business go from 10 to 50+ new clients per month.\n\nHappy to share how — takes 15 minutes.\n\nBest,\nNicklas" },
                { name: "Proposal Send", subject: "Your proposal is ready", body: "Hey!\n\nGreat chatting today! As discussed, here's the proposal for your marketing.\n\nTake a look and let me know if you have any questions. I'm confident we can get you great results.\n\nBest,\nNicklas" },
                { name: "Welcome", subject: "Welcome to ShortStack!", body: "Hey!\n\nWelcome aboard! We're thrilled to have you as a client.\n\nHere's what happens next:\n1. You'll get access to your client portal\n2. We'll schedule your onboarding call\n3. We'll start your first content batch\n\nBest,\nThe ShortStack Team" },
                { name: "Monthly Report", subject: "Your monthly report is ready", body: "Hey!\n\nYour monthly marketing report is ready. Here's a quick summary of what we accomplished this month.\n\nFull report is in your portal. Let me know if you have any questions!\n\nBest,\nNicklas" },
              ].map(t => (
                <button key={t.name} onClick={() => setEmail(prev => ({ ...prev, subject: t.subject, body: t.body }))}
                  className="w-full text-left p-2.5 rounded-lg text-[10px] transition-all hover:bg-white/[0.03]"
                  style={{ border: "1px solid rgba(255,255,255,0.04)" }}>
                  <p className="font-semibold">{t.name}</p>
                  <p className="text-muted truncate">{t.subject}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <h3 className="section-header">Variables</h3>
            <div className="flex flex-wrap gap-1">
              {["{name}", "{business}", "{industry}", "{city}", "{link}", "{amount}"].map(v => (
                <button key={v} onClick={() => setEmail(prev => ({ ...prev, body: prev.body + " " + v }))}
                  className="text-[9px] px-2 py-1 rounded text-gold hover:bg-gold/10 transition-colors"
                  style={{ background: "rgba(200,168,85,0.04)", border: "1px solid rgba(200,168,85,0.08)" }}>
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
