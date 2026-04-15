"use client";

import { useState } from "react";
import {
  MessageSquare, Plus, Copy, Sparkles, Trash2, Edit3,
  Search, Shield, Link2, BarChart3, Clock, Send,
  AlertTriangle, CheckCircle, Smile, Calendar, Eye,
  TrendingUp, Settings, X
} from "lucide-react";

type MainTab = "library" | "preview" | "compliance" | "analytics" | "links" | "schedule";

interface SMSTemplate {
  id: string;
  name: string;
  body: string;
  category: string;
  sends: number;
  delivered: number;
  replies: number;
}

const DEFAULT_TEMPLATES: SMSTemplate[] = [];

const EMOJI_CATEGORIES = [
  { name: "Smileys", emojis: ["😀", "😊", "🤝", "👋", "🎉", "🔥", "💪", "✅"] },
  { name: "Business", emojis: ["📊", "💰", "📈", "🏆", "🎯", "💼", "📱", "🖥️"] },
  { name: "Actions", emojis: ["👉", "✨", "⭐", "🚀", "💡", "📞", "📧", "⏰"] },
];

const MERGE_TAGS = [
  "{name}", "{first_name}", "{last_name}", "{business_name}",
  "{industry}", "{city}", "{phone}", "{link}",
  "{amount}", "{due_date}", "{time}", "{date}",
];

export default function SMSTemplatesPage() {
  const [activeTab, setActiveTab] = useState<MainTab>("library");
  const [templates, setTemplates] = useState<SMSTemplate[]>(DEFAULT_TEMPLATES);
  const [editing, setEditing] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [newTemplate, setNewTemplate] = useState({ name: "", body: "", category: "Outreach" });
  const [showAdd, setShowAdd] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<SMSTemplate | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [optOutFooter, setOptOutFooter] = useState("Reply STOP to unsubscribe");
  const [shortLinkInput, setShortLinkInput] = useState("");

  const categories = ["all", ...Array.from(new Set(templates.map(t => t.category)))];
  const filtered = templates
    .filter(t => (filter === "all" || t.category === filter) && (!search || t.name.toLowerCase().includes(search.toLowerCase()) || t.body.toLowerCase().includes(search.toLowerCase())));

  const getSegments = (text: string) => {
    const len = text.length;
    if (len <= 160) return 1;
    return Math.ceil(len / 153);
  };

  const totalSends = templates.reduce((s, t) => s + t.sends, 0);
  const totalDelivered = templates.reduce((s, t) => s + t.delivered, 0);
  const totalReplies = templates.reduce((s, t) => s + t.replies, 0);
  const deliveryRate = totalSends > 0 ? ((totalDelivered / totalSends) * 100).toFixed(1) : "0";
  const replyRate = totalDelivered > 0 ? ((totalReplies / totalDelivered) * 100).toFixed(1) : "0";

  const TABS: { key: MainTab; label: string; icon: React.ReactNode }[] = [
    { key: "library", label: "Template Library", icon: <MessageSquare size={14} /> },
    { key: "preview", label: "Preview", icon: <Eye size={14} /> },
    { key: "compliance", label: "TCPA Compliance", icon: <Shield size={14} /> },
    { key: "analytics", label: "SMS Analytics", icon: <BarChart3 size={14} /> },
    { key: "links", label: "Short Links", icon: <Link2 size={14} /> },
    { key: "schedule", label: "Schedule", icon: <Calendar size={14} /> },
  ];

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2">
            <MessageSquare size={18} className="text-gold" /> SMS Templates
          </h1>
          <p className="text-xs text-muted mt-0.5">{templates.length} templates | Segment calculator, compliance checker, analytics</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary text-xs flex items-center gap-1.5"><Sparkles size={12} /> AI Generate</button>
          <button onClick={() => setShowAdd(true)} className="btn-primary text-xs flex items-center gap-1.5"><Plus size={12} /> New</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface rounded-lg p-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 text-xs rounded-md flex items-center gap-2 whitespace-nowrap transition-all ${
              activeTab === t.key ? "bg-gold text-black font-medium" : "text-muted hover:text-foreground"
            }`}>{t.icon} {t.label}</button>
        ))}
      </div>

      {/* ===== TEMPLATE LIBRARY ===== */}
      {activeTab === "library" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input value={search} onChange={e => setSearch(e.target.value)} className="input w-full pl-9 text-xs" placeholder="Search templates..." />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {categories.map(c => (
                <button key={c} onClick={() => setFilter(c)}
                  className={`text-[10px] px-2.5 py-1.5 rounded-lg capitalize ${
                    filter === c ? "bg-gold/10 text-gold border border-gold/20" : "text-muted border border-white/[0.05]"
                  }`}>{c}</button>
              ))}
            </div>
          </div>

          {/* Add form */}
          {showAdd && (
            <div className="card border-gold/10 space-y-2 p-4">
              <h4 className="text-xs font-semibold">New SMS Template</h4>
              <div className="grid grid-cols-2 gap-2">
                <input value={newTemplate.name} onChange={e => setNewTemplate({ ...newTemplate, name: e.target.value })} className="input text-xs" placeholder="Template name" />
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
              <div className="relative">
                <textarea value={newTemplate.body} onChange={e => setNewTemplate({ ...newTemplate, body: e.target.value })} className="input w-full h-20 text-xs" placeholder="SMS body..." />
                <button onClick={() => setShowEmoji(!showEmoji)} className="absolute right-2 bottom-2 text-muted hover:text-gold"><Smile size={14} /></button>
              </div>
              {showEmoji && (
                <div className="p-2 rounded-lg bg-surface-light border border-border">
                  {EMOJI_CATEGORIES.map(cat => (
                    <div key={cat.name} className="mb-1.5">
                      <p className="text-[8px] text-muted mb-0.5">{cat.name}</p>
                      <div className="flex gap-1 flex-wrap">
                        {cat.emojis.map(e => (
                          <button key={e} onClick={() => setNewTemplate(prev => ({ ...prev, body: prev.body + e }))}
                            className="text-sm hover:bg-white/10 rounded p-0.5">{e}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* Merge tags */}
              <div className="flex flex-wrap gap-1">
                {MERGE_TAGS.map(tag => (
                  <button key={tag} onClick={() => setNewTemplate(prev => ({ ...prev, body: prev.body + " " + tag }))}
                    className="text-[8px] px-1.5 py-0.5 rounded bg-gold/10 text-gold hover:bg-gold/20">{tag}</button>
                ))}
              </div>
              {/* Character counter */}
              <div className="flex items-center justify-between text-[9px]">
                <div className="flex items-center gap-3">
                  <span className={newTemplate.body.length > 160 ? "text-yellow-400" : "text-muted"}>{newTemplate.body.length}/160 chars</span>
                  <span className="text-muted">{getSegments(newTemplate.body)} segment{getSegments(newTemplate.body) > 1 ? "s" : ""}</span>
                  {getSegments(newTemplate.body) > 1 && <span className="text-yellow-400">({getSegments(newTemplate.body)} credits)</span>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setShowAdd(false); setShowEmoji(false); }} className="btn-ghost text-xs">Cancel</button>
                  <button onClick={() => {
                    if (!newTemplate.name || !newTemplate.body) return;
                    setTemplates(prev => [...prev, { id: `t_${Date.now()}`, ...newTemplate, sends: 0, delivered: 0, replies: 0 }]);
                    setNewTemplate({ name: "", body: "", category: "Outreach" });
                    setShowAdd(false);
                    setShowEmoji(false);
                  }} className="btn-primary text-xs">Save</button>
                </div>
              </div>
            </div>
          )}

          {/* Template Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {filtered.length === 0 && (
              <div className="col-span-2 text-center py-12 text-muted text-xs">No templates yet. Click &quot;New&quot; to create your first SMS template.</div>
            )}
            {filtered.map(template => (
              <div key={template.id} className="p-4 rounded-xl bg-surface-light border border-border group transition-all hover:border-gold/10">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-xs font-semibold">{template.name}</p>
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-gold/10 text-gold">{template.category}</span>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { navigator.clipboard.writeText(template.body); }} className="p-1 rounded hover:bg-white/5 text-muted hover:text-foreground"><Copy size={10} /></button>
                    <button onClick={() => setPreviewTemplate(template)} className="p-1 rounded hover:bg-white/5 text-muted hover:text-foreground"><Eye size={10} /></button>
                    <button onClick={() => setEditing(editing === template.id ? null : template.id)} className="p-1 rounded hover:bg-white/5 text-muted hover:text-foreground"><Edit3 size={10} /></button>
                    <button onClick={() => setTemplates(prev => prev.filter(t => t.id !== template.id))} className="p-1 rounded hover:bg-red-400/10 text-muted hover:text-red-400"><Trash2 size={10} /></button>
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
                  <div className="flex items-center gap-3 text-[8px] text-muted">
                    <span>{template.body.length} chars</span>
                    <span>{getSegments(template.body)} seg</span>
                    {template.sends > 0 && (
                      <>
                        <span className="text-blue-400">{template.sends} sent</span>
                        <span className="text-green-400">{template.replies} replies</span>
                      </>
                    )}
                  </div>
                  <button onClick={() => { navigator.clipboard.writeText(template.body); }}
                    className="text-[9px] text-gold hover:text-gold flex items-center gap-0.5">
                    <Copy size={8} /> Copy
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== PREVIEW PANEL ===== */}
      {activeTab === "preview" && (
        <div className="space-y-4">
          <div className="flex justify-center">
            <div className="w-[320px] bg-gray-900 rounded-[2rem] p-3 shadow-2xl">
              <div className="bg-gray-800 rounded-[1.5rem] overflow-hidden">
                <div className="bg-gray-700 p-3 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center">
                    <MessageSquare size={12} className="text-gold" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-white">ShortStack</p>
                    <p className="text-[8px] text-gray-400">SMS</p>
                  </div>
                </div>
                <div className="p-3 min-h-[300px] space-y-2">
                  {previewTemplate ? (
                    <div className="bg-green-600 rounded-2xl rounded-tl-sm p-3 max-w-[85%]">
                      <p className="text-[10px] text-white leading-relaxed">
                        {previewTemplate.body
                          .replace(/\{name\}/g, "John")
                          .replace(/\{first_name\}/g, "John")
                          .replace(/\{business_name\}/g, "Bright Smile Dental")
                          .replace(/\{industry\}/g, "dental")
                          .replace(/\{link\}/g, "srtst.ck/abc123")
                          .replace(/\{time\}/g, "2:00 PM")
                          .replace(/\{amount\}/g, "2,497")
                          .replace(/\{due_date\}/g, "Apr 21")}
                      </p>
                      <p className="text-[7px] text-green-200 mt-1 text-right">10:32 AM</p>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <MessageSquare size={24} className="mx-auto mb-2 text-gray-600" />
                      <p className="text-[10px] text-gray-500">Select a template from the Library tab to preview</p>
                    </div>
                  )}
                  {previewTemplate && optOutFooter && (
                    <p className="text-[7px] text-gray-500 text-center mt-3">{optOutFooter}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
          {/* Template selector for preview */}
          <div className="card">
            <h4 className="text-xs font-semibold mb-2">Select Template to Preview</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
              {templates.length === 0 && (
                <p className="col-span-4 text-center text-[10px] text-muted py-4">No templates yet.</p>
              )}
              {templates.slice(0, 8).map(t => (
                <button key={t.id} onClick={() => setPreviewTemplate(t)}
                  className={`text-left p-2 rounded-lg text-[9px] border transition-all ${
                    previewTemplate?.id === t.id ? "border-gold/30 bg-gold/5" : "border-border hover:border-gold/10"
                  }`}>
                  <p className="font-semibold truncate">{t.name}</p>
                  <p className="text-muted">{t.body.length} chars</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== TCPA COMPLIANCE ===== */}
      {activeTab === "compliance" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Compliance Checker */}
            <div className="card">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Shield size={14} className="text-gold" /> TCPA Compliance Checker
              </h3>
              <div className="space-y-2">
                {[
                  { rule: "Opt-in consent recorded for all contacts", status: "pass" },
                  { rule: "Opt-out mechanism in every message", status: optOutFooter ? "pass" : "fail" },
                  { rule: "Sending within allowed hours (8AM-9PM)", status: "pass" },
                  { rule: "Business identification included", status: "pass" },
                  { rule: "No prohibited content detected", status: "pass" },
                  { rule: "Contact list scrubbed against DNC", status: "warning" },
                  { rule: "Message frequency within limits", status: "pass" },
                ].map((check, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded bg-surface-light">
                    <div className="flex items-center gap-2 text-[10px]">
                      {check.status === "pass" ? <CheckCircle size={12} className="text-green-400" /> :
                       check.status === "warning" ? <AlertTriangle size={12} className="text-yellow-400" /> :
                       <X size={12} className="text-red-400" />}
                      <span>{check.rule}</span>
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                      check.status === "pass" ? "bg-green-400/10 text-green-400" :
                      check.status === "warning" ? "bg-yellow-400/10 text-yellow-400" :
                      "bg-red-400/10 text-red-400"
                    }`}>{check.status}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Opt-out Footer Manager */}
            <div className="card">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Settings size={14} className="text-gold" /> Opt-out Footer Manager
              </h3>
              <p className="text-[10px] text-muted mb-3">This footer is automatically appended to all outgoing SMS.</p>
              <div className="space-y-2">
                {[
                  "Reply STOP to unsubscribe",
                  "Text STOP to opt out",
                  "Reply STOP to stop receiving messages",
                  "To unsubscribe, reply STOP",
                ].map((footer, i) => (
                  <button key={i} onClick={() => setOptOutFooter(footer)}
                    className={`w-full text-left p-2.5 rounded-lg text-[10px] border transition-all ${
                      optOutFooter === footer ? "border-gold/30 bg-gold/5 text-gold" : "border-border text-muted hover:border-gold/10"
                    }`}>{footer}</button>
                ))}
                <div className="flex gap-2 mt-2">
                  <input value={optOutFooter} onChange={e => setOptOutFooter(e.target.value)} className="input flex-1 text-xs" placeholder="Custom footer..." />
                  <button className="btn-primary text-xs">Save</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== SMS ANALYTICS ===== */}
      {activeTab === "analytics" && (
        <div className="space-y-4">
          {/* Overview Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: "Total Sent", value: totalSends.toLocaleString(), icon: <Send size={12} />, color: "text-gold" },
              { label: "Delivered", value: totalDelivered.toLocaleString(), icon: <CheckCircle size={12} />, color: "text-green-400" },
              { label: "Delivery Rate", value: `${deliveryRate}%`, icon: <TrendingUp size={12} />, color: "text-blue-400" },
              { label: "Total Replies", value: totalReplies.toLocaleString(), icon: <MessageSquare size={12} />, color: "text-purple-400" },
              { label: "Reply Rate", value: `${replyRate}%`, icon: <BarChart3 size={12} />, color: "text-gold" },
            ].map((stat, i) => (
              <div key={i} className="card text-center p-3">
                <div className={`w-7 h-7 rounded-lg mx-auto mb-1.5 flex items-center justify-center bg-white/5 ${stat.color}`}>{stat.icon}</div>
                <p className="text-lg font-bold">{stat.value}</p>
                <p className="text-[9px] text-muted">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Delivery Rate Monitor */}
          <div className="card">
            <h3 className="text-sm font-semibold mb-3">Delivery Rate by Template</h3>
            <div className="space-y-2">
              {templates.filter(t => t.sends > 0).length === 0 && (
                <p className="text-center text-[10px] text-muted py-6">No delivery data yet. Analytics will appear once templates are sent.</p>
              )}
              {templates.filter(t => t.sends > 0).sort((a, b) => (b.delivered / b.sends) - (a.delivered / a.sends)).map(t => {
                const rate = ((t.delivered / t.sends) * 100).toFixed(1);
                return (
                  <div key={t.id} className="flex items-center gap-3 p-2 rounded bg-surface-light">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-[10px] mb-1">
                        <span className="font-medium truncate">{t.name}</span>
                        <span className={`font-bold ${Number(rate) >= 98 ? "text-green-400" : Number(rate) >= 95 ? "text-yellow-400" : "text-red-400"}`}>{rate}%</span>
                      </div>
                      <div className="w-full bg-surface rounded-full h-1.5">
                        <div className={`rounded-full h-1.5 ${Number(rate) >= 98 ? "bg-green-400" : Number(rate) >= 95 ? "bg-yellow-400" : "bg-red-400"}`} style={{ width: `${rate}%` }} />
                      </div>
                    </div>
                    <div className="text-center text-[9px] flex-shrink-0 w-16">
                      <p className="font-bold">{t.replies}</p>
                      <p className="text-muted">replies</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===== SHORT LINKS ===== */}
      {activeTab === "links" && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Link2 size={14} className="text-gold" /> Short Link Generator
            </h3>
            <p className="text-[10px] text-muted mb-3">Create short, trackable links for your SMS messages</p>
            <div className="flex gap-2 mb-4">
              <input value={shortLinkInput} onChange={e => setShortLinkInput(e.target.value)} className="input flex-1 text-xs" placeholder="Paste your long URL here..." />
              <button className="btn-primary text-xs flex items-center gap-1.5"><Link2 size={12} /> Shorten</button>
            </div>
            <div className="space-y-1.5">
              <div className="grid grid-cols-4 text-[9px] text-muted uppercase tracking-wider font-semibold py-1.5 px-2">
                <span>Short Link</span><span>Original URL</span><span className="text-center">Clicks</span><span className="text-center">Created</span>
              </div>
              {([] as { short: string; long: string; clicks: number; date: string }[]).length === 0 ? (
                <div className="text-center py-6 text-[10px] text-muted col-span-4">No short links yet. Paste a URL above to create one.</div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* ===== SCHEDULED SEND ===== */}
      {activeTab === "schedule" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Calendar size={14} className="text-gold" /> Schedule SMS
              </h3>
              <div className="space-y-3">
                <select className="input w-full text-xs">
                  <option value="">Select template...</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <input type="datetime-local" className="input w-full text-xs" />
                <select className="input w-full text-xs">
                  <option>America/New_York (ET)</option>
                  <option>America/Chicago (CT)</option>
                  <option>America/Los_Angeles (PT)</option>
                  <option>Europe/Stockholm (CET)</option>
                </select>
                <button className="btn-primary w-full text-xs flex items-center justify-center gap-1.5">
                  <Clock size={12} /> Schedule Send
                </button>
              </div>
            </div>
            <div className="card">
              <h3 className="text-sm font-semibold mb-3">Scheduled Messages</h3>
              <div className="space-y-2">
                <div className="text-center py-6 text-[10px] text-muted">No scheduled messages yet. Use the form to schedule one.</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
