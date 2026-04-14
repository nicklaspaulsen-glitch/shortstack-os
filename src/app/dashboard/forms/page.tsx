"use client";

import { useState } from "react";
import {
  FileText, Plus, Copy, Trash2, Eye, Type, Mail, Phone,
  MessageSquare, List, Hash, Star, Upload, CheckSquare,
  Settings, BarChart3, Code, Shield, Link2, Download,
  ChevronUp, ChevronDown, Palette, Globe, Zap
} from "lucide-react";

type FormTab = "builder" | "templates" | "submissions" | "analytics" | "settings";

interface FormField {
  id: string;
  type: "text" | "email" | "phone" | "textarea" | "select" | "number" | "checkbox" | "file" | "rating";
  label: string;
  placeholder: string;
  required: boolean;
  options?: string[];
  condition?: { fieldId: string; value: string } | null;
}

interface LeadForm {
  id: string;
  name: string;
  fields: FormField[];
  submitText: string;
  redirectUrl: string;
  webhookUrl: string;
  thankYouMessage: string;
  accentColor: string;
  spamProtection: boolean;
  views: number;
  starts: number;
  completions: number;
}

interface FormSubmission {
  id: string;
  formId: string;
  data: Record<string, string>;
  submittedAt: string;
  source: string;
}

const FIELD_TYPES: { type: FormField["type"]; label: string; icon: React.ReactNode }[] = [
  { type: "text", label: "Text", icon: <Type size={12} /> },
  { type: "email", label: "Email", icon: <Mail size={12} /> },
  { type: "phone", label: "Phone", icon: <Phone size={12} /> },
  { type: "textarea", label: "Text Area", icon: <MessageSquare size={12} /> },
  { type: "select", label: "Dropdown", icon: <List size={12} /> },
  { type: "number", label: "Number", icon: <Hash size={12} /> },
  { type: "checkbox", label: "Checkbox", icon: <CheckSquare size={12} /> },
  { type: "file", label: "File Upload", icon: <Upload size={12} /> },
  { type: "rating", label: "Rating", icon: <Star size={12} /> },
];

const TEMPLATES = [
  { name: "Contact Form", desc: "Simple contact form", fields: [
    { id: "1", type: "text" as const, label: "Full Name", placeholder: "John Smith", required: true },
    { id: "2", type: "email" as const, label: "Email", placeholder: "john@example.com", required: true },
    { id: "3", type: "phone" as const, label: "Phone", placeholder: "(555) 123-4567", required: false },
    { id: "4", type: "textarea" as const, label: "Message", placeholder: "How can we help?", required: false },
  ]},
  { name: "Free Consultation", desc: "Lead capture for consultations", fields: [
    { id: "1", type: "text" as const, label: "Business Name", placeholder: "Your Business", required: true },
    { id: "2", type: "email" as const, label: "Email", placeholder: "you@business.com", required: true },
    { id: "3", type: "phone" as const, label: "Phone", placeholder: "(555) 123-4567", required: true },
    { id: "4", type: "select" as const, label: "Budget", placeholder: "Select...", required: true, options: ["Under $1k", "$1k-$3k", "$3k-$5k", "$5k+"] },
    { id: "5", type: "select" as const, label: "Service", placeholder: "Select...", required: true, options: ["Social Media", "Paid Ads", "SEO", "Web Design", "Full Service"] },
  ]},
  { name: "Quick Lead Capture", desc: "Minimal fields for speed", fields: [
    { id: "1", type: "text" as const, label: "Name", placeholder: "Your name", required: true },
    { id: "2", type: "email" as const, label: "Email", placeholder: "you@email.com", required: true },
  ]},
  { name: "Event Registration", desc: "Event/webinar signup", fields: [
    { id: "1", type: "text" as const, label: "Full Name", placeholder: "Your name", required: true },
    { id: "2", type: "email" as const, label: "Email", placeholder: "you@email.com", required: true },
    { id: "3", type: "text" as const, label: "Company", placeholder: "Company name", required: false },
    { id: "4", type: "select" as const, label: "How did you hear about us?", placeholder: "Select...", required: false, options: ["Google", "Social Media", "Referral", "Ad", "Other"] },
  ]},
  { name: "Feedback Form", desc: "Collect customer feedback", fields: [
    { id: "1", type: "text" as const, label: "Name", placeholder: "Your name", required: true },
    { id: "2", type: "email" as const, label: "Email", placeholder: "you@email.com", required: true },
    { id: "3", type: "rating" as const, label: "Rating", placeholder: "", required: true },
    { id: "4", type: "textarea" as const, label: "Comments", placeholder: "Tell us more...", required: false },
  ]},
  { name: "Job Application", desc: "Hiring form", fields: [
    { id: "1", type: "text" as const, label: "Full Name", placeholder: "Your name", required: true },
    { id: "2", type: "email" as const, label: "Email", placeholder: "you@email.com", required: true },
    { id: "3", type: "phone" as const, label: "Phone", placeholder: "(555) 123-4567", required: true },
    { id: "4", type: "select" as const, label: "Position", placeholder: "Select...", required: true, options: ["Content Creator", "Ads Manager", "Video Editor", "Cold Caller", "Developer"] },
    { id: "5", type: "file" as const, label: "Resume", placeholder: "", required: true },
    { id: "6", type: "textarea" as const, label: "Cover Letter", placeholder: "Tell us about yourself...", required: false },
  ]},
  { name: "Newsletter Signup", desc: "Email list builder", fields: [
    { id: "1", type: "text" as const, label: "First Name", placeholder: "First name", required: true },
    { id: "2", type: "email" as const, label: "Email", placeholder: "you@email.com", required: true },
  ]},
  { name: "Quote Request", desc: "Service pricing inquiry", fields: [
    { id: "1", type: "text" as const, label: "Business Name", placeholder: "Your business", required: true },
    { id: "2", type: "email" as const, label: "Email", placeholder: "you@business.com", required: true },
    { id: "3", type: "phone" as const, label: "Phone", placeholder: "(555) 123-4567", required: true },
    { id: "4", type: "select" as const, label: "Service Needed", placeholder: "Select...", required: true, options: ["Social Media", "Paid Ads", "SEO", "Web Design", "Video Production", "Full Service"] },
    { id: "5", type: "textarea" as const, label: "Project Details", placeholder: "Tell us about your project...", required: true },
    { id: "6", type: "select" as const, label: "Timeline", placeholder: "Select...", required: false, options: ["ASAP", "1-2 weeks", "1 month", "No rush"] },
  ]},
  { name: "Customer Survey", desc: "Post-purchase feedback", fields: [
    { id: "1", type: "text" as const, label: "Name", placeholder: "Your name", required: false },
    { id: "2", type: "rating" as const, label: "Overall Satisfaction", placeholder: "", required: true },
    { id: "3", type: "select" as const, label: "Would you recommend us?", placeholder: "Select...", required: true, options: ["Definitely", "Probably", "Not sure", "No"] },
    { id: "4", type: "textarea" as const, label: "Suggestions", placeholder: "How can we improve?", required: false },
  ]},
  { name: "Appointment Request", desc: "Request a meeting", fields: [
    { id: "1", type: "text" as const, label: "Name", placeholder: "Your name", required: true },
    { id: "2", type: "email" as const, label: "Email", placeholder: "you@email.com", required: true },
    { id: "3", type: "phone" as const, label: "Phone", placeholder: "(555) 123-4567", required: true },
    { id: "4", type: "select" as const, label: "Preferred Day", placeholder: "Select...", required: true, options: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] },
    { id: "5", type: "select" as const, label: "Preferred Time", placeholder: "Select...", required: true, options: ["Morning", "Afternoon", "Evening"] },
  ]},
  { name: "Testimonial Request", desc: "Collect reviews", fields: [
    { id: "1", type: "text" as const, label: "Name", placeholder: "Your name", required: true },
    { id: "2", type: "text" as const, label: "Company", placeholder: "Company", required: false },
    { id: "3", type: "rating" as const, label: "Rating", placeholder: "", required: true },
    { id: "4", type: "textarea" as const, label: "Your Testimonial", placeholder: "What was your experience?", required: true },
    { id: "5", type: "checkbox" as const, label: "May we share this publicly?", placeholder: "", required: true },
  ]},
  { name: "Warranty Registration", desc: "Product registration", fields: [
    { id: "1", type: "text" as const, label: "Full Name", placeholder: "Your name", required: true },
    { id: "2", type: "email" as const, label: "Email", placeholder: "you@email.com", required: true },
    { id: "3", type: "text" as const, label: "Product Name", placeholder: "Product purchased", required: true },
    { id: "4", type: "number" as const, label: "Order Number", placeholder: "123456", required: true },
  ]},
];

const MOCK_SUBMISSIONS: FormSubmission[] = [
  { id: "s1", formId: "f1", data: { "Full Name": "Dr. Sarah Mitchell", "Email": "sarah@mitchell.com", "Phone": "(555) 987-6543", "Message": "Interested in social media management for my dental practice" }, submittedAt: "2026-04-14T09:30:00Z", source: "Website" },
  { id: "s2", formId: "f1", data: { "Full Name": "Mike Chen", "Email": "mike@fitprogym.com", "Phone": "(555) 321-4567" }, submittedAt: "2026-04-13T14:15:00Z", source: "Landing Page" },
  { id: "s3", formId: "f2", data: { "Business Name": "Luxe Salon", "Email": "info@luxesalon.com", "Phone": "(555) 654-3210", "Budget": "$3k-$5k", "Service": "Full Service" }, submittedAt: "2026-04-12T11:00:00Z", source: "Facebook Ad" },
  { id: "s4", formId: "f1", data: { "Full Name": "Anna Lopez", "Email": "anna@metrorealty.com" }, submittedAt: "2026-04-11T16:45:00Z", source: "Email Link" },
  { id: "s5", formId: "f2", data: { "Business Name": "Green Eats", "Email": "hello@greeneats.com", "Budget": "$1k-$3k", "Service": "Social Media" }, submittedAt: "2026-04-10T10:20:00Z", source: "Google Ad" },
];

export default function FormsPage() {
  const [tab, setTab] = useState<FormTab>("builder");
  const [forms, setForms] = useState<LeadForm[]>([]);
  const [activeForm, setActiveForm] = useState<LeadForm | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [showEmbedCode, setShowEmbedCode] = useState(false);
  const [ratingHover, setRatingHover] = useState(0);

  function createFromTemplate(tpl: typeof TEMPLATES[0]) {
    const newForm: LeadForm = {
      id: `form_${Date.now()}`,
      name: tpl.name,
      fields: tpl.fields.map(f => ({ ...f, condition: null })),
      submitText: "Submit",
      redirectUrl: "",
      webhookUrl: "",
      thankYouMessage: "Thank you for your submission! We'll be in touch soon.",
      accentColor: "#C9A84C",
      spamProtection: true,
      views: Math.floor(Math.random() * 500) + 100,
      starts: Math.floor(Math.random() * 300) + 50,
      completions: Math.floor(Math.random() * 100) + 20,
    };
    setForms(prev => [...prev, newForm]);
    setActiveForm(newForm);
    setTab("builder");
  }

  function addField(type: FormField["type"]) {
    if (!activeForm) return;
    const field: FormField = {
      id: `f_${Date.now()}`,
      type,
      label: FIELD_TYPES.find(t => t.type === type)?.label || "Field",
      placeholder: "",
      required: false,
      options: type === "select" ? ["Option 1", "Option 2", "Option 3"] : undefined,
      condition: null,
    };
    const updated = { ...activeForm, fields: [...activeForm.fields, field] };
    setActiveForm(updated);
    setForms(prev => prev.map(f => f.id === updated.id ? updated : f));
  }

  function removeField(fieldId: string) {
    if (!activeForm) return;
    const updated = { ...activeForm, fields: activeForm.fields.filter(f => f.id !== fieldId) };
    setActiveForm(updated);
    setForms(prev => prev.map(f => f.id === updated.id ? updated : f));
  }

  function moveField(fieldId: string, direction: "up" | "down") {
    if (!activeForm) return;
    const idx = activeForm.fields.findIndex(f => f.id === fieldId);
    if ((direction === "up" && idx <= 0) || (direction === "down" && idx >= activeForm.fields.length - 1)) return;
    const newFields = [...activeForm.fields];
    const swap = direction === "up" ? idx - 1 : idx + 1;
    [newFields[idx], newFields[swap]] = [newFields[swap], newFields[idx]];
    const updated = { ...activeForm, fields: newFields };
    setActiveForm(updated);
    setForms(prev => prev.map(f => f.id === updated.id ? updated : f));
  }

  function updateField(fieldId: string, key: string, value: unknown) {
    if (!activeForm) return;
    const fields = activeForm.fields.map(f => f.id === fieldId ? { ...f, [key]: value } : f);
    const updated = { ...activeForm, fields };
    setActiveForm(updated);
    setForms(prev => prev.map(f => f.id === updated.id ? updated : f));
  }

  function generateEmbedCode(): string {
    if (!activeForm) return "";
    return `<iframe src="https://shortstack-os.vercel.app/forms/embed/${activeForm.id}" width="100%" height="600" frameborder="0" style="border:none;border-radius:12px;"></iframe>`;
  }

  const totalSubmissions = MOCK_SUBMISSIONS.length;
  const avgCompletionRate = forms.length > 0 ? Math.round(forms.reduce((s, f) => s + (f.views > 0 ? (f.completions / f.views) * 100 : 0), 0) / forms.length) : 42;

  const TABS: { id: FormTab; label: string; icon: React.ReactNode }[] = [
    { id: "builder", label: "Builder", icon: <FileText size={13} /> },
    { id: "templates", label: "Templates", icon: <List size={13} /> },
    { id: "submissions", label: "Submissions", icon: <MessageSquare size={13} /> },
    { id: "analytics", label: "Analytics", icon: <BarChart3 size={13} /> },
    { id: "settings", label: "Settings", icon: <Settings size={13} /> },
  ];

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2"><FileText size={18} className="text-gold" /> Form Builder</h1>
          <p className="text-xs text-muted mt-0.5">Create lead capture forms, embed on websites, leads flow into CRM</p>
        </div>
        <div className="flex items-center gap-2">
          {activeForm && (
            <button onClick={() => setActiveForm(null)} className="btn-secondary text-xs">All Forms</button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="card p-3 text-center">
          <p className="text-lg font-bold">{forms.length}</p>
          <p className="text-[10px] text-muted">Total Forms</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-gold">{totalSubmissions}</p>
          <p className="text-[10px] text-muted">Submissions</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-emerald-400">{avgCompletionRate}%</p>
          <p className="text-[10px] text-muted">Avg Completion</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-lg font-bold text-blue-400">{forms.reduce((s, f) => s + f.views, 0)}</p>
          <p className="text-[10px] text-muted">Total Views</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface rounded-lg p-1 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-all ${
              tab === t.id ? "bg-gold/10 text-gold font-medium" : "text-muted hover:text-foreground"
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Builder Tab */}
      {tab === "builder" && !activeForm && (
        <div className="space-y-4">
          {forms.length > 0 && (
            <div className="card">
              <h2 className="section-header">Your Forms</h2>
              <div className="space-y-2">
                {forms.map(form => (
                  <div key={form.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-light border border-border">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-8 rounded-full" style={{ background: form.accentColor }} />
                      <div>
                        <p className="text-xs font-semibold">{form.name}</p>
                        <p className="text-[10px] text-muted">{form.fields.length} fields - {form.completions} submissions</p>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => { setActiveForm(form); setTab("builder"); }} className="btn-secondary text-[9px] py-1 px-2 flex items-center gap-1"><Eye size={10} /> Edit</button>
                      <button onClick={() => { setShowEmbedCode(true); setActiveForm(form); }} className="btn-ghost text-[9px] py-1 px-2 flex items-center gap-1"><Code size={10} /> Embed</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="card text-center py-8">
            <FileText size={24} className="mx-auto mb-2 text-muted/30" />
            <p className="text-xs text-muted mb-3">Start with a template or create from scratch</p>
            <button onClick={() => setTab("templates")} className="btn-primary text-xs">Browse Templates</button>
          </div>
        </div>
      )}

      {/* Builder with Active Form */}
      {tab === "builder" && activeForm && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-4">
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="section-header mb-0">Edit Form</h2>
              </div>
              <input value={activeForm.name} onChange={e => {
                const updated = { ...activeForm, name: e.target.value };
                setActiveForm(updated);
                setForms(prev => prev.map(f => f.id === updated.id ? updated : f));
              }} className="input w-full mb-3" placeholder="Form name" />

              {/* Fields with drag order */}
              <div className="space-y-2 mb-3">
                {activeForm.fields.map((field) => (
                  <div key={field.id} className="p-2.5 rounded-lg bg-surface-light border border-border">
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col gap-0.5">
                        <button onClick={() => moveField(field.id, "up")} className="text-muted hover:text-foreground"><ChevronUp size={10} /></button>
                        <button onClick={() => moveField(field.id, "down")} className="text-muted hover:text-foreground"><ChevronDown size={10} /></button>
                      </div>
                      <span className="text-muted">{FIELD_TYPES.find(t => t.type === field.type)?.icon}</span>
                      <input value={field.label} onChange={e => updateField(field.id, "label", e.target.value)}
                        className="flex-1 bg-transparent text-xs outline-none font-medium" />
                      <span className="text-[8px] text-muted px-1.5 py-0.5 rounded bg-surface">{field.type}</span>
                      <button onClick={() => updateField(field.id, "required", !field.required)}
                        className={`text-[8px] px-1.5 py-0.5 rounded ${field.required ? "bg-gold/10 text-gold" : "text-muted"}`}>
                        {field.required ? "Required" : "Optional"}
                      </button>
                      <button onClick={() => removeField(field.id)} className="text-muted hover:text-red-400 p-1"><Trash2 size={10} /></button>
                    </div>
                    {field.type === "select" && field.options && (
                      <div className="mt-2 ml-8">
                        <input value={field.options.join(", ")} onChange={e => updateField(field.id, "options", e.target.value.split(", "))}
                          className="input w-full text-[10px]" placeholder="Options (comma separated)" />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Add field */}
              <div className="flex flex-wrap gap-1.5">
                {FIELD_TYPES.map(ft => (
                  <button key={ft.type} onClick={() => addField(ft.type)}
                    className="flex items-center gap-1 text-[9px] px-2 py-1 rounded-md text-muted hover:text-foreground bg-surface-light border border-border">
                    <Plus size={8} /> {ft.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Form Settings */}
            <div className="card">
              <h2 className="section-header flex items-center gap-2"><Settings size={12} className="text-gold" /> Form Settings</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] text-muted mb-1">Submit Button Text</label>
                  <input value={activeForm.submitText} onChange={e => {
                    const u = { ...activeForm, submitText: e.target.value }; setActiveForm(u); setForms(p => p.map(f => f.id === u.id ? u : f));
                  }} className="input w-full text-xs" />
                </div>
                <div>
                  <label className="block text-[10px] text-muted mb-1">Thank You Message</label>
                  <textarea value={activeForm.thankYouMessage} onChange={e => {
                    const u = { ...activeForm, thankYouMessage: e.target.value }; setActiveForm(u); setForms(p => p.map(f => f.id === u.id ? u : f));
                  }} className="input w-full text-xs h-16" />
                </div>
                <div>
                  <label className="block text-[10px] text-muted mb-1">Accent Color</label>
                  <div className="flex gap-2">
                    {["#C9A84C", "#3b82f6", "#10b981", "#ef4444", "#8b5cf6", "#ec4899", "#f59e0b"].map(c => (
                      <button key={c} onClick={() => {
                        const u = { ...activeForm, accentColor: c }; setActiveForm(u); setForms(p => p.map(f => f.id === u.id ? u : f));
                      }} className={`w-6 h-6 rounded-full transition-all ${activeForm.accentColor === c ? "ring-2 ring-white/30 scale-110" : ""}`}
                        style={{ background: c }} />
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] text-muted mb-1">Webhook URL (on submit)</label>
                  <input value={activeForm.webhookUrl} onChange={e => {
                    const u = { ...activeForm, webhookUrl: e.target.value }; setActiveForm(u); setForms(p => p.map(f => f.id === u.id ? u : f));
                  }} className="input w-full text-xs" placeholder="https://hooks.zapier.com/..." />
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-light">
                  <div className="flex items-center gap-2">
                    <Shield size={12} className="text-gold" />
                    <span className="text-xs">Spam Protection</span>
                  </div>
                  <button onClick={() => {
                    const u = { ...activeForm, spamProtection: !activeForm.spamProtection }; setActiveForm(u); setForms(p => p.map(f => f.id === u.id ? u : f));
                  }} className={`w-10 h-5 rounded-full transition-all relative ${activeForm.spamProtection ? "bg-gold" : "bg-surface"}`}>
                    <div className="w-4 h-4 rounded-full bg-white absolute top-0.5" style={{ left: activeForm.spamProtection ? 22 : 2 }} />
                  </button>
                </div>
              </div>
            </div>

            {/* Embed Code */}
            <div className="card">
              <h2 className="section-header flex items-center gap-2"><Code size={12} className="text-gold" /> Embed Code</h2>
              <pre className="text-[9px] text-muted bg-black/20 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">{generateEmbedCode()}</pre>
              <button onClick={() => navigator.clipboard.writeText(generateEmbedCode())} className="btn-primary w-full text-xs mt-2 flex items-center justify-center gap-1.5">
                <Copy size={12} /> Copy Embed Code
              </button>
            </div>
          </div>

          {/* Live Preview */}
          <div className="card sticky top-4">
            <h2 className="section-header flex items-center gap-2"><Eye size={12} className="text-gold" /> Live Preview</h2>
            <div className="rounded-xl p-6" style={{ background: "#ffffff" }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111", marginBottom: 16 }}>{activeForm.name}</h2>
              {activeForm.fields.map(field => (
                <div key={field.id} style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontSize: 12, color: "#666", marginBottom: 4 }}>
                    {field.label} {field.required && <span style={{ color: activeForm.accentColor }}>*</span>}
                  </label>
                  {field.type === "textarea" ? (
                    <textarea placeholder={field.placeholder} rows={3} style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 6, fontSize: 14, resize: "vertical" }} />
                  ) : field.type === "select" ? (
                    <select style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 6, fontSize: 14 }}>
                      <option>{field.placeholder || "Select..."}</option>
                      {(field.options || []).map(o => <option key={o}>{o}</option>)}
                    </select>
                  ) : field.type === "checkbox" ? (
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                      <input type="checkbox" /> {field.label}
                    </label>
                  ) : field.type === "rating" ? (
                    <div style={{ display: "flex", gap: 4 }}>
                      {[1,2,3,4,5].map(n => (
                        <button key={n} onMouseEnter={() => setRatingHover(n)} onMouseLeave={() => setRatingHover(0)}
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 24, color: n <= ratingHover ? activeForm.accentColor : "#ddd" }}>
                          &#9733;
                        </button>
                      ))}
                    </div>
                  ) : field.type === "file" ? (
                    <div style={{ border: "2px dashed #ddd", borderRadius: 6, padding: 20, textAlign: "center", color: "#999", fontSize: 12 }}>
                      Click to upload or drag and drop
                    </div>
                  ) : (
                    <input type={field.type} placeholder={field.placeholder} style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 6, fontSize: 14 }} />
                  )}
                </div>
              ))}
              <button style={{ width: "100%", padding: 12, background: activeForm.accentColor, color: "#000", fontWeight: 700, border: "none", borderRadius: 6, fontSize: 15, cursor: "pointer" }}>
                {activeForm.submitText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Templates Tab */}
      {tab === "templates" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {TEMPLATES.map((tpl, i) => (
            <button key={i} onClick={() => createFromTemplate(tpl)}
              className="text-left p-4 rounded-xl transition-all hover:border-gold/15 bg-surface-light border border-border">
              <p className="text-sm font-bold mb-1">{tpl.name}</p>
              <p className="text-[10px] text-muted mb-2">{tpl.desc} - {tpl.fields.length} fields</p>
              <div className="flex flex-wrap gap-1">
                {tpl.fields.map((f, j) => (
                  <span key={j} className="text-[8px] px-1.5 py-0.5 rounded bg-surface flex items-center gap-0.5">
                    {FIELD_TYPES.find(ft => ft.type === f.type)?.icon} {f.label}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Submissions Tab */}
      {tab === "submissions" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="section-header mb-0">Recent Submissions</h2>
            <button className="btn-secondary text-xs flex items-center gap-1.5"><Download size={12} /> Export CSV</button>
          </div>
          <div className="space-y-2">
            {MOCK_SUBMISSIONS.map(sub => (
              <div key={sub.id} className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-400/10 text-blue-400">{sub.source}</span>
                    <span className="text-[9px] text-muted">{new Date(sub.submittedAt).toLocaleString()}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(sub.data).map(([key, val]) => (
                    <div key={key}>
                      <p className="text-[9px] text-muted">{key}</p>
                      <p className="text-xs font-medium">{val}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {tab === "analytics" && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><BarChart3 size={13} className="text-gold" /> Form Funnel</h2>
            <div className="flex items-end gap-4 h-40 justify-center">
              {[
                { label: "Views", value: 1247, color: "#3b82f6" },
                { label: "Starts", value: 834, color: "#8b5cf6" },
                { label: "Completions", value: 523, color: "#10b981" },
              ].map(item => (
                <div key={item.label} className="flex flex-col items-center gap-1">
                  <p className="text-xs font-bold" style={{ color: item.color }}>{item.value}</p>
                  <div className="w-20 rounded-t-lg" style={{ height: `${(item.value / 1247) * 120}px`, background: item.color }} />
                  <p className="text-[10px] text-muted">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="card">
              <h2 className="section-header flex items-center gap-2"><Globe size={13} className="text-blue-400" /> Traffic Sources</h2>
              <div className="space-y-2">
                {[
                  { source: "Website", count: 45, pct: 42 },
                  { source: "Facebook Ad", count: 28, pct: 26 },
                  { source: "Google Ad", count: 18, pct: 17 },
                  { source: "Email Link", count: 12, pct: 11 },
                  { source: "Direct", count: 5, pct: 4 },
                ].map(s => (
                  <div key={s.source} className="flex items-center gap-2 text-xs">
                    <span className="w-24 truncate">{s.source}</span>
                    <div className="flex-1 h-2 rounded-full bg-surface-light overflow-hidden">
                      <div className="h-full rounded-full bg-blue-400" style={{ width: `${s.pct}%` }} />
                    </div>
                    <span className="text-muted w-10 text-right">{s.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <h2 className="section-header flex items-center gap-2"><Zap size={13} className="text-gold" /> Drop-off Points</h2>
              <div className="space-y-2">
                {[
                  { field: "Phone Number", dropoff: 23 },
                  { field: "Budget Range", dropoff: 15 },
                  { field: "Message", dropoff: 8 },
                  { field: "File Upload", dropoff: 31 },
                ].map(d => (
                  <div key={d.field} className="flex items-center gap-2 text-xs">
                    <span className="flex-1">{d.field}</span>
                    <span className="text-red-400 font-bold">{d.dropoff}% leave</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {tab === "settings" && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Palette size={13} className="text-gold" /> Form Styling</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] text-muted mb-1">Font Family</label>
                <select className="input w-full text-xs">
                  <option>System Default</option>
                  <option>Inter</option>
                  <option>Poppins</option>
                  <option>Roboto</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-muted mb-1">Border Radius</label>
                <select className="input w-full text-xs">
                  <option>Rounded (8px)</option>
                  <option>Sharp (0px)</option>
                  <option>Pill (24px)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-muted mb-1">Background</label>
                <select className="input w-full text-xs">
                  <option>White</option>
                  <option>Light Gray</option>
                  <option>Transparent</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-muted mb-1">Submit Button Style</label>
                <select className="input w-full text-xs">
                  <option>Filled</option>
                  <option>Outlined</option>
                  <option>Ghost</option>
                </select>
              </div>
            </div>
          </div>
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Link2 size={13} className="text-blue-400" /> Integrations</h2>
            <div className="space-y-2">
              {[
                { name: "Zapier Webhook", connected: true },
                { name: "Email Notifications", connected: true },
                { name: "Slack Alerts", connected: false },
                { name: "Google Sheets", connected: false },
              ].map(int => (
                <div key={int.name} className="flex items-center justify-between p-2.5 rounded-lg bg-surface-light border border-border">
                  <span className="text-xs">{int.name}</span>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full ${int.connected ? "bg-emerald-400/10 text-emerald-400" : "bg-surface text-muted"}`}>
                    {int.connected ? "Connected" : "Connect"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
