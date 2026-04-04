"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Client } from "@/lib/types";
import Modal from "@/components/ui/modal";
import StatusBadge from "@/components/ui/status-badge";
import { Zap, Plus, Sparkles, Play, Trash2, Settings } from "lucide-react";
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

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Array<{ id: string; workflow: Workflow; client_name?: string; created_at: string; status: string }>>([]);
  const [clients, setClients] = useState<Pick<Client, "id" | "business_name">[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  const [generating, setGenerating] = useState(false);
  const [previewWorkflow, setPreviewWorkflow] = useState<Workflow | null>(null);
  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, []);

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
    toast.loading("Running workflow...");
    try {
      const res = await fetch("/api/workflows/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflow, client_id: selectedClient || null }),
      });
      const data = await res.json();
      toast.dismiss();
      if (data.success) {
        toast.success(`Workflow completed — ${data.results.length} steps executed`);
      } else {
        toast.error("Workflow failed");
      }
    } catch {
      toast.dismiss();
      toast.error("Error running workflow");
    }
  }

  const EXAMPLE_PROMPTS = [
    "When a new lead is scraped, send me a Telegram notification and add them to GHL with a 'new-lead' tag",
    "Every time a deal is closed, send a Slack message to #wins channel and generate an invoice",
    "When a client replies to outreach, create a follow-up task and notify the team on Slack",
    "Send a weekly content report to each client via email with their published videos",
    "When a lead books a call, send them an SMS confirmation and notify the sales team",
    "Auto-generate a welcome email for new clients with their onboarding checklist",
  ];

  return (
    <div className="fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-3">
            <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
              <Zap size={24} className="text-gold" />
            </div>
            Workflows
          </h1>
          <p className="text-muted text-sm">AI-powered automation — describe what you need, Claude builds it</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> New Workflow
        </button>
      </div>

      {/* Example prompts */}
      <div className="card">
        <h3 className="text-sm font-medium text-muted mb-3">Quick start — click any example:</h3>
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_PROMPTS.map((p, i) => (
            <button key={i} onClick={() => { setPrompt(p); setShowCreate(true); }}
              className="text-xs bg-surface-light px-3 py-2 rounded-lg text-muted hover:text-white hover:border-gold/30 border border-border transition-all text-left"
            >{p}</button>
          ))}
        </div>
      </div>

      {/* Preview designed workflow */}
      {previewWorkflow && (
        <div className="card border-gold/30">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gold">{previewWorkflow.name}</h2>
              <p className="text-sm text-muted">{previewWorkflow.description}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => runWorkflow(previewWorkflow)} className="btn-primary flex items-center gap-2">
                <Play size={16} /> Run Now
              </button>
              <button onClick={() => setPreviewWorkflow(null)} className="btn-secondary">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
          <p className="text-xs text-gold mb-3">Trigger: {previewWorkflow.trigger}</p>
          <div className="space-y-2">
            {previewWorkflow.steps.map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gold/10 rounded-lg flex items-center justify-center text-gold text-xs font-bold shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 bg-surface-light rounded-lg p-3 border border-border/50">
                  <p className="text-sm font-medium">{step.name}</p>
                  <p className="text-xs text-muted capitalize">{String(step.config?.action || step.type).replace(/_/g, " ")}</p>
                </div>
                {i < previewWorkflow.steps.length - 1 && (
                  <div className="text-muted">→</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Workflow history */}
      <div>
        <h2 className="section-header">Workflow History</h2>
        <div className="space-y-3">
          {workflows.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-muted">No workflows yet. Click &quot;New Workflow&quot; to create one with AI.</p>
            </div>
          ) : (
            workflows.map((w) => (
              <div key={w.id} className="card-hover flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{w.workflow?.name || w.client_name}</p>
                  <p className="text-xs text-muted">{w.workflow?.description || ""}</p>
                  <p className="text-xs text-muted mt-1">{w.workflow?.steps?.length || 0} steps · {new Date(w.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={w.status} />
                  {w.workflow?.steps && (
                    <button onClick={() => { setPreviewWorkflow(w.workflow); }} className="btn-secondary text-xs py-1 px-3">
                      View
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create Workflow Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Design a Workflow with AI" size="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-muted mb-1">Client (optional)</label>
            <select value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)} className="input w-full">
              <option value="">General workflow</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.business_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-muted mb-1">Describe what you want to automate</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="input w-full h-32"
              placeholder="e.g., When a new lead is scraped, check if they have a website. If yes, send a personalized DM. If no reply after 3 days, send a follow-up. Notify me on Telegram either way."
            />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            <button onClick={generateWorkflow} disabled={generating || !prompt.trim()} className="btn-primary flex items-center gap-2 disabled:opacity-50">
              <Sparkles size={16} /> {generating ? "Designing..." : "Design Workflow"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
