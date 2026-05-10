"use client";

import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import PageHero from "@/components/ui/page-hero";
import toast from "react-hot-toast";
import Link from "next/link";
import {
  Zap, Plus, Search, ToggleLeft, ToggleRight,
  Clock, Play, Webhook, Mail, MessageCircle,
  Phone, Tag, GitBranch, RefreshCw, Loader
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state-illustration";

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

const containerVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } };
const itemVariants = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.32, 0.72, 0, 1] as [number, number, number, number] } } };

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
        eyebrow="AUTOMATION ENGINE"
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/automations/library"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 text-sm font-medium transition-colors border border-indigo-500/20"
            >
              Browse template library
            </Link>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Link
                href="/dashboard/workflow-builder"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[rgba(0,0,0,0.06)] hover:bg-[rgba(0,0,0,0.10)] text-[#0A0A0B] text-sm font-medium transition-colors border border-[rgba(0,0,0,0.10)]"
              >
                <Plus size={15} /> New Automation
              </Link>
            </motion.div>
          </div>
        }
      />

      {/* Stats bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: "Total", value: workflows.length, color: "text-[#0A0A0B]" },
          { label: "Active", value: activeCount, color: "text-emerald-400" },
          { label: "Paused", value: workflows.length - activeCount, color: "text-indigo-400" },
        ].map((s, index) => (
          <motion.div
            key={s.label}
            className="glass rounded-xl px-4 py-3 text-center overflow-hidden relative"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: index * 0.06 }}
            whileHover={{ y: -2 }}
          >
            <div style={{ height: 3, background: "linear-gradient(90deg, #1D4ED8, #8b5cf6, #ec4899, #f97316, #1D4ED8)" }} />
            <p className={`text-2xl font-bold ${s.color} mt-2`}>{s.value}</p>
            <p className="text-xs text-[#71717A] mt-0.5">{s.label}</p>
            <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: 'rgba(0,0,0,0.08)' }} />
          </motion.div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71717A]" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search automations�"
          className="w-full glass rounded-lg pl-8 pr-3 py-2 text-[#0A0A0B] text-sm focus:outline-none focus:border-indigo-500/50"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 rounded-xl bg-[rgba(0,0,0,0.04)] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          type="no-campaigns"
          title={search ? "No automations found" : "No automations yet"}
          description={
            search
              ? "Try a different search term."
              : "Build workflows that run automatically � trigger actions on new leads, replies, form fills, and more."
          }
          action={
            !search ? (
              <Link
                href="/dashboard/workflow-builder"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 text-sm font-medium transition-colors border border-indigo-500/20"
              >
                <Plus size={14} /> Create your first automation
              </Link>
            ) : undefined
          }
        />
      ) : (
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="glass rounded-xl overflow-hidden">
          <div className="divide-y divide-[rgba(0,0,0,0.06)]">
            {filtered.map((w) => {
              const triggerType = getTriggerType(w.nodes);
              const stepCount = (w.nodes?.length || 0) + (Array.isArray(w.edges) ? w.edges.length : 0);
              return (
                <motion.div
                  key={w.id}
                  className="flex items-center gap-4 px-5 py-4 transition-colors"
                  variants={itemVariants}
                  whileHover={{ backgroundColor: "rgba(0,0,0,0.04)" }}
                >
                  {/* Status indicator */}
                  <div
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      w.active ? "bg-emerald-500" : "bg-[rgba(0,0,0,0.16)]"
                    }`}
                  />

                  {/* Name & meta */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium text-[#0A0A0B] text-sm truncate">
                        {w.name}
                      </span>
                      {/* Trigger chip */}
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[rgba(0,0,0,0.06)] text-[#52525B] border border-[rgba(0,0,0,0.08)] shrink-0">
                        {getTriggerIcon(triggerType)}
                        {triggerType}
                      </span>
                    </div>
                    {w.description && (
                      <p className="text-xs text-[#71717A] truncate">{w.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-xs text-[#71717A]">
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
                      className="text-xs text-[#52525B] hover:text-[#0A0A0B] px-2 py-1 rounded border border-[rgba(0,0,0,0.08)] hover:border-[rgba(0,0,0,0.16)] transition-colors"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => toggleActive(w)}
                      disabled={toggling === w.id}
                      className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                        w.active
                          ? "text-emerald-400 hover:bg-emerald-500/10"
                          : "text-[#71717A] hover:bg-[rgba(0,0,0,0.06)] hover:text-[#52525B]"
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
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Footer hint */}
      <p className="text-xs text-[#71717A] text-center">
        To build advanced automations with branching logic, use the{" "}
        <Link href="/dashboard/workflow-builder" className="text-[#52525B] hover:text-[#0A0A0B] underline underline-offset-2">
          Workflow Builder
        </Link>
        .
      </p>
    </div>
  );
}
