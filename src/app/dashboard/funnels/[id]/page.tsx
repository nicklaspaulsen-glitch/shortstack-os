"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PageHero from "@/components/ui/page-hero";
import toast from "react-hot-toast";
import {
  GitBranch, Plus, Save, Globe, ArrowLeft, ChevronLeft, ChevronRight,
  Trash2, Eye, BarChart3, Settings, X, Link2,
  CheckCircle2, Clock, Archive, Pencil, ArrowRight,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════ TYPES */

type StepType = "opt-in" | "thank-you" | "vsl" | "checkout" | "upsell" | "downsell" | "webinar";

interface FunnelStep {
  id: string;
  funnel_id: string;
  title: string;
  step_type: StepType;
  page_id: string | null;
  sort_order: number;
  settings: {
    button_text?: string;
    redirect_url?: string;
    [key: string]: unknown;
  };
}

interface Funnel {
  id: string;
  name: string;
  description: string | null;
  status: "draft" | "published" | "archived";
  created_at: string;
  updated_at: string;
  funnel_steps: FunnelStep[];
}

interface WebsiteProject {
  id: string;
  name: string;
}

/* ═══════════════════════════════════════════════════════════ CONSTANTS */

const STEP_TYPES: { value: StepType; label: string }[] = [
  { value: "opt-in", label: "Opt-In" },
  { value: "vsl", label: "Video Sales Letter" },
  { value: "checkout", label: "Checkout" },
  { value: "upsell", label: "Upsell" },
  { value: "downsell", label: "Downsell" },
  { value: "webinar", label: "Webinar" },
  { value: "thank-you", label: "Thank You" },
];

const STEP_TYPE_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  "opt-in":   { bg: "bg-blue-500/10",    border: "border-blue-500/30",    text: "text-blue-400",    dot: "bg-blue-400" },
  "thank-you":{ bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400", dot: "bg-emerald-400" },
  vsl:        { bg: "bg-purple-500/10",  border: "border-purple-500/30",  text: "text-purple-400",  dot: "bg-purple-400" },
  checkout:   { bg: "bg-amber-500/10",   border: "border-amber-500/30",   text: "text-amber-400",   dot: "bg-amber-400" },
  upsell:     { bg: "bg-pink-500/10",    border: "border-pink-500/30",    text: "text-pink-400",    dot: "bg-pink-400" },
  downsell:   { bg: "bg-orange-500/10",  border: "border-orange-500/30",  text: "text-orange-400",  dot: "bg-orange-400" },
  webinar:    { bg: "bg-cyan-500/10",    border: "border-cyan-500/30",    text: "text-cyan-400",    dot: "bg-cyan-400" },
};

function getStepColor(type: string) {
  return STEP_TYPE_COLORS[type] ?? {
    bg: "bg-zinc-500/10", border: "border-zinc-500/30", text: "text-zinc-400", dot: "bg-zinc-400",
  };
}

/* ═══════════════════════════════════════════════════════════ COMPONENT */

export default function FunnelCanvasPage() {
  const rawParams = useParams();
  const id = rawParams?.id as string;
  const router = useRouter();
  const supabase = createClient();

  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [steps, setSteps] = useState<FunnelStep[]>([]);
  const [pages, setPages] = useState<WebsiteProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"builder" | "analytics">("builder");
  const [selectedStep, setSelectedStep] = useState<FunnelStep | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Panel form state
  const [panelTitle, setPanelTitle] = useState("");
  const [panelType, setPanelType] = useState<StepType>("opt-in");
  const [panelPageId, setPanelPageId] = useState<string>("");
  const [panelButtonText, setPanelButtonText] = useState("");
  const [panelRedirectUrl, setPanelRedirectUrl] = useState("");

  // Add step form
  const [addingStep, setAddingStep] = useState(false);
  const [newStepTitle, setNewStepTitle] = useState("");
  const [newStepType, setNewStepType] = useState<StepType>("opt-in");

  // Analytics
  const [analytics, setAnalytics] = useState<{
    total_views: number;
    total_submits: number;
    overall_conversion_rate: number;
    unique_visitors: number;
    steps: Array<{
      step_id: string;
      views: number;
      submits: number;
      conversion_rate: number;
      dropoff_pct: number;
    }>;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/funnels/${id}`);
      if (!res.ok) throw new Error("Not found");
      const json = await res.json();
      setFunnel(json.funnel);
      setSteps(json.funnel.funnel_steps ?? []);
    } catch {
      toast.error("Failed to load funnel");
      router.push("/dashboard/funnels");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  const loadPages = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("website_projects")
      .select("id, name")
      .eq("profile_id", user.id)
      .order("name");
    setPages(data ?? []);
  }, [supabase]);

  const loadAnalytics = useCallback(async () => {
    try {
      const res = await fetch(`/api/funnels/${id}/analytics`);
      const json = await res.json();
      setAnalytics(json);
    } catch {
      // Analytics might have no data yet
    }
  }, [id]);

  useEffect(() => {
    void load();
    void loadPages();
    void loadAnalytics();
  }, [load, loadPages, loadAnalytics]);

  function openPanel(step: FunnelStep) {
    setSelectedStep(step);
    setPanelTitle(step.title);
    setPanelType(step.step_type);
    setPanelPageId(step.page_id ?? "");
    setPanelButtonText((step.settings.button_text as string) ?? "");
    setPanelRedirectUrl((step.settings.redirect_url as string) ?? "");
    setPanelOpen(true);
  }

  async function savePanel() {
    if (!selectedStep) return;
    setSaving(true);
    try {
      await fetch(`/api/funnels/steps/${selectedStep.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: panelTitle,
          step_type: panelType,
          page_id: panelPageId || null,
          settings: {
            button_text: panelButtonText,
            redirect_url: panelRedirectUrl,
          },
        }),
      });
      toast.success("Step saved");
      void load();
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function deleteStep(stepId: string) {
    if (!confirm("Delete this step?")) return;
    await fetch(`/api/funnels/steps/${stepId}`, { method: "DELETE" });
    toast.success("Step deleted");
    setPanelOpen(false);
    void load();
  }

  async function moveStep(stepId: string, direction: "left" | "right") {
    await fetch(`/api/funnels/steps/${stepId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ direction }),
    });
    void load();
  }

  async function addStep() {
    if (!newStepTitle.trim()) { toast.error("Enter a step title"); return; }
    await fetch(`/api/funnels/${id}/steps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newStepTitle.trim(), step_type: newStepType }),
    });
    toast.success("Step added");
    setNewStepTitle("");
    setAddingStep(false);
    void load();
  }

  async function togglePublish() {
    if (!funnel) return;
    setPublishing(true);
    try {
      const newStatus = funnel.status === "published" ? "draft" : "published";
      await fetch(`/api/funnels/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      toast.success(newStatus === "published" ? "Funnel published!" : "Funnel unpublished");
      void load();
    } finally {
      setPublishing(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="h-32 rounded-2xl bg-white/4 animate-pulse" />
        <div className="flex gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-36 w-48 rounded-xl bg-white/4 animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!funnel) return null;

  const statusConfig = {
    draft: { icon: <Clock size={13} />, label: "Draft", color: "text-amber-400 bg-amber-400/10 border-amber-400/20" },
    published: { icon: <CheckCircle2 size={13} />, label: "Published", color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" },
    archived: { icon: <Archive size={13} />, label: "Archived", color: "text-zinc-500 bg-zinc-500/10 border-zinc-500/20" },
  }[funnel.status];

  const analyticsMap = new Map(
    (analytics?.steps ?? []).map((s) => [s.step_id, s])
  );

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      <PageHero
        title={funnel.name}
        subtitle={funnel.description ?? "Funnel canvas — click a step to edit, arrow buttons to reorder."}
        icon={<GitBranch size={22} />}
        gradient="purple"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/dashboard/funnels")}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 text-zinc-400 hover:text-white text-sm transition-colors"
            >
              <ArrowLeft size={14} />
              Back
            </button>

            <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusConfig.color}`}>
              {statusConfig.icon}
              {statusConfig.label}
            </span>

            <button
              onClick={togglePublish}
              disabled={publishing || steps.length === 0}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 ${funnel.status === "published" ? "bg-zinc-700 hover:bg-zinc-600 text-white" : "bg-emerald-600 hover:bg-emerald-500 text-white"}`}
            >
              <Globe size={14} />
              {publishing ? "…" : funnel.status === "published" ? "Unpublish" : "Publish"}
            </button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-zinc-900/60 border border-white/8 rounded-lg p-1 w-fit">
        {(["builder", "analytics"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); if (tab === "analytics") void loadAnalytics(); }}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === tab ? "bg-white/10 text-white" : "text-zinc-400 hover:text-zinc-200"}`}
          >
            {tab === "builder" ? <Settings size={14} /> : <BarChart3 size={14} />}
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Publish URL banner */}
      {funnel.status === "published" && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/25">
          <Globe size={15} className="text-emerald-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-emerald-300 text-sm font-medium">Funnel is live — </span>
            <span className="text-zinc-400 text-sm font-mono break-all">
              {typeof window !== "undefined" ? window.location.origin : ""}/f/{funnel.id}/1
            </span>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/f/${funnel.id}/1`);
              toast.success("Link copied!");
            }}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-medium shrink-0"
          >
            Copy
          </button>
        </div>
      )}

      {/* ── BUILDER TAB ── */}
      {activeTab === "builder" && (
        <div className="space-y-4">
          {/* Canvas — horizontal step chain */}
          <div className="bg-zinc-900/40 border border-white/8 rounded-xl p-6 overflow-x-auto">
            <div className="flex items-start gap-0 min-w-max">
              {steps.map((step, idx) => {
                const sc = getStepColor(step.step_type);
                const stepAnalytics = analyticsMap.get(step.id);
                const linkedPage = pages.find((p) => p.id === step.page_id);

                return (
                  <div key={step.id} className="flex items-center">
                    {/* Step card */}
                    <div
                      className={`relative w-44 rounded-xl border p-4 cursor-pointer transition-all hover:scale-[1.02] ${sc.bg} ${sc.border} ${selectedStep?.id === step.id ? "ring-2 ring-purple-500/50" : ""}`}
                      onClick={() => openPanel(step)}
                    >
                      {/* Step number */}
                      <div className="absolute -top-3 -left-1 w-5 h-5 rounded-full bg-zinc-800 border border-white/15 flex items-center justify-center text-[10px] text-zinc-400 font-bold">
                        {idx + 1}
                      </div>

                      {/* Type chip */}
                      <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider mb-2 ${sc.text} bg-white/5`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                        {STEP_TYPES.find((t) => t.value === step.step_type)?.label ?? step.step_type}
                      </div>

                      {/* Title */}
                      <div className="text-white text-sm font-semibold leading-tight mb-2">{step.title}</div>

                      {/* Linked page */}
                      {linkedPage && (
                        <div className="flex items-center gap-1 text-zinc-500 text-[10px] mb-2">
                          <Link2 size={9} />
                          <span className="truncate">{linkedPage.name}</span>
                        </div>
                      )}

                      {/* Analytics mini */}
                      {stepAnalytics && (
                        <div className="grid grid-cols-2 gap-1 mt-2">
                          <div className="bg-black/20 rounded p-1 text-center">
                            <div className="text-white text-xs font-bold">{stepAnalytics.views}</div>
                            <div className="text-zinc-600 text-[9px]">views</div>
                          </div>
                          <div className="bg-black/20 rounded p-1 text-center">
                            <div className={`text-xs font-bold ${stepAnalytics.conversion_rate >= 20 ? "text-emerald-400" : "text-zinc-400"}`}>
                              {stepAnalytics.conversion_rate}%
                            </div>
                            <div className="text-zinc-600 text-[9px]">conv.</div>
                          </div>
                        </div>
                      )}

                      {/* Reorder buttons */}
                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/5">
                        <button
                          onClick={(e) => { e.stopPropagation(); void moveStep(step.id, "left"); }}
                          disabled={idx === 0}
                          className="p-1 rounded hover:bg-white/10 text-zinc-500 hover:text-zinc-200 disabled:opacity-20 transition-colors"
                        >
                          <ChevronLeft size={12} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); void deleteStep(step.id); }}
                          className="p-1 rounded hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); void moveStep(step.id, "right"); }}
                          disabled={idx === steps.length - 1}
                          className="p-1 rounded hover:bg-white/10 text-zinc-500 hover:text-zinc-200 disabled:opacity-20 transition-colors"
                        >
                          <ChevronRight size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Arrow connector */}
                    {idx < steps.length - 1 && (
                      <div className="flex items-center px-1">
                        <ArrowRight size={18} className="text-zinc-700" />
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add Step button */}
              {steps.length > 0 && <div className="flex items-center px-1"><ArrowRight size={18} className="text-zinc-800" /></div>}
              <div className="flex items-center">
                {!addingStep ? (
                  <button
                    onClick={() => setAddingStep(true)}
                    className="w-44 h-full min-h-[120px] rounded-xl border-2 border-dashed border-white/10 hover:border-purple-500/40 flex flex-col items-center justify-center gap-2 text-zinc-600 hover:text-purple-400 transition-all"
                  >
                    <Plus size={20} />
                    <span className="text-sm font-medium">Add Step</span>
                  </button>
                ) : (
                  <div className="w-52 bg-zinc-900 border border-white/15 rounded-xl p-4 space-y-3">
                    <input
                      autoFocus
                      value={newStepTitle}
                      onChange={(e) => setNewStepTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") void addStep(); if (e.key === "Escape") setAddingStep(false); }}
                      placeholder="Step title"
                      className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-white/10 text-white text-sm placeholder-zinc-600 outline-none"
                    />
                    <select
                      value={newStepType}
                      onChange={(e) => setNewStepType(e.target.value as StepType)}
                      className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-white/10 text-white text-sm outline-none"
                    >
                      {STEP_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <button onClick={() => void addStep()} className="flex-1 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-colors">
                        Add
                      </button>
                      <button onClick={() => setAddingStep(false)} className="px-3 py-1.5 rounded-lg border border-white/10 text-zinc-400 text-xs transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {steps.length === 0 && (
            <div className="text-center py-12 text-zinc-500 text-sm">
              No steps yet — click &quot;Add Step&quot; to build your funnel.
            </div>
          )}
        </div>
      )}

      {/* ── ANALYTICS TAB ── */}
      {activeTab === "analytics" && (
        <div className="space-y-5">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Total Views", value: analytics?.total_views ?? 0, color: "text-blue-400" },
              { label: "Unique Visitors", value: analytics?.unique_visitors ?? 0, color: "text-purple-400" },
              { label: "Total Submits", value: analytics?.total_submits ?? 0, color: "text-amber-400" },
              { label: "Overall Conv.", value: `${analytics?.overall_conversion_rate ?? 0}%`, color: "text-emerald-400" },
            ].map((stat) => (
              <div key={stat.label} className="bg-zinc-900/60 border border-white/8 rounded-xl p-4">
                <div className={`text-2xl font-bold ${stat.color}`}>{stat.value.toLocaleString()}</div>
                <div className="text-zinc-500 text-xs mt-1">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Step-by-step funnel visualization */}
          <div className="bg-zinc-900/60 border border-white/8 rounded-xl p-6 space-y-4">
            <h3 className="text-white font-semibold text-base">Step-by-Step Funnel</h3>
            {steps.length === 0 ? (
              <p className="text-zinc-500 text-sm">Add steps to see analytics.</p>
            ) : (
              <div className="space-y-3">
                {steps.map((step, idx) => {
                  const sa = analyticsMap.get(step.id);
                  const views = sa?.views ?? 0;
                  const maxViews = Math.max(...steps.map((s) => analyticsMap.get(s.id)?.views ?? 0), 1);
                  const barWidth = Math.round((views / maxViews) * 100);
                  const sc = getStepColor(step.step_type);

                  return (
                    <div key={step.id}>
                      <div className="flex items-center gap-3">
                        <div className="shrink-0 w-6 h-6 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center text-[10px] text-zinc-400 font-bold">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-white text-sm font-medium truncate">{step.title}</span>
                            <div className="flex items-center gap-3 text-xs shrink-0 ml-2">
                              <span className="text-zinc-400">{views.toLocaleString()} views</span>
                              <span className={sa?.conversion_rate && sa.conversion_rate >= 20 ? "text-emerald-400 font-semibold" : "text-zinc-500"}>
                                {sa?.conversion_rate ?? 0}% conv.
                              </span>
                              {idx > 0 && sa?.dropoff_pct !== undefined && (
                                <span className="text-red-400">-{sa.dropoff_pct}% drop</span>
                              )}
                            </div>
                          </div>
                          <div className="h-2 rounded-full bg-white/5">
                            <div
                              className={`h-2 rounded-full transition-all ${sc.dot}`}
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      {idx < steps.length - 1 && (
                        <div className="ml-9 border-l border-dashed border-white/8 h-3" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── RIGHT PANEL — Step Editor ── */}
      {panelOpen && selectedStep && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => setPanelOpen(false)}
          />
          {/* Drawer */}
          <div className="fixed right-0 top-0 bottom-0 z-50 w-80 bg-zinc-950 border-l border-white/10 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
              <div className="flex items-center gap-2">
                <Pencil size={15} className="text-purple-400" />
                <span className="text-white font-semibold text-sm">Edit Step</span>
              </div>
              <button onClick={() => setPanelOpen(false)} className="text-zinc-500 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div>
                <label className="block text-xs text-zinc-400 font-medium mb-1.5">Step Title</label>
                <input
                  value={panelTitle}
                  onChange={(e) => setPanelTitle(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-white/10 text-white text-sm outline-none focus:border-purple-500/50"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 font-medium mb-1.5">Step Type</label>
                <select
                  value={panelType}
                  onChange={(e) => setPanelType(e.target.value as StepType)}
                  className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-white/10 text-white text-sm outline-none focus:border-purple-500/50"
                >
                  {STEP_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 font-medium mb-1.5">
                  <span className="flex items-center gap-1"><Link2 size={11} /> Linked Landing Page</span>
                </label>
                <select
                  value={panelPageId}
                  onChange={(e) => setPanelPageId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-white/10 text-white text-sm outline-none focus:border-purple-500/50"
                >
                  <option value="">— None —</option>
                  {pages.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {pages.length === 0 && (
                  <p className="text-zinc-600 text-xs mt-1">No landing pages yet — create one first.</p>
                )}
              </div>

              <div>
                <label className="block text-xs text-zinc-400 font-medium mb-1.5">Button Text</label>
                <input
                  value={panelButtonText}
                  onChange={(e) => setPanelButtonText(e.target.value)}
                  placeholder="e.g. Yes, I Want Access!"
                  className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-white/10 text-white text-sm placeholder-zinc-600 outline-none focus:border-purple-500/50"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 font-medium mb-1.5">Redirect URL (override)</label>
                <input
                  value={panelRedirectUrl}
                  onChange={(e) => setPanelRedirectUrl(e.target.value)}
                  placeholder="https://…"
                  className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-white/10 text-white text-sm placeholder-zinc-600 outline-none focus:border-purple-500/50"
                />
              </div>

              {/* Analytics for this step */}
              {analyticsMap.get(selectedStep.id) && (
                <div className="bg-zinc-900/60 border border-white/8 rounded-lg p-3 space-y-2">
                  <div className="text-zinc-400 text-xs font-semibold uppercase tracking-widest">Step Stats</div>
                  {(() => {
                    const sa = analyticsMap.get(selectedStep.id)!;
                    return (
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: "Views", value: sa.views },
                          { label: "Submits", value: sa.submits },
                          { label: "Conv. Rate", value: `${sa.conversion_rate}%` },
                          { label: "Drop-off", value: `${sa.dropoff_pct}%` },
                        ].map((s) => (
                          <div key={s.label} className="bg-black/20 rounded p-2">
                            <div className="text-white text-sm font-bold">{s.value}</div>
                            <div className="text-zinc-600 text-[10px]">{s.label}</div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            <div className="p-5 border-t border-white/8 flex gap-2">
              <button
                onClick={savePanel}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold text-sm transition-colors"
              >
                <Save size={14} />
                {saving ? "Saving…" : "Save Step"}
              </button>
              <button
                onClick={() => void deleteStep(selectedStep.id)}
                className="px-3 py-2.5 rounded-lg border border-red-500/20 hover:bg-red-500/10 text-red-400 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
