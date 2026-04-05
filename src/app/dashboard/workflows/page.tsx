"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Client } from "@/lib/types";
import Modal from "@/components/ui/modal";
import StatusBadge from "@/components/ui/status-badge";
import { formatRelativeTime } from "@/lib/utils";
import {
  Zap, Plus, Sparkles, Play, Trash2, Bot, ArrowRight,
  MessageCircle, Mail, Clock, GitBranch, Globe, Phone,
  Tag, FileText, Send, Webhook, Pause, Terminal, Loader,
  ChevronDown, Copy, RotateCcw, Settings, Eye, Code,
  Video
} from "lucide-react";
import toast from "react-hot-toast";

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
  send_telegram: { icon: <Send size={14} />, color: "text-blue-400", bg: "border-blue-400/20 bg-blue-400/5" },
  send_slack_message: { icon: <MessageCircle size={14} />, color: "text-purple-400", bg: "border-purple-400/20 bg-purple-400/5" },
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
  generate_video: { icon: <Video size={14} />, color: "text-red-400", bg: "border-red-400/20 bg-red-400/5" },
};

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Array<{ id: string; workflow: Workflow; client_name?: string; created_at: string; status: string }>>([]);
  const [clients, setClients] = useState<Pick<Client, "id" | "business_name">[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  const [generating, setGenerating] = useState(false);
  const [previewWorkflow, setPreviewWorkflow] = useState<Workflow | null>(null);
  const [agentMode, setAgentMode] = useState(false);
  const [agentChat, setAgentChat] = useState<Array<{ role: "user" | "agent"; content: string; workflow?: Workflow }>>([]);
  const [agentInput, setAgentInput] = useState("");
  const [agentThinking, setAgentThinking] = useState(false);
  const [tab, setTab] = useState<"builder" | "history" | "agent">("builder");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [agentChat]);

  async function fetchData() {
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
        toast.error("Failed to design workflow");
      }
    } catch {
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
        toast.error("Workflow failed");
      }
    } catch {
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
    } catch {
      setAgentChat(prev => [...prev, { role: "agent", content: "Connection error. Try again." }]);
    }
    setAgentThinking(false);
  }

  function getNodeStyle(step: WorkflowStep) {
    const action = (step.config?.action as string) || step.type;
    return NODE_TYPES[action] || { icon: <Zap size={14} />, color: "text-muted", bg: "border-border bg-surface-light/50" };
  }

  const EXAMPLE_PROMPTS = [
    "When a new lead is scraped, send a Telegram notification and add to GHL",
    "Auto-generate weekly content reports for each client",
    "When a deal closes, send Slack message and create invoice",
    "Follow up with leads who haven&apos;t replied in 3 days",
    "Create an AI ad video when a new campaign is launched",
    "Auto-onboard new clients: create tasks, send welcome email, setup GHL",
  ];

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2">
            <Zap size={18} className="text-gold" /> Workflows
          </h1>
          <p className="text-muted text-xs mt-0.5">AI agent automation — describe it, we build and run it</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowCreate(true)} className="btn-secondary text-xs flex items-center gap-1.5">
            <Plus size={13} /> New
          </button>
          <button onClick={() => setTab("agent")} className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-medium transition-all ${
            tab === "agent" ? "bg-gold text-black" : "bg-surface-light text-muted hover:text-white border border-border"
          }`}>
            <Bot size={13} /> Agent Mode
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-group w-fit">
        {(["builder", "agent", "history"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={tab === t ? "tab-item-active" : "tab-item-inactive"}>
            {t === "builder" ? "Builder" : t === "agent" ? "AI Agent" : "History"}
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
                  className="text-[10px] bg-surface-light px-2.5 py-1.5 rounded-md text-muted hover:text-white hover:border-gold/20 border border-border/50 transition-all text-left"
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
                    <button onClick={() => setPreviewWorkflow(null)} className="btn-ghost text-xs">
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
                            {step.config?.params && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {Object.entries(step.config.params as Record<string, string>).slice(0, 3).map(([k, v]) => (
                                  <span key={k} className="text-[9px] bg-surface-light/80 px-1.5 py-0.5 rounded text-muted">
                                    {k}: {String(v).substring(0, 30)}
                                  </span>
                                ))}
                              </div>
                            )}
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

      {/* Agent Tab — conversational AI workflow builder */}
      {tab === "agent" && (
        <div className="card border-gold/10 relative overflow-hidden" style={{ minHeight: "500px" }}>
          <div className="absolute inset-0 bg-mesh opacity-20" />
          <div className="relative flex flex-col h-full" style={{ minHeight: "480px" }}>
            {/* Agent header */}
            <div className="flex items-center justify-between pb-3 border-b border-border/20 mb-3">
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
                  <button onClick={() => setAgentChat([])} className="btn-ghost text-[10px]">
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
                        className="text-[10px] bg-surface-light/50 px-2.5 py-1.5 rounded-md text-muted hover:text-white border border-border/30 hover:border-gold/20 transition-all">
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
                      ? "bg-gold/10 border border-gold/15 text-white"
                      : "bg-surface-light/50 border border-border/20"
                  }`}>
                    <p className="text-xs whitespace-pre-wrap">{msg.content}</p>
                    {msg.workflow && (
                      <div className="mt-2 pt-2 border-t border-border/20">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] text-gold font-medium">{msg.workflow.name}</span>
                          <div className="flex gap-1">
                            <button onClick={() => setPreviewWorkflow(msg.workflow!)} className="text-[9px] text-accent hover:underline flex items-center gap-0.5">
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
                  <div className="bg-surface-light/50 border border-border/20 rounded-lg px-3 py-2">
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
              />
              <button type="submit" disabled={!agentInput.trim() || agentThinking} className="btn-primary text-xs px-4 disabled:opacity-30">
                <Send size={13} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* History Tab */}
      {tab === "history" && (
        <div className="space-y-2">
          {workflows.length === 0 ? (
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
                    <button onClick={() => { setPreviewWorkflow(w.workflow); setTab("builder"); }} className="btn-ghost text-[10px]">
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
