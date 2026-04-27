"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { Client } from "@/lib/types";
import Modal from "@/components/ui/modal";
import StatusBadge from "@/components/ui/status-badge";
import PageHero from "@/components/ui/page-hero";
import { CardSkeleton } from "@/components/ui/skeleton";
import { formatRelativeTime } from "@/lib/utils";
import {
  Zap, Plus, Sparkles, Play, Trash2, Bot,
  MessageCircle, Mail, Clock, GitBranch, Phone,
  Tag, FileText, Send, Webhook, Loader,
  RotateCcw, Eye, Search, BookOpen, ChevronRight,
  Users, UserPlus, Globe, CreditCard, Star,
  Target, BarChart, Calendar, Bell, ShoppingCart,
  Briefcase, Database, BarChart3, Building
} from "lucide-react";
import { WORKFLOW_PRESETS, WORKFLOW_CATEGORIES, type WorkflowPreset } from "@/lib/workflow-presets";
import toast from "react-hot-toast";
import { TelegramIcon, SlackIcon } from "@/components/ui/platform-icons";
import AiWorkflowHero from "@/components/workflows/ai-workflow-hero";

interface WorkflowStep {
  id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
}

interface Workflow {
  name: string;
  description: string;
  trigger: string;
  steps: WorkflowStep[];
}

const NODE_TYPES: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  send_telegram: { icon: <TelegramIcon size={14} />, color: "text-blue-400", bg: "border-blue-400/20 bg-blue-400/5" },
  send_slack_message: { icon: <SlackIcon size={14} />, color: "text-purple-400", bg: "border-purple-400/20 bg-purple-400/5" },
  send_email: { icon: <Mail size={14} />, color: "text-cyan-400", bg: "border-cyan-400/20 bg-cyan-400/5" },
  send_sms: { icon: <Phone size={14} />, color: "text-green-400", bg: "border-green-400/20 bg-green-400/5" },
  create_task: { icon: <FileText size={14} />, color: "text-gold", bg: "border-gold/20 bg-gold/5" },
  update_lead_status: { icon: <Tag size={14} />, color: "text-orange-400", bg: "border-orange-400/20 bg-orange-400/5" },
  generate_content: { icon: <Sparkles size={14} />, color: "text-pink-400", bg: "border-pink-400/20 bg-pink-400/5" },
  create_invoice: { icon: <FileText size={14} />, color: "text-emerald-400", bg: "border-emerald-400/20 bg-emerald-400/5" },
  webhook: { icon: <Webhook size={14} />, color: "text-yellow-400", bg: "border-yellow-400/20 bg-yellow-400/5" },
  delay: { icon: <Clock size={14} />, color: "text-muted", bg: "border-border bg-surface-light/50" },
  ghl_add_tag: { icon: <Tag size={14} />, color: "text-teal-400", bg: "border-teal-400/20 bg-teal-400/5" },
  condition: { icon: <GitBranch size={14} />, color: "text-amber-400", bg: "border-amber-400/20 bg-amber-400/5" },
};

export default function WorkflowsPage() {
  const { profile } = useAuth();
  const isPlatformAdmin = profile?.role === "admin" || profile?.role === "founder";
  const [workflows, setWorkflows] = useState<Array<{ id: string; workflow: Workflow; client_name?: string; created_at: string; status: string }>>([]);
  const [workflowsLoading, setWorkflowsLoading] = useState(true);
  const [clients, setClients] = useState<Pick<Client, "id" | "business_name">[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showAiGen, setShowAiGen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  const [generating, setGenerating] = useState(false);
  const [previewWorkflow, setPreviewWorkflow] = useState<Workflow | null>(null);
  const [agentChat, setAgentChat] = useState<Array<{ role: "user" | "agent"; content: string; workflow?: Workflow }>>([]);
  const [agentInput, setAgentInput] = useState("");
  const [agentThinking, setAgentThinking] = useState(false);
  const [tab, setTab] = useState<"builder" | "presets" | "history" | "agent" | "n8n" | "analytics" | "triggers" | "sharing">("builder");
  const [presetSearch, setPresetSearch] = useState("");
  const [presetCategory, setPresetCategory] = useState("all");
  const [presetDifficulty, setPresetDifficulty] = useState<"all" | "easy" | "medium" | "advanced">("all");
  const [n8nWorkflows, setN8nWorkflows] = useState<Array<{ id: string; name: string; active: boolean; nodes: number; createdAt: string; updatedAt: string; tags: Array<{ name: string }> }>>([]);
  const [n8nLoading, setN8nLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // Test mode
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [testMode, setTestMode] = useState(false);

  // Analytics data
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [workflowAnalytics] = useState({
    totalRuns: 0,
    successRate: 0,
    avgDuration: "--",
    activeWorkflows: workflows.filter(w => w.status === "completed").length,
    failedRuns: 0,
    topWorkflow: "--",
    runsThisWeek: 0,
    savedHours: 0,
  });

  // Run history detail
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [runHistory] = useState<{ id: string; workflow: string; status: "success" | "failed"; duration: string; steps: number; timestamp: string; error?: string }[]>([]);

  // Error handling
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [errorNotifications, setErrorNotifications] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [retryOnFailure, setRetryOnFailure] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [maxRetries] = useState(3);

  // Shared workflows
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [sharedWorkflows] = useState<{ id: string; name: string; author: string; downloads: number; rating: number }[]>([]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); }, []);
  // n8n workflows live on a non-default tab — lazy-fetch the first time
  // the user clicks into the n8n tab so it doesn't block the default
  // Builder tab's paint.
  const [n8nFetched, setN8nFetched] = useState(false);
  useEffect(() => {
    if (tab === "n8n" && !n8nFetched) {
      setN8nFetched(true);
      fetchN8n();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, n8nFetched]);

  async function fetchN8n() {
    setN8nLoading(true);
    try {
      const res = await fetch("/api/n8n/workflows");
      const data = await res.json();
      setN8nWorkflows(data.workflows || []);
    } catch (err) {
      console.error("[workflows] fetchN8n failed:", err);
      toast.error("Couldn't load n8n workflows");
    }
    setN8nLoading(false);
  }

  async function toggleN8nWorkflow(id: string, active: boolean) {
    try {
      const res = await fetch(`/api/n8n/workflows/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !active }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Workflow ${!active ? "activated" : "deactivated"}`);
        fetchN8n();
      } else {
        toast.error(data.error || "Failed to update workflow");
      }
    } catch (err) {
      console.error("[workflows] toggleN8nWorkflow failed:", err);
      toast.error("Failed to update");
    }
  }

  async function deleteN8nWorkflow(id: string) {
    if (!confirm("Delete this n8n workflow?")) return;
    try {
      const res = await fetch(`/api/n8n/workflows/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Workflow deleted");
      fetchN8n();
    } catch (err) {
      console.error("[workflows] deleteN8nWorkflow failed:", err);
      toast.error("Failed to delete");
    }
  }
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [agentChat]);

  async function fetchData() {
    setWorkflowsLoading(true);
    try {
      const [{ data: logs }, { data: cl }] = await Promise.all([
        supabase.from("trinity_log").select("*").eq("action_type", "automation").order("created_at", { ascending: false }).limit(50),
        supabase.from("clients").select("id, business_name").eq("is_active", true),
      ]);
      setWorkflows((logs || []).map((l: Record<string, unknown>) => ({
        id: l.id as string,
        workflow: l.result as Workflow,
        client_name: l.description as string,
        created_at: l.created_at as string,
        status: l.status as string,
      })));
      setClients(cl || []);
    } finally {
      setWorkflowsLoading(false);
    }
  }

  async function generateWorkflow() {
    if (!prompt.trim()) return;
    setGenerating(true);
    try {
      const clientName = clients.find(c => c.id === selectedClient)?.business_name;
      const res = await fetch("/api/workflows/design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, client_id: selectedClient || null, client_name: clientName }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Workflow designed!");
        setPreviewWorkflow(data.workflow);
        setShowCreate(false);
        setPrompt("");
        fetchData();
      } else {
        toast.error(data.error || "Failed to design workflow");
      }
    } catch (err) {
      console.error("[workflows] generateWorkflow failed:", err);
      toast.error("Error generating workflow");
    }
    setGenerating(false);
  }

  async function runWorkflow(workflow: Workflow) {
    toast.loading("Executing workflow...");
    try {
      const res = await fetch("/api/workflows/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflow, client_id: selectedClient || null }),
      });
      const data = await res.json();
      toast.dismiss();
      if (data.success) {
        toast.success(`Done — ${data.results.length} steps executed`);
        fetchData();
      } else {
        toast.error(data.error || "Workflow failed");
      }
    } catch (err) {
      console.error("[workflows] runWorkflow failed:", err);
      toast.dismiss();
      toast.error("Error running workflow");
    }
  }

  async function sendAgentMessage() {
    if (!agentInput.trim()) return;
    const msg = agentInput.trim();
    setAgentInput("");
    setAgentChat(prev => [...prev, { role: "user", content: msg }]);
    setAgentThinking(true);

    try {
      const clientName = clients.find(c => c.id === selectedClient)?.business_name;
      const res = await fetch("/api/workflows/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          history: agentChat.slice(-10),
          client_id: selectedClient || null,
          client_name: clientName,
        }),
      });
      const data = await res.json();
      if (data.reply) {
        setAgentChat(prev => [...prev, {
          role: "agent",
          content: data.reply,
          workflow: data.workflow || undefined,
        }]);
        if (data.workflow) {
          setPreviewWorkflow(data.workflow);
        }
        if (data.executed) {
          toast.success(`Agent executed workflow: ${data.results?.length || 0} steps`);
          fetchData();
        }
      }
    } catch (err) {
      console.error("[workflows] sendAgentMessage failed:", err);
      setAgentChat(prev => [...prev, { role: "agent", content: "Connection error. Try again." }]);
    }
    setAgentThinking(false);
  }

  function getNodeStyle(step: WorkflowStep) {
    const action = (step.config?.action as string) || step.type;
    return NODE_TYPES[action] || { icon: <Zap size={14} />, color: "text-muted", bg: "border-border bg-surface-light/50" };
  }

  function applyPreset(preset: WorkflowPreset) {
    const description = `${preset.name}: ${preset.description}\n\nTrigger: ${preset.trigger}\nSteps:\n${preset.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`;
    setPrompt(description);
    setTab("builder");
    setShowCreate(true);
  }

  function exportWorkflowsJson() {
    if (workflows.length === 0) {
      toast.error("No workflows to export yet");
      return;
    }
    const payload = {
      exported_at: new Date().toISOString(),
      count: workflows.length,
      workflows: workflows.map(w => ({ id: w.id, client_name: w.client_name, status: w.status, created_at: w.created_at, workflow: w.workflow })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `workflows-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${workflows.length} workflow${workflows.length === 1 ? "" : "s"}`);
  }

  const CATEGORY_ICONS: Record<string, React.ReactNode> = {
    "lead-gen": <Users size={12} />, onboarding: <UserPlus size={12} />, email: <Mail size={12} />,
    social: <Globe size={12} />, crm: <GitBranch size={12} />, invoicing: <CreditCard size={12} />,
    content: <FileText size={12} />, reviews: <Star size={12} />, ads: <Target size={12} />,
    seo: <BarChart size={12} />, scheduling: <Calendar size={12} />, notifications: <Bell size={12} />,
    ecommerce: <ShoppingCart size={12} />, support: <MessageCircle size={12} />, hr: <Briefcase size={12} />,
    data: <Database size={12} />, ai: <Sparkles size={12} />, reporting: <BarChart3 size={12} />,
    webhooks: <Webhook size={12} />, agency: <Building size={12} />,
  };

  const filteredPresets = WORKFLOW_PRESETS.filter(p => {
    if (presetCategory !== "all" && p.category !== presetCategory) return false;
    if (presetDifficulty !== "all" && p.difficulty !== presetDifficulty) return false;
    if (presetSearch) {
      const q = presetSearch.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.tags.some(t => t.toLowerCase().includes(q));
    }
    return true;
  });

  const categoryCounts = WORKFLOW_CATEGORIES.map(cat => ({
    ...cat,
    count: WORKFLOW_PRESETS.filter(p => p.category === cat.id).length,
  }));

  const EXAMPLE_PROMPTS = [
    "When a new lead is scraped, send a Telegram notification and add to GHL",
    "Auto-generate weekly content reports for each client",
    "When a deal closes, send Slack message and create invoice",
    "Follow up with leads who haven&apos;t replied in 3 days",
    "Create an AI ad video when a new campaign is launched",
    "Auto-onboard new clients: create tasks, send welcome email, setup GHL",
  ];

  return (
    <div className="fade-in space-y-3">
      <PageHero
        icon={<Zap size={28} />}
        title="Workflows"
        subtitle="AI agent automation — describe & run."
        gradient="sunset"
        actions={
          <>
            <button onClick={() => setShowAiGen(true)} className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-gold to-amber-500 text-black text-xs font-semibold hover:shadow-lg transition-all flex items-center gap-1.5">
              <Sparkles size={13} /> Generate with AI
            </button>
            <button onClick={() => setShowCreate(true)} className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white text-xs font-medium hover:bg-white/20 transition-all flex items-center gap-1.5">
              <Plus size={13} /> New
            </button>
            <button onClick={() => setTab("agent")} className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-medium transition-all ${
              tab === "agent" ? "bg-white/25 text-white" : "bg-white/10 text-white/80 hover:text-white border border-white/20"
            }`}>
              <Bot size={13} /> Agent Mode
            </button>
          </>
        }
      />

      {/* AI Generator Modal */}
      <AiWorkflowGenModal open={showAiGen} onClose={() => setShowAiGen(false)} />

      {/* AI Workflow Hero — natural-language workflow designer at the top.
          Per Apr 26 ask: "massively improve workflows tab to have more
          options like GHL and features and AI stuff". The Hero replaces
          a hidden "Generate with AI" button with a hero panel that
          surfaces the AI design flow as the primary way to build
          workflows. */}
      <AiWorkflowHero
        clients={clients}
        onPreview={(wf) => setPreviewWorkflow(wf)}
      />

      {/* Tabs (sticky) */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur flex gap-1 overflow-x-auto border-b border-border pb-0">
        {([
          { id: "builder" as const, label: "Builder", icon: Zap },
          { id: "presets" as const, label: `Presets (${WORKFLOW_PRESETS.length})`, icon: BookOpen },
          { id: "triggers" as const, label: "Triggers & Actions", icon: GitBranch },
          { id: "agent" as const, label: "AI Agent", icon: Bot },
          { id: "n8n" as const, label: "n8n Live", icon: Globe },
          { id: "analytics" as const, label: "Analytics", icon: BarChart3 },
          { id: "sharing" as const, label: "Sharing", icon: Users },
          { id: "history" as const, label: "History", icon: Clock },
        ]).map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); if (t.id === "n8n") fetchN8n(); }}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg transition-colors whitespace-nowrap ${
              tab === t.id
                ? "bg-surface-light text-gold border border-border border-b-transparent -mb-px"
                : "text-muted hover:text-foreground"
            }`}>
            <t.icon size={12} /> {t.label}
          </button>
        ))}
      </div>

      {/* Builder Tab */}
      {tab === "builder" && (
        <div className="space-y-4">
          {/* Quick prompts */}
          <div className="card">
            <h3 className="text-[10px] text-muted uppercase tracking-wider mb-2">Quick start</h3>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLE_PROMPTS.map((p, i) => (
                <button key={i} onClick={() => { setPrompt(p.replace(/&apos;/g, "'")); setShowCreate(true); }}
                  className="text-[10px] bg-surface-light px-2.5 py-1.5 rounded-md text-muted hover:text-foreground hover:border-gold/20 border border-border transition-all text-left"
                >{p.replace(/&apos;/g, "'")}</button>
              ))}
            </div>
          </div>

          {/* Visual workflow preview */}
          {previewWorkflow && (
            <div className="card border-gold/15 relative overflow-hidden">
              <div className="absolute inset-0 bg-mesh opacity-30" />
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-sm font-bold text-gold">{previewWorkflow.name}</h2>
                    <p className="text-[10px] text-muted mt-0.5">{previewWorkflow.description}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => runWorkflow(previewWorkflow)} className="btn-primary text-xs py-1.5 flex items-center gap-1">
                      <Play size={12} /> Execute
                    </button>
                    <button onClick={() => setPreviewWorkflow(null)} aria-label="Dismiss workflow preview" className="btn-ghost text-xs">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Trigger */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 bg-gold/10 border border-gold/20 rounded-lg flex items-center justify-center">
                    <Zap size={12} className="text-gold" />
                  </div>
                  <div className="flex-1 bg-gold/5 border border-gold/15 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-gold uppercase tracking-wider font-medium">Trigger</p>
                    <p className="text-xs">{previewWorkflow.trigger}</p>
                  </div>
                </div>

                {/* Steps — visual pipeline */}
                <div className="space-y-1">
                  {previewWorkflow.steps.map((step, i) => {
                    const style = getNodeStyle(step);
                    return (
                      <div key={i}>
                        {/* Connector line */}
                        {i > 0 && (
                          <div className="flex items-center justify-center py-0.5">
                            <div className="w-px h-4 bg-border" />
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center border shrink-0 ${style.bg}`}>
                            <span className={style.color}>{style.icon}</span>
                          </div>
                          <div className={`flex-1 rounded-lg px-3 py-2 border ${style.bg}`}>
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-medium">{step.name}</p>
                              <span className="text-[9px] text-muted font-mono">{(step.config?.action as string || step.type).replace(/_/g, " ")}</span>
                            </div>
                            {(() => {
                              const params = step.config?.params;
                              if (!params || typeof params !== "object") return null;
                              return (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {Object.entries(params as Record<string, string>).slice(0, 3).map(([k, v]) => (
                                    <span key={k} className="text-[9px] bg-surface-light/80 px-1.5 py-0.5 rounded text-muted">
                                      {k}: {String(v).substring(0, 30)}
                                    </span>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                          {step.type === "condition" && (
                            <div className="flex flex-col items-center gap-0.5 text-[8px] text-muted">
                              <span className="text-success">Y</span>
                              <GitBranch size={10} className="text-amber-400" />
                              <span className="text-danger">N</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* End node */}
                <div className="flex items-center justify-center py-1">
                  <div className="w-px h-4 bg-border" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-success/10 border border-success/20 rounded-lg flex items-center justify-center">
                    <span className="text-success text-[10px] font-bold">END</span>
                  </div>
                  <span className="text-[10px] text-muted">Workflow complete</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Presets Tab */}
      {tab === "presets" && (
        <div className="space-y-4">
          {/* Search + filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={presetSearch}
                onChange={(e) => setPresetSearch(e.target.value)}
                placeholder="Search presets..."
                className="input w-full text-xs pl-8"
              />
            </div>
            <div className="flex gap-1.5">
              {(["all", "easy", "medium", "advanced"] as const).map(d => (
                <button key={d} onClick={() => setPresetDifficulty(d)}
                  className={`text-[10px] px-2.5 py-1.5 rounded-lg border transition-all ${
                    presetDifficulty === d
                      ? "border-gold/30 bg-gold/[0.05] text-gold font-medium"
                      : "border-border text-muted hover:text-foreground"
                  }`}>
                  {d === "all" ? "All Levels" : d.charAt(0).toUpperCase() + d.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Category pills */}
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setPresetCategory("all")}
              className={`text-[10px] px-2.5 py-1.5 rounded-lg border transition-all flex items-center gap-1 ${
                presetCategory === "all"
                  ? "border-gold/30 bg-gold/[0.05] text-gold font-medium"
                  : "border-border text-muted hover:text-foreground"
              }`}>
              <BookOpen size={10} /> All ({WORKFLOW_PRESETS.length})
            </button>
            {categoryCounts.map(cat => (
              <button key={cat.id} onClick={() => setPresetCategory(cat.id)}
                className={`text-[10px] px-2.5 py-1.5 rounded-lg border transition-all flex items-center gap-1 ${
                  presetCategory === cat.id
                    ? "border-gold/30 bg-gold/[0.05] text-gold font-medium"
                    : "border-border text-muted hover:text-foreground"
                }`}>
                {CATEGORY_ICONS[cat.id]} {cat.name} ({cat.count})
              </button>
            ))}
          </div>

          {/* Results count */}
          <p className="text-[10px] text-muted">{filteredPresets.length} preset{filteredPresets.length !== 1 ? "s" : ""} found</p>

          {/* Preset cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredPresets.map(preset => (
              <div key={preset.id} className="card card-hover p-4 flex flex-col">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gold/10 rounded-lg flex items-center justify-center shrink-0">
                      {CATEGORY_ICONS[preset.category] || <Zap size={12} />}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs font-semibold truncate">{preset.name}</h3>
                      <span className="text-[8px] text-muted">{categoryCounts.find(c => c.id === preset.category)?.name}</span>
                    </div>
                  </div>
                  <span className={`text-[8px] px-1.5 py-0.5 rounded shrink-0 font-medium ${
                    preset.difficulty === "easy" ? "bg-success/10 text-success" :
                    preset.difficulty === "medium" ? "bg-warning/10 text-warning" :
                    "bg-danger/10 text-danger"
                  }`}>
                    {preset.difficulty}
                  </span>
                </div>

                <p className="text-[10px] text-muted mb-2 flex-1">{preset.description}</p>

                <div className="space-y-2">
                  {/* Steps preview */}
                  <div className="flex items-center gap-1 flex-wrap">
                    {preset.steps.slice(0, 3).map((step, i) => (
                      <span key={i} className="text-[8px] bg-surface-light px-1.5 py-0.5 rounded text-muted truncate max-w-[120px]">
                        {i + 1}. {step}
                      </span>
                    ))}
                    {preset.steps.length > 3 && (
                      <span className="text-[8px] text-muted">+{preset.steps.length - 3} more</span>
                    )}
                  </div>

                  {/* Tags + action */}
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1 flex-wrap">
                      {preset.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-[7px] bg-gold/10 text-gold px-1.5 py-0.5 rounded">{tag}</span>
                      ))}
                    </div>
                    <button onClick={() => applyPreset(preset)}
                      className="btn-secondary text-[9px] py-1 px-2.5 flex items-center gap-1 shrink-0">
                      Use <ChevronRight size={9} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredPresets.length === 0 && (
            <div className="card-static text-center py-12">
              <BookOpen size={24} className="text-muted mx-auto mb-2" />
              <p className="text-sm text-muted">No presets match your filters</p>
              <button onClick={() => { setPresetSearch(""); setPresetCategory("all"); setPresetDifficulty("all"); }}
                className="btn-secondary text-xs mt-3">
                Clear Filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Agent Tab — conversational AI workflow builder */}
      {tab === "agent" && (
        <div className="card border-gold/10 relative overflow-hidden" style={{ minHeight: "500px" }}>
          <div className="absolute inset-0 bg-mesh opacity-20" />
          <div className="relative flex flex-col h-full" style={{ minHeight: "480px" }}>
            {/* Agent header */}
            <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gold/10 rounded-lg flex items-center justify-center">
                  <Bot size={16} className="text-gold" />
                </div>
                <div>
                  <p className="text-xs font-semibold">Workflow Agent</p>
                  <p className="text-[9px] text-muted">I can design, modify, and execute workflows for you</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)} className="input text-[10px] py-1 px-2">
                  <option value="">No client</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.business_name}</option>)}
                </select>
                {agentChat.length > 0 && (
                  <button onClick={() => setAgentChat([])} aria-label="Clear agent chat history" className="btn-ghost text-[10px]">
                    <RotateCcw size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Chat area */}
            <div className="flex-1 overflow-y-auto space-y-3 mb-3 max-h-[350px]">
              {agentChat.length === 0 && (
                <div className="text-center py-12">
                  <Bot size={32} className="mx-auto mb-3 text-gold/30" />
                  <p className="text-xs text-muted mb-4">Tell me what you want to automate. I&apos;ll design it, show you the plan, and execute it.</p>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {[
                      "Build me an onboarding workflow for new clients",
                      "Create a lead follow-up sequence with 3-day delays",
                      "Set up a content pipeline: script > review > publish > report",
                      "When a lead replies, notify me and create a task",
                    ].map((s, i) => (
                      <button key={i} onClick={() => { setAgentInput(s); }}
                        className="text-[10px] bg-surface-light/50 px-2.5 py-1.5 rounded-md text-muted hover:text-foreground border border-border hover:border-gold/20 transition-all">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {agentChat.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-lg px-3 py-2 ${
                    msg.role === "user"
                      ? "bg-gold/10 border border-gold/15 text-foreground"
                      : "bg-surface-light/50 border border-border"
                  }`}>
                    <p className="text-xs whitespace-pre-wrap">{msg.content}</p>
                    {msg.workflow && (
                      <div className="mt-2 pt-2 border-t border-border">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] text-gold font-medium">{msg.workflow.name}</span>
                          <div className="flex gap-1">
                            <button onClick={() => setPreviewWorkflow(msg.workflow!)} className="text-[9px] text-gold hover:underline flex items-center gap-0.5">
                              <Eye size={9} /> View
                            </button>
                            <button onClick={() => runWorkflow(msg.workflow!)} className="text-[9px] text-success hover:underline flex items-center gap-0.5">
                              <Play size={9} /> Run
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {msg.workflow.steps.map((s, j) => {
                            const st = getNodeStyle(s);
                            return (
                              <span key={j} className={`text-[9px] px-1.5 py-0.5 rounded border ${st.bg} ${st.color}`}>
                                {s.name}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {agentThinking && (
                <div className="flex justify-start">
                  <div className="bg-surface-light/50 border border-border rounded-lg px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <Loader size={12} className="animate-spin text-gold" />
                      <span className="text-[10px] text-muted">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={(e) => { e.preventDefault(); sendAgentMessage(); }} className="flex gap-2">
              <input
                type="text"
                value={agentInput}
                onChange={(e) => setAgentInput(e.target.value)}
                placeholder="Describe a workflow, ask to modify, or say 'run it'..."
                className="input flex-1 text-xs"
                disabled={agentThinking}
                aria-label="Workflow agent prompt"
              />
              <button type="submit" disabled={!agentInput.trim() || agentThinking} className="btn-primary text-xs px-4 disabled:opacity-30" aria-label="Send message to workflow agent">
                <Send size={13} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* n8n Live Tab */}
      {tab === "n8n" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted">Live workflows from your n8n instance</p>
            <div className="flex gap-2">
              <a href={`${process.env.NEXT_PUBLIC_N8N_URL || "https://n8n-production-97d7.up.railway.app"}`}
                target="_blank" rel="noopener noreferrer"
                className="btn-ghost text-[10px] flex items-center gap-1">
                Open n8n <Eye size={10} />
              </a>
              <button onClick={fetchN8n} className="btn-secondary text-[10px] flex items-center gap-1">
                <RotateCcw size={10} /> Refresh
              </button>
            </div>
          </div>
          {n8nLoading ? (
            <div className="card text-center py-8"><Loader size={16} className="animate-spin text-gold mx-auto" /></div>
          ) : n8nWorkflows.length === 0 ? (
            <div className="card text-center py-8">
              <Zap size={20} className="mx-auto mb-2 text-gold/30" />
              <p className="text-xs text-muted">No n8n workflows found. Create one in the Builder tab or via Agent Mode.</p>
              {isPlatformAdmin && (
                <p className="text-[9px] text-muted mt-1">Make sure N8N_API_KEY is set in your environment variables.</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {n8nWorkflows.map((w) => (
                <div key={w.id} className="card-hover p-4 relative overflow-hidden">
                  <div className={`absolute top-0 left-0 w-1 h-full ${w.active ? "bg-success" : "bg-muted/30"}`} />
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${w.active ? "bg-success/10" : "bg-surface-light"}`}>
                        <Zap size={14} className={w.active ? "text-success" : "text-muted"} />
                      </div>
                      <div>
                        <h3 className="text-xs font-semibold">{w.name}</h3>
                        <p className="text-[9px] text-muted">{w.nodes} nodes · Updated {formatRelativeTime(w.updatedAt)}</p>
                      </div>
                    </div>
                    <button onClick={() => toggleN8nWorkflow(w.id, w.active)}
                      className={`relative w-10 h-5 rounded-full transition-colors ${w.active ? "bg-success" : "bg-surface-light border border-border"}`}>
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${w.active ? "left-5" : "left-0.5"}`} />
                    </button>
                  </div>
                  {w.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {w.tags.map((t, i) => (
                        <span key={i} className="text-[8px] bg-gold/10 text-gold px-1.5 py-0.5 rounded">{t.name}</span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <a href={`${process.env.NEXT_PUBLIC_N8N_URL || "https://n8n-production-97d7.up.railway.app"}/workflow/${w.id}`}
                      target="_blank" rel="noopener noreferrer"
                      className="btn-secondary text-[9px] py-1 px-2 flex items-center gap-1">
                      <Eye size={9} /> Edit in n8n
                    </a>
                    <button onClick={() => deleteN8nWorkflow(w.id)}
                      aria-label={`Delete workflow: ${w.name}`}
                      className="btn-ghost text-[9px] py-1 px-2 text-danger hover:text-danger">
                      <Trash2 size={9} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================================================================== */}
      {/* TRIGGERS & ACTIONS TAB                                              */}
      {/* ================================================================== */}
      {tab === "triggers" && (
        <div className="space-y-4">
          <div className="card p-4">
            <p className="text-xs font-semibold mb-3 flex items-center gap-1.5"><Zap size={13} className="text-gold" /> Trigger Library (15+)</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {[
                { name: "New Lead Scraped", icon: Users, color: "text-blue-400", desc: "When scraper finds a lead" },
                { name: "Client Created", icon: UserPlus, color: "text-green-400", desc: "New client is added" },
                { name: "Deal Closed", icon: CreditCard, color: "text-gold", desc: "Deal status changes to won" },
                { name: "Form Submitted", icon: FileText, color: "text-purple-400", desc: "Website form submission" },
                { name: "Email Received", icon: Mail, color: "text-cyan-400", desc: "Incoming email from client" },
                { name: "Schedule Trigger", icon: Calendar, color: "text-orange-400", desc: "Time-based recurring trigger" },
                { name: "Webhook Received", icon: Webhook, color: "text-yellow-400", desc: "External webhook fires" },
                { name: "Invoice Paid", icon: CreditCard, color: "text-emerald-400", desc: "Client pays invoice" },
                { name: "Task Completed", icon: FileText, color: "text-pink-400", desc: "Team member completes task" },
                { name: "Review Posted", icon: Star, color: "text-amber-400", desc: "New review on Google/Yelp" },
                { name: "Lead Score Change", icon: Target, color: "text-red-400", desc: "Lead score threshold met" },
                { name: "Appointment Booked", icon: Calendar, color: "text-teal-400", desc: "Client books appointment" },
                { name: "Chat Message", icon: MessageCircle, color: "text-violet-400", desc: "New chat from prospect" },
                { name: "Campaign Launched", icon: Globe, color: "text-indigo-400", desc: "New ad campaign starts" },
                { name: "Manual Trigger", icon: Play, color: "text-muted", desc: "Run on-demand manually" },
              ].map(trigger => (
                <button key={trigger.name} onClick={() => { setPrompt(`When: ${trigger.name} - ${trigger.desc}`); setShowCreate(true); setTab("builder"); }}
                  className="card-hover p-3 text-left flex items-start gap-2">
                  <trigger.icon size={14} className={`${trigger.color} mt-0.5 shrink-0`} />
                  <div><p className="text-[10px] font-semibold">{trigger.name}</p><p className="text-[9px] text-muted">{trigger.desc}</p></div>
                </button>
              ))}
            </div>
          </div>
          <div className="card p-4">
            <p className="text-xs font-semibold mb-3 flex items-center gap-1.5"><Play size={13} className="text-gold" /> Action Library (20+)</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {["Send Email", "Send SMS", "Send Telegram", "Send Slack Message", "Create Task", "Update Lead Status", "Add Tag", "Generate Content", "Create Invoice", "Fire Webhook", "Add to CRM", "Schedule Meeting", "Generate Report", "Push Notification", "Create Proposal", "Update Database", "Run AI Analysis", "Deploy Website", "Generate Social Posts", "Send Voice Message"].map((action, i) => (
                <div key={action} className="px-3 py-2 rounded-lg border border-border text-[10px] font-medium flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${["bg-cyan-400", "bg-green-400", "bg-blue-400", "bg-purple-400", "bg-gold", "bg-orange-400", "bg-teal-400", "bg-pink-400", "bg-emerald-400", "bg-yellow-400"][i % 10]}`} />
                  {action}
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card p-4">
              <p className="text-xs font-semibold mb-3 flex items-center gap-1.5"><GitBranch size={13} className="text-gold" /> Condition Nodes</p>
              <div className="space-y-2">
                {["If lead has email", "If deal value > $1000", "If client is active", "If score > 80", "If tag contains X", "If time is between 9-5"].map(cond => (
                  <div key={cond} className="flex items-center gap-2 p-2 rounded-lg bg-surface-light border border-border text-[10px]"><GitBranch size={10} className="text-amber-400" /> {cond}</div>
                ))}
              </div>
            </div>
            <div className="card p-4">
              <p className="text-xs font-semibold mb-3 flex items-center gap-1.5"><Clock size={13} className="text-gold" /> Delay Nodes</p>
              <div className="space-y-2">
                {["Wait 5 minutes", "Wait 1 hour", "Wait 24 hours", "Wait 3 days", "Wait until specific time", "Wait until next business day"].map(delay => (
                  <div key={delay} className="flex items-center gap-2 p-2 rounded-lg bg-surface-light border border-border text-[10px]"><Clock size={10} className="text-muted" /> {delay}</div>
                ))}
              </div>
            </div>
          </div>
          <div className="card p-4">
            <p className="text-xs font-semibold mb-3 flex items-center gap-1.5"><Bell size={13} className="text-gold" /> Error Handling</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div><p className="text-xs font-semibold">Error Notifications</p><p className="text-[9px] text-muted">Get notified when a step fails</p></div>
                <button onClick={() => setErrorNotifications(!errorNotifications)} className={`w-10 h-5 rounded-full transition-colors relative ${errorNotifications ? "bg-gold" : "bg-surface-light border border-border"}`}><span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${errorNotifications ? "left-5" : "left-0.5"}`} /></button>
              </div>
              <div className="flex items-center justify-between">
                <div><p className="text-xs font-semibold">Auto-Retry on Failure</p><p className="text-[9px] text-muted">Retry failed steps up to {maxRetries}x</p></div>
                <button onClick={() => setRetryOnFailure(!retryOnFailure)} className={`w-10 h-5 rounded-full transition-colors relative ${retryOnFailure ? "bg-gold" : "bg-surface-light border border-border"}`}><span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${retryOnFailure ? "left-5" : "left-0.5"}`} /></button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* ANALYTICS TAB                                                       */}
      {/* ================================================================== */}
      {tab === "analytics" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <div className="card p-3"><div className="flex items-center gap-1.5 mb-1"><Play size={12} className="text-gold" /><p className="text-[10px] text-muted uppercase tracking-wider">Total Runs</p></div><p className="text-lg font-bold text-gold">{workflowAnalytics.totalRuns}</p></div>
            <div className="card p-3"><div className="flex items-center gap-1.5 mb-1"><Target size={12} className="text-green-400" /><p className="text-[10px] text-muted uppercase tracking-wider">Success Rate</p></div><p className="text-lg font-bold text-green-400">{workflowAnalytics.successRate}%</p></div>
            <div className="card p-3"><div className="flex items-center gap-1.5 mb-1"><Clock size={12} className="text-blue-400" /><p className="text-[10px] text-muted uppercase tracking-wider">Avg Duration</p></div><p className="text-lg font-bold text-blue-400">{workflowAnalytics.avgDuration}</p></div>
            <div className="card p-3"><div className="flex items-center gap-1.5 mb-1"><Zap size={12} className="text-purple-400" /><p className="text-[10px] text-muted uppercase tracking-wider">Hours Saved</p></div><p className="text-lg font-bold text-purple-400">{workflowAnalytics.savedHours}h</p></div>
          </div>
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold flex items-center gap-1.5"><Clock size={13} className="text-gold" /> Recent Runs</p>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-muted flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${testMode ? "bg-yellow-400" : "bg-green-400"}`} />{testMode ? "Test Mode" : "Live Mode"}</span>
                <button onClick={() => setTestMode(!testMode)} className="btn-secondary text-[9px] flex items-center gap-1">{testMode ? <Play size={9} /> : <Eye size={9} />} {testMode ? "Go Live" : "Test Mode"}</button>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[10px] text-muted uppercase tracking-wider font-semibold">
                <div className="col-span-1">ID</div><div className="col-span-3">Workflow</div><div className="col-span-2">Status</div><div className="col-span-2">Duration</div><div className="col-span-1">Steps</div><div className="col-span-3">Time</div>
              </div>
              {runHistory.length === 0 ? (
                <div className="text-center py-6">
                  <Clock size={18} className="mx-auto mb-2 text-muted/30" />
                  <p className="text-[10px] text-muted">No workflow runs yet</p>
                </div>
              ) : runHistory.map(run => (
                <div key={run.id} className="grid grid-cols-12 gap-2 items-center px-3 py-2 rounded-lg bg-surface-light border border-border">
                  <div className="col-span-1"><span className="text-[9px] font-mono text-muted">{run.id}</span></div>
                  <div className="col-span-3"><span className="text-[10px] font-semibold">{run.workflow}</span></div>
                  <div className="col-span-2"><span className={`text-[9px] px-2 py-0.5 rounded-full border ${run.status === "success" ? "text-green-400 border-green-400/30 bg-green-400/10" : "text-red-400 border-red-400/30 bg-red-400/10"}`}>{run.status === "success" ? "Success" : "Failed"}</span></div>
                  <div className="col-span-2"><span className="text-[10px] text-muted">{run.duration}</span></div>
                  <div className="col-span-1"><span className="text-[10px] text-muted">{run.steps}</span></div>
                  <div className="col-span-3"><span className="text-[9px] text-muted">{run.timestamp}</span></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* SHARING TAB                                                         */}
      {/* ================================================================== */}
      {tab === "sharing" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted">Share workflows with your team or the community</p>
            <button onClick={() => toast("Community sharing coming soon", { icon: "🚧" })} className="btn-primary text-[10px] flex items-center gap-1"><Send size={10} /> Share Workflow</button>
          </div>
          <div className="card p-4">
            <p className="text-xs font-semibold mb-3 flex items-center gap-1.5"><Users size={13} className="text-gold" /> Community Workflows</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {sharedWorkflows.length === 0 ? (
                <div className="col-span-2 text-center py-6">
                  <Users size={18} className="mx-auto mb-2 text-muted/30" />
                  <p className="text-[10px] text-muted">No shared workflows yet</p>
                </div>
              ) : sharedWorkflows.map(sw => (
                <div key={sw.id} className="p-3 rounded-lg bg-surface-light border border-border">
                  <div className="flex items-start justify-between mb-2">
                    <div><h3 className="text-xs font-semibold">{sw.name}</h3><p className="text-[9px] text-muted">by {sw.author}</p></div>
                    <div className="flex items-center gap-1 text-[9px] text-gold"><Star size={9} /> {sw.rating}</div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-muted">{sw.downloads} downloads</span>
                    <button onClick={() => toast("Import coming soon", { icon: "🚧" })} className="btn-secondary text-[9px] flex items-center gap-1"><RotateCcw size={9} /> Import</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="card p-4">
              <p className="text-xs font-semibold mb-3 flex items-center gap-1.5"><Send size={13} className="text-gold" /> Export Workflows</p>
              <p className="text-[10px] text-muted mb-3">Export as JSON to share or back up</p>
              <button onClick={exportWorkflowsJson} className="btn-primary text-xs w-full flex items-center justify-center gap-1.5"><FileText size={12} /> Export All</button>
            </div>
            <div className="card p-4">
              <p className="text-xs font-semibold mb-3 flex items-center gap-1.5"><RotateCcw size={13} className="text-gold" /> Import Workflows</p>
              <p className="text-[10px] text-muted mb-3">Import from JSON or shared links</p>
              <button onClick={() => toast("Import via JSON coming soon", { icon: "🚧" })} className="btn-secondary text-xs w-full flex items-center justify-center gap-1.5"><FileText size={12} /> Import JSON</button>
            </div>
          </div>
          <div className="card p-4">
            <p className="text-xs font-semibold mb-3 flex items-center gap-1.5"><GitBranch size={13} className="text-gold" /> Workflow Versioning</p>
            <p className="text-[10px] text-muted mb-3">Each edit creates a new version. Rollback anytime.</p>
            <div className="text-center py-6 text-[10px] text-muted">
              <GitBranch size={16} className="mx-auto mb-2 text-muted/40" />
              Version history will appear here once you edit a workflow.
            </div>
          </div>
        </div>
      )}

      {/* History Tab */}
      {tab === "history" && (
        <div className="space-y-2">
          {workflowsLoading ? (
            <>{Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}</>
          ) : workflows.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-xs text-muted">No workflows yet</p>
            </div>
          ) : (
            workflows.map((w) => (
              <div key={w.id} className="card-hover flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gold/10 rounded-lg flex items-center justify-center">
                    <Zap size={14} className="text-gold" />
                  </div>
                  <div>
                    <p className="text-xs font-medium">{w.workflow?.name || w.client_name}</p>
                    <p className="text-[10px] text-muted">{w.workflow?.steps?.length || 0} steps · {formatRelativeTime(w.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={w.status} />
                  {w.workflow?.steps && (
                    <button onClick={() => { setPreviewWorkflow(w.workflow); setTab("builder"); }} aria-label={`Preview workflow: ${w.workflow?.name || "Workflow"}`} className="btn-ghost text-[10px]">
                      <Eye size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Create Workflow Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Design Workflow" size="lg">
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider">Client (optional)</label>
            <select value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)} className="input w-full text-xs">
              <option value="">General workflow</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.business_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider">What do you want to automate?</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="input w-full h-28 text-xs"
              placeholder="e.g., When a new lead is scraped, check if they have a website. If yes, send a personalized DM. If no reply after 3 days, send a follow-up."
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowCreate(false)} className="btn-secondary text-xs">Cancel</button>
            <button onClick={generateWorkflow} disabled={generating || !prompt.trim()} className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50">
              {generating ? <Loader size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {generating ? "Designing..." : "Design Workflow"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ───── AI Workflow Generator Modal ───── */
function AiWorkflowGenModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [goal, setGoal] = useState("");
  const [audience, setAudience] = useState("");
  const [channels, setChannels] = useState<string[]>(["email"]);
  const [tone, setTone] = useState("professional");
  const [duration, setDuration] = useState("2 weeks");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ name: string; description: string; objective: string; estimated_duration_days: number; nodes: Array<{ id: string; type: string; subtype: string; label: string }>; tags: string[]; confidence: number } | null>(null);

  if (!open) return null;

  async function generate() {
    if (!goal.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/workflows/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, audience, channels, tone, duration_hint: duration }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.workflow);
      } else {
        toast.error(data.error || "Generation failed");
      }
    } catch (err) {
      console.error("[workflows] AI generate failed:", err);
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }

  function toggleChannel(ch: string) {
    setChannels(prev => prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-gold" />
            <h3 className="text-sm font-semibold">AI Workflow Generator</h3>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gold/10 text-gold">Sonnet</span>
          </div>
          <button onClick={onClose} className="text-muted hover:text-foreground text-lg">×</button>
        </div>

        {!result ? (
          <>
            <div>
              <label className="text-[10px] text-muted uppercase tracking-wider">Goal</label>
              <textarea
                className="input w-full text-xs mt-1"
                rows={3}
                placeholder="e.g., Re-engage cold leads who haven't replied in 30 days and book a call"
                value={goal}
                onChange={e => setGoal(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-muted uppercase tracking-wider">Audience</label>
                <input className="input w-full text-xs mt-1" placeholder="e.g., SaaS founders" value={audience} onChange={e => setAudience(e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] text-muted uppercase tracking-wider">Tone</label>
                <select className="input w-full text-xs mt-1" value={tone} onChange={e => setTone(e.target.value)}>
                  <option value="professional">Professional</option>
                  <option value="friendly">Friendly</option>
                  <option value="urgent">Urgent</option>
                  <option value="casual">Casual</option>
                  <option value="persuasive">Persuasive</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-[10px] text-muted uppercase tracking-wider mb-1 block">Channels</label>
              <div className="flex gap-2 flex-wrap">
                {["email","sms","dm","call","webhook","ai_content"].map(ch => (
                  <button key={ch} type="button" onClick={() => toggleChannel(ch)}
                    className={`text-[10px] px-2.5 py-1 rounded-full border capitalize ${
                      channels.includes(ch)
                        ? "bg-gold/15 border-gold/30 text-gold"
                        : "bg-surface-light border-border text-muted"
                    }`}>
                    {ch.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] text-muted uppercase tracking-wider">Duration</label>
              <select className="input w-full text-xs mt-1" value={duration} onChange={e => setDuration(e.target.value)}>
                <option>3 days</option>
                <option>1 week</option>
                <option>2 weeks</option>
                <option>1 month</option>
                <option>3 months</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={onClose} className="btn-secondary text-xs">Cancel</button>
              <button onClick={generate} disabled={loading || !goal.trim()} className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50">
                {loading ? <Loader size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {loading ? "Generating..." : "Generate Workflow"}
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <div className="bg-gold/5 border border-gold/20 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-sm font-semibold">{result.name}</h4>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
                  {result.confidence}% confidence
                </span>
              </div>
              <p className="text-[11px] text-muted">{result.description}</p>
              <div className="flex items-center gap-3 mt-2 text-[10px] text-muted">
                <span>📅 {result.estimated_duration_days} days</span>
                <span>🔗 {result.nodes.length} nodes</span>
                <span>🎯 {result.objective}</span>
              </div>
            </div>
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
              {result.nodes.map((node, i) => (
                <div key={node.id} className="flex items-center gap-2 p-2 rounded-lg bg-surface-light/50 border border-border">
                  <span className="w-6 h-6 rounded-md bg-gold/15 text-gold text-[9px] font-bold flex items-center justify-center">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full uppercase tracking-wider ${
                        node.type === "trigger" ? "bg-emerald-500/10 text-emerald-400" :
                        node.type === "action" ? "bg-blue-500/10 text-blue-400" :
                        node.type === "condition" ? "bg-purple-500/10 text-purple-400" :
                        node.type === "wait" ? "bg-amber-500/10 text-amber-400" :
                        "bg-surface-light text-muted"
                      }`}>{node.type}</span>
                      <span className="text-[10px] font-medium">{node.label}</span>
                    </div>
                    <p className="text-[9px] text-muted mt-0.5">{node.subtype}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              {result.tags.map(tag => (
                <span key={tag} className="text-[9px] px-2 py-0.5 rounded-full bg-surface-light border border-border text-muted">#{tag}</span>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setResult(null)} className="btn-secondary text-xs">Start Over</button>
              <button onClick={onClose} className="btn-primary text-xs">Use This Workflow</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
