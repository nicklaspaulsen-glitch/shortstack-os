"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  FileText, Plus, Copy, Trash2, Eye,
  Type, Mail, Phone, MessageSquare, List, Hash
} from "lucide-react";
import toast from "react-hot-toast";

interface FormField {
  id: string;
  type: "text" | "email" | "phone" | "textarea" | "select" | "number";
  label: string;
  placeholder: string;
  required: boolean;
  options?: string[];
}

interface LeadForm {
  id: string;
  name: string;
  fields: FormField[];
  submitText: string;
  redirectUrl: string;
  webhookUrl: string;
}

const FIELD_TYPES = [
  { type: "text" as const, label: "Text", icon: <Type size={14} /> },
  { type: "email" as const, label: "Email", icon: <Mail size={14} /> },
  { type: "phone" as const, label: "Phone", icon: <Phone size={14} /> },
  { type: "textarea" as const, label: "Text Area", icon: <MessageSquare size={14} /> },
  { type: "select" as const, label: "Dropdown", icon: <List size={14} /> },
  { type: "number" as const, label: "Number", icon: <Hash size={14} /> },
];

const PRESETS = [
  {
    name: "Contact Form",
    fields: [
      { id: "1", type: "text" as const, label: "Full Name", placeholder: "John Smith", required: true },
      { id: "2", type: "email" as const, label: "Email", placeholder: "john@example.com", required: true },
      { id: "3", type: "phone" as const, label: "Phone", placeholder: "(555) 123-4567", required: false },
      { id: "4", type: "textarea" as const, label: "Message", placeholder: "How can we help?", required: false },
    ],
  },
  {
    name: "Free Consultation",
    fields: [
      { id: "1", type: "text" as const, label: "Business Name", placeholder: "Your Business", required: true },
      { id: "2", type: "text" as const, label: "Your Name", placeholder: "Full name", required: true },
      { id: "3", type: "email" as const, label: "Email", placeholder: "you@business.com", required: true },
      { id: "4", type: "phone" as const, label: "Phone", placeholder: "(555) 123-4567", required: true },
      { id: "5", type: "select" as const, label: "Monthly Budget", placeholder: "Select...", required: true, options: ["Under $1,000", "$1,000 - $3,000", "$3,000 - $5,000", "$5,000+"] },
      { id: "6", type: "select" as const, label: "Service Interested In", placeholder: "Select...", required: true, options: ["Social Media", "Paid Ads", "SEO", "Web Design", "Content Creation", "Full Service"] },
    ],
  },
  {
    name: "Quick Lead Capture",
    fields: [
      { id: "1", type: "text" as const, label: "Name", placeholder: "Your name", required: true },
      { id: "2", type: "email" as const, label: "Email", placeholder: "you@email.com", required: true },
    ],
  },
];

export default function FormsPage() {
  useAuth();
  const [forms, setForms] = useState<LeadForm[]>([]);
  const [activeForm, setActiveForm] = useState<LeadForm | null>(null);

  function createFromPreset(preset: typeof PRESETS[0]) {
    const newForm: LeadForm = {
      id: `form_${Date.now()}`,
      name: preset.name,
      fields: preset.fields,
      submitText: "Submit",
      redirectUrl: "",
      webhookUrl: "",
    };
    setForms(prev => [...prev, newForm]);
    setActiveForm(newForm);
    toast.success(`${preset.name} created!`);
  }

  function addField(type: FormField["type"]) {
    if (!activeForm) return;
    const field: FormField = {
      id: `f_${Date.now()}`,
      type,
      label: FIELD_TYPES.find(t => t.type === type)?.label || "Field",
      placeholder: "",
      required: false,
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

  function generateEmbedCode(): string {
    if (!activeForm) return "";
    const fields = activeForm.fields.map(f => {
      if (f.type === "select") {
        return `<select name="${f.label.toLowerCase().replace(/\s/g, '_')}" ${f.required ? 'required' : ''} style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;margin-bottom:12px;font-size:14px">\n    <option value="">${f.placeholder || 'Select...'}</option>\n    ${(f.options || []).map(o => `<option value="${o}">${o}</option>`).join('\n    ')}\n  </select>`;
      }
      if (f.type === "textarea") {
        return `<textarea name="${f.label.toLowerCase().replace(/\s/g, '_')}" placeholder="${f.placeholder}" ${f.required ? 'required' : ''} rows="3" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;margin-bottom:12px;font-size:14px;resize:vertical"></textarea>`;
      }
      return `<input type="${f.type}" name="${f.label.toLowerCase().replace(/\s/g, '_')}" placeholder="${f.placeholder}" ${f.required ? 'required' : ''} style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;margin-bottom:12px;font-size:14px"/>`;
    }).join('\n  ');

    return `<form action="https://shortstack-os.vercel.app/api/forms/submit" method="POST" style="max-width:400px;margin:0 auto;padding:24px;font-family:system-ui,sans-serif">
  <h2 style="margin-bottom:16px;font-size:20px;font-weight:700">${activeForm.name}</h2>
  ${fields}
  <input type="hidden" name="form_id" value="${activeForm.id}"/>
  <button type="submit" style="width:100%;padding:12px;background:#C9A84C;color:#000;font-weight:700;border:none;border-radius:6px;font-size:15px;cursor:pointer">${activeForm.submitText}</button>
</form>`;
  }

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2">
            <FileText size={18} className="text-gold" /> Form Builder
          </h1>
          <p className="text-xs text-muted mt-0.5">Create lead capture forms, embed on websites, leads flow into CRM</p>
        </div>
      </div>

      {!activeForm ? (
        <div className="space-y-4">
          {/* Presets */}
          <div className="card">
            <h2 className="section-header">Start from a template</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {PRESETS.map((preset, i) => (
                <button key={i} onClick={() => createFromPreset(preset)}
                  className="text-left p-4 rounded-xl transition-all hover:border-gold/15"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <p className="text-sm font-bold mb-1">{preset.name}</p>
                  <p className="text-[10px] text-muted">{preset.fields.length} fields</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {preset.fields.map((f, j) => (
                      <span key={j} className="text-[8px] px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.04)" }}>{f.label}</span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Existing forms */}
          {forms.length > 0 && (
            <div className="card">
              <h2 className="section-header">Your Forms</h2>
              <div className="space-y-2">
                {forms.map(form => (
                  <div key={form.id} className="flex items-center justify-between p-3 rounded-lg"
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <div>
                      <p className="text-xs font-semibold">{form.name}</p>
                      <p className="text-[10px] text-muted">{form.fields.length} fields</p>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => setActiveForm(form)} className="btn-secondary text-[9px] py-1 px-2"><Eye size={10} /> Edit</button>
                      <button onClick={() => { navigator.clipboard.writeText(generateEmbedCode()); toast.success("Embed code copied!"); }}
                        className="btn-ghost text-[9px] py-1 px-2"><Copy size={10} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Form Editor */}
          <div className="space-y-4">
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="section-header mb-0">Edit Form</h2>
                <button onClick={() => setActiveForm(null)} className="btn-ghost text-[10px]">Back to forms</button>
              </div>
              <input value={activeForm.name} onChange={e => {
                const updated = { ...activeForm, name: e.target.value };
                setActiveForm(updated);
                setForms(prev => prev.map(f => f.id === updated.id ? updated : f));
              }} className="input w-full mb-3" placeholder="Form name" />

              {/* Fields */}
              <div className="space-y-2 mb-3">
                {activeForm.fields.map((field, i) => (
                  <div key={field.id} className="flex items-center gap-2 p-2.5 rounded-lg"
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <span className="text-muted">{FIELD_TYPES.find(t => t.type === field.type)?.icon}</span>
                    <input value={field.label} onChange={e => {
                      const fields = [...activeForm.fields];
                      fields[i] = { ...fields[i], label: e.target.value };
                      const updated = { ...activeForm, fields };
                      setActiveForm(updated);
                      setForms(prev => prev.map(f => f.id === updated.id ? updated : f));
                    }} className="flex-1 bg-transparent text-xs outline-none" />
                    <button onClick={() => {
                      const fields = [...activeForm.fields];
                      fields[i] = { ...fields[i], required: !fields[i].required };
                      const updated = { ...activeForm, fields };
                      setActiveForm(updated);
                      setForms(prev => prev.map(f => f.id === updated.id ? updated : f));
                    }} className={`text-[8px] px-1.5 py-0.5 rounded ${field.required ? "bg-gold/10 text-gold" : "text-muted"}`}>
                      {field.required ? "Required" : "Optional"}
                    </button>
                    <button onClick={() => removeField(field.id)} className="text-muted hover:text-danger p-1"><Trash2 size={10} /></button>
                  </div>
                ))}
              </div>

              {/* Add field */}
              <div className="flex flex-wrap gap-1.5">
                {FIELD_TYPES.map(ft => (
                  <button key={ft.type} onClick={() => addField(ft.type)}
                    className="flex items-center gap-1 text-[9px] px-2 py-1 rounded-md text-muted hover:text-white transition-colors"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <Plus size={8} /> {ft.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Embed Code */}
            <div className="card">
              <h2 className="section-header flex items-center gap-2"><Copy size={12} className="text-gold" /> Embed Code</h2>
              <pre className="text-[9px] text-muted bg-black/20 rounded-lg p-3 max-h-[200px] overflow-y-auto whitespace-pre-wrap">{generateEmbedCode()}</pre>
              <button onClick={() => { navigator.clipboard.writeText(generateEmbedCode()); toast.success("Copied!"); }}
                className="btn-primary w-full text-xs mt-2 flex items-center justify-center gap-1.5">
                <Copy size={12} /> Copy Embed Code
              </button>
            </div>
          </div>

          {/* Live Preview */}
          <div className="card">
            <h2 className="section-header flex items-center gap-2"><Eye size={12} className="text-gold" /> Live Preview</h2>
            <div className="rounded-xl p-6" style={{ background: "#ffffff" }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111", marginBottom: 16 }}>{activeForm.name}</h2>
              {activeForm.fields.map(field => (
                <div key={field.id} style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontSize: 12, color: "#666", marginBottom: 4 }}>
                    {field.label} {field.required && <span style={{ color: "#C9A84C" }}>*</span>}
                  </label>
                  {field.type === "textarea" ? (
                    <textarea placeholder={field.placeholder} rows={3}
                      style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 6, fontSize: 14, resize: "vertical" }} />
                  ) : field.type === "select" ? (
                    <select style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 6, fontSize: 14 }}>
                      <option>{field.placeholder || "Select..."}</option>
                      {(field.options || []).map(o => <option key={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input type={field.type} placeholder={field.placeholder}
                      style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 6, fontSize: 14 }} />
                  )}
                </div>
              ))}
              <button style={{ width: "100%", padding: 12, background: "#C9A84C", color: "#000", fontWeight: 700, border: "none", borderRadius: 6, fontSize: 15, cursor: "pointer" }}>
                {activeForm.submitText}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
