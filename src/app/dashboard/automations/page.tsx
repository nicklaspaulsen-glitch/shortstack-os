"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import PageHero from "@/components/ui/page-hero";
import toast from "react-hot-toast";
import Link from "next/link";
import {
  Zap, Plus, Search, ToggleLeft, ToggleRight,
  Clock, Play, Webhook, Mail, MessageCircle,
  Phone, Tag, GitBranch, RefreshCw, Loader
} from "lucide-react";

interface WorkflowNode {
  id: string;
  type: string;
  data?: { label?: string };
}

interface Workflow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  nodes: WorkflowNode[] | null;
  edges: unknown[] | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

const TRIGGER_ICONS: Record<string, React.ReactNode> = {
  webhook: <Webhook size={13} />,
  send_email: <Mail size={13} />,
  send_sms: <Phone size={13} />,
  send_telegram: <MessageCircle size={13} />,
  schedule: <Clock size={13} />,
  tag: <Tag size={13} />,
  condition: <GitBranch size={13} />,
};

function getTriggerType(nodes: WorkflowNode[] | null): string {
  if (!nodes || nodes.length === 0) return "manual";
  const first = nodes[0];
  return first.type || "trigger";
}

function getTriggerIcon(type: string): React.ReactNode {
  for (const [key, icon] of Object.entries(TRIGGER_ICONS)) {
    if (type.toLowerCase().includes(key)) return icon;
  }
  return <Zap size={13} />;
}

function fmtDate(d: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  }).format(new Date(d));
}

export default function AutomationsPage() {
  const supabase = createClient();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [toggling, setToggling] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("workflows")
      .select("*")
      .order("updated_at", { ascending: false });
    if (!error && data) setWorkflows(data as Workflow[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (!search) return workflows;
    const q = search.toLowerCase();
    return workflows.filter(
      w =>
        w.name.toLowerCase().includes(q) ||
        (w.description || "").toLowerCase().includes(q)
    );
  }, [workflows, search]);

  async function toggleActive(w: Workflow) {
    setToggling(w.id);
    const { error } = await supabase
      .from("workflows")
      .update({ active: !w.active })
      .eq("id", w.id);
    setToggling(null);
    if (error) { toast.error(error.message); return; }
    setWorkflows(prev =>
      prev.map(x => (x.id === w.id ? { ...x, active: !x.active } : x))
    );
    toast.success(w.active ? "Automation paused" : "Automation enabled");
  }

  const activeCount = workflows.filter(w => w.active).length;

  return (
    <div className="space-y-6">
      <PageHero
        title="Automations"
        subtitle="View and manage your workflow automations. Enable, pause, and jump to the builder."
        icon={<Zap size={22} />}
        gradient="gold"
        actions={
          <Link
            href="/dashboard/workflow-builder"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors border border-white/20"
          >
            <Plus size={15} /> New Automation
          </Link>
        }
      />

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total", value: workflows.length, color: "text-white" },
          { label: "Active", value: activeCount, color: "text-emerald-400" },
          { label: "Paused", value: workflows.length - activeCount, color: "text-yellow-400" },
        ].map(s => (
          <div
            key={s.label}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center"
          >
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-white/40 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search automations…"
          className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400/50"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-12 text-center">
          <Zap size={40} className="mx-auto mb-4 text-white/20" />
          <p className="text-white/60 mb-2">
            {search ? "No automations match your search." : "No automations yet."}
          </p>
          {!search && (
            <Link
              href="/dashboard/workflow-builder"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 text-sm font-medium transition-colors"
            >
              <Plus size={14} /> Create your first automation
            </Link>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="divide-y divide-white/5">
            {filtered.map(w => {
              const triggerType = getTriggerType(w.nodes);
              const stepCount = (w.nodes?.length || 0) + (Array.isArray(w.edges) ? w.edges.length : 0);
              return (
                <div
                  key={w.id}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-white/5 transition-colors"
                >
                  {/* Status indicator */}
                  <div
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      w.active ? "bg-emerald-400" : "bg-white/20"
                    }`}
                  />

                  {/* Name & meta */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium text-white text-sm truncate">
                        {w.name}
                      </span>
                      {/* Trigger chip */}
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/10 text-white/50 border border-white/10 shrink-0">
                        {getTriggerIcon(triggerType)}
                        {triggerType}
                      </span>
                    </div>
                    {w.description && (
                      <p className="text-xs text-white/40 truncate">{w.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-xs text-white/25">
                      {stepCount > 0 && (
                        <span className="flex items-center gap-1">
                          <Play size={9} /> {stepCount} step{stepCount !== 1 ? "s" : ""}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <RefreshCw size={9} /> Updated {fmtDate(w.updated_at)}
                      </span>
                    </div>
                  </div>

                  {/* Toggle + builder link */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href={`/dashboard/workflows`}
                      className="text-xs text-white/30 hover:text-white/60 px-2 py-1 rounded border border-white/10 hover:border-white/20 transition-colors"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => toggleActive(w)}
                      disabled={toggling === w.id}
                      className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                        w.active
                          ? "text-emerald-400 hover:bg-emerald-500/10"
                          : "text-white/30 hover:bg-white/10 hover:text-white/60"
                      }`}
                      title={w.active ? "Pause" : "Enable"}
                    >
                      {toggling === w.id ? (
                        <Loader size={16} className="animate-spin" />
                      ) : w.active ? (
                        <ToggleRight size={20} />
                      ) : (
                        <ToggleLeft size={20} />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer hint */}
      <p className="text-xs text-white/25 text-center">
        To build advanced automations with branching logic, use the{" "}
        <Link href="/dashboard/workflow-builder" className="text-white/40 hover:text-white/60 underline underline-offset-2">
          Workflow Builder
        </Link>
        .
      </p>
    </div>
  );
}
