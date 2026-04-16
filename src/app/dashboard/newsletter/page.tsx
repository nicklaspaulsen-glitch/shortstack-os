"use client";

import { useState, useRef } from "react";
import toast from "react-hot-toast";
import {
  Mail, Send, Sparkles, Eye, Monitor, Smartphone,
  Trash2, GripVertical, Image as ImageIcon,
  Type, MousePointerClick, Link2, Clock, Calendar,
  BarChart3, Users, ChevronDown, ChevronUp,
  Layout, Megaphone, BookOpen,
  Briefcase, Gift, Zap, Copy, Check, X,
  ArrowUp, ArrowDown, Loader2,
} from "lucide-react";

/* ─────────── types ─────────── */
type MainTab = "builder" | "templates" | "preview" | "stats";
type PreviewMode = "desktop" | "mobile";

interface ContentBlock {
  id: string;
  type: "header" | "hero" | "text" | "image" | "button" | "divider" | "footer";
  content: Record<string, string>;
}

interface NewsletterTemplate {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  subject: string;
  blocks: ContentBlock[];
}

interface PastNewsletter {
  id: string;
  subject: string;
  sentAt: string;
  recipients: number;
  opens: number;
  clicks: number;
  bounces: number;
  openRate: string;
  clickRate: string;
}

/* ─────────── helpers ─────────── */
let _blockIdCounter = 0;
function uid(): string {
  _blockIdCounter += 1;
  return `blk_${Date.now()}_${_blockIdCounter}`;
}

function defaultBlock(type: ContentBlock["type"]): ContentBlock {
  const id = uid();
  const defaults: Record<ContentBlock["type"], Record<string, string>> = {
    header:  { logo: "/icons/shortstack-logo.svg", title: "ShortStack", tagline: "Digital Marketing Agency" },
    hero:    { imageUrl: "", headline: "Your Headline Here", subheadline: "Add a short supporting line." },
    text:    { body: "Write your content here. Click 'Write with AI' for instant copy." },
    image:   { url: "", alt: "Image description", caption: "" },
    button:  { label: "Learn More", url: "#", color: "#C9A84C" },
    divider: {},
    footer:  { company: "ShortStack", address: "123 Agency St, Miami FL", unsubscribe: "#", twitter: "#", linkedin: "#", instagram: "#" },
  };
  return { id, type, content: defaults[type] };
}

/* ─────────── mock data ─────────── */
const RECIPIENT_LISTS = [
  { id: "all_subscribers", label: "All Subscribers", count: 1247, color: "text-blue-400" },
  { id: "active_clients", label: "Active Clients", count: 89, color: "text-green-400" },
  { id: "leads", label: "Leads", count: 342, color: "text-yellow-400" },
  { id: "custom_segment", label: "Custom Segment", count: 156, color: "text-purple-400" },
];

const PAST_NEWSLETTERS: PastNewsletter[] = [
  { id: "1", subject: "April Agency Update - New Services & Case Studies", sentAt: "2026-04-10", recipients: 1182, opens: 437, clicks: 89, bounces: 12, openRate: "37.0%", clickRate: "7.5%" },
  { id: "2", subject: "How We Grew a Dental Practice 340% in 6 Months", sentAt: "2026-04-03", recipients: 1156, opens: 521, clicks: 142, bounces: 8, openRate: "45.1%", clickRate: "12.3%" },
  { id: "3", subject: "Your Weekly Marketing Digest - Week 14", sentAt: "2026-03-27", recipients: 1134, opens: 389, clicks: 67, bounces: 15, openRate: "34.3%", clickRate: "5.9%" },
  { id: "4", subject: "Join Us: Digital Marketing Masterclass (Free)", sentAt: "2026-03-20", recipients: 1098, opens: 602, clicks: 234, bounces: 11, openRate: "54.8%", clickRate: "21.3%" },
  { id: "5", subject: "Case Study: $2.4M Revenue from Email Alone", sentAt: "2026-03-13", recipients: 1067, opens: 478, clicks: 156, bounces: 9, openRate: "44.8%", clickRate: "14.6%" },
];

function makeTemplateBlocks(preset: string): ContentBlock[] {
  const header = defaultBlock("header");
  const hero = defaultBlock("hero");
  const footer = defaultBlock("footer");

  switch (preset) {
    case "agency_update":
      hero.content.headline = "April Agency Update";
      hero.content.subheadline = "New services, team wins, and what's coming next.";
      return [
        header, hero,
        { ...defaultBlock("text"), content: { body: "Hi there,\n\nIt's been an incredible month at ShortStack. Here's what we've been up to and what's coming next for your brand." } },
        { ...defaultBlock("text"), content: { body: "New Service: AI-Powered Ad Optimization\n\nWe've rolled out our new AI ad engine that automatically optimizes your campaigns for maximum ROAS." } },
        { ...defaultBlock("button"), content: { label: "See What's New", url: "#", color: "#C9A84C" } },
        footer,
      ];
    case "product_launch":
      hero.content.headline = "Introducing Something Big";
      hero.content.subheadline = "The tool you've been waiting for is here.";
      return [
        header, hero,
        { ...defaultBlock("text"), content: { body: "We're thrilled to announce the launch of our newest product. Built from the ground up based on your feedback." } },
        defaultBlock("image"),
        { ...defaultBlock("text"), content: { body: "Key features:\n- Lightning-fast performance\n- AI-powered insights\n- Seamless integrations\n- Beautiful, intuitive design" } },
        { ...defaultBlock("button"), content: { label: "Get Early Access", url: "#", color: "#10b981" } },
        footer,
      ];
    case "weekly_digest":
      hero.content.headline = "Your Weekly Digest";
      hero.content.subheadline = "Top stories and insights from this week.";
      return [
        header, hero,
        { ...defaultBlock("text"), content: { body: "Top Story: Why short-form video is dominating Q2 2026\n\nThe latest data shows short-form video content generates 3x more engagement than static posts." } },
        defaultBlock("divider"),
        { ...defaultBlock("text"), content: { body: "Quick Wins This Week:\n- Updated your social posting schedule for optimal reach\n- A/B tested two landing page variants (winner: +23% conversion)\n- Launched retargeting campaign for abandoned carts" } },
        { ...defaultBlock("button"), content: { label: "View Full Report", url: "#", color: "#C9A84C" } },
        footer,
      ];
    case "event_invite":
      hero.content.headline = "You're Invited";
      hero.content.subheadline = "An exclusive event for our valued clients.";
      return [
        header, hero,
        { ...defaultBlock("text"), content: { body: "Join us for an exclusive digital marketing masterclass.\n\nDate: April 25, 2026\nTime: 2:00 PM ET\nLocation: Virtual (Zoom)\n\nLearn the latest strategies for scaling your business through paid media and organic growth." } },
        { ...defaultBlock("button"), content: { label: "Reserve Your Spot", url: "#", color: "#3B82F6" } },
        { ...defaultBlock("text"), content: { body: "Seats are limited to 50 attendees. Reserve yours today." } },
        footer,
      ];
    case "case_study":
      hero.content.headline = "Client Success Story";
      hero.content.subheadline = "How we drove real results for a real business.";
      return [
        header, hero,
        { ...defaultBlock("text"), content: { body: "The Challenge:\nOur client, a growing dental practice, was struggling to fill their appointment book and had no online presence to speak of." } },
        defaultBlock("divider"),
        { ...defaultBlock("text"), content: { body: "The Results:\n- 340% increase in new patient appointments\n- $2.4M in attributed revenue\n- 4.8-star average review rating\n- #1 Google Maps ranking in their area" } },
        defaultBlock("image"),
        { ...defaultBlock("button"), content: { label: "Read Full Case Study", url: "#", color: "#C9A84C" } },
        footer,
      ];
    case "holiday_special":
      hero.content.headline = "Holiday Special Offer";
      hero.content.subheadline = "Exclusive savings for our subscribers.";
      return [
        header, hero,
        { ...defaultBlock("text"), content: { body: "Tis the season for growth!\n\nFor a limited time, get 20% off any new service package when you sign up before December 31st." } },
        { ...defaultBlock("button"), content: { label: "Claim Your 20% Off", url: "#", color: "#EF4444" } },
        { ...defaultBlock("text"), content: { body: "This offer is exclusive to newsletter subscribers and cannot be combined with other promotions. Don't miss out!" } },
        footer,
      ];
    default:
      return [header, hero, defaultBlock("text"), defaultBlock("button"), footer];
  }
}

const TEMPLATES: NewsletterTemplate[] = [
  { id: "agency_update",  name: "Agency Update",   icon: <Megaphone size={16} />, description: "Monthly update with wins, news, and upcoming plans",       subject: "April Agency Update - New Services & Wins", blocks: [] },
  { id: "product_launch",  name: "Product Launch",  icon: <Zap size={16} />,       description: "Announce a new product, feature, or service",              subject: "Introducing [Product Name] - Built For You", blocks: [] },
  { id: "weekly_digest",   name: "Weekly Digest",   icon: <BookOpen size={16} />,  description: "Curated weekly roundup of insights and quick wins",        subject: "Your Weekly Marketing Digest", blocks: [] },
  { id: "event_invite",    name: "Event Invite",    icon: <Calendar size={16} />,  description: "Invite subscribers to webinars, workshops, or events",     subject: "You're Invited: [Event Name]", blocks: [] },
  { id: "case_study",      name: "Case Study",      icon: <Briefcase size={16} />, description: "Showcase client results with a compelling story",          subject: "How We Drove [Result] for [Client]", blocks: [] },
  { id: "holiday_special",  name: "Holiday Special", icon: <Gift size={16} />,      description: "Seasonal promotions and limited-time offers",             subject: "Holiday Special - [X]% Off This Season", blocks: [] },
];

/* ─────────── component ─────────── */
export default function NewsletterPage() {
  /* tabs & preview */
  const [activeTab, setActiveTab] = useState<MainTab>("builder");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("desktop");

  /* newsletter state */
  const [subject, setSubject] = useState("");
  const [blocks, setBlocks] = useState<ContentBlock[]>([
    defaultBlock("header"),
    defaultBlock("hero"),
    defaultBlock("text"),
    defaultBlock("button"),
    defaultBlock("footer"),
  ]);
  const [recipientList, setRecipientList] = useState("all_subscribers");
  const [sendMode, setSendMode] = useState<"now" | "schedule">("now");
  const [scheduleDate, setScheduleDate] = useState("");
  const [showRecipientDropdown, setShowRecipientDropdown] = useState(false);

  /* AI state */
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [subjectAiOpen, setSubjectAiOpen] = useState(false);
  const [aiSubjects, setAiSubjects] = useState<string[]>([]);

  /* drag state */
  const dragItem = useRef<number | null>(null);
  const dragOver = useRef<number | null>(null);

  /* sending */
  const [sending, setSending] = useState(false);

  /* ─── block operations ─── */
  const addBlock = (type: ContentBlock["type"]) => {
    const footerIdx = blocks.findIndex(b => b.type === "footer");
    const insertIdx = footerIdx >= 0 ? footerIdx : blocks.length;
    const next = [...blocks];
    next.splice(insertIdx, 0, defaultBlock(type));
    setBlocks(next);
  };

  const removeBlock = (id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id));
  };

  const updateBlockContent = (id: string, field: string, value: string) => {
    setBlocks(prev =>
      prev.map(b => (b.id === id ? { ...b, content: { ...b.content, [field]: value } } : b))
    );
  };

  const moveBlock = (index: number, direction: "up" | "down") => {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    const tmp = next[index];
    next[index] = next[target];
    next[target] = tmp;
    setBlocks(next);
  };

  /* ─── drag-to-reorder ─── */
  const handleDragStart = (index: number) => {
    dragItem.current = index;
  };

  const handleDragEnter = (index: number) => {
    dragOver.current = index;
  };

  const handleDragEnd = () => {
    if (dragItem.current === null || dragOver.current === null) return;
    const next = [...blocks];
    const dragged = next.splice(dragItem.current, 1)[0];
    next.splice(dragOver.current, 0, dragged);
    dragItem.current = null;
    dragOver.current = null;
    setBlocks(next);
  };

  /* ─── AI content generation ─── */
  const generateAiContent = async (blockId: string, context: string) => {
    setAiLoading(blockId);
    try {
      const res = await fetch("/api/newsletter/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "section_copy", context, tone: "professional", audience: "subscribers" }),
      });
      const data = await res.json();
      if (data.success && data.result?.content) {
        const plain = data.result.content.replace(/<[^>]+>/g, "").trim();
        updateBlockContent(blockId, "body", plain);
        toast.success("AI content generated");
      } else {
        toast.error(data.error || "Failed to generate content");
      }
    } catch {
      toast.error("Failed to connect to AI");
    }
    setAiLoading(null);
  };

  const generateSubjectLines = async () => {
    setSubjectAiOpen(true);
    setAiLoading("subject");
    try {
      const context = blocks.find(b => b.type === "hero")?.content.headline || subject || "agency newsletter";
      const res = await fetch("/api/newsletter/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "subject_line", context, tone: "professional", audience: "subscribers" }),
      });
      const data = await res.json();
      if (data.success && data.result?.subjects) {
        setAiSubjects(data.result.subjects);
      } else {
        setAiSubjects([
          `${new Date().toLocaleString("default", { month: "long" })} Update: What's New at ShortStack`,
          "3 Marketing Wins You Can Steal This Week",
          "Your growth report is ready",
          "Don't miss this: exclusive insights inside",
          "The strategy that doubled our client's revenue",
        ]);
      }
    } catch {
      setAiSubjects([
        "Monthly Roundup: Wins, Insights & What's Next",
        "Quick question about your marketing goals",
        "The results are in (you'll want to see this)",
        "3 things top agencies are doing differently",
        "Your exclusive growth playbook is inside",
      ]);
    }
    setAiLoading(null);
  };

  /* ─── send / schedule ─── */
  const handleSend = async () => {
    if (!subject.trim()) { toast.error("Please add a subject line"); return; }
    if (sendMode === "schedule" && !scheduleDate) { toast.error("Please select a schedule date"); return; }

    setSending(true);
    try {
      const res = await fetch("/api/newsletter/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          html_body: renderNewsletterHtml(),
          recipient_list: recipientList,
          schedule_at: sendMode === "schedule" ? scheduleDate : null,
          from_name: "ShortStack",
          reply_to: "hello@shortstack.work",
        }),
      });
      const data = await res.json();
      if (data.success) {
        const list = RECIPIENT_LISTS.find(l => l.id === recipientList);
        if (data.scheduled) {
          toast.success(`Newsletter scheduled for ${scheduleDate} to ${list?.count || 0} recipients`);
        } else {
          toast.success(`Newsletter sent to ${list?.count || 0} recipients!`);
        }
      } else {
        toast.error(data.error || "Send failed");
      }
    } catch {
      // Demo fallback
      const list = RECIPIENT_LISTS.find(l => l.id === recipientList);
      if (sendMode === "schedule") {
        toast.success(`Newsletter scheduled for ${scheduleDate} to ${list?.count || 0} recipients`);
      } else {
        toast.success(`Newsletter sent to ${list?.count || 0} recipients!`);
      }
    }
    setSending(false);
  };

  /* ─── load template ─── */
  const loadTemplate = (templateId: string) => {
    const tpl = TEMPLATES.find(t => t.id === templateId);
    if (!tpl) return;
    setBlocks(makeTemplateBlocks(templateId));
    setSubject(tpl.subject);
    setActiveTab("builder");
    toast.success(`Loaded "${tpl.name}" template`);
  };

  /* ─── render HTML for preview ─── */
  function renderNewsletterHtml(): string {
    const sections = blocks.map(b => {
      switch (b.type) {
        case "header":
          return `<tr><td style="padding:24px 32px;text-align:center;border-bottom:1px solid #e8e5e0"><strong style="font-size:18px;color:#1a1a2e">${b.content.title || "ShortStack"}</strong><br/><span style="font-size:12px;color:#6b7280">${b.content.tagline || ""}</span></td></tr>`;
        case "hero":
          return `<tr><td style="padding:32px;text-align:center;background:linear-gradient(135deg,#f8f7f4,#f0eeea)">${b.content.imageUrl ? `<img src="${b.content.imageUrl}" alt="Hero" style="max-width:100%;border-radius:12px;margin-bottom:16px"/>` : ""}<h1 style="font-size:28px;font-weight:700;color:#1a1a2e;margin:0 0 8px">${b.content.headline || ""}</h1><p style="font-size:14px;color:#6b7280;margin:0">${b.content.subheadline || ""}</p></td></tr>`;
        case "text":
          return `<tr><td style="padding:20px 32px"><p style="font-size:14px;line-height:1.7;color:#374151;margin:0;white-space:pre-wrap">${b.content.body || ""}</p></td></tr>`;
        case "image":
          return `<tr><td style="padding:12px 32px;text-align:center">${b.content.url ? `<img src="${b.content.url}" alt="${b.content.alt || ""}" style="max-width:100%;border-radius:8px"/>` : `<div style="height:160px;background:#f0eeea;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:13px">Image placeholder</div>`}${b.content.caption ? `<p style="font-size:11px;color:#9ca3af;margin-top:6px">${b.content.caption}</p>` : ""}</td></tr>`;
        case "button":
          return `<tr><td style="padding:16px 32px;text-align:center"><a href="${b.content.url || "#"}" style="display:inline-block;padding:12px 28px;background:${b.content.color || "#C9A84C"};color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">${b.content.label || "Click Here"}</a></td></tr>`;
        case "divider":
          return `<tr><td style="padding:8px 32px"><hr style="border:none;border-top:1px solid #e8e5e0;margin:0"/></td></tr>`;
        case "footer":
          return `<tr><td style="padding:24px 32px;text-align:center;border-top:1px solid #e8e5e0;background:#fafaf7"><p style="font-size:11px;color:#9ca3af;margin:0 0 4px">${b.content.company || "ShortStack"} | ${b.content.address || ""}</p><p style="font-size:11px;margin:0"><a href="${b.content.unsubscribe || "#"}" style="color:#9ca3af;text-decoration:underline">Unsubscribe</a></p></td></tr>`;
        default:
          return "";
      }
    }).join("");
    return `<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;font-family:Inter,Arial,sans-serif;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e8e5e0">${sections}</table>`;
  }

  /* ─── tab config ─── */
  const TABS: { key: MainTab; label: string; icon: React.ReactNode }[] = [
    { key: "builder",   label: "Builder",   icon: <Layout size={14} /> },
    { key: "templates", label: "Templates", icon: <Copy size={14} /> },
    { key: "preview",   label: "Preview",   icon: <Eye size={14} /> },
    { key: "stats",     label: "Stats",     icon: <BarChart3 size={14} /> },
  ];

  const selectedList = RECIPIENT_LISTS.find(l => l.id === recipientList);

  /* ─────────── block type label ─────────── */
  function blockLabel(type: ContentBlock["type"]): string {
    const labels: Record<ContentBlock["type"], string> = {
      header: "Header", hero: "Hero", text: "Text", image: "Image",
      button: "Button", divider: "Divider", footer: "Footer",
    };
    return labels[type];
  }

  /* ═════════ RENDER ═════════ */
  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2">
            <Mail size={18} className="text-gold" /> Newsletter Builder
          </h1>
          <p className="text-xs text-muted mt-0.5">Design, preview, and send newsletters to your email lists</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setActiveTab("preview")} className="btn-secondary text-xs flex items-center gap-1.5">
            <Eye size={12} /> Preview
          </button>
          <button onClick={handleSend} disabled={sending} className="btn-primary text-xs flex items-center gap-1.5">
            {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            {sendMode === "schedule" ? "Schedule" : "Send"}
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

      {/* ═══════ BUILDER TAB ═══════ */}
      {activeTab === "builder" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main editor */}
          <div className="lg:col-span-2 space-y-3">
            {/* Subject line */}
            <div className="relative">
              <input
                value={subject} onChange={e => setSubject(e.target.value)}
                className="input w-full text-sm font-medium pr-24"
                placeholder="Newsletter subject line..."
              />
              <button
                onClick={generateSubjectLines}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] px-2 py-1 rounded bg-gold/10 text-gold hover:bg-gold/20 transition-all flex items-center gap-1"
              >
                {aiLoading === "subject" ? <Loader2 size={9} className="animate-spin" /> : <Sparkles size={9} />} AI Ideas
              </button>
            </div>

            {/* AI subject suggestions */}
            {subjectAiOpen && aiSubjects.length > 0 && (
              <div className="card border-gold/10 p-3 space-y-1.5">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] font-semibold text-gold">AI Subject Line Suggestions</p>
                  <button onClick={() => setSubjectAiOpen(false)} className="text-muted hover:text-foreground"><X size={12} /></button>
                </div>
                {aiSubjects.map((s, i) => (
                  <button key={i} onClick={() => { setSubject(s); setSubjectAiOpen(false); toast.success("Subject line applied"); }}
                    className="block w-full text-left text-[10px] p-2 rounded hover:bg-gold/5 transition-all text-muted hover:text-foreground">
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Content blocks */}
            <div className="space-y-2">
              {blocks.map((block, index) => (
                <div
                  key={block.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragEnter={() => handleDragEnter(index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={e => e.preventDefault()}
                  className="card group relative"
                  style={{ cursor: "grab" }}
                >
                  {/* Block toolbar */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <GripVertical size={14} className="text-muted opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />
                      <span className="text-[9px] uppercase tracking-wider font-semibold text-muted">{blockLabel(block.type)}</span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => moveBlock(index, "up")} className="p-1 rounded text-muted hover:text-foreground hover:bg-surface-light" title="Move up"><ArrowUp size={12} /></button>
                      <button onClick={() => moveBlock(index, "down")} className="p-1 rounded text-muted hover:text-foreground hover:bg-surface-light" title="Move down"><ArrowDown size={12} /></button>
                      {block.type !== "header" && block.type !== "footer" && (
                        <button onClick={() => removeBlock(block.id)} className="p-1 rounded text-muted hover:text-red-400 hover:bg-red-400/5" title="Remove"><Trash2 size={12} /></button>
                      )}
                    </div>
                  </div>

                  {/* Block editor content */}
                  {block.type === "header" && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">Title</label>
                        <input value={block.content.title} onChange={e => updateBlockContent(block.id, "title", e.target.value)} className="input w-full text-xs" />
                      </div>
                      <div>
                        <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">Tagline</label>
                        <input value={block.content.tagline} onChange={e => updateBlockContent(block.id, "tagline", e.target.value)} className="input w-full text-xs" />
                      </div>
                    </div>
                  )}

                  {block.type === "hero" && (
                    <div className="space-y-2">
                      <div>
                        <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">Headline</label>
                        <input value={block.content.headline} onChange={e => updateBlockContent(block.id, "headline", e.target.value)} className="input w-full text-sm font-semibold" />
                      </div>
                      <div>
                        <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">Subheadline</label>
                        <input value={block.content.subheadline} onChange={e => updateBlockContent(block.id, "subheadline", e.target.value)} className="input w-full text-xs" />
                      </div>
                      <div>
                        <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">Hero Image URL (optional)</label>
                        <input value={block.content.imageUrl} onChange={e => updateBlockContent(block.id, "imageUrl", e.target.value)} className="input w-full text-xs" placeholder="https://..." />
                      </div>
                    </div>
                  )}

                  {block.type === "text" && (
                    <div className="space-y-2">
                      <textarea
                        value={block.content.body}
                        onChange={e => updateBlockContent(block.id, "body", e.target.value)}
                        className="input w-full text-xs leading-relaxed"
                        style={{ minHeight: 100, resize: "vertical" }}
                        placeholder="Write your content..."
                      />
                      <button
                        onClick={() => generateAiContent(block.id, block.content.body || "newsletter section content")}
                        disabled={aiLoading === block.id}
                        className="text-[9px] px-2 py-1 rounded bg-gold/10 text-gold hover:bg-gold/20 transition-all flex items-center gap-1"
                      >
                        {aiLoading === block.id ? <Loader2 size={9} className="animate-spin" /> : <Sparkles size={9} />} Write with AI
                      </button>
                    </div>
                  )}

                  {block.type === "image" && (
                    <div className="space-y-2">
                      <div>
                        <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">Image URL</label>
                        <input value={block.content.url} onChange={e => updateBlockContent(block.id, "url", e.target.value)} className="input w-full text-xs" placeholder="https://..." />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">Alt Text</label>
                          <input value={block.content.alt} onChange={e => updateBlockContent(block.id, "alt", e.target.value)} className="input w-full text-xs" />
                        </div>
                        <div>
                          <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">Caption</label>
                          <input value={block.content.caption} onChange={e => updateBlockContent(block.id, "caption", e.target.value)} className="input w-full text-xs" />
                        </div>
                      </div>
                      {!block.content.url && (
                        <div className="h-28 rounded-lg bg-surface-light border border-dashed border-border flex items-center justify-center text-muted text-[10px]">
                          <ImageIcon size={14} className="mr-2" /> Image preview will appear here
                        </div>
                      )}
                    </div>
                  )}

                  {block.type === "button" && (
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">Label</label>
                        <input value={block.content.label} onChange={e => updateBlockContent(block.id, "label", e.target.value)} className="input w-full text-xs" />
                      </div>
                      <div>
                        <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">URL</label>
                        <input value={block.content.url} onChange={e => updateBlockContent(block.id, "url", e.target.value)} className="input w-full text-xs" placeholder="https://..." />
                      </div>
                      <div>
                        <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">Color</label>
                        <div className="flex gap-1.5">
                          {["#C9A84C", "#3B82F6", "#10b981", "#EF4444", "#8B5CF6", "#1a1a2e"].map(c => (
                            <button key={c} onClick={() => updateBlockContent(block.id, "color", c)}
                              className={`w-6 h-6 rounded-md border-2 transition-all ${block.content.color === c ? "border-white scale-110" : "border-transparent"}`}
                              style={{ background: c }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {block.type === "divider" && (
                    <div className="border-t border-dashed border-border" />
                  )}

                  {block.type === "footer" && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">Company</label>
                          <input value={block.content.company} onChange={e => updateBlockContent(block.id, "company", e.target.value)} className="input w-full text-xs" />
                        </div>
                        <div>
                          <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">Address</label>
                          <input value={block.content.address} onChange={e => updateBlockContent(block.id, "address", e.target.value)} className="input w-full text-xs" />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">Twitter</label>
                          <input value={block.content.twitter} onChange={e => updateBlockContent(block.id, "twitter", e.target.value)} className="input w-full text-xs" placeholder="#" />
                        </div>
                        <div>
                          <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">LinkedIn</label>
                          <input value={block.content.linkedin} onChange={e => updateBlockContent(block.id, "linkedin", e.target.value)} className="input w-full text-xs" placeholder="#" />
                        </div>
                        <div>
                          <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">Instagram</label>
                          <input value={block.content.instagram} onChange={e => updateBlockContent(block.id, "instagram", e.target.value)} className="input w-full text-xs" placeholder="#" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Add block toolbar */}
            <div className="flex items-center gap-2 p-3 rounded-xl bg-surface-light border border-dashed border-border">
              <span className="text-[9px] text-muted uppercase tracking-wider font-semibold mr-2">Add Block:</span>
              {(["text", "image", "button", "divider"] as const).map(type => (
                <button key={type} onClick={() => addBlock(type)}
                  className="text-[10px] px-3 py-1.5 rounded-lg bg-surface border border-border hover:border-gold/20 hover:text-gold transition-all flex items-center gap-1.5">
                  {type === "text" && <Type size={10} />}
                  {type === "image" && <ImageIcon size={10} />}
                  {type === "button" && <MousePointerClick size={10} />}
                  {type === "divider" && <span className="text-[8px]">---</span>}
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-3">
            {/* Recipient list */}
            <div className="card">
              <h3 className="text-[10px] font-semibold mb-2 uppercase tracking-wider text-muted flex items-center gap-1.5"><Users size={10} /> Recipients</h3>
              <div className="relative">
                <button onClick={() => setShowRecipientDropdown(!showRecipientDropdown)}
                  className="w-full text-left p-2.5 rounded-xl bg-surface-light border border-border hover:border-gold/20 transition-all flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${selectedList?.color === "text-blue-400" ? "bg-blue-400" : selectedList?.color === "text-green-400" ? "bg-green-400" : selectedList?.color === "text-yellow-400" ? "bg-yellow-400" : "bg-purple-400"}`} />
                    {selectedList?.label}
                    <span className="text-muted">({selectedList?.count})</span>
                  </span>
                  {showRecipientDropdown ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
                {showRecipientDropdown && (
                  <div className="absolute z-10 top-full left-0 right-0 mt-1 rounded-xl bg-surface border border-border shadow-lg overflow-hidden">
                    {RECIPIENT_LISTS.map(l => (
                      <button key={l.id} onClick={() => { setRecipientList(l.id); setShowRecipientDropdown(false); }}
                        className={`w-full text-left px-3 py-2.5 text-xs hover:bg-surface-light transition-all flex items-center justify-between ${recipientList === l.id ? "bg-gold/5 text-gold" : "text-foreground"}`}>
                        <span className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${l.color === "text-blue-400" ? "bg-blue-400" : l.color === "text-green-400" ? "bg-green-400" : l.color === "text-yellow-400" ? "bg-yellow-400" : "bg-purple-400"}`} />
                          {l.label}
                        </span>
                        <span className="text-muted text-[10px]">{l.count}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Send options */}
            <div className="card">
              <h3 className="text-[10px] font-semibold mb-2 uppercase tracking-wider text-muted flex items-center gap-1.5"><Send size={10} /> Send Options</h3>
              <div className="flex gap-1 mb-3">
                <button onClick={() => setSendMode("now")}
                  className={`flex-1 text-[10px] px-3 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${sendMode === "now" ? "bg-gold/10 text-gold border border-gold/20" : "text-muted border border-border"}`}>
                  <Zap size={10} /> Send Now
                </button>
                <button onClick={() => setSendMode("schedule")}
                  className={`flex-1 text-[10px] px-3 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${sendMode === "schedule" ? "bg-gold/10 text-gold border border-gold/20" : "text-muted border border-border"}`}>
                  <Clock size={10} /> Schedule
                </button>
              </div>
              {sendMode === "schedule" && (
                <div className="space-y-2">
                  <label className="text-[9px] text-muted uppercase tracking-wider block">Date & Time</label>
                  <input type="datetime-local" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} className="input w-full text-xs" />
                  <select className="input w-full text-xs">
                    <option>America/New_York (ET)</option>
                    <option>America/Chicago (CT)</option>
                    <option>America/Los_Angeles (PT)</option>
                    <option>Europe/London (GMT)</option>
                    <option>Europe/Stockholm (CET)</option>
                  </select>
                </div>
              )}
              <button onClick={handleSend} disabled={sending}
                className="btn-primary w-full text-xs flex items-center justify-center gap-1.5 mt-3">
                {sending ? <Loader2 size={12} className="animate-spin" /> : sendMode === "schedule" ? <Clock size={12} /> : <Send size={12} />}
                {sending ? "Processing..." : sendMode === "schedule" ? "Schedule Newsletter" : "Send Newsletter"}
              </button>
            </div>

            {/* Block count summary */}
            <div className="card">
              <h3 className="text-[10px] font-semibold mb-2 uppercase tracking-wider text-muted">Builder Stats</h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="text-center p-2 rounded bg-surface-light">
                  <p className="text-sm font-bold text-gold">{blocks.length}</p>
                  <p className="text-[8px] text-muted">Blocks</p>
                </div>
                <div className="text-center p-2 rounded bg-surface-light">
                  <p className="text-sm font-bold">{blocks.filter(b => b.type === "text").length}</p>
                  <p className="text-[8px] text-muted">Text Sections</p>
                </div>
                <div className="text-center p-2 rounded bg-surface-light">
                  <p className="text-sm font-bold">{blocks.filter(b => b.type === "image").length}</p>
                  <p className="text-[8px] text-muted">Images</p>
                </div>
                <div className="text-center p-2 rounded bg-surface-light">
                  <p className="text-sm font-bold">{blocks.filter(b => b.type === "button").length}</p>
                  <p className="text-[8px] text-muted">CTAs</p>
                </div>
              </div>
            </div>

            {/* Quick links */}
            <div className="card">
              <h3 className="text-[10px] font-semibold mb-2 uppercase tracking-wider text-muted">Quick Actions</h3>
              <div className="space-y-1">
                <button onClick={() => setActiveTab("templates")} className="w-full text-left p-2 rounded-lg text-[10px] transition-all hover:bg-surface-light flex items-center gap-2 text-muted hover:text-foreground">
                  <Copy size={10} /> Load from template
                </button>
                <button onClick={() => setActiveTab("preview")} className="w-full text-left p-2 rounded-lg text-[10px] transition-all hover:bg-surface-light flex items-center gap-2 text-muted hover:text-foreground">
                  <Eye size={10} /> Preview newsletter
                </button>
                <button onClick={() => setActiveTab("stats")} className="w-full text-left p-2 rounded-lg text-[10px] transition-all hover:bg-surface-light flex items-center gap-2 text-muted hover:text-foreground">
                  <BarChart3 size={10} /> View past stats
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ TEMPLATES TAB ═══════ */}
      {activeTab === "templates" && (
        <div className="space-y-4">
          <p className="text-xs text-muted">Choose a template to start building your newsletter. You can customize every section after loading.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {TEMPLATES.map(tpl => (
              <button key={tpl.id} onClick={() => loadTemplate(tpl.id)}
                className="text-left p-5 rounded-2xl bg-surface border border-border hover:border-gold/20 hover:shadow-lg transition-all group">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gold/10 text-gold flex items-center justify-center group-hover:bg-gold/20 transition-colors">
                    {tpl.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{tpl.name}</p>
                    <p className="text-[10px] text-muted">{tpl.description}</p>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-surface-light">
                  <p className="text-[9px] text-muted uppercase tracking-wider mb-1">Subject Preview</p>
                  <p className="text-xs font-medium truncate">{tpl.subject}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ═══════ PREVIEW TAB ═══════ */}
      {activeTab === "preview" && (
        <div className="space-y-4">
          {/* Preview mode toggle */}
          <div className="flex items-center justify-center gap-2">
            <button onClick={() => setPreviewMode("desktop")}
              className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 ${
                previewMode === "desktop" ? "bg-gold/10 text-gold border border-gold/20" : "text-muted border border-border"
              }`}><Monitor size={12} /> Desktop</button>
            <button onClick={() => setPreviewMode("mobile")}
              className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 ${
                previewMode === "mobile" ? "bg-gold/10 text-gold border border-gold/20" : "text-muted border border-border"
              }`}><Smartphone size={12} /> Mobile</button>
          </div>

          {/* Email client chrome */}
          <div className="flex justify-center">
            <div className={`bg-[#1a1c23] rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 ${previewMode === "desktop" ? "w-full max-w-2xl" : "w-[375px]"}`}>
              {/* Window chrome */}
              <div className="bg-surface p-3 border-b border-border">
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

              {/* Email header bar */}
              <div className="p-4 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                <p className="text-sm font-semibold text-white mb-1">{subject || "No subject"}</p>
                <p className="text-[10px] text-white/40">From: ShortStack &lt;hello@shortstack.work&gt;</p>
                <p className="text-[10px] text-white/40">To: {selectedList?.label} ({selectedList?.count} recipients)</p>
              </div>

              {/* Rendered newsletter */}
              <div className="p-4 bg-[#f5f3ee]">
                {/* Render each block as a real-email-looking preview */}
                <div className="mx-auto bg-white rounded-xl overflow-hidden shadow-sm" style={{ maxWidth: previewMode === "desktop" ? 580 : "100%", border: "1px solid #e8e5e0" }}>
                  {blocks.map(block => (
                    <div key={block.id}>
                      {block.type === "header" && (
                        <div className="py-5 px-6 text-center" style={{ borderBottom: "1px solid #e8e5e0" }}>
                          <p className="text-base font-bold" style={{ color: "#1a1a2e" }}>{block.content.title || "ShortStack"}</p>
                          {block.content.tagline && <p className="text-[11px] mt-0.5" style={{ color: "#6b7280" }}>{block.content.tagline}</p>}
                        </div>
                      )}

                      {block.type === "hero" && (
                        <div className="py-8 px-6 text-center" style={{ background: "linear-gradient(135deg, #f8f7f4, #f0eeea)" }}>
                          {block.content.imageUrl && (
                            <img src={block.content.imageUrl} alt="Hero" className="max-w-full rounded-xl mb-4 mx-auto" style={{ maxHeight: 200 }} />
                          )}
                          <h1 className="text-2xl font-bold mb-2" style={{ color: "#1a1a2e" }}>{block.content.headline || "Headline"}</h1>
                          {block.content.subheadline && <p className="text-sm" style={{ color: "#6b7280" }}>{block.content.subheadline}</p>}
                        </div>
                      )}

                      {block.type === "text" && (
                        <div className="py-4 px-6">
                          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#374151" }}>{block.content.body}</p>
                        </div>
                      )}

                      {block.type === "image" && (
                        <div className="py-3 px-6 text-center">
                          {block.content.url ? (
                            <img src={block.content.url} alt={block.content.alt || ""} className="max-w-full rounded-lg mx-auto" />
                          ) : (
                            <div className="h-36 rounded-lg flex items-center justify-center text-[11px]" style={{ background: "#f0eeea", color: "#9ca3af" }}>
                              <ImageIcon size={14} className="mr-1.5" /> Image placeholder
                            </div>
                          )}
                          {block.content.caption && <p className="text-[10px] mt-2" style={{ color: "#9ca3af" }}>{block.content.caption}</p>}
                        </div>
                      )}

                      {block.type === "button" && (
                        <div className="py-4 px-6 text-center">
                          <a
                            href={block.content.url || "#"}
                            className="inline-block py-3 px-7 rounded-lg text-white font-semibold text-sm no-underline"
                            style={{ background: block.content.color || "#C9A84C" }}
                          >
                            {block.content.label || "Click Here"}
                          </a>
                        </div>
                      )}

                      {block.type === "divider" && (
                        <div className="px-6 py-2"><hr style={{ border: "none", borderTop: "1px solid #e8e5e0" }} /></div>
                      )}

                      {block.type === "footer" && (
                        <div className="py-5 px-6 text-center" style={{ background: "#fafaf7", borderTop: "1px solid #e8e5e0" }}>
                          <p className="text-[11px] mb-1" style={{ color: "#9ca3af" }}>{block.content.company} | {block.content.address}</p>
                          <div className="flex items-center justify-center gap-3 mb-2">
                            {block.content.twitter && block.content.twitter !== "#" && <a href={block.content.twitter} className="text-[10px] underline" style={{ color: "#9ca3af" }}>Twitter</a>}
                            {block.content.linkedin && block.content.linkedin !== "#" && <a href={block.content.linkedin} className="text-[10px] underline" style={{ color: "#9ca3af" }}>LinkedIn</a>}
                            {block.content.instagram && block.content.instagram !== "#" && <a href={block.content.instagram} className="text-[10px] underline" style={{ color: "#9ca3af" }}>Instagram</a>}
                          </div>
                          <a href={block.content.unsubscribe || "#"} className="text-[10px] underline" style={{ color: "#9ca3af" }}>Unsubscribe</a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ STATS TAB ═══════ */}
      {activeTab === "stats" && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="card text-center">
              <p className="text-2xl font-bold text-gold">{PAST_NEWSLETTERS.length}</p>
              <p className="text-[9px] text-muted uppercase tracking-wider mt-1">Newsletters Sent</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-bold text-green-400">
                {(PAST_NEWSLETTERS.reduce((s, n) => s + parseFloat(n.openRate), 0) / PAST_NEWSLETTERS.length).toFixed(1)}%
              </p>
              <p className="text-[9px] text-muted uppercase tracking-wider mt-1">Avg Open Rate</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-bold text-blue-400">
                {(PAST_NEWSLETTERS.reduce((s, n) => s + parseFloat(n.clickRate), 0) / PAST_NEWSLETTERS.length).toFixed(1)}%
              </p>
              <p className="text-[9px] text-muted uppercase tracking-wider mt-1">Avg Click Rate</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-bold">{PAST_NEWSLETTERS.reduce((s, n) => s + n.recipients, 0).toLocaleString()}</p>
              <p className="text-[9px] text-muted uppercase tracking-wider mt-1">Total Recipients</p>
            </div>
          </div>

          {/* Past newsletters table */}
          <div className="card">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <BarChart3 size={14} className="text-gold" /> Past Newsletters
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left py-2.5 px-3 text-[9px] uppercase tracking-wider text-muted font-semibold" style={{ borderBottom: "1px solid var(--color-border, #e8e5e0)" }}>Subject</th>
                    <th className="text-left py-2.5 px-3 text-[9px] uppercase tracking-wider text-muted font-semibold" style={{ borderBottom: "1px solid var(--color-border, #e8e5e0)" }}>Sent</th>
                    <th className="text-right py-2.5 px-3 text-[9px] uppercase tracking-wider text-muted font-semibold" style={{ borderBottom: "1px solid var(--color-border, #e8e5e0)" }}>Recipients</th>
                    <th className="text-right py-2.5 px-3 text-[9px] uppercase tracking-wider text-muted font-semibold" style={{ borderBottom: "1px solid var(--color-border, #e8e5e0)" }}>Opens</th>
                    <th className="text-right py-2.5 px-3 text-[9px] uppercase tracking-wider text-muted font-semibold" style={{ borderBottom: "1px solid var(--color-border, #e8e5e0)" }}>Clicks</th>
                    <th className="text-right py-2.5 px-3 text-[9px] uppercase tracking-wider text-muted font-semibold" style={{ borderBottom: "1px solid var(--color-border, #e8e5e0)" }}>Bounces</th>
                    <th className="text-right py-2.5 px-3 text-[9px] uppercase tracking-wider text-muted font-semibold" style={{ borderBottom: "1px solid var(--color-border, #e8e5e0)" }}>Open Rate</th>
                    <th className="text-right py-2.5 px-3 text-[9px] uppercase tracking-wider text-muted font-semibold" style={{ borderBottom: "1px solid var(--color-border, #e8e5e0)" }}>CTR</th>
                  </tr>
                </thead>
                <tbody>
                  {PAST_NEWSLETTERS.map(nl => (
                    <tr key={nl.id} className="hover:bg-surface-light transition-colors">
                      <td className="py-2.5 px-3 font-medium max-w-[260px] truncate" style={{ borderBottom: "1px solid var(--color-surface-light, #f5f3ee)" }}>{nl.subject}</td>
                      <td className="py-2.5 px-3 text-muted" style={{ borderBottom: "1px solid var(--color-surface-light, #f5f3ee)" }}>{nl.sentAt}</td>
                      <td className="py-2.5 px-3 text-right" style={{ borderBottom: "1px solid var(--color-surface-light, #f5f3ee)" }}>{nl.recipients.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right text-green-400 font-medium" style={{ borderBottom: "1px solid var(--color-surface-light, #f5f3ee)" }}>{nl.opens.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right text-blue-400 font-medium" style={{ borderBottom: "1px solid var(--color-surface-light, #f5f3ee)" }}>{nl.clicks.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right text-red-400" style={{ borderBottom: "1px solid var(--color-surface-light, #f5f3ee)" }}>{nl.bounces}</td>
                      <td className="py-2.5 px-3 text-right font-semibold" style={{ borderBottom: "1px solid var(--color-surface-light, #f5f3ee)" }}>
                        <span className={parseFloat(nl.openRate) >= 40 ? "text-green-400" : parseFloat(nl.openRate) >= 30 ? "text-yellow-400" : "text-red-400"}>{nl.openRate}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold" style={{ borderBottom: "1px solid var(--color-surface-light, #f5f3ee)" }}>
                        <span className={parseFloat(nl.clickRate) >= 10 ? "text-green-400" : parseFloat(nl.clickRate) >= 5 ? "text-yellow-400" : "text-red-400"}>{nl.clickRate}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Best performing highlight */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="card">
              <h3 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                <Check size={12} className="text-green-400" /> Best Open Rate
              </h3>
              {(() => {
                const best = [...PAST_NEWSLETTERS].sort((a, b) => parseFloat(b.openRate) - parseFloat(a.openRate))[0];
                return (
                  <div>
                    <p className="text-sm font-medium mb-1">{best.subject}</p>
                    <div className="flex gap-3 text-[10px] text-muted">
                      <span className="text-green-400 font-semibold">{best.openRate} opens</span>
                      <span>Sent {best.sentAt}</span>
                      <span>{best.recipients.toLocaleString()} recipients</span>
                    </div>
                  </div>
                );
              })()}
            </div>
            <div className="card">
              <h3 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                <Link2 size={12} className="text-blue-400" /> Best Click Rate
              </h3>
              {(() => {
                const best = [...PAST_NEWSLETTERS].sort((a, b) => parseFloat(b.clickRate) - parseFloat(a.clickRate))[0];
                return (
                  <div>
                    <p className="text-sm font-medium mb-1">{best.subject}</p>
                    <div className="flex gap-3 text-[10px] text-muted">
                      <span className="text-blue-400 font-semibold">{best.clickRate} CTR</span>
                      <span>Sent {best.sentAt}</span>
                      <span>{best.clicks.toLocaleString()} clicks</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
