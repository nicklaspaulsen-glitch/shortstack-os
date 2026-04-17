"use client";

import { useState } from "react";
import {
  Mail, Send, Sparkles, Bold, Italic, Link2, List,
  Image as ImageIcon, Save, Monitor, Smartphone, Code,
  Clock, Eye, AlertTriangle, CheckCircle, Copy, Type,
  Paperclip, Palette, Hash, MousePointerClick,
  X, Plus, Calendar, Loader2, Wand2, TrendingUp
} from "lucide-react";
import toast from "react-hot-toast";
import Modal from "@/components/ui/modal";
import { GmailIcon, OutlookIcon } from "@/components/ui/platform-icons";

interface SubjectVariant {
  subject: string;
  predicted_open_rate: number;
  reason: string;
}

type ComposeMode = "write" | "improve" | "shorten" | "lengthen" | "tone";
type ComposeTone = "professional" | "friendly" | "casual" | "urgent" | "persuasive";

type MainTab = "compose" | "templates" | "preview" | "spam-check" | "scheduler" | "signatures";

const TEMPLATE_GALLERY: { id: string; name: string; category: string; subject: string; preview: string }[] = [];

const VARIABLES = [
  { tag: "{first_name}", label: "First Name", example: "John" },
  { tag: "{last_name}", label: "Last Name", example: "Smith" },
  { tag: "{business_name}", label: "Business", example: "Bright Smile Dental" },
  { tag: "{company}", label: "Company", example: "ShortStack" },
  { tag: "{industry}", label: "Industry", example: "Dental" },
  { tag: "{city}", label: "City", example: "Miami" },
  { tag: "{website}", label: "Website", example: "brightsmile.com" },
  { tag: "{link}", label: "Custom Link", example: "https://..." },
  { tag: "{amount}", label: "Amount", example: "$2,497" },
  { tag: "{date}", label: "Date", example: "April 14, 2026" },
  { tag: "{sender_name}", label: "Sender Name", example: "Your Name" },
  { tag: "{calendar_link}", label: "Calendar", example: "https://cal.com/..." },
];

export default function EmailComposerPage() {
  const [activeTab, setActiveTab] = useState<MainTab>("compose");
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [showHtml, setShowHtml] = useState(false);
  const [linkTracking, setLinkTracking] = useState(true);
  const [templateCategory, setTemplateCategory] = useState("all");
  const [showVarPanel, setShowVarPanel] = useState(false);
  const [showSubjectAI, setShowSubjectAI] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [scheduledTime, setScheduledTime] = useState("");

  const [email, setEmail] = useState({
    to: "",
    subject: "",
    body: "",
    fromName: "",
    replyTo: "",
  });
  const [provider, setProvider] = useState<"gmail" | "outlook" | "smtp">("gmail");

  /* ── AI state ── */
  const [showAiWrite, setShowAiWrite] = useState(false);
  const [aiWriting, setAiWriting] = useState(false);
  const [aiImproving, setAiImproving] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiMode, setAiMode] = useState<ComposeMode>("write");
  const [aiTone, setAiTone] = useState<ComposeTone>("professional");
  const [aiAudience, setAiAudience] = useState("");
  const [aiLength, setAiLength] = useState<"short" | "medium" | "long">("medium");

  const [showSubjectVariants, setShowSubjectVariants] = useState(false);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [subjectVariants, setSubjectVariants] = useState<SubjectVariant[]>([]);
  const [subjectIdeas, setSubjectIdeas] = useState<string[]>([]);

  async function handleAiCompose(mode: ComposeMode) {
    if (mode === "write" && !aiPrompt.trim()) {
      toast.error("Describe what you want to write");
      return;
    }
    if (mode !== "write" && !email.body.trim()) {
      toast.error("Write or paste email content first");
      return;
    }
    setAiWriting(true);
    try {
      const res = await fetch("/api/emails/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          prompt: aiPrompt.trim() || undefined,
          existing_email: mode === "write" ? undefined : email.body,
          tone: aiTone,
          audience: aiAudience.trim() || undefined,
          length: aiLength,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "AI write failed");
        return;
      }
      setEmail(prev => ({ ...prev, subject: data.subject || prev.subject, body: data.body || prev.body }));
      toast.success("Email generated");
      setShowAiWrite(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI write failed");
    } finally {
      setAiWriting(false);
    }
  }

  async function handleAiImprove() {
    if (!email.body.trim()) {
      toast.error("Write or paste email content first");
      return;
    }
    setAiImproving(true);
    try {
      const res = await fetch("/api/emails/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "improve",
          existing_email: email.body,
          tone: aiTone,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "AI improve failed");
        return;
      }
      setEmail(prev => ({ ...prev, subject: data.subject || prev.subject, body: data.body || prev.body }));
      toast.success("Email improved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI improve failed");
    } finally {
      setAiImproving(false);
    }
  }

  async function handleSubjectIdeas() {
    if (!email.body.trim()) {
      toast.error("Write the email body first");
      return;
    }
    setShowSubjectAI(true);
    setLoadingVariants(true);
    setSubjectIdeas([]);
    try {
      const res = await fetch("/api/emails/subject-variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: email.body, audience: aiAudience.trim() || undefined, count: 5 }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Couldn't generate subjects");
        return;
      }
      const variants: SubjectVariant[] = data.variants || [];
      setSubjectIdeas(variants.map((v: SubjectVariant) => v.subject));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Subject ideas failed");
    } finally {
      setLoadingVariants(false);
    }
  }

  async function handleGenerateSubjectVariants() {
    if (!email.body.trim()) {
      toast.error("Write the email body first");
      return;
    }
    setShowSubjectVariants(true);
    setLoadingVariants(true);
    setSubjectVariants([]);
    try {
      const res = await fetch("/api/emails/subject-variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: email.body, audience: aiAudience.trim() || undefined, count: 5 }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Couldn't generate subjects");
        return;
      }
      setSubjectVariants(data.variants || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Subject variants failed");
    } finally {
      setLoadingVariants(false);
    }
  }

  const wordCount = email.body.split(/\s+/).filter(Boolean).length;
  const charCount = email.body.length;

  const spamChecks = [
    { rule: "No spam trigger words", pass: !email.body.toLowerCase().includes("free money") && !email.body.toLowerCase().includes("act now"), weight: 20 },
    { rule: "Subject line under 60 chars", pass: email.subject.length < 60 && email.subject.length > 0, weight: 15 },
    { rule: "Has personalization tags", pass: email.body.includes("{"), weight: 15 },
    { rule: "No excessive caps", pass: email.body === email.body || (email.body.replace(/[^A-Z]/g, "").length / email.body.length) < 0.3, weight: 10 },
    { rule: "Body length 50-300 words", pass: wordCount >= 50 && wordCount <= 300, weight: 10 },
    { rule: "Has clear CTA", pass: email.body.toLowerCase().includes("call") || email.body.toLowerCase().includes("chat") || email.body.toLowerCase().includes("link"), weight: 10 },
    { rule: "From name is set", pass: email.fromName.length > 0, weight: 10 },
    { rule: "Link tracking enabled", pass: linkTracking, weight: 5 },
    { rule: "Reply-to address set", pass: email.replyTo.length > 0, weight: 5 },
  ];
  const spamScore = spamChecks.reduce((s, c) => s + (c.pass ? c.weight : 0), 0);

  const filteredTemplates = TEMPLATE_GALLERY.filter(t =>
    templateCategory === "all" || t.category === templateCategory
  );

  const TABS: { key: MainTab; label: string; icon: React.ReactNode }[] = [
    { key: "compose", label: "Compose", icon: <Mail size={14} /> },
    { key: "templates", label: "Templates", icon: <Copy size={14} /> },
    { key: "preview", label: "Preview", icon: <Eye size={14} /> },
    { key: "spam-check", label: "Spam Check", icon: <AlertTriangle size={14} /> },
    { key: "scheduler", label: "Schedule", icon: <Calendar size={14} /> },
    { key: "signatures", label: "Signatures", icon: <Palette size={14} /> },
  ];

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2">
            <Mail size={18} className="text-gold" /> Email Composer
          </h1>
          <p className="text-xs text-muted mt-0.5">Write, preview, test, and schedule emails</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setAiMode("write"); setShowAiWrite(true); }} className="btn-secondary text-xs flex items-center gap-1.5" disabled={aiWriting}>
            {aiWriting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} AI Write
          </button>
          <button onClick={handleAiImprove} className="btn-secondary text-xs flex items-center gap-1.5" disabled={aiImproving}>
            {aiImproving ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />} AI Improve
          </button>
          <button onClick={handleGenerateSubjectVariants} className="btn-secondary text-xs flex items-center gap-1.5" disabled={loadingVariants}>
            {loadingVariants ? <Loader2 size={12} className="animate-spin" /> : <TrendingUp size={12} />} Subject Variants
          </button>
          <button className="btn-primary text-xs flex items-center gap-1.5">
            <Send size={12} /> Send
          </button>
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

      {/* ===== COMPOSE TAB ===== */}
      {activeTab === "compose" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-3">
            {/* Recipient + From */}
            <div className="card space-y-2">
              {/* Email Provider Selector */}
              <div>
                <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">Send via</label>
                <div className="flex gap-1.5">
                  {([
                    { id: "gmail" as const, label: "Gmail", icon: <GmailIcon size={14} /> },
                    { id: "outlook" as const, label: "Outlook", icon: <OutlookIcon size={14} /> },
                    { id: "smtp" as const, label: "SMTP", icon: <Mail size={12} /> },
                  ]).map(p => (
                    <button key={p.id} onClick={() => setProvider(p.id)}
                      className={`flex-1 text-[10px] py-1.5 rounded-lg border capitalize transition-all flex items-center justify-center gap-1.5 ${
                        provider === p.id ? "border-gold/30 bg-gold/10 text-gold" : "border-border text-muted"
                      }`}>
                      {p.icon} {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">To</label>
                  <input value={email.to} onChange={e => setEmail({ ...email, to: e.target.value })} className="input w-full text-xs" placeholder="Recipient email or select from list..." />
                </div>
                <div>
                  <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">From</label>
                  <input value={email.fromName} onChange={e => setEmail({ ...email, fromName: e.target.value })} className="input w-full text-xs" />
                </div>
              </div>
              <div>
                <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">Reply-To</label>
                <input value={email.replyTo} onChange={e => setEmail({ ...email, replyTo: e.target.value })} className="input w-full text-xs" />
              </div>
            </div>

            {/* Subject + AI Subject Line Generator */}
            <div className="relative">
              <input value={email.subject} onChange={e => setEmail({ ...email, subject: e.target.value })}
                className="input w-full text-sm font-medium pr-24" placeholder="Subject line..." />
              <button onClick={handleSubjectIdeas} disabled={loadingVariants}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] px-2 py-1 rounded bg-gold/10 text-gold hover:bg-gold/20 transition-all flex items-center gap-1">
                {loadingVariants ? <Loader2 size={9} className="animate-spin" /> : <Sparkles size={9} />} AI Ideas
              </button>
            </div>
            {showSubjectAI && (
              <div className="card border-gold/10 p-3 space-y-1.5">
                <p className="text-[10px] font-semibold text-gold mb-2">AI Subject Line Suggestions</p>
                {loadingVariants && (
                  <div className="flex items-center gap-2 text-[9px] text-muted py-2">
                    <Loader2 size={10} className="animate-spin" /> Generating...
                  </div>
                )}
                {!loadingVariants && subjectIdeas.length === 0 && (
                  <p className="text-[9px] text-muted text-center py-2">No AI suggestions yet. Write the email body first.</p>
                )}
                {subjectIdeas.map((idea, i) => (
                  <button key={i} onClick={() => { setEmail({ ...email, subject: idea }); setShowSubjectAI(false); }}
                    className="block w-full text-left text-[10px] p-2 rounded hover:bg-gold/5 transition-all text-muted hover:text-foreground">
                    {idea}
                  </button>
                ))}
              </div>
            )}

            {/* Rich Text Toolbar */}
            <div className="flex items-center gap-1 p-1.5 rounded-lg bg-surface-light border border-border">
              {[
                { icon: <Bold size={12} />, label: "Bold" },
                { icon: <Italic size={12} />, label: "Italic" },
                { icon: <Link2 size={12} />, label: "Link" },
                { icon: <List size={12} />, label: "List" },
                { icon: <ImageIcon size={12} />, label: "Image" },
                { icon: <Type size={12} />, label: "Heading" },
              ].map(tool => (
                <button key={tool.label} className="p-2 rounded text-muted hover:text-foreground hover:bg-white/5 transition-colors" title={tool.label}>
                  {tool.icon}
                </button>
              ))}
              <div className="w-px h-4 bg-border mx-1" />
              <button onClick={() => setShowVarPanel(!showVarPanel)} className="p-2 rounded text-muted hover:text-gold hover:bg-gold/5 transition-colors flex items-center gap-1" title="Insert Variable">
                <Hash size={12} /> <span className="text-[9px]">Variables</span>
              </button>
              <div className="w-px h-4 bg-border mx-1" />
              <button onClick={() => setShowHtml(!showHtml)} className={`p-2 rounded transition-colors flex items-center gap-1 ${showHtml ? "text-gold bg-gold/10" : "text-muted hover:text-foreground hover:bg-white/5"}`}>
                <Code size={12} /> <span className="text-[9px]">HTML</span>
              </button>
              <div className="ml-auto flex items-center gap-2">
                <label className="flex items-center gap-1 text-[9px] text-muted cursor-pointer">
                  <MousePointerClick size={9} />
                  <span>Link Tracking</span>
                  <button onClick={() => setLinkTracking(!linkTracking)}
                    className={`w-6 h-3 rounded-full ml-1 ${linkTracking ? "bg-gold" : "bg-surface"}`}>
                    <div className={`w-2.5 h-2.5 bg-white rounded-full mt-px ${linkTracking ? "ml-3" : "ml-0.5"}`} />
                  </button>
                </label>
              </div>
            </div>

            {/* Variable Insertion Panel */}
            {showVarPanel && (
              <div className="card border-gold/10 p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-semibold text-gold">Insert Variable</p>
                  <button onClick={() => setShowVarPanel(false)} className="text-muted hover:text-foreground"><X size={12} /></button>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {VARIABLES.map(v => (
                    <button key={v.tag} onClick={() => setEmail(prev => ({ ...prev, body: prev.body + " " + v.tag }))}
                      className="text-left p-2 rounded bg-surface-light border border-border hover:border-gold/20 transition-all">
                      <p className="text-[9px] font-mono text-gold">{v.tag}</p>
                      <p className="text-[8px] text-muted">{v.label} ({v.example})</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Body Editor / HTML Source */}
            {showHtml ? (
              <textarea value={`<html><body><p>${email.body.replace(/\n/g, "</p><p>")}</p></body></html>`}
                className="input w-full text-xs font-mono leading-relaxed" style={{ minHeight: 300, resize: "vertical" }}
                readOnly />
            ) : (
              <textarea value={email.body} onChange={e => setEmail({ ...email, body: e.target.value })}
                className="input w-full text-sm leading-relaxed" style={{ minHeight: 300, resize: "vertical" }}
                placeholder="Write your email here..." />
            )}

            {/* Attachment Manager */}
            <div className="card p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold flex items-center gap-1.5"><Paperclip size={10} /> Attachments ({attachments.length})</p>
                <button onClick={() => setAttachments(prev => [...prev, `file_${prev.length + 1}.pdf`])}
                  className="text-[9px] px-2 py-1 rounded bg-gold/10 text-gold hover:bg-gold/20 flex items-center gap-1">
                  <Plus size={9} /> Add
                </button>
              </div>
              {attachments.length === 0 ? (
                <p className="text-[9px] text-muted text-center py-3">No attachments. Click Add to attach files.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {attachments.map((file, i) => (
                    <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded bg-surface-light border border-border text-[9px]">
                      <Paperclip size={9} className="text-muted" />
                      <span>{file}</span>
                      <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))} className="text-muted hover:text-red-400"><X size={8} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3 text-[10px] text-muted">
                <span>From: {email.fromName}</span>
                <span>{wordCount} words</span>
                <span>{charCount} chars</span>
                <span className={`flex items-center gap-1 ${spamScore >= 80 ? "text-green-400" : spamScore >= 50 ? "text-yellow-400" : "text-red-400"}`}>
                  <AlertTriangle size={9} /> Spam score: {spamScore}/100
                </span>
              </div>
              <div className="flex gap-2">
                <button className="btn-ghost text-xs flex items-center gap-1"><Save size={12} /> Draft</button>
                <button className="btn-secondary text-xs flex items-center gap-1"><Send size={12} /> Test Send</button>
                <button className="btn-primary text-xs flex items-center gap-1"><Send size={12} /> Send</button>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-3">
            {/* Quick stats */}
            <div className="card">
              <h3 className="text-[10px] font-semibold mb-2 uppercase tracking-wider text-muted">Composer Stats</h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="text-center p-2 rounded bg-surface-light">
                  <p className="text-sm font-bold text-gold">{wordCount}</p>
                  <p className="text-[8px] text-muted">Words</p>
                </div>
                <div className="text-center p-2 rounded bg-surface-light">
                  <p className="text-sm font-bold">{VARIABLES.filter(v => email.body.includes(v.tag)).length}</p>
                  <p className="text-[8px] text-muted">Variables</p>
                </div>
                <div className="text-center p-2 rounded bg-surface-light">
                  <p className="text-sm font-bold">{attachments.length}</p>
                  <p className="text-[8px] text-muted">Attachments</p>
                </div>
                <div className="text-center p-2 rounded bg-surface-light">
                  <p className={`text-sm font-bold ${spamScore >= 80 ? "text-green-400" : "text-yellow-400"}`}>{spamScore}%</p>
                  <p className="text-[8px] text-muted">Spam Score</p>
                </div>
              </div>
            </div>

            {/* Quick Templates */}
            <div className="card">
              <h3 className="text-[10px] font-semibold mb-2 uppercase tracking-wider text-muted">Quick Templates</h3>
              <div className="space-y-1">
                {TEMPLATE_GALLERY.length === 0 && (
                  <p className="text-[9px] text-muted text-center py-3">No templates yet.</p>
                )}
                {TEMPLATE_GALLERY.slice(0, 6).map(t => (
                  <button key={t.id} onClick={() => setEmail(prev => ({ ...prev, subject: t.subject, body: t.preview }))}
                    className="w-full text-left p-2 rounded-lg text-[10px] transition-all hover:bg-white/[0.03] border border-border">
                    <p className="font-semibold">{t.name}</p>
                    <p className="text-muted truncate">{t.subject}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== TEMPLATE GALLERY ===== */}
      {activeTab === "templates" && (
        <div className="space-y-4">
          <div className="flex gap-1.5 flex-wrap">
            {["all", "Outreach", "Value", "Sales", "Onboarding", "Client", "Billing", "Retention", "Promo"].map(c => (
              <button key={c} onClick={() => setTemplateCategory(c)}
                className={`text-[10px] px-3 py-1.5 rounded-lg ${
                  templateCategory === c ? "bg-gold/10 text-gold border border-gold/20" : "text-muted border border-white/[0.05]"
                }`}>{c}</button>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-2">
            {filteredTemplates.length === 0 && (
              <div className="col-span-5 text-center py-12 text-muted text-xs">No templates yet.</div>
            )}
            {filteredTemplates.map(t => (
              <button key={t.id} onClick={() => { setEmail(prev => ({ ...prev, subject: t.subject, body: t.preview })); setActiveTab("compose"); }}
                className="text-left p-3 rounded-xl bg-surface-light border border-border hover:border-gold/10 transition-all">
                <p className="text-[10px] font-semibold">{t.name}</p>
                <p className="text-[9px] text-gold mt-0.5">{t.category}</p>
                <p className="text-[9px] text-muted mt-1 line-clamp-2">{t.subject}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ===== PREVIEW MODE ===== */}
      {activeTab === "preview" && (
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-2">
            <button onClick={() => setPreviewMode("desktop")}
              className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 ${
                previewMode === "desktop" ? "bg-gold/10 text-gold border border-gold/20" : "text-muted border border-white/[0.05]"
              }`}><Monitor size={12} /> Desktop</button>
            <button onClick={() => setPreviewMode("mobile")}
              className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 ${
                previewMode === "mobile" ? "bg-gold/10 text-gold border border-gold/20" : "text-muted border border-white/[0.05]"
              }`}><Smartphone size={12} /> Mobile</button>
          </div>
          <div className="flex justify-center">
            <div className={`bg-[#1a1c23] rounded-lg shadow-2xl overflow-hidden ${previewMode === "desktop" ? "w-full max-w-2xl" : "w-[375px]"}`}>
              <div className="bg-surface p-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                  </div>
                  <div className="flex-1 text-center">
                    <p className="text-[10px] text-muted font-mono">Inbox</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <p className="text-sm font-semibold text-white mb-1">{email.subject || "No subject"}</p>
                <p className="text-[10px] text-muted mb-4">From: {email.fromName} &lt;{email.replyTo}&gt;</p>
                <div className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
                  {email.body.replace(/\{first_name\}/g, "John").replace(/\{business_name\}/g, "Bright Smile Dental").replace(/\{industry\}/g, "dental").replace(/\{company\}/g, "ShortStack").replace(/\{city\}/g, "Miami")}
                </div>
                {attachments.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <p className="text-[10px] text-muted mb-2">Attachments ({attachments.length})</p>
                    <div className="flex gap-2">
                      {attachments.map((f, i) => (
                        <div key={i} className="flex items-center gap-1 px-2 py-1 rounded bg-white/5 text-[9px] text-muted">
                          <Paperclip size={8} /> {f}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== SPAM SCORE CHECKER ===== */}
      {activeTab === "spam-check" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="card text-center p-6">
              <div className={`w-24 h-24 rounded-full border-4 flex items-center justify-center mx-auto mb-3 ${
                spamScore >= 80 ? "border-green-400" : spamScore >= 50 ? "border-yellow-400" : "border-red-400"
              }`}>
                <div>
                  <p className={`text-3xl font-bold ${spamScore >= 80 ? "text-green-400" : spamScore >= 50 ? "text-yellow-400" : "text-red-400"}`}>{spamScore}</p>
                  <p className="text-[9px] text-muted">/ 100</p>
                </div>
              </div>
              <h3 className="text-sm font-semibold">Spam Score</h3>
              <p className={`text-[10px] mt-1 ${spamScore >= 80 ? "text-green-400" : spamScore >= 50 ? "text-yellow-400" : "text-red-400"}`}>
                {spamScore >= 80 ? "Excellent - Safe to send" : spamScore >= 50 ? "Fair - Review suggestions" : "Poor - High spam risk"}
              </p>
            </div>
            <div className="card col-span-1 lg:col-span-2">
              <h3 className="text-sm font-semibold mb-3">Deliverability Checklist</h3>
              <div className="space-y-2">
                {spamChecks.map((check, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded bg-surface-light">
                    <div className="flex items-center gap-2 text-[10px]">
                      {check.pass ? <CheckCircle size={12} className="text-green-400" /> : <AlertTriangle size={12} className="text-red-400" />}
                      <span>{check.rule}</span>
                    </div>
                    <span className={`text-[9px] font-bold ${check.pass ? "text-green-400" : "text-red-400"}`}>
                      {check.pass ? `+${check.weight}` : `0/${check.weight}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== SCHEDULE ===== */}
      {activeTab === "scheduler" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Calendar size={14} className="text-gold" /> Schedule Send
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">Date & Time</label>
                  <input type="datetime-local" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} className="input w-full text-xs" />
                </div>
                <div>
                  <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">Timezone</label>
                  <select className="input w-full text-xs">
                    <option>America/New_York (ET)</option>
                    <option>America/Chicago (CT)</option>
                    <option>America/Los_Angeles (PT)</option>
                    <option>Europe/London (GMT)</option>
                    <option>Europe/Stockholm (CET)</option>
                  </select>
                </div>
                <button className="btn-primary w-full text-xs flex items-center justify-center gap-1.5">
                  <Clock size={12} /> Schedule Email
                </button>
              </div>
            </div>
            <div className="card">
              <h3 className="text-sm font-semibold mb-3">Optimal Send Times</h3>
              <p className="text-[10px] text-muted mb-3">Based on your audience engagement data</p>
              <div className="space-y-2">
                <p className="text-center text-[10px] text-muted py-4">No engagement data yet. Send times will be suggested once you have audience data.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== AI WRITE MODAL ===== */}
      <Modal isOpen={showAiWrite} onClose={() => setShowAiWrite(false)} title="Write Email with AI" size="lg">
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-muted uppercase tracking-wider block mb-1">What should this email be about?</label>
            <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} rows={4}
              className="input w-full text-xs" placeholder="e.g. Follow up with a dental practice owner we called last week about a lead generation trial..." />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] text-muted uppercase tracking-wider block mb-1">Tone</label>
              <select value={aiTone} onChange={e => setAiTone(e.target.value as ComposeTone)} className="input w-full text-xs">
                <option value="professional">Professional</option>
                <option value="friendly">Friendly</option>
                <option value="casual">Casual</option>
                <option value="urgent">Urgent</option>
                <option value="persuasive">Persuasive</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-muted uppercase tracking-wider block mb-1">Length</label>
              <select value={aiLength} onChange={e => setAiLength(e.target.value as "short" | "medium" | "long")} className="input w-full text-xs">
                <option value="short">Short</option>
                <option value="medium">Medium</option>
                <option value="long">Long</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-muted uppercase tracking-wider block mb-1">Audience</label>
              <input value={aiAudience} onChange={e => setAiAudience(e.target.value)} className="input w-full text-xs" placeholder="e.g. SMB owners" />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button onClick={() => setShowAiWrite(false)} className="btn-ghost text-xs">Cancel</button>
            <button onClick={() => handleAiCompose(aiMode)} disabled={aiWriting} className="btn-primary text-xs flex items-center gap-1.5">
              {aiWriting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Generate
            </button>
          </div>
        </div>
      </Modal>

      {/* ===== SUBJECT VARIANTS MODAL ===== */}
      <Modal isOpen={showSubjectVariants} onClose={() => setShowSubjectVariants(false)} title="Subject Line Variants (Ranked)" size="lg">
        <div className="space-y-2">
          {loadingVariants && (
            <div className="flex items-center justify-center gap-2 text-xs text-muted py-8">
              <Loader2 size={14} className="animate-spin" /> Scoring variants...
            </div>
          )}
          {!loadingVariants && subjectVariants.length === 0 && (
            <p className="text-xs text-muted text-center py-8">No variants yet.</p>
          )}
          {!loadingVariants && subjectVariants.map((v, i) => (
            <button key={i} onClick={() => { setEmail({ ...email, subject: v.subject }); setShowSubjectVariants(false); toast.success("Subject applied"); }}
              className="block w-full text-left p-3 rounded-lg bg-surface-light border border-border hover:border-gold/30 transition-all">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold">{v.subject}</p>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-400/10 text-green-400 font-bold">{v.predicted_open_rate.toFixed(0)}% open</span>
              </div>
              <p className="text-[10px] text-muted">{v.reason}</p>
            </button>
          ))}
        </div>
      </Modal>

      {/* ===== SIGNATURE BUILDER ===== */}
      {activeTab === "signatures" && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Palette size={14} className="text-gold" /> Signature Builder
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card space-y-3">
              <h4 className="text-xs font-semibold">Edit Signature</h4>
              <input className="input w-full text-xs" placeholder="Full Name" defaultValue="" />
              <input className="input w-full text-xs" placeholder="Title" defaultValue="" />
              <input className="input w-full text-xs" placeholder="Phone" defaultValue="" />
              <input className="input w-full text-xs" placeholder="Email" defaultValue="" />
              <input className="input w-full text-xs" placeholder="Website" defaultValue="" />
              <input className="input w-full text-xs" placeholder="Calendar link" defaultValue="" />
              <button className="btn-primary w-full text-xs">Save Signature</button>
            </div>
            <div className="card">
              <h4 className="text-xs font-semibold mb-3">Preview</h4>
              <div className="p-4 rounded-lg bg-[#1a1c23]">
                <div className="border-t-2 border-amber-500 pt-3">
                  <p className="text-sm font-bold text-gray-500 italic">No signature configured</p>
                  <p className="text-[10px] text-gray-500">Fill in the fields to preview your signature</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
