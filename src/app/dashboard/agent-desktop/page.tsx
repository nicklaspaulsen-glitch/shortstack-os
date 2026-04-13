"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  Monitor, FolderOpen, FileText, Zap, Plus, RefreshCw,
  CheckCircle, Clock, Trash2, ArrowRight, Download,
} from "lucide-react";
import toast from "react-hot-toast";

interface WorkspaceData {
  workspace_path: string;
  files: Array<{ path: string; type: string; size: number }>;
  projects: Array<{ name: string; type: string; file_count: number }>;
  file_count: number;
  project_count: number;
  last_synced_at: string;
}

interface AgentTask {
  id: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  status: "pending" | "in_progress" | "completed" | "cancelled";
  task_type: string;
  created_at: string;
  completed_at: string | null;
}

const QUICK_TASKS = [
  { title: "Create social media campaign", description: "Scaffold a complete multi-platform social campaign with briefs, captions, and calendar", type: "social-campaign", priority: "medium" },
  { title: "Build a landing page", description: "Generate a responsive HTML/CSS/JS landing page for a product or service", type: "website", priority: "medium" },
  { title: "Generate content calendar", description: "Create a weekly content calendar with post ideas for all platforms", type: "content-calendar", priority: "medium" },
  { title: "Create brand kit", description: "Scaffold brand guidelines with logo usage, colors, typography, and templates", type: "brand-kit", priority: "low" },
  { title: "Write email sequence", description: "Generate a 5-email drip campaign with welcome, value, and conversion emails", type: "email-sequence", priority: "medium" },
  { title: "Organize workspace files", description: "Scan and auto-organize all files in the workspace by type and project", type: "organize", priority: "low" },
];

export default function AgentDesktopPage() {
  const { profile } = useAuth();
  const supabase = createClient();
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState<"high" | "medium" | "low">("medium");

  useEffect(() => {
    if (profile?.id) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  async function loadData() {
    setLoading(true);
    const [wsRes, taskRes] = await Promise.all([
      supabase.from("agent_workspace").select("*").eq("user_id", profile!.id).single(),
      supabase.from("agent_tasks").select("*").eq("user_id", profile!.id).order("created_at", { ascending: false }).limit(50),
    ]);
    if (wsRes.data) setWorkspace(wsRes.data as WorkspaceData);
    if (taskRes.data) setTasks(taskRes.data as AgentTask[]);
    setLoading(false);
  }

  async function addTask(title: string, description: string, priority: string, taskType = "general") {
    const { error } = await supabase.from("agent_tasks").insert({
      user_id: profile!.id,
      title,
      description,
      priority,
      task_type: taskType,
      status: "pending",
    });
    if (error) { toast.error("Failed to add task"); return; }
    toast.success("Task queued for agent");
    setNewTitle("");
    setNewDesc("");
    loadData();
  }

  async function cancelTask(id: string) {
    await supabase.from("agent_tasks").update({ status: "cancelled" }).eq("id", id);
    toast.success("Task cancelled");
    loadData();
  }

  const pendingTasks = tasks.filter(t => t.status === "pending");
  const completedTasks = tasks.filter(t => t.status === "completed");
  const timeSinceSync = workspace?.last_synced_at
    ? Math.round((Date.now() - new Date(workspace.last_synced_at).getTime()) / 60000)
    : null;

  function formatSize(bytes: number) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw size={20} className="animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="fade-in space-y-5 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2">
            <Monitor size={18} className="text-gold" /> Desktop Agent
          </h1>
          <p className="text-xs text-muted mt-0.5">Manage your AI desktop assistant and workspace</p>
        </div>
        <button onClick={loadData} className="btn-secondary text-xs flex items-center gap-1.5">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Workspace Status */}
      <div className="card border-gold/10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <FolderOpen size={14} className="text-gold" /> Workspace
          </h2>
          {timeSinceSync !== null && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
              timeSinceSync < 5 ? "bg-success/10 text-success" :
              timeSinceSync < 60 ? "bg-gold/10 text-gold" :
              "bg-danger/10 text-danger"
            }`}>
              {timeSinceSync < 1 ? "Just synced" :
               timeSinceSync < 60 ? `${timeSinceSync}m ago` :
               `${Math.round(timeSinceSync / 60)}h ago`}
            </span>
          )}
        </div>

        {workspace ? (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-surface-light rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-gold">{workspace.file_count}</p>
              <p className="text-[10px] text-muted">Files</p>
            </div>
            <div className="bg-surface-light rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-gold">{workspace.project_count}</p>
              <p className="text-[10px] text-muted">Projects</p>
            </div>
            <div className="bg-surface-light rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-gold">
                {workspace.files ? formatSize(workspace.files.reduce((s, f) => s + (f.size || 0), 0)) : "0 B"}
              </p>
              <p className="text-[10px] text-muted">Total Size</p>
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <Download size={24} className="text-muted mx-auto mb-2" />
            <p className="text-xs text-muted">No workspace synced yet. Open the desktop agent and click Sync.</p>
          </div>
        )}

        {/* Projects list */}
        {workspace?.projects && workspace.projects.length > 0 && (
          <div className="mt-3 space-y-1.5">
            <p className="text-[10px] text-muted uppercase tracking-wider font-semibold">Projects</p>
            {workspace.projects.map((p, i) => (
              <div key={i} className="flex items-center gap-2 bg-surface-light rounded-lg px-3 py-2">
                <FileText size={12} className="text-gold" />
                <span className="text-xs font-medium flex-1">{p.name}</span>
                <span className="text-[10px] text-muted">{p.file_count} files</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Tasks */}
      <div className="card">
        <h2 className="text-sm font-bold flex items-center gap-2 mb-3">
          <Zap size={14} className="text-gold" /> Quick Tasks
        </h2>
        <p className="text-[10px] text-muted mb-3">Push tasks to your desktop agent. They will appear in the Tasks tab.</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {QUICK_TASKS.map((qt, i) => (
            <button key={i} onClick={() => addTask(qt.title, qt.description, qt.priority, qt.type)}
              className="bg-surface-light border border-border rounded-xl p-3 text-left hover:border-gold/30 transition-all group">
              <p className="text-xs font-semibold group-hover:text-gold transition-colors">{qt.title}</p>
              <p className="text-[9px] text-muted mt-1 line-clamp-2">{qt.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Custom Task */}
      <div className="card">
        <h2 className="text-sm font-bold flex items-center gap-2 mb-3">
          <Plus size={14} className="text-gold" /> Custom Task
        </h2>
        <div className="space-y-2">
          <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
            placeholder="Task title..."
            className="w-full bg-surface-light border border-border rounded-lg px-3 py-2 text-xs outline-none focus:border-gold/30" />
          <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)}
            placeholder="Description (optional)..."
            className="w-full bg-surface-light border border-border rounded-lg px-3 py-2 text-xs outline-none focus:border-gold/30 h-16 resize-none" />
          <div className="flex items-center gap-2">
            <select value={newPriority} onChange={e => setNewPriority(e.target.value as "high" | "medium" | "low")}
              className="bg-surface-light border border-border rounded-lg px-3 py-1.5 text-xs outline-none">
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <button onClick={() => newTitle && addTask(newTitle, newDesc, newPriority)}
              disabled={!newTitle}
              className="ml-auto bg-gold text-black text-xs font-semibold px-4 py-1.5 rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity flex items-center gap-1.5">
              Queue Task <ArrowRight size={11} />
            </button>
          </div>
        </div>
      </div>

      {/* Pending Tasks */}
      {pendingTasks.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-bold flex items-center gap-2 mb-3">
            <Clock size={14} className="text-gold" /> Pending ({pendingTasks.length})
          </h2>
          <div className="space-y-2">
            {pendingTasks.map(t => (
              <div key={t.id} className="flex items-start gap-3 bg-surface-light rounded-xl p-3">
                <span className={`text-[8px] mt-0.5 px-1.5 py-0.5 rounded-full font-bold uppercase ${
                  t.priority === "high" ? "bg-danger/10 text-danger" :
                  t.priority === "medium" ? "bg-gold/10 text-gold" :
                  "bg-muted/10 text-muted"
                }`}>{t.priority}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold">{t.title}</p>
                  {t.description && <p className="text-[10px] text-muted mt-0.5">{t.description}</p>}
                </div>
                <button onClick={() => cancelTask(t.id)} className="text-muted hover:text-danger transition-colors p-1">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed Tasks */}
      {completedTasks.length > 0 && (
        <div className="card border-success/10">
          <h2 className="text-sm font-bold flex items-center gap-2 mb-3">
            <CheckCircle size={14} className="text-success" /> Completed ({completedTasks.length})
          </h2>
          <div className="space-y-1.5">
            {completedTasks.slice(0, 10).map(t => (
              <div key={t.id} className="flex items-center gap-2 opacity-60">
                <CheckCircle size={12} className="text-success shrink-0" />
                <p className="text-xs line-through">{t.title}</p>
                <span className="text-[9px] text-muted ml-auto whitespace-nowrap">
                  {t.completed_at ? new Date(t.completed_at).toLocaleDateString() : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
