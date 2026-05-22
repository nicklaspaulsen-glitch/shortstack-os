"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Mail, Copy, Send, X, FileText, Tag, Sparkles,
  Search, Monitor, Smartphone, Eye, BarChart3,
  Plus, Star, GitBranch, Download, Upload,
  TrendingUp, Edit3, Trash2, Moon, Loader2
} from "lucide-react";
import toast from "react-hot-toast";
import Modal from "@/components/ui/modal";
import AIEnhanceButton from "@/components/ui/ai-enhance-button";
import { PrismPanel, PRISM_RAINBOW_GRADIENT } from "@/components/prism";
import { MotionPage } from "@/components/motion/motion-page";

type AiTemplateType =
  | "welcome"
  | "nurture"
  | "promo"
  | "winback"
  | "onboarding"
  | "broadcast"
  | "transactional"
  | "custom";

interface AiVariant {
  subject: string;
  body: string;
  angle: string;
}

type MainTab = "gallery" | "editor" | "performance" | "versions" | "ai-generate" | "import-export";

interface Template {
  id: number;
  name: string;
  subject: string;
  category: string;
  body: string;
  opens: number;
  clicks: number;
  replies: number;
  version: number;
  lastEdited: string;
  shared: boolean;
}

const CATEGORIES = ["All", "Welcome", "Follow-up", "Re-engagement", "Invoice", "Report", "Promotion", "Onboarding", "Sales", "Retention"];

const TEMPLATES: Template[] = [];

const MERGE_TAGS = [
  { tag: "{{client_name}}", desc: "Client's name" },
  { tag: "{{company}}", desc: "Your company name" },
  { tag: "{{sender_name}}", desc: "Sender name" },
  { tag: "{{invoice_number}}", desc: "Invoice #" },
  { tag: "{{amount_usd}}", desc: "Dollar amount" },
  { tag: "{{due_date}}", desc: "Due date" },
  { tag: "{{booking_link}}", desc: "Calendar link" },
  { tag: "{{portal_link}}", desc: "Portal URL" },
  { tag: "{{project_name}}", desc: "Project name" },
  { tag: "{{review_link}}", desc: "Review URL" },
  { tag: "{{date_range}}", desc: "Date range" },
  { tag: "{{offer_title}}", desc: "Offer title" },
];

const categoryColors: Record<string, string> = {
  Welcome: "bg-green-500/10 text-green-400",
  "Follow-up": "bg-[rgba(99,102,241,0.10)] text-indigo-400",
  "Re-engagement": "bg-orange-500/10 text-orange-400",
  Invoice: "bg-yellow-500/10 text-yellow-400",
  Report: "bg-purple-500/10 text-purple-400",
  Promotion: "bg-pink-500/10 text-pink-400",
  Onboarding: "bg-teal-500/10 text-teal-400",
  Sales: "bg-indigo-500/10 text-indigo-400",
  Retention: "bg-amber-500/10 text-amber-400",
};

export default function EmailTemplatesPage() {
  const [activeTab, setActiveTab] = useState<MainTab>("gallery");
  const [filterCategory, setFilterCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [editedBody, setEditedBody] = useState("");
  const [editedSubject, setEditedSubject] = useState("");
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile" | "dark">("desktop");
  const [aiPrompt, setAiPrompt] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "opens" | "replies">("name");

 /* -- AI state -- */
  const [aiTemplateType, setAiTemplateType] = useState<AiTemplateType>("welcome");
  const [aiAudience, setAiAudience] = useState("");
  const [aiBrandVoice, setAiBrandVoice] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiGenerated, setAiGenerated] = useState<{ name: string; subject: string; preheader: string; body: string; html_version?: string; merge_tags: string[] } | null>(null);
  const [showVariantsModal, setShowVariantsModal] = useState(false);
  const [variantsLoading, setVariantsLoading] = useState(false);
  const [variants, setVariants] = useState<AiVariant[]>([]);

  async function handleGenerateTemplate() {
    if (!aiPrompt.trim() && aiTemplateType === "custom") {
      toast.error("Describe the template you need");
      return;
    }
    setAiGenerating(true);
    setAiGenerated(null);
    try {
      const res = await fetch("/api/email-templates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_type: aiTemplateType,
          goal: aiPrompt.trim() || undefined,
          audience: aiAudience.trim() || undefined,
          brand_voice: aiBrandVoice.trim() || undefined,
          include_merge_tags: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Template generation failed");
        return;
      }
      setAiGenerated(data);
      setEditedSubject(data.subject || "");
      setEditedBody(data.body || "");
      toast.success("Template generated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Template generation failed");
    } finally {
      setAiGenerating(false);
    }
  }

  async function handleGenerateVariants() {
    const source = editedBody || aiGenerated?.body || selectedTemplate?.body;
    if (!source) {
      toast.error("Open or generate a template first");
      return;
    }
    setShowVariantsModal(true);
    setVariantsLoading(true);
    setVariants([]);
    try {
      const res = await fetch("/api/email-templates/variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_body: source, count: 3 }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Variants failed");
        return;
      }
      setVariants(data.variants || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Variants failed");
    } finally {
      setVariantsLoading(false);
    }
  }

  const filtered = TEMPLATES
    .filter(t => (filterCategory === "All" || t.category === filterCategory) &&
      (!search || t.name.toLowerCase().includes(search.toLowerCase()) || t.subject.toLowerCase().includes(search.toLowerCase())))
    .sort((a, b) => sortBy === "opens" ? b.opens - a.opens : sortBy === "replies" ? b.replies - a.replies : a.name.localeCompare(b.name));

  const openTemplate = (t: Template) => {
    setSelectedTemplate(t);
    setEditedBody(t.body);
    setEditedSubject(t.subject);
  };

  const TABS: { key: MainTab; label: string; icon: React.ReactNode }[] = [
    { key: "gallery", label: "Template Gallery", icon: <Mail size={14} /> },
    { key: "editor", label: "Editor", icon: <Edit3 size={14} /> },
    { key: "performance", label: "Performance", icon: <BarChart3 size={14} /> },
    { key: "versions", label: "Versioning", icon: <GitBranch size={14} /> },
    { key: "ai-generate", label: "AI Generator", icon: <Sparkles size={14} /> },
    { key: "import-export", label: "Import/Export", icon: <Download size={14} /> },
  ];

  return (
    <MotionPage className="space-y-6">{/* -- Email Templates command strip -- */}
    <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-[0.2em] text-text-muted font-editorial italic mb-1">Template Library</p>
        <h1 className="text-2xl font-display font-bold text-text-primary">Email Templates</h1>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button className="px-3 py-1.5 rounded-lg bg-white/10 border border-border-subtle text-text-primary text-xs font-semibold hover:bg-white/15 transition-all flex items-center gap-1.5">
                  <Plus size={12} /> New Template
                </button>
      </div>
    </div>{/* Tabs */}<div className="flex gap-1 bg-surface rounded-lg p-1 overflow-x-auto">
              {TABS.map(t => (
                <button key={t.key} onClick={() => setActiveTab(t.key)}
                  className={`px-4 py-2 text-xs rounded-md flex items-center gap-2 whitespace-nowrap transition-all ${
                    activeTab === t.key ? "bg-brand-accent text-[#020711] font-medium" : "text-text-muted hover:text-text-primary"
                  }`}>{t.icon} {t.label}</button>
              ))}
            </div>{/* ===== TEMPLATE GALLERY ===== */}{activeTab === "gallery" && (
              <div className="space-y-4">
                {/* Filters */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input value={search} onChange={e => setSearch(e.target.value)} className="rounded-xl w-full pl-9 text-xs px-3 py-2 text-text-primary placeholder:text-text-muted outline-none bg-white/5 border border-border-subtle" placeholder="Search templates..." aria-label="Search email templates" />
                  </div>
                  <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)} className="rounded-xl text-xs px-3 py-2 text-text-primary outline-none bg-white/5 border border-border-subtle">
                    <option value="name">Sort: Name</option>
                    <option value="opens">Sort: Opens</option>
                    <option value="replies">Sort: Replies</option>
                  </select>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {CATEGORIES.map(cat => (
                    <button key={cat} onClick={() => setFilterCategory(cat)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                        filterCategory === cat ? "bg-[rgba(212,255,0,0.08)] text-brand-accent border border-[rgba(212,255,0,0.20)]" : "bg-white/4 text-text-muted border border-border-subtle hover:bg-white/8"
                      }`}>{cat}</button>
                  ))}
                </div>

                {/* Template Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filtered.length === 0 && (
                    <div className="col-span-4 text-center py-12 text-text-muted text-xs">No templates yet. Click &quot;New Template&quot; to get started.</div>
                  )}
                  {filtered.map((template, i) => (
                    <motion.div
                      key={template.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.4 }}
                      whileHover={{ y: -4, scale: 1.01 }}
                      onMouseMove={(e) => { const rect = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`); e.currentTarget.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`); }}
                      onClick={() => openTemplate(template)}
                      className="glass rounded-xl overflow-hidden cursor-pointer group spotlight-card"
>
                      <div style={{ height: 3, background: PRISM_RAINBOW_GRADIENT, borderRadius: "4px 4px 0 0" }} />
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold truncate">{template.name}</p>
                            <p className="text-[10px] text-text-muted truncate mt-0.5">{template.subject}</p>
                          </div>
                          {template.shared && <Star size={10} className="text-brand-accent flex-shrink-0 mt-0.5" />}
                        </div>
                        {/* Mini preview */}
                        <div className="rounded-lg p-2 mb-2 text-[8px] text-text-muted leading-relaxed line-clamp-3" style={{ background: "rgba(255,255,255,0.88)", border: "1px solid rgba(255,255,255,0.70)" }}>
                          {template.body.substring(0, 120)}...
                        </div>
                        <div className="flex items-center justify-between">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded ${categoryColors[template.category] || "bg-white/5 text-text-muted"}`}>
                            {template.category}
                          </span>
                          <div className="flex items-center gap-2 text-[8px] text-text-muted">
                            <span className="flex items-center gap-0.5"><Eye size={8} /> {template.opens}%</span>
                            <span className="flex items-center gap-0.5"><Mail size={8} /> {template.replies}%</span>
                          </div>
                        </div>
                        <p className="text-[8px] text-text-muted mt-1.5">v{template.version} | {template.lastEdited}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}{/* ===== TEMPLATE EDITOR ===== */}{activeTab === "editor" && (
              <div className="space-y-4">
                {selectedTemplate ? (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded ${categoryColors[selectedTemplate.category] || ""}`}>{selectedTemplate.category}</span>
                        <span className="text-[9px] text-text-muted">v{selectedTemplate.version}</span>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[9px] text-text-muted uppercase tracking-wider">Subject</label>
                          <AIEnhanceButton value={editedSubject} onResult={setEditedSubject} context="email subject line" variant="inline" />
                        </div>
                        <input value={editedSubject} onChange={e => setEditedSubject(e.target.value)}
                          className="input w-full text-sm font-medium" placeholder="Subject line..." />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[9px] text-text-muted uppercase tracking-wider">Body</label>
                          <AIEnhanceButton value={editedBody} onResult={setEditedBody} context="email body copy" variant="inline" />
                        </div>
                        <textarea value={editedBody} onChange={e => setEditedBody(e.target.value)}
                          rows={16} className="input w-full text-xs font-mono resize-none leading-relaxed" />
                      </div>
                      <div className="flex gap-2">
                        <button className="btn-primary text-xs flex items-center gap-1.5"><Save size={12} /> Save</button>
                        <button className="btn-secondary text-xs flex items-center gap-1.5"><Copy size={12} /> Duplicate</button>
                        <button className="btn-secondary text-xs flex items-center gap-1.5"><Send size={12} /> Send Test</button>
                        <button className="btn-ghost text-xs flex items-center gap-1.5 text-red-400"><Trash2 size={12} /> Delete</button>
                      </div>
                    </div>
                    {/* Merge Tag Helper */}
                    <div className="space-y-3">
                      <div className="glass rounded-xl p-4">
                        <h4 className="text-[10px] font-semibold mb-2 uppercase tracking-wider text-text-muted">Merge Tags</h4>
                        <div className="space-y-1">
                          {MERGE_TAGS.map(tag => (
                            <button key={tag.tag} onClick={() => setEditedBody(prev => prev + " " + tag.tag)}
                              className="flex items-center justify-between w-full p-1.5 rounded hover:bg-[rgba(212,255,0,0.05)] transition-all text-[10px]">
                              <span className="font-mono text-brand-accent">{tag.tag}</span>
                              <span className="text-text-muted">{tag.desc}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      {/* Preview Modes */}
                      <div className="glass rounded-xl p-4">
                        <h4 className="text-[10px] font-semibold mb-2 uppercase tracking-wider text-text-muted">Preview Mode</h4>
                        <div className="flex gap-1">
                          {[
                            { key: "desktop", icon: <Monitor size={12} />, label: "Desktop" },
                            { key: "mobile", icon: <Smartphone size={12} />, label: "Mobile" },
                            { key: "dark", icon: <Moon size={12} />, label: "Dark" },
                          ].map(m => (
                            <button key={m.key} onClick={() => setPreviewMode(m.key as typeof previewMode)}
                              className={`flex-1 text-[9px] py-1.5 rounded flex items-center justify-center gap-1 ${
                                previewMode === m.key ? "bg-[rgba(212,255,0,0.08)] text-brand-accent" : "text-text-muted hover:bg-white/5"
                              }`}>{m.icon} {m.label}</button>
                          ))}
                        </div>
                        <div className={`mt-3 rounded-lg overflow-hidden ${previewMode === "dark" ? "bg-gray-900" : "bg-white"}`}>
                          <div className={`p-3 text-[9px] leading-relaxed ${previewMode === "dark" ? "text-text-muted" : "text-gray-700"}`}>
                            <p className={`font-semibold mb-1 ${previewMode === "dark" ? "text-white" : "text-gray-900"}`}>{editedSubject}</p>
                            <p className="whitespace-pre-wrap">{editedBody.substring(0, 200)}...</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass rounded-xl text-center py-12" 
>
                    <Edit3 size={24} className="mx-auto mb-2 text-text-muted/30" />
                    <p className="text-sm text-text-muted">Select a template from the Gallery to edit</p>
                  </motion.div>
                )}
              </div>
            )}{/* ===== PERFORMANCE STATS ===== */}{activeTab === "performance" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 lg:grid-cols-[4fr_2fr_2fr_2fr] gap-3 mb-4">
                  {/* Focal tile */}
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.04 }}
                    className="flex items-start gap-3 glass rounded-2xl p-5"
                  >
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Avg Open Rate</p>
                      <p className="font-display text-3xl font-bold tracking-[-0.03em] text-text-primary tabular-nums">
                        {TEMPLATES.length > 0 ? `${Math.round(TEMPLATES.reduce((s, t) => s + t.opens, 0) / TEMPLATES.length)}%` : "0%"}
                      </p>
                    </div>
                  </motion.div>
                  {/* Support tiles */}
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.10 }}
                    className="glass rounded-2xl p-5"
                  >
                    <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Avg Click Rate</p>
                    <p className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary tabular-nums">
                      {TEMPLATES.length > 0 ? `${Math.round(TEMPLATES.reduce((s, t) => s + t.clicks, 0) / TEMPLATES.length)}%` : "0%"}
                    </p>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.14 }}
                    className="glass rounded-2xl p-5"
                  >
                    <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Avg Reply Rate</p>
                    <p className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary tabular-nums">
                      {TEMPLATES.length > 0 ? `${Math.round(TEMPLATES.reduce((s, t) => s + t.replies, 0) / TEMPLATES.length)}%` : "0%"}
                    </p>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.18 }}
                    className="glass rounded-2xl p-5"
                  >
                    <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Top Performer</p>
                    <p className="font-display text-2xl font-bold tracking-[-0.02em] text-text-primary tabular-nums truncate">
                      {TEMPLATES.length > 0 ? [...TEMPLATES].sort((a, b) => b.replies - a.replies)[0].name : "N/A"}
                    </p>
                  </motion.div>
                </div>
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="glass rounded-xl p-4" 
>
                  <h3 className="text-sm font-semibold mb-3">Template Performance Ranking</h3>
                  <div className="space-y-2">
                    {TEMPLATES.length === 0 && (
                      <p className="text-center text-[10px] text-text-muted py-6">No templates yet. Performance data will appear here once templates are created and used.</p>
                    )}
                    {[...TEMPLATES].sort((a, b) => b.replies - a.replies).map((t, i) => (
                      <motion.div
                        key={t.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="flex items-center gap-3 p-2.5 rounded" style={{ background: "rgba(255,255,255,0.88)", border: "1px solid rgba(255,255,255,0.70)" }}
>
                        <span className="text-[9px] text-text-muted font-bold w-6 text-center">#{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{t.name}</p>
                          <p className="text-[9px] text-text-muted">{t.category}</p>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-center text-[10px]">
                          <div><p className="font-bold text-brand-accent">{t.opens}%</p><p className="text-[8px] text-text-muted">Opens</p></div>
                          <div><p className="font-bold text-green-400">{t.clicks}%</p><p className="text-[8px] text-text-muted">Clicks</p></div>
                          <div><p className="font-bold text-purple-400">{t.replies}%</p><p className="text-[8px] text-text-muted">Replies</p></div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              </div>
            )}{/* ===== VERSIONING ===== */}{activeTab === "versions" && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <GitBranch size={14} className="text-brand-accent" /> Template Version History
                </h3>
                <div className="space-y-3">
                  {TEMPLATES.filter(t => t.version> 1).length === 0 && (
                    <p className="text-center text-[10px] text-text-muted py-6">No version history yet. Versions will appear here as templates are edited.</p>
                  )}
                  {TEMPLATES.filter(t => t.version> 1).map((t, i) => (
                    <motion.div
                      key={t.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="glass rounded-xl p-4" 
>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold">{t.name}</p>
                        <span className="text-[9px] px-2 py-0.5 rounded bg-[rgba(212,255,0,0.08)] text-brand-accent">v{t.version} (current)</span>
                      </div>
                      <div className="space-y-1.5">
                        {Array.from({ length: t.version }, (_, i) => t.version - i).map(v => (
                          <div key={v} className="flex items-center justify-between p-2 rounded glass-md text-[10px]">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${v === t.version ? "bg-brand-accent" : "bg-muted"}`} />
                              <span className={v === t.version ? "font-semibold" : "text-text-muted"}>Version {v}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-text-muted">{v === t.version ? t.lastEdited : `Mar ${10 + v}`}</span>
                              {v !== t.version && (
                                <button className="text-[9px] px-2 py-0.5 rounded bg-white/5 text-text-muted hover:text-brand-accent">Restore</button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}{/* ===== AI TEMPLATE GENERATOR ===== */}{activeTab === "ai-generate" && (
              <div className="space-y-4">
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass rounded-xl p-6" 
>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-[rgba(212,255,0,0.08)] rounded-xl flex items-center justify-center">
                      <Sparkles size={18} className="text-brand-accent" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold">AI Template Generator</h3>
                      <p className="text-[10px] text-text-muted">Describe the template you need and AI will create it.</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] text-text-muted uppercase tracking-wider block mb-1">Template Type</label>
                      <select value={aiTemplateType} onChange={e => setAiTemplateType(e.target.value as AiTemplateType)} className="input w-full text-xs">
                        <option value="welcome">Welcome</option>
                        <option value="nurture">Nurture</option>
                        <option value="promo">Promo</option>
                        <option value="winback">Winback</option>
                        <option value="onboarding">Onboarding</option>
                        <option value="broadcast">Broadcast</option>
                        <option value="transactional">Transactional</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] text-text-muted uppercase tracking-wider">Goal / Description</label>
                        <AIEnhanceButton value={aiPrompt} onResult={setAiPrompt} context="email body copy" variant="inline" />
                      </div>
                      <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
                        className="input w-full text-xs h-20 resize-none" placeholder="e.g. Re-engage dental practices that stopped opening our emails. Reference a case study, offer a free audit, book a call." />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-text-muted uppercase tracking-wider block mb-1">Audience</label>
                        <input value={aiAudience} onChange={e => setAiAudience(e.target.value)} className="input w-full text-xs" placeholder="Dental practice owners" />
                      </div>
                      <div>
                        <label className="text-[10px] text-text-muted uppercase tracking-wider block mb-1">Brand Voice</label>
                        <input value={aiBrandVoice} onChange={e => setAiBrandVoice(e.target.value)} className="input w-full text-xs" placeholder="Warm, direct, no-fluff" />
                      </div>
                    </div>

                    <div className="flex gap-2 justify-center flex-wrap">
                      {["Follow-up", "Welcome", "Re-engagement", "Upsell", "Review request", "Holiday promo"].map(q => (
                        <button key={q} onClick={() => setAiPrompt(`Write a ${q.toLowerCase()} email template for a digital marketing agency. Professional but conversational tone.`)}
                          className="text-[9px] px-2 py-1 rounded bg-white/5 text-text-muted border border-border-subtle hover:border-[rgba(212,255,0,0.25)] hover:text-brand-accent transition-all">{q}</button>
                      ))}
                    </div>

                    <button onClick={handleGenerateTemplate} disabled={aiGenerating} className="btn-primary text-xs flex items-center gap-1.5">
                      {aiGenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                      {aiGenerating ? "Generating..." : "Generate Template"}
                    </button>
                  </div>
                </motion.div>

                {aiGenerated && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass rounded-xl p-4" 
>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="text-sm font-semibold">{aiGenerated.name}</h4>
                        <p className="text-[10px] text-text-muted">{aiGenerated.merge_tags.length} merge tags</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={handleGenerateVariants} className="btn-secondary text-xs flex items-center gap-1.5">
                          <GitBranch size={12} /> Generate A/B Variants
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] text-text-muted uppercase tracking-wider">Subject</label>
                          <AIEnhanceButton value={editedSubject} onResult={setEditedSubject} context="email subject line" variant="inline" />
                        </div>
                        <input value={editedSubject} onChange={e => setEditedSubject(e.target.value)} className="input w-full text-xs" />
                      </div>
                      <div>
                        <label className="text-[10px] text-text-muted uppercase tracking-wider block mb-1">Preheader</label>
                        <p className="text-[10px] text-text-muted">{aiGenerated.preheader}</p>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] text-text-muted uppercase tracking-wider">Body</label>
                          <AIEnhanceButton value={editedBody} onResult={setEditedBody} context="email body copy" variant="inline" />
                        </div>
                        <textarea value={editedBody} onChange={e => setEditedBody(e.target.value)} rows={12} className="input w-full text-xs font-mono resize-none" />
                      </div>
                      {aiGenerated.merge_tags.length> 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {aiGenerated.merge_tags.map(tag => (
                            <span key={tag} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[rgba(212,255,0,0.08)] text-brand-accent">{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </div>
            )}{/* A/B Variants Modal */}<Modal isOpen={showVariantsModal} onClose={() => setShowVariantsModal(false)} title="A/B Variants" size="xl">
              <div className="space-y-3">
                {variantsLoading && (
                  <div className="flex items-center justify-center gap-2 text-xs text-text-muted py-8">
                    <Loader2 size={14} className="animate-spin" /> Generating variants...
                  </div>
                )}
                {!variantsLoading && variants.length === 0 && (
                  <p className="text-xs text-text-muted text-center py-8">No variants yet.</p>
                )}
                {!variantsLoading && variants.map((v, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="glass rounded-xl p-3" 
>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-[rgba(212,255,0,0.08)] text-brand-accent font-semibold">{v.angle}</span>
                      <button onClick={() => { setEditedSubject(v.subject); setEditedBody(v.body); setShowVariantsModal(false); toast.success("Variant applied"); }} className="btn-primary text-[10px] py-1 px-2">Apply</button>
                    </div>
                    <p className="text-xs font-semibold mb-1">{v.subject}</p>
                    <p className="text-[10px] text-text-muted whitespace-pre-wrap">{v.body}</p>
                  </motion.div>
                ))}
              </div>
            </Modal>{/* ===== IMPORT/EXPORT ===== */}{activeTab === "import-export" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0 }}
                    className="glass rounded-xl text-center p-6" 
>
                    <Upload size={24} className="mx-auto mb-2 text-brand-accent" />
                    <h3 className="text-sm font-semibold mb-1">Import Templates</h3>
                    <p className="text-[10px] text-text-muted mb-3">Upload HTML or JSON template files</p>
                    <div className="border-2 border-dashed border-border-subtle rounded-lg p-6 mb-3">
                      <p className="text-[10px] text-text-muted">Drag and drop files here or click to browse</p>
                      <p className="text-[8px] text-text-muted mt-1">Supports .html, .json, .mjml</p>
                    </div>
                    <button className="btn-secondary text-xs">Browse Files</button>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className="glass rounded-xl text-center p-6" 
>
                    <Download size={24} className="mx-auto mb-2 text-brand-accent" />
                    <h3 className="text-sm font-semibold mb-1">Export Templates</h3>
                    <p className="text-[10px] text-text-muted mb-3">Download your templates for backup or sharing</p>
                    <div className="space-y-2">
                      <button className="btn-secondary w-full text-xs flex items-center justify-center gap-1.5">
                        <FileText size={12} /> Export All as JSON
                      </button>
                      <button className="btn-secondary w-full text-xs flex items-center justify-center gap-1.5">
                        <Mail size={12} /> Export All as HTML
                      </button>
                      <button className="btn-secondary w-full text-xs flex items-center justify-center gap-1.5">
                        <Copy size={12} /> Export Selected Only
                      </button>
                    </div>
                  </motion.div>
                </div>
                {/* Template Sharing */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="glass rounded-xl p-4" 
>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Share2 size={14} className="text-brand-accent" /> Template Sharing
                  </h3>
                  <div className="space-y-1.5">
                    {TEMPLATES.length === 0 && (
                      <p className="text-center text-[10px] text-text-muted py-4">No templates to share yet.</p>
                    )}
                    {TEMPLATES.map((t, i) => (
                      <motion.div
                        key={t.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="flex items-center justify-between p-2 rounded glass-md text-[10px]"
>
                        <span className="font-medium">{t.name}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded ${t.shared ? "bg-green-500/10 text-green-400" : "bg-white/5 text-text-muted"}`}>
                            {t.shared ? "Shared" : "Private"}
                          </span>
                          <button className="text-[9px] px-2 py-0.5 rounded bg-[rgba(212,255,0,0.08)] text-brand-accent hover:bg-[rgba(212,255,0,0.12)]">
                            {t.shared ? "Unshare" : "Share"}
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              </div>
            )}{/* Template Editor Modal */}{selectedTemplate && activeTab === "gallery" && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.97, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className="glass rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col" 
>
                  <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <Tag size={14} className="text-brand-accent" />
                      <h3 className="text-sm font-bold">{selectedTemplate.name}</h3>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${categoryColors[selectedTemplate.category] || ""}`}>{selectedTemplate.category}</span>
                    </div>
                    <button onClick={() => setSelectedTemplate(null)} className="text-text-muted hover:text-text-primary"><X size={16} /></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] text-text-muted uppercase tracking-wider">Subject Line</label>
                        <AIEnhanceButton value={editedSubject} onResult={setEditedSubject} context="email subject line" variant="inline" />
                      </div>
                      <input value={editedSubject} onChange={e => setEditedSubject(e.target.value)} className="input w-full text-xs" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] text-text-muted uppercase tracking-wider">Email Body</label>
                        <AIEnhanceButton value={editedBody} onResult={setEditedBody} context="email body copy" variant="inline" />
                      </div>
                      <textarea value={editedBody} onChange={e => setEditedBody(e.target.value)} rows={12} className="input w-full text-xs resize-none font-mono" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-4 border-t border-white/10">
                    <button className="btn-primary flex items-center gap-1.5 text-[10px]"><Copy size={12} /> Copy</button>
                    <button onClick={handleGenerateVariants} className="btn-secondary flex items-center gap-1.5 text-[10px]"><Sparkles size={12} /> A/B Variants</button>
                    <button onClick={() => { setActiveTab("editor"); }} className="btn-secondary flex items-center gap-1.5 text-[10px]"><Edit3 size={12} /> Full Editor</button>
                    <button onClick={() => setSelectedTemplate(null)} className="btn-primary flex items-center gap-1.5 text-[10px] ml-auto"><Send size={12} /> Use Template</button>
                  </div>
                </motion.div>
              </div>
            )}</MotionPage>
  );
}

function Share2({ size, className }: { size: number; className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  );
}

function Save({ size, className }: { size: number; className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
      <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
    </svg>
  );
}


