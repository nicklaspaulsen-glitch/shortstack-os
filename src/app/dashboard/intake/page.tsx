"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus, Copy, Trash2, Eye, BarChart3, ExternalLink,
  CheckCircle2, Clock, XCircle, Users, Sparkles,
  ChevronRight, Loader2, Settings, Mail, Phone,
  MessageSquare, List, Hash, Star, ChevronDown,
  X, Zap
} from "lucide-react";
import toast from "react-hot-toast";
import PageHero from "@/components/ui/page-hero";
import Modal from "@/components/ui/modal";
import { createClient as createClientSupabase } from "@/lib/supabase/client";

// ─── Types ───────────────────────────────────────────────────────────────────

interface FormField {
  id: string;
  label: string;
  type: "text" | "email" | "phone" | "textarea" | "select" | "radio";
  placeholder?: string;
  required?: boolean;
  options?: string[];
}

interface IntakeForm {
  id: string;
  name: string;
  welcome_message: string;
  fields: FormField[];
  brand_color: string;
  ai_qualification: boolean;
  ai_system_prompt: string | null;
  is_active: boolean;
  created_at: string;
}

interface Submission {
  id: string;
  form_id: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  responses: Record<string, string>;
  ai_score: number | null;
  ai_summary: string | null;
  ai_questions: string[];
  status: "new" | "contacted" | "qualified" | "disqualified" | "converted";
  created_at: string;
}

// ─── Score badge ──────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-white/25 text-xs">—</span>;
  const color =
    score >= 80 ? "#22c55e" :
    score >= 50 ? "#f59e0b" :
    "#ef4444";
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}
    >
      <Sparkles size={10} />
      {score}
    </span>
  );
}

const STATUS_META = {
  new:          { label: "New",          color: "#6366F1", icon: <Clock size={10} /> },
  contacted:    { label: "Contacted",    color: "#f59e0b", icon: <Mail size={10} /> },
  qualified:    { label: "Qualified",    color: "#22c55e", icon: <CheckCircle2 size={10} /> },
  disqualified: { label: "Disqualified", color: "#ef4444", icon: <XCircle size={10} /> },
  converted:    { label: "Converted",    color: "#a78bfa", icon: <Star size={10} /> },
};

const FIELD_TYPES: { value: FormField["type"]; label: string; icon: React.ReactNode }[] = [
  { value: "text",     label: "Short text",  icon: <Hash size={14} /> },
  { value: "textarea", label: "Long text",   icon: <MessageSquare size={14} /> },
  { value: "email",    label: "Email",       icon: <Mail size={14} /> },
  { value: "phone",    label: "Phone",       icon: <Phone size={14} /> },
  { value: "select",   label: "Dropdown",    icon: <List size={14} /> },
  { value: "radio",    label: "Multiple choice", icon: <Star size={14} /> },
];

// ─── Main page ────────────────────────────────────────────────────────────────

export default function IntakePage() {
  const supabase = createClientSupabase();
  const [forms, setForms] = useState<IntakeForm[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"forms" | "submissions">("forms");
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingForm, setEditingForm] = useState<IntakeForm | null>(null);
  const [subDetail, setSubDetail] = useState<Submission | null>(null);
  const [saving, setSaving] = useState(false);

  // Builder state
  const [bName, setBName] = useState("New Intake Form");
  const [bWelcome, setBWelcome] = useState("Tell us about your business and goals.");
  const [bColor, setBColor] = useState("#6366F1");
  const [bAI, setBAI] = useState(true);
  const [bPrompt, setBPrompt] = useState("");
  const [bFields, setBFields] = useState<FormField[]>([]);

  const loadForms = useCallback(async () => {
    const { data } = await supabase
      .from("intake_forms")
      .select("*")
      .order("created_at", { ascending: false });
    setForms((data as IntakeForm[]) ?? []);
    setLoading(false);
  }, [supabase]);

  const loadSubmissions = useCallback(async (formId?: string) => {
    let q = supabase
      .from("intake_submissions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (formId) q = q.eq("form_id", formId);
    const { data } = await q;
    setSubmissions((data as Submission[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    loadForms();
  }, [loadForms]);

  useEffect(() => {
    if (activeTab === "submissions") {
      loadSubmissions(selectedFormId ?? undefined);
    }
  }, [activeTab, selectedFormId, loadSubmissions]);

  function openBuilder(form?: IntakeForm) {
    if (form) {
      setEditingForm(form);
      setBName(form.name);
      setBWelcome(form.welcome_message);
      setBColor(form.brand_color);
      setBAI(form.ai_qualification);
      setBPrompt(form.ai_system_prompt ?? "");
      setBFields(form.fields);
    } else {
      setEditingForm(null);
      setBName("New Intake Form");
      setBWelcome("Tell us about your business and goals.");
      setBColor("#6366F1");
      setBAI(true);
      setBPrompt("");
      setBFields([]);
    }
    setBuilderOpen(true);
  }

  async function saveForm() {
    setSaving(true);
    const payload = {
      name: bName,
      welcome_message: bWelcome,
      brand_color: bColor,
      ai_qualification: bAI,
      ai_system_prompt: bPrompt || null,
      fields: bFields,
    };

    if (editingForm) {
      const { error } = await supabase
        .from("intake_forms")
        .update(payload)
        .eq("id", editingForm.id);
      if (error) { toast.error("Save failed"); setSaving(false); return; }
      toast.success("Form updated");
    } else {
      const { error } = await supabase
        .from("intake_forms")
        .insert(payload);
      if (error) { toast.error("Save failed"); setSaving(false); return; }
      toast.success("Form created");
    }

    setSaving(false);
    setBuilderOpen(false);
    loadForms();
  }

  async function deleteForm(id: string) {
    if (!confirm("Delete this form and all its submissions?")) return;
    await supabase.from("intake_forms").delete().eq("id", id);
    toast.success("Form deleted");
    loadForms();
  }

  async function toggleActive(form: IntakeForm) {
    await supabase
      .from("intake_forms")
      .update({ is_active: !form.is_active })
      .eq("id", form.id);
    loadForms();
  }

  async function updateStatus(subId: string, status: Submission["status"]) {
    await supabase
      .from("intake_submissions")
      .update({ status })
      .eq("id", subId);
    setSubmissions((prev) =>
      prev.map((s) => (s.id === subId ? { ...s, status } : s))
    );
    if (subDetail?.id === subId) setSubDetail((p) => p ? { ...p, status } : p);
  }

  function addField(type: FormField["type"]) {
    const newField: FormField = {
      id: crypto.randomUUID(),
      label: FIELD_TYPES.find((f) => f.value === type)?.label ?? "Field",
      type,
      placeholder: "",
      required: false,
      options: ["select", "radio"].includes(type) ? ["Option 1", "Option 2"] : undefined,
    };
    setBFields((prev) => [...prev, newField]);
  }

  function updateField(id: string, patch: Partial<FormField>) {
    setBFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function removeField(id: string) {
    setBFields((prev) => prev.filter((f) => f.id !== id));
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.shortstack.work";

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full min-h-screen bg-[#070708]">
      <PageHero
        icon={<Zap size={18} className="text-[#6366F1]" />}
        title="Intake Forms"
        subtitle="AI-powered lead qualification forms you can embed anywhere"
        gradient="blue"
      />

      <div className="flex-1 p-4 md:p-6 max-w-6xl mx-auto w-full">
        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6">
          {(["forms", "submissions"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab
                  ? "bg-[rgba(99,102,241,0.15)] text-[#6366F1]"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              {tab === "forms" ? "Forms" : "Submissions"}
            </button>
          ))}
          <div className="ml-auto">
            {activeTab === "forms" && (
              <button
                onClick={() => openBuilder()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#6366F1] hover:bg-[#4F46E5] text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Plus size={14} />
                New Form
              </button>
            )}
            {activeTab === "submissions" && forms.length > 0 && (
              <select
                value={selectedFormId ?? ""}
                onChange={(e) => setSelectedFormId(e.target.value || null)}
                className="bg-white/[0.04] border border-white/[0.08] text-white/70 text-xs rounded-lg px-2 py-1.5 outline-none"
              >
                <option value="">All forms</option>
                {forms.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* ── Forms list ── */}
        {activeTab === "forms" && (
          <div>
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-white/20" />
              </div>
            ) : forms.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                <div className="w-14 h-14 rounded-2xl bg-[rgba(99,102,241,0.08)] border border-[rgba(99,102,241,0.12)] flex items-center justify-center">
                  <Zap size={22} className="text-[#6366F1]/60" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white/50 mb-1">No intake forms yet</p>
                  <p className="text-xs text-white/25 max-w-xs">
                    Create a form to embed on your website or send to prospects. Claude will auto-qualify every submission.
                  </p>
                </div>
                <button
                  onClick={() => openBuilder()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#6366F1] hover:bg-[#4F46E5] text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <Plus size={14} />
                  Create your first form
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {forms.map((form) => {
                  const embedUrl = `${appUrl}/intake/${form.id}`;
                  return (
                    <div
                      key={form.id}
                      className="bg-[#101012] border border-[rgba(99,102,241,0.08)] rounded-xl p-4 flex flex-col gap-3"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center"
                          style={{ background: `${form.brand_color}18`, border: `1px solid ${form.brand_color}30` }}
                        >
                          <ChevronRight size={14} style={{ color: form.brand_color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-white/90 truncate">{form.name}</h3>
                          <p className="text-[10px] text-white/30 mt-0.5">
                            {form.fields.length} fields · {form.ai_qualification ? "AI scoring on" : "No AI"}
                          </p>
                        </div>
                        <button
                          onClick={() => toggleActive(form)}
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full border transition-all ${
                            form.is_active
                              ? "text-green-400 border-green-400/30 bg-green-400/10"
                              : "text-white/30 border-white/10 bg-white/[0.03]"
                          }`}
                        >
                          {form.is_active ? "Live" : "Off"}
                        </button>
                      </div>

                      {/* Embed URL */}
                      <div className="bg-white/[0.03] border border-white/[0.05] rounded-lg px-2.5 py-2 flex items-center gap-2">
                        <span className="text-[10px] text-white/30 truncate flex-1 font-mono">{embedUrl}</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(embedUrl);
                            toast.success("Link copied");
                          }}
                          className="text-white/30 hover:text-white/60 transition-colors flex-shrink-0"
                          title="Copy link"
                        >
                          <Copy size={12} />
                        </button>
                        <a
                          href={embedUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-white/30 hover:text-white/60 transition-colors flex-shrink-0"
                          title="Preview form"
                        >
                          <ExternalLink size={12} />
                        </a>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openBuilder(form)}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-white/[0.04] hover:bg-white/[0.07] text-white/60 text-xs rounded-lg transition-colors"
                        >
                          <Settings size={11} />
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            setSelectedFormId(form.id);
                            setActiveTab("submissions");
                          }}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-white/[0.04] hover:bg-white/[0.07] text-white/60 text-xs rounded-lg transition-colors"
                        >
                          <BarChart3 size={11} />
                          Submissions
                        </button>
                        <button
                          onClick={() => {
                            const iframeCode = `<iframe src="${embedUrl}" width="100%" height="700" frameborder="0" style="border-radius:12px"></iframe>`;
                            navigator.clipboard.writeText(iframeCode);
                            toast.success("Embed code copied");
                          }}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-white/[0.04] hover:bg-white/[0.07] text-white/60 text-xs rounded-lg transition-colors"
                          title="Copy iframe embed code"
                        >
                          <Eye size={11} />
                          Embed
                        </button>
                        <button
                          onClick={() => deleteForm(form.id)}
                          className="ml-auto flex items-center gap-1 px-2.5 py-1.5 hover:bg-red-500/10 text-white/30 hover:text-red-400 text-xs rounded-lg transition-colors"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Submissions ── */}
        {activeTab === "submissions" && (
          <div>
            {submissions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
                <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                  <Users size={18} className="text-white/20" />
                </div>
                <p className="text-sm text-white/40">No submissions yet</p>
                <p className="text-xs text-white/20 max-w-xs">
                  Share your form link to start receiving qualified leads.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {submissions.map((sub) => {
                  const meta = STATUS_META[sub.status];
                  return (
                    <button
                      key={sub.id}
                      onClick={() => setSubDetail(sub)}
                      className="w-full text-left bg-[#101012] border border-[rgba(99,102,241,0.08)] hover:border-[rgba(99,102,241,0.18)] rounded-xl p-3.5 flex items-center gap-3 transition-all"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-white/80 truncate">
                            {sub.contact_name ?? "Anonymous"}
                          </span>
                          {sub.contact_email && (
                            <span className="text-[10px] text-white/30">{sub.contact_email}</span>
                          )}
                        </div>
                        <p className="text-[10px] text-white/30 mt-0.5">
                          {new Date(sub.created_at).toLocaleDateString()}
                          {sub.ai_summary && ` · ${sub.ai_summary.slice(0, 80)}…`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <ScoreBadge score={sub.ai_score} />
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                          style={{ background: `${meta.color}15`, color: meta.color, border: `1px solid ${meta.color}25` }}
                        >
                          {meta.icon}
                          {meta.label}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Form Builder Modal ── */}
      <Modal isOpen={builderOpen} onClose={() => setBuilderOpen(false)} title={editingForm ? "Edit Form" : "New Intake Form"} size="lg">
        <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
          {/* Basic settings */}
          <div className="space-y-3">
            <p className="text-[11px] font-medium text-white/30 uppercase tracking-widest">Settings</p>

            <div className="space-y-1.5">
              <label className="text-xs text-white/50">Form name</label>
              <input
                value={bName}
                onChange={(e) => setBName(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/90 outline-none focus:border-[#6366F1]/50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-white/50">Welcome message</label>
              <textarea
                value={bWelcome}
                onChange={(e) => setBWelcome(e.target.value)}
                rows={2}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/90 outline-none focus:border-[#6366F1]/50 resize-none"
              />
            </div>

            <div className="flex items-center gap-4">
              <div className="space-y-1.5 flex-1">
                <label className="text-xs text-white/50">Brand color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={bColor}
                    onChange={(e) => setBColor(e.target.value)}
                    className="w-9 h-9 rounded-lg border border-white/[0.08] bg-transparent cursor-pointer"
                  />
                  <input
                    value={bColor}
                    onChange={(e) => setBColor(e.target.value)}
                    className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/90 outline-none font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-white/50">AI scoring</label>
                <button
                  onClick={() => setBAI((p) => !p)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${bAI ? "bg-[#6366F1]" : "bg-white/10"}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${bAI ? "left-6" : "left-1"}`} />
                </button>
              </div>
            </div>

            {bAI && (
              <div className="space-y-1.5">
                <label className="text-xs text-white/50">Custom AI prompt (optional — leave blank to use default)</label>
                <textarea
                  value={bPrompt}
                  onChange={(e) => setBPrompt(e.target.value)}
                  rows={3}
                  placeholder="You are an expert lead qualifier for [your business]…"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white/70 placeholder:text-white/20 outline-none focus:border-[#6366F1]/50 resize-none font-mono"
                />
              </div>
            )}
          </div>

          {/* Fields */}
          <div className="space-y-3">
            <p className="text-[11px] font-medium text-white/30 uppercase tracking-widest">Fields</p>
            <p className="text-[10px] text-white/30">Name, email, and phone are always collected. Add custom questions below.</p>

            {bFields.map((field) => (
              <FieldEditor
                key={field.id}
                field={field}
                onChange={(patch) => updateField(field.id, patch)}
                onRemove={() => removeField(field.id)}
              />
            ))}

            {/* Add field buttons */}
            <div className="flex flex-wrap gap-2">
              {FIELD_TYPES.map((ft) => (
                <button
                  key={ft.value}
                  onClick={() => addField(ft.value)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/[0.04] hover:bg-white/[0.07] text-white/50 text-xs rounded-lg transition-colors border border-white/[0.05]"
                >
                  {ft.icon}
                  {ft.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/[0.06] mt-4">
          <button
            onClick={() => setBuilderOpen(false)}
            className="px-4 py-2 text-sm text-white/50 hover:text-white/70 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={saveForm}
            disabled={saving || !bName.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-[#6366F1] hover:bg-[#4F46E5] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {editingForm ? "Save changes" : "Create form"}
          </button>
        </div>
      </Modal>

      {/* ── Submission detail modal ── */}
      {subDetail && (
        <Modal isOpen onClose={() => setSubDetail(null)} title="Submission detail" size="md">
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            <div className="flex items-center gap-3">
              <div>
                <p className="text-sm font-semibold text-white/90">{subDetail.contact_name ?? "Anonymous"}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {subDetail.contact_email && <span className="text-[10px] text-white/40">{subDetail.contact_email}</span>}
                  {subDetail.contact_phone && <span className="text-[10px] text-white/40">{subDetail.contact_phone}</span>}
                </div>
              </div>
              <div className="ml-auto">
                <ScoreBadge score={subDetail.ai_score} />
              </div>
            </div>

            {subDetail.ai_summary && (
              <div className="bg-[rgba(99,102,241,0.06)] border border-[rgba(99,102,241,0.12)] rounded-xl p-3">
                <p className="text-[10px] font-medium text-[#6366F1] mb-1.5 flex items-center gap-1">
                  <Sparkles size={10} /> AI Summary
                </p>
                <p className="text-xs text-white/70 leading-relaxed">{subDetail.ai_summary}</p>
              </div>
            )}

            {subDetail.ai_questions.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-medium text-white/30 uppercase tracking-widest">Follow-up questions</p>
                {subDetail.ai_questions.map((q, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-[10px] font-bold text-[#6366F1]/60 mt-0.5">{i + 1}.</span>
                    <p className="text-xs text-white/60 leading-relaxed">{q}</p>
                  </div>
                ))}
              </div>
            )}

            {Object.keys(subDetail.responses).length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-medium text-white/30 uppercase tracking-widest">Responses</p>
                {Object.entries(subDetail.responses).map(([k, v]) => (
                  <div key={k} className="bg-white/[0.03] rounded-lg p-2.5">
                    <p className="text-[10px] text-white/30 mb-0.5">{k}</p>
                    <p className="text-xs text-white/70">{String(v)}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Status */}
            <div className="space-y-2">
              <p className="text-[10px] font-medium text-white/30 uppercase tracking-widest">Status</p>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(STATUS_META) as Submission["status"][]).map((s) => {
                  const meta = STATUS_META[s];
                  return (
                    <button
                      key={s}
                      onClick={() => updateStatus(subDetail.id, s)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium transition-all"
                      style={{
                        background: subDetail.status === s ? `${meta.color}20` : "rgba(255,255,255,0.03)",
                        color: subDetail.status === s ? meta.color : "rgba(255,255,255,0.4)",
                        border: `1px solid ${subDetail.status === s ? `${meta.color}40` : "rgba(255,255,255,0.07)"}`,
                      }}
                    >
                      {meta.icon}
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Field editor ─────────────────────────────────────────────────────────────

function FieldEditor({
  field,
  onChange,
  onRemove,
}: {
  field: FormField;
  onChange: (p: Partial<FormField>) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className="text-[10px] font-medium text-white/30 uppercase">
          {FIELD_TYPES.find((f) => f.value === field.type)?.label ?? field.type}
        </span>
        <input
          value={field.label}
          onChange={(e) => onChange({ label: e.target.value })}
          className="flex-1 bg-transparent text-sm text-white/80 outline-none placeholder:text-white/20"
          placeholder="Field label"
        />
        <button
          onClick={() => setExpanded((p) => !p)}
          className="text-white/30 hover:text-white/60 transition-colors"
        >
          <ChevronDown size={14} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
        <button onClick={onRemove} className="text-white/20 hover:text-red-400 transition-colors">
          <X size={14} />
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-3 space-y-2.5 border-t border-white/[0.05] pt-2.5">
          <div className="space-y-1">
            <label className="text-[10px] text-white/30">Placeholder</label>
            <input
              value={field.placeholder ?? ""}
              onChange={(e) => onChange({ placeholder: e.target.value })}
              className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-xs text-white/70 outline-none"
            />
          </div>

          {(field.type === "select" || field.type === "radio") && (
            <div className="space-y-1">
              <label className="text-[10px] text-white/30">Options (one per line)</label>
              <textarea
                value={(field.options ?? []).join("\n")}
                onChange={(e) => onChange({ options: e.target.value.split("\n").filter(Boolean) })}
                rows={3}
                className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-xs text-white/70 outline-none resize-none"
              />
            </div>
          )}

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={field.required ?? false}
              onChange={(e) => onChange({ required: e.target.checked })}
              className="w-3.5 h-3.5 accent-[#6366F1]"
            />
            <span className="text-xs text-white/50">Required</span>
          </label>
        </div>
      )}
    </div>
  );
}
