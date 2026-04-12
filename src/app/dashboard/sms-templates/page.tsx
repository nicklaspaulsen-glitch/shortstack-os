"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  MessageSquare, Plus, Copy, Sparkles, Trash2, Loader, Edit3
} from "lucide-react";
import toast from "react-hot-toast";

interface SMSTemplate {
  id: string;
  name: string;
  body: string;
  category: string;
}

const DEFAULT_TEMPLATES: SMSTemplate[] = [
  { id: "1", name: "Cold Intro", body: "Hey {name}! I came across {business_name} and love what you're doing. We help {industry} businesses get more clients through social media. Mind if I send over a quick case study?", category: "Outreach" },
  { id: "2", name: "Follow Up #1", body: "Hey {name}! Just following up on my last message. We recently helped a {industry} business get 30+ new clients in 30 days. Would love to share how. Quick chat this week?", category: "Follow Up" },
  { id: "3", name: "Follow Up #2", body: "Hey {name}, last one from me! I put together a free marketing audit for {business_name} — no strings attached. Want me to send it over?", category: "Follow Up" },
  { id: "4", name: "Appointment Reminder", body: "Hey {name}! Just a reminder about our call tomorrow at {time}. Looking forward to chatting about {business_name}! Here's the link: {link}", category: "Scheduling" },
  { id: "5", name: "No Show Follow Up", body: "Hey {name}, looks like we missed each other today. No worries! Would you like to reschedule? I have openings this week.", category: "Scheduling" },
  { id: "6", name: "Post-Call Thank You", body: "Hey {name}! Great chatting today. As discussed, I'll send over the proposal for {business_name} by end of day. Excited to get started!", category: "Sales" },
  { id: "7", name: "Invoice Reminder", body: "Hey {name}, friendly reminder that your invoice of ${amount} is due on {due_date}. You can pay here: {link}. Thanks!", category: "Billing" },
  { id: "8", name: "Content Approval", body: "Hey {name}! Your content for this week is ready for review. Check it out in your portal: {link}. Let me know if you'd like any changes!", category: "Client" },
  { id: "9", name: "Review Request", body: "Hey {name}! Working with {business_name} has been awesome. Would you mind leaving us a quick Google review? It really helps! {link}", category: "Reviews" },
  { id: "10", name: "Referral Ask", body: "Hey {name}! So glad the results have been great for {business_name}. Know anyone else who could use similar results? I'd love an intro — and there's a referral bonus for you!", category: "Referral" },
];

export default function SMSTemplatesPage() {
  useAuth();
  const [templates, setTemplates] = useState<SMSTemplate[]>(DEFAULT_TEMPLATES);
  const [editing, setEditing] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [filter, setFilter] = useState("all");
  const [newTemplate, setNewTemplate] = useState({ name: "", body: "", category: "Outreach" });
  const [showAdd, setShowAdd] = useState(false);

  const categories = ["all", ...Array.from(new Set(templates.map(t => t.category)))];

  async function generateWithAI(purpose: string) {
    setGenerating(true);
    try {
      const res = await fetch("/api/agents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `Write 3 SMS templates for "${purpose}" for a digital marketing agency. Each SMS should be under 160 characters, use {name} and {business_name} as variables. Make them conversational and personal. Return each on a new line, numbered 1-3. No markdown.`,
          agent_name: "Content Agent",
        }),
      });
      const data = await res.json();
      if (data.result) {
        toast.success("AI generated templates!");
        // Parse results into templates
        const lines = data.result.split("\n").filter((l: string) => l.trim().match(/^\d/));
        lines.forEach((line: string, i: number) => {
          const body = line.replace(/^\d+[\.\)]\s*/, "").trim();
          if (body) {
            setTemplates(prev => [...prev, {
              id: `ai_${Date.now()}_${i}`,
              name: `AI: ${purpose} #${i + 1}`,
              body,
              category: "AI Generated",
            }]);
          }
        });
      }
    } catch { toast.error("Failed to generate"); }
    setGenerating(false);
  }

  const filtered = filter === "all" ? templates : templates.filter(t => t.category === filter);

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2">
            <MessageSquare size={18} className="text-gold" /> SMS Templates
          </h1>
          <p className="text-xs text-muted mt-0.5">{templates.length} templates · Click to copy, edit, or generate with AI</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => generateWithAI("cold outreach")} disabled={generating}
            className="btn-secondary text-xs flex items-center gap-1.5">
            {generating ? <Loader size={12} className="animate-spin" /> : <Sparkles size={12} />}
            AI Generate
          </button>
          <button onClick={() => setShowAdd(true)} className="btn-primary text-xs flex items-center gap-1.5">
            <Plus size={12} /> New
          </button>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-1.5 flex-wrap">
        {categories.map(c => (
          <button key={c} onClick={() => setFilter(c)}
            className={`text-[10px] px-3 py-1.5 rounded-lg capitalize transition-all ${
              filter === c ? "bg-gold/10 text-gold border border-gold/20" : "text-muted border border-white/[0.05]"
            }`}>
            {c}
          </button>
        ))}
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="card border-gold/10">
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input value={newTemplate.name} onChange={e => setNewTemplate({ ...newTemplate, name: e.target.value })}
                className="input text-xs" placeholder="Template name" />
              <select value={newTemplate.category} onChange={e => setNewTemplate({ ...newTemplate, category: e.target.value })} className="input text-xs">
                <option value="Outreach">Outreach</option>
                <option value="Follow Up">Follow Up</option>
                <option value="Scheduling">Scheduling</option>
                <option value="Sales">Sales</option>
                <option value="Billing">Billing</option>
                <option value="Client">Client</option>
                <option value="Reviews">Reviews</option>
                <option value="Referral">Referral</option>
              </select>
            </div>
            <textarea value={newTemplate.body} onChange={e => setNewTemplate({ ...newTemplate, body: e.target.value })}
              className="input w-full h-20 text-xs" placeholder="SMS body... use {name}, {business_name}, {industry}" />
            <div className="flex justify-between">
              <span className="text-[9px] text-muted">{newTemplate.body.length}/160 chars</span>
              <div className="flex gap-2">
                <button onClick={() => setShowAdd(false)} className="btn-ghost text-xs">Cancel</button>
                <button onClick={() => {
                  if (!newTemplate.name || !newTemplate.body) { toast.error("Fill in name and body"); return; }
                  setTemplates(prev => [...prev, { id: `t_${Date.now()}`, ...newTemplate }]);
                  setNewTemplate({ name: "", body: "", category: "Outreach" });
                  setShowAdd(false);
                  toast.success("Template added!");
                }} className="btn-primary text-xs">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Templates grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {filtered.map(template => (
          <div key={template.id} className="p-4 rounded-xl group transition-all bg-surface-light border border-border">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-xs font-semibold">{template.name}</p>
                <span className="text-[8px] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(200,168,85,0.08)", color: "#c8a855" }}>
                  {template.category}
                </span>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => { navigator.clipboard.writeText(template.body); toast.success("Copied!"); }}
                  className="p-1 rounded hover:bg-white/5 text-muted hover:text-foreground"><Copy size={10} /></button>
                <button onClick={() => setEditing(editing === template.id ? null : template.id)}
                  className="p-1 rounded hover:bg-white/5 text-muted hover:text-foreground"><Edit3 size={10} /></button>
                <button onClick={() => { setTemplates(prev => prev.filter(t => t.id !== template.id)); toast.success("Deleted"); }}
                  className="p-1 rounded hover:bg-danger/10 text-muted hover:text-danger"><Trash2 size={10} /></button>
              </div>
            </div>

            {editing === template.id ? (
              <textarea value={template.body} onChange={e => {
                setTemplates(prev => prev.map(t => t.id === template.id ? { ...t, body: e.target.value } : t));
              }} className="input w-full h-20 text-xs" />
            ) : (
              <p className="text-[11px] text-muted leading-relaxed">{template.body}</p>
            )}

            <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
              <span className="text-[8px] text-muted/40">{template.body.length} chars</span>
              <button onClick={() => { navigator.clipboard.writeText(template.body); toast.success("Copied!"); }}
                className="text-[9px] text-gold hover:text-gold-light flex items-center gap-0.5">
                <Copy size={8} /> Copy
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
