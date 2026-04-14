"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  FileText, Plus, Eye, Copy, Check, X, Star,
  Palette, Type, DollarSign, Settings,
  Sparkles, Download, ChevronDown, ChevronRight,
  Trash2, Edit3, Save, Loader,
  CreditCard, Receipt, Building, Briefcase, Zap, Award
} from "lucide-react";
import toast from "react-hot-toast";

interface InvoiceTemplate {
  id: string;
  name: string;
  style: "modern" | "classic" | "minimal" | "bold" | "corporate" | "creative";
  isDefault: boolean;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
  lineItems: LineItemPreset[];
  paymentTerms: string;
  taxRate: number;
  taxIncluded: boolean;
  notes: string;
  terms: string;
  companyName: string;
  companyAddress: string;
  companyEmail: string;
  companyPhone: string;
}

interface LineItemPreset {
  id: string;
  description: string;
  quantity: number;
  rate: number;
}

const TEMPLATE_STYLES = [
  { key: "modern" as const, label: "Modern", icon: <Zap size={16} />, description: "Clean lines, bold accents, contemporary feel", colors: { primary: "#D4AF37", accent: "#1a1a2e" } },
  { key: "classic" as const, label: "Classic", icon: <Award size={16} />, description: "Timeless design, serif fonts, traditional layout", colors: { primary: "#2c3e50", accent: "#ecf0f1" } },
  { key: "minimal" as const, label: "Minimal", icon: <Type size={16} />, description: "Whitespace-focused, simple typography, understated", colors: { primary: "#333333", accent: "#f5f5f5" } },
  { key: "bold" as const, label: "Bold", icon: <Sparkles size={16} />, description: "High contrast, large type, impactful design", colors: { primary: "#e74c3c", accent: "#2c3e50" } },
  { key: "corporate" as const, label: "Corporate", icon: <Building size={16} />, description: "Professional, structured, enterprise-ready", colors: { primary: "#2980b9", accent: "#ecf0f1" } },
  { key: "creative" as const, label: "Creative", icon: <Palette size={16} />, description: "Unique layouts, playful colors, artistic flair", colors: { primary: "#9b59b6", accent: "#ffeaa7" } },
];

const LINE_ITEM_PRESETS = [
  { description: "Monthly Retainer", rate: 2500 },
  { description: "Ad Spend Management", rate: 1500 },
  { description: "Content Package (10 posts)", rate: 1200 },
  { description: "SEO Optimization", rate: 800 },
  { description: "Social Media Management", rate: 1800 },
  { description: "Email Marketing Campaign", rate: 600 },
  { description: "Website Maintenance", rate: 500 },
  { description: "Brand Strategy Session", rate: 350 },
  { description: "Video Production (per video)", rate: 450 },
  { description: "Graphic Design (per hour)", rate: 125 },
];

const PAYMENT_TERMS = ["Due on Receipt", "Net 15", "Net 30", "Net 45", "Net 60", "Custom"];
const FONT_OPTIONS = ["Inter", "Georgia", "Helvetica", "Courier New", "Palatino", "Futura"];

const INITIAL_TEMPLATES: InvoiceTemplate[] = [
  {
    id: "1", name: "Agency Standard", style: "modern", isDefault: true,
    logoUrl: "", primaryColor: "#D4AF37", accentColor: "#1a1a2e", fontFamily: "Inter",
    lineItems: [
      { id: "1", description: "Monthly Retainer", quantity: 1, rate: 2500 },
      { id: "2", description: "Ad Spend Management", quantity: 1, rate: 1500 },
      { id: "3", description: "Content Package (10 posts)", quantity: 1, rate: 1200 },
    ],
    paymentTerms: "Net 30", taxRate: 0, taxIncluded: false,
    notes: "Thank you for your business! Payment is due within 30 days.",
    terms: "Late payments are subject to a 1.5% monthly fee. All work remains property of provider until paid in full.",
    companyName: "ShortStack Agency", companyAddress: "123 Agency Blvd, Suite 100", companyEmail: "billing@shortstackagency.com", companyPhone: "(555) 123-4567",
  },
  {
    id: "2", name: "Minimal Invoice", style: "minimal", isDefault: false,
    logoUrl: "", primaryColor: "#333333", accentColor: "#f5f5f5", fontFamily: "Helvetica",
    lineItems: [
      { id: "1", description: "Consulting Services", quantity: 8, rate: 150 },
    ],
    paymentTerms: "Due on Receipt", taxRate: 8.25, taxIncluded: false,
    notes: "Payment due upon receipt. Thank you!",
    terms: "Standard terms apply.",
    companyName: "ShortStack Agency", companyAddress: "123 Agency Blvd", companyEmail: "billing@shortstackagency.com", companyPhone: "(555) 123-4567",
  },
  {
    id: "3", name: "Corporate Pro", style: "corporate", isDefault: false,
    logoUrl: "", primaryColor: "#2980b9", accentColor: "#ecf0f1", fontFamily: "Georgia",
    lineItems: [
      { id: "1", description: "Monthly Retainer", quantity: 1, rate: 5000 },
      { id: "2", description: "Social Media Management", quantity: 1, rate: 1800 },
    ],
    paymentTerms: "Net 45", taxRate: 10, taxIncluded: true,
    notes: "All prices include applicable taxes.",
    terms: "Payment terms as agreed in master service agreement.",
    companyName: "ShortStack Agency", companyAddress: "123 Agency Blvd, Suite 100", companyEmail: "billing@shortstackagency.com", companyPhone: "(555) 123-4567",
  },
];

export default function InvoiceTemplatesPage() {
  useAuth();
  const supabase = createClient();

  const [templates, setTemplates] = useState<InvoiceTemplate[]>(INITIAL_TEMPLATES);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("1");
  const [tab, setTab] = useState<"gallery" | "editor" | "preview">("gallery");
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const [saving, setSaving] = useState(false);

  void supabase;

  const template = templates.find(t => t.id === selectedTemplate);

  const updateTemplate = (updates: Partial<InvoiceTemplate>) => {
    setTemplates(prev => prev.map(t => t.id === selectedTemplate ? { ...t, ...updates } : t));
  };

  const addLineItem = (preset?: { description: string; rate: number }) => {
    if (!template) return;
    const newItem: LineItemPreset = {
      id: String(Date.now()),
      description: preset?.description || "New Item",
      quantity: 1,
      rate: preset?.rate || 0,
    };
    updateTemplate({ lineItems: [...template.lineItems, newItem] });
    toast.success("Line item added");
  };

  const updateLineItem = (itemId: string, updates: Partial<LineItemPreset>) => {
    if (!template) return;
    updateTemplate({
      lineItems: template.lineItems.map(li => li.id === itemId ? { ...li, ...updates } : li),
    });
  };

  const removeLineItem = (itemId: string) => {
    if (!template) return;
    updateTemplate({ lineItems: template.lineItems.filter(li => li.id !== itemId) });
  };

  const setAsDefault = (id: string) => {
    setTemplates(prev => prev.map(t => ({ ...t, isDefault: t.id === id })));
    toast.success("Default template updated");
  };

  const duplicateTemplate = (id: string) => {
    const src = templates.find(t => t.id === id);
    if (!src) return;
    const newTemplate = { ...src, id: String(Date.now()), name: `${src.name} (Copy)`, isDefault: false };
    setTemplates(prev => [...prev, newTemplate]);
    setSelectedTemplate(newTemplate.id);
    toast.success("Template duplicated");
  };

  const deleteTemplate = (id: string) => {
    if (templates.length <= 1) { toast.error("Cannot delete the last template"); return; }
    setTemplates(prev => prev.filter(t => t.id !== id));
    if (selectedTemplate === id) setSelectedTemplate(templates[0].id === id ? templates[1].id : templates[0].id);
    toast.success("Template deleted");
  };

  const createNewTemplate = () => {
    const newTemplate: InvoiceTemplate = {
      id: String(Date.now()), name: "New Template", style: "modern", isDefault: false,
      logoUrl: "", primaryColor: "#D4AF37", accentColor: "#1a1a2e", fontFamily: "Inter",
      lineItems: [], paymentTerms: "Net 30", taxRate: 0, taxIncluded: false,
      notes: "", terms: "",
      companyName: "", companyAddress: "", companyEmail: "", companyPhone: "",
    };
    setTemplates(prev => [...prev, newTemplate]);
    setSelectedTemplate(newTemplate.id);
    setTab("editor");
    toast.success("New template created");
  };

  const saveTemplate = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 800));
    setSaving(false);
    toast.success("Template saved!");
  };

  const getSubtotal = () => template?.lineItems.reduce((sum, li) => sum + li.quantity * li.rate, 0) || 0;
  const getTax = () => template?.taxIncluded ? 0 : (getSubtotal() * (template?.taxRate || 0)) / 100;
  const getTotal = () => getSubtotal() + getTax();

  const TABS = [
    { key: "gallery" as const, label: "Template Gallery", icon: <Palette size={14} /> },
    { key: "editor" as const, label: "Editor", icon: <Edit3 size={14} /> },
    { key: "preview" as const, label: "Preview", icon: <Eye size={14} /> },
  ];

  return (
    <div className="fade-in space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Receipt size={20} className="text-gold" /> Invoice Template Builder
          </h1>
          <p className="text-xs text-muted">Create and manage professional invoice templates</p>
        </div>
        <button onClick={createNewTemplate} className="btn-primary text-xs flex items-center gap-1">
          <Plus size={14} /> New Template
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-lg p-1">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all ${
              tab === t.key ? "bg-gold/20 text-gold" : "text-muted hover:text-white"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Gallery Tab */}
      {tab === "gallery" && (
        <div className="space-y-6">
          {/* Style Presets */}
          <div>
            <h2 className="text-sm font-semibold mb-3">Template Styles</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {TEMPLATE_STYLES.map(style => (
                <div key={style.key} className="card cursor-pointer hover:border-white/20 transition-all group">
                  <div className="w-full aspect-[3/4] rounded-lg mb-2 border border-white/10 overflow-hidden relative" style={{ background: style.colors.accent }}>
                    <div className="absolute top-0 left-0 right-0 h-6" style={{ background: style.colors.primary }} />
                    <div className="p-2 mt-6 space-y-1">
                      <div className="h-1.5 w-2/3 rounded bg-black/20" />
                      <div className="h-1 w-full rounded bg-black/10" />
                      <div className="h-1 w-full rounded bg-black/10" />
                      <div className="h-1 w-4/5 rounded bg-black/10" />
                      <div className="mt-2 h-1.5 w-1/3 rounded ml-auto" style={{ background: style.colors.primary }} />
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted group-hover:text-white transition-colors">{style.icon}</span>
                    <span className="text-xs font-medium">{style.label}</span>
                  </div>
                  <p className="text-[10px] text-muted mt-0.5">{style.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Saved Templates */}
          <div>
            <h2 className="text-sm font-semibold mb-3">Your Templates</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map(t => (
                <div
                  key={t.id}
                  onClick={() => { setSelectedTemplate(t.id); setTab("editor"); }}
                  className={`card cursor-pointer transition-all hover:border-white/20 ${
                    t.id === selectedTemplate ? "border border-gold/40" : ""
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {TEMPLATE_STYLES.find(s => s.key === t.style)?.icon}
                      <div>
                        <p className="text-xs font-semibold">{t.name}</p>
                        <p className="text-[10px] text-muted capitalize">{t.style} style</p>
                      </div>
                    </div>
                    {t.isDefault && (
                      <span className="px-2 py-0.5 rounded-full bg-gold/20 text-gold text-[9px] font-semibold">DEFAULT</span>
                    )}
                  </div>

                  {/* Mini Preview */}
                  <div className="w-full aspect-[4/3] rounded-lg border border-white/10 mb-3 overflow-hidden bg-white/5 p-3">
                    <div className="h-1.5 w-1/2 bg-white/20 rounded mb-2" />
                    <div className="space-y-1">
                      {t.lineItems.slice(0, 3).map(li => (
                        <div key={li.id} className="flex justify-between">
                          <div className="h-1 w-2/3 bg-white/10 rounded" />
                          <div className="h-1 w-1/6 bg-white/10 rounded" />
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 pt-1 border-t border-white/10 flex justify-between">
                      <div className="h-1.5 w-1/4 bg-white/15 rounded" />
                      <div className="h-1.5 w-1/5 bg-gold/30 rounded" />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] text-muted mb-2">
                    <span>{t.lineItems.length} line items</span>
                    <span>-</span>
                    <span>{t.paymentTerms}</span>
                    {t.taxRate > 0 && <><span>-</span><span>{t.taxRate}% tax</span></>}
                  </div>

                  <div className="flex gap-1">
                    <button
                      onClick={e => { e.stopPropagation(); setSelectedTemplate(t.id); setTab("editor"); }}
                      className="btn-ghost text-[10px] flex-1"
                    >
                      <Edit3 size={10} /> Edit
                    </button>
                    <button onClick={e => { e.stopPropagation(); duplicateTemplate(t.id); }} className="btn-ghost text-[10px]">
                      <Copy size={10} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); setAsDefault(t.id); }} className="btn-ghost text-[10px]">
                      <Star size={10} className={t.isDefault ? "fill-gold text-gold" : ""} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); deleteTemplate(t.id); }} className="btn-ghost text-[10px] text-red-400">
                      <Trash2 size={10} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Editor Tab */}
      {tab === "editor" && template && (
        <div className="grid grid-cols-12 gap-4">
          {/* Editor Panel */}
          <div className="col-span-12 lg:col-span-7 space-y-4">
            {/* Template Name & Style */}
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <Settings size={16} className="text-gold" />
                <span className="text-sm font-semibold">Template Settings</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-muted uppercase tracking-wider">Template Name</label>
                  <input
                    value={template.name}
                    onChange={e => updateTemplate({ name: e.target.value })}
                    className="input text-xs w-full mt-1"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted uppercase tracking-wider">Style</label>
                  <div className="relative mt-1">
                    <button
                      onClick={() => setShowPresetMenu(!showPresetMenu)}
                      className="input text-xs w-full text-left flex items-center justify-between"
                    >
                      <span className="capitalize">{template.style}</span>
                      <ChevronDown size={12} />
                    </button>
                    {showPresetMenu && (
                      <div className="absolute left-0 top-full mt-1 bg-[#1a1a2e] border border-white/10 rounded-lg shadow-xl z-10 w-full">
                        {TEMPLATE_STYLES.map(s => (
                          <button
                            key={s.key}
                            onClick={() => { updateTemplate({ style: s.key, primaryColor: s.colors.primary, accentColor: s.colors.accent }); setShowPresetMenu(false); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/5 transition-colors"
                          >
                            {s.icon} {s.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Branding */}
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <Palette size={16} className="text-gold" />
                <span className="text-sm font-semibold">Branding</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-muted uppercase tracking-wider">Primary Color</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="color"
                      value={template.primaryColor}
                      onChange={e => updateTemplate({ primaryColor: e.target.value })}
                      className="w-8 h-8 rounded cursor-pointer border-0"
                    />
                    <input
                      value={template.primaryColor}
                      onChange={e => updateTemplate({ primaryColor: e.target.value })}
                      className="input text-xs flex-1"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-muted uppercase tracking-wider">Accent Color</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="color"
                      value={template.accentColor}
                      onChange={e => updateTemplate({ accentColor: e.target.value })}
                      className="w-8 h-8 rounded cursor-pointer border-0"
                    />
                    <input
                      value={template.accentColor}
                      onChange={e => updateTemplate({ accentColor: e.target.value })}
                      className="input text-xs flex-1"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-muted uppercase tracking-wider">Font Family</label>
                  <select
                    value={template.fontFamily}
                    onChange={e => updateTemplate({ fontFamily: e.target.value })}
                    className="input text-xs w-full mt-1"
                  >
                    {FONT_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Company Info */}
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <Building size={16} className="text-gold" />
                <span className="text-sm font-semibold">Company Information</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-muted uppercase tracking-wider">Company Name</label>
                  <input value={template.companyName} onChange={e => updateTemplate({ companyName: e.target.value })} className="input text-xs w-full mt-1" />
                </div>
                <div>
                  <label className="text-[10px] text-muted uppercase tracking-wider">Email</label>
                  <input value={template.companyEmail} onChange={e => updateTemplate({ companyEmail: e.target.value })} className="input text-xs w-full mt-1" />
                </div>
                <div>
                  <label className="text-[10px] text-muted uppercase tracking-wider">Address</label>
                  <input value={template.companyAddress} onChange={e => updateTemplate({ companyAddress: e.target.value })} className="input text-xs w-full mt-1" />
                </div>
                <div>
                  <label className="text-[10px] text-muted uppercase tracking-wider">Phone</label>
                  <input value={template.companyPhone} onChange={e => updateTemplate({ companyPhone: e.target.value })} className="input text-xs w-full mt-1" />
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <DollarSign size={16} className="text-gold" />
                  <span className="text-sm font-semibold">Line Items</span>
                </div>
                <button onClick={() => addLineItem()} className="text-xs text-gold hover:underline flex items-center gap-1">
                  <Plus size={12} /> Add Item
                </button>
              </div>

              {/* Presets */}
              <div className="flex flex-wrap gap-1 mb-3">
                {LINE_ITEM_PRESETS.slice(0, 5).map(preset => (
                  <button
                    key={preset.description}
                    onClick={() => addLineItem(preset)}
                    className="px-2 py-0.5 rounded-full bg-white/5 text-[9px] text-muted hover:text-white hover:bg-white/10 transition-all border border-white/10"
                  >
                    + {preset.description}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                {template.lineItems.map(li => (
                  <div key={li.id} className="flex items-center gap-2 p-2 rounded bg-white/5 group">
                    <input
                      value={li.description}
                      onChange={e => updateLineItem(li.id, { description: e.target.value })}
                      className="input text-xs flex-1"
                      placeholder="Description"
                    />
                    <input
                      type="number"
                      value={li.quantity}
                      onChange={e => updateLineItem(li.id, { quantity: Number(e.target.value) })}
                      className="input text-xs w-16 text-center"
                      placeholder="Qty"
                    />
                    <div className="flex items-center">
                      <span className="text-[10px] text-muted mr-1">$</span>
                      <input
                        type="number"
                        value={li.rate}
                        onChange={e => updateLineItem(li.id, { rate: Number(e.target.value) })}
                        className="input text-xs w-24"
                        placeholder="Rate"
                      />
                    </div>
                    <span className="text-xs font-medium w-20 text-right">${(li.quantity * li.rate).toLocaleString()}</span>
                    <button onClick={() => removeLineItem(li.id)} className="text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment & Tax */}
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <CreditCard size={16} className="text-gold" />
                <span className="text-sm font-semibold">Payment & Tax</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-muted uppercase tracking-wider">Payment Terms</label>
                  <select
                    value={template.paymentTerms}
                    onChange={e => updateTemplate({ paymentTerms: e.target.value })}
                    className="input text-xs w-full mt-1"
                  >
                    {PAYMENT_TERMS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted uppercase tracking-wider">Tax Rate (%)</label>
                  <input
                    type="number"
                    value={template.taxRate}
                    onChange={e => updateTemplate({ taxRate: Number(e.target.value) })}
                    className="input text-xs w-full mt-1"
                    step={0.25}
                    min={0}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted uppercase tracking-wider">Tax Handling</label>
                  <button
                    onClick={() => updateTemplate({ taxIncluded: !template.taxIncluded })}
                    className="input text-xs w-full mt-1 text-left flex items-center justify-between"
                  >
                    <span>{template.taxIncluded ? "Included in price" : "Added to subtotal"}</span>
                    {template.taxIncluded ? <Check size={12} className="text-green-400" /> : <X size={12} className="text-muted" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Notes & Terms */}
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <FileText size={16} className="text-gold" />
                <span className="text-sm font-semibold">Notes & Terms</span>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-muted uppercase tracking-wider">Notes</label>
                  <textarea
                    value={template.notes}
                    onChange={e => updateTemplate({ notes: e.target.value })}
                    className="input text-xs w-full mt-1 min-h-[60px] resize-none"
                    placeholder="Thank you for your business..."
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted uppercase tracking-wider">Terms & Conditions</label>
                  <textarea
                    value={template.terms}
                    onChange={e => updateTemplate({ terms: e.target.value })}
                    className="input text-xs w-full mt-1 min-h-[60px] resize-none"
                    placeholder="Payment terms, late fees, etc..."
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button onClick={saveTemplate} disabled={saving} className="btn-primary text-xs flex items-center gap-1">
                {saving ? <Loader size={12} className="animate-spin" /> : <Save size={12} />}
                {saving ? "Saving..." : "Save Template"}
              </button>
              <button onClick={() => setAsDefault(template.id)} className="btn-ghost text-xs flex items-center gap-1">
                <Star size={12} className={template.isDefault ? "fill-gold text-gold" : ""} />
                {template.isDefault ? "Default" : "Set as Default"}
              </button>
              <button onClick={() => setTab("preview")} className="btn-ghost text-xs flex items-center gap-1">
                <Eye size={12} /> Preview
              </button>
            </div>
          </div>

          {/* Live Preview Sidebar */}
          <div className="col-span-12 lg:col-span-5">
            <div className="sticky top-4">
              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-muted">Live Preview</span>
                  <button onClick={() => setTab("preview")} className="text-[10px] text-gold hover:underline">Full Preview</button>
                </div>
                <div className="rounded-lg border border-white/10 overflow-hidden bg-white text-black p-4" style={{ fontFamily: template.fontFamily }}>
                  {/* Invoice Header */}
                  <div className="flex justify-between items-start mb-4 pb-3 border-b" style={{ borderColor: template.primaryColor + "40" }}>
                    <div>
                      <div className="w-10 h-10 rounded flex items-center justify-center mb-1" style={{ background: template.primaryColor }}>
                        <Briefcase size={16} className="text-white" />
                      </div>
                      <p className="text-[10px] font-bold">{template.companyName || "Company Name"}</p>
                      <p className="text-[7px] text-gray-500">{template.companyAddress}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-bold" style={{ color: template.primaryColor }}>INVOICE</p>
                      <p className="text-[7px] text-gray-500">#INV-0001</p>
                      <p className="text-[7px] text-gray-500">Date: {new Date().toLocaleDateString()}</p>
                    </div>
                  </div>

                  {/* Line Items */}
                  <table className="w-full text-[7px] mb-3">
                    <thead>
                      <tr style={{ background: template.primaryColor + "15" }}>
                        <th className="text-left p-1 font-semibold">Description</th>
                        <th className="text-center p-1 font-semibold">Qty</th>
                        <th className="text-right p-1 font-semibold">Rate</th>
                        <th className="text-right p-1 font-semibold">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {template.lineItems.map(li => (
                        <tr key={li.id} className="border-b border-gray-100">
                          <td className="p-1">{li.description}</td>
                          <td className="p-1 text-center">{li.quantity}</td>
                          <td className="p-1 text-right">${li.rate}</td>
                          <td className="p-1 text-right">${(li.quantity * li.rate).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Totals */}
                  <div className="flex justify-end mb-3">
                    <div className="w-1/2 space-y-0.5 text-[7px]">
                      <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>${getSubtotal().toLocaleString()}</span></div>
                      {template.taxRate > 0 && !template.taxIncluded && (
                        <div className="flex justify-between"><span className="text-gray-500">Tax ({template.taxRate}%)</span><span>${getTax().toLocaleString()}</span></div>
                      )}
                      <div className="flex justify-between font-bold pt-0.5 border-t border-gray-200" style={{ color: template.primaryColor }}>
                        <span>Total</span><span>${getTotal().toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="pt-2 border-t border-gray-100 text-[6px] text-gray-400 space-y-0.5">
                    {template.paymentTerms && <p>Payment Terms: {template.paymentTerms}</p>}
                    {template.notes && <p>{template.notes}</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full Preview Tab */}
      {tab === "preview" && template && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button onClick={() => setTab("editor")} className="btn-ghost text-xs flex items-center gap-1">
              <ChevronRight size={12} className="rotate-180" /> Back to Editor
            </button>
            <div className="flex-1" />
            <button onClick={() => { toast.success("Invoice downloaded as PDF"); }} className="btn-primary text-xs flex items-center gap-1">
              <Download size={12} /> Download PDF
            </button>
          </div>

          <div className="flex justify-center">
            <div className="w-full max-w-2xl rounded-lg border border-white/10 overflow-hidden bg-white text-black p-8" style={{ fontFamily: template.fontFamily }}>
              {/* Header */}
              <div className="flex justify-between items-start mb-8 pb-4 border-b-2" style={{ borderColor: template.primaryColor }}>
                <div>
                  <div className="w-16 h-16 rounded-lg flex items-center justify-center mb-2" style={{ background: template.primaryColor }}>
                    <Briefcase size={28} className="text-white" />
                  </div>
                  <p className="text-sm font-bold">{template.companyName || "Company Name"}</p>
                  <p className="text-xs text-gray-500">{template.companyAddress}</p>
                  <p className="text-xs text-gray-500">{template.companyEmail}</p>
                  <p className="text-xs text-gray-500">{template.companyPhone}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold" style={{ color: template.primaryColor }}>INVOICE</p>
                  <p className="text-xs text-gray-500 mt-1">Invoice #INV-0001</p>
                  <p className="text-xs text-gray-500">Date: {new Date().toLocaleDateString()}</p>
                  <p className="text-xs text-gray-500">Due: {template.paymentTerms}</p>
                </div>
              </div>

              {/* Bill To */}
              <div className="mb-6">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Bill To</p>
                <p className="text-sm font-semibold">Client Name</p>
                <p className="text-xs text-gray-500">123 Client Street</p>
                <p className="text-xs text-gray-500">client@example.com</p>
              </div>

              {/* Table */}
              <table className="w-full text-xs mb-6">
                <thead>
                  <tr style={{ background: template.primaryColor + "15" }}>
                    <th className="text-left p-2 font-semibold">Description</th>
                    <th className="text-center p-2 font-semibold w-20">Quantity</th>
                    <th className="text-right p-2 font-semibold w-24">Rate</th>
                    <th className="text-right p-2 font-semibold w-24">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {template.lineItems.map(li => (
                    <tr key={li.id} className="border-b border-gray-100">
                      <td className="p-2">{li.description}</td>
                      <td className="p-2 text-center">{li.quantity}</td>
                      <td className="p-2 text-right">${li.rate.toLocaleString()}</td>
                      <td className="p-2 text-right">${(li.quantity * li.rate).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div className="flex justify-end mb-6">
                <div className="w-64 space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>${getSubtotal().toLocaleString()}</span></div>
                  {template.taxRate > 0 && !template.taxIncluded && (
                    <div className="flex justify-between"><span className="text-gray-500">Tax ({template.taxRate}%)</span><span>${getTax().toLocaleString()}</span></div>
                  )}
                  <div className="flex justify-between text-sm font-bold pt-2 border-t-2" style={{ borderColor: template.primaryColor, color: template.primaryColor }}>
                    <span>Total Due</span><span>${getTotal().toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {template.notes && (
                <div className="mb-4 p-3 rounded-lg" style={{ background: template.primaryColor + "08" }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Notes</p>
                  <p className="text-xs text-gray-600">{template.notes}</p>
                </div>
              )}

              {/* Terms */}
              {template.terms && (
                <div className="pt-4 border-t border-gray-200">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Terms & Conditions</p>
                  <p className="text-[10px] text-gray-500">{template.terms}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
