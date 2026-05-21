"use client";

/**
 * Trinity proposals inbox + autonomous-mode settings.
 *
 *  - Mode toggle (Off / Shadow / Autopilot)
 *  - Veto window slider
 *  - Per-action enable toggles
 *  - List of pending proposals with Approve / Veto buttons
 *  - History tab for executed/vetoed/expired
 */

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Brain,
  CheckCircle,
  XCircle,
  Clock,
  Power,
  EyeOff,
  Plane,
  Save,
  Loader2,
  History,
} from "lucide-react";
import toast from "react-hot-toast";
import { MotionPage } from "@/components/motion/motion-page";

type Mode = "off" | "shadow" | "autopilot";

interface Settings {
  user_id: string;
  mode: Mode;
  enabled_actions: string[];
  veto_window_hours: number;
  daily_brief_email: string | null;
  updated_at: string | null;
}

interface ProposalRow {
  id: string;
  action_type: string;
  context: Record<string, unknown> | null;
  proposed_action: Record<string, unknown> | null;
  rationale: string | null;
  status: string;
  veto_window_until: string | null;
  executed_at: string | null;
  result: Record<string, unknown> | null;
  cost_usd: number;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  morning_brief: "Morning brief",
  pause_underperforming_ad: "Pause under-performing ad",
  launch_followup_email: "Launch follow-up email",
  boost_winning_ad: "Boost winning ad",
  recompute_lead_scores: "Recompute lead scores",
  generate_content_plan: "Weekly content plan",
};

const MODE_TILES: { mode: Mode; label: string; desc: string; icon: React.ReactNode }[] = [
  {
    mode: "off",
    label: "Off",
    desc: "Trinity makes no autonomous moves.",
    icon: <Power size={16} />,
  },
  {
    mode: "shadow",
    label: "Shadow",
    desc: "Trinity proposes — you approve before anything runs.",
    icon: <EyeOff size={16} />,
  },
  {
    mode: "autopilot",
    label: "Autopilot",
    desc: "Trinity acts after the veto window unless you stop it.",
    icon: <Plane size={16} />,
  },
];

const STATUS_COLOR: Record<string, string> = {
  proposed: "bg-amber-500/10 text-amber-700",
  approved: "bg-blue-500/10 text-blue-700",
  executed: "bg-emerald-500/10 text-emerald-700",
  vetoed: "bg-[rgba(0,0,0,0.06)] text-[#6B7280]",
  expired: "bg-[rgba(0,0,0,0.06)] text-[#6B7280]",
  failed: "bg-red-500/10 text-red-700",
};

const containerVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } };
const itemVariants = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.32, 0.72, 0, 1] as [number, number, number, number] } } };

export default function TrinityProposalsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [actionTypes, setActionTypes] = useState<string[]>([]);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [tab, setTab] = useState<"pending" | "history">("pending");
  const [proposals, setProposals] = useState<ProposalRow[]>([]);
  const [loadingProposals, setLoadingProposals] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const reloadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/trinity/settings");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { settings: Settings; action_types: string[] };
      setSettings(data.settings);
      setActionTypes(data.action_types ?? []);
    } catch (err) {
      console.error("[trinity/proposals] settings load failed", err);
    } finally {
      setLoadingSettings(false);
    }
  }, []);

  const reloadProposals = useCallback(async () => {
    setLoadingProposals(true);
    try {
      const status = tab === "pending" ? "proposed" : "";
      const res = await fetch(
        `/api/trinity/proposals${status ? `?status=${status}` : ""}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { proposals: ProposalRow[] };
      setProposals(data.proposals ?? []);
    } catch (err) {
      console.error("[trinity/proposals] load failed", err);
    } finally {
      setLoadingProposals(false);
    }
  }, [tab]);

  useEffect(() => {
    void reloadSettings();
  }, [reloadSettings]);
  useEffect(() => {
    void reloadProposals();
  }, [reloadProposals]);

  const updateSettings = async (patch: Partial<Settings>) => {
    setSavingSettings(true);
    try {
      const res = await fetch("/api/trinity/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { settings: Settings };
      setSettings(data.settings);
      toast.success("Settings saved");
    } catch (err) {
      console.error("[trinity/proposals] save failed", err);
      const msg = err instanceof Error ? err.message : "Failed to save";
      toast.error(msg);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleProposalAction = async (
    proposalId: string,
    action: "approve" | "veto",
  ) => {
    setActingId(proposalId);
    try {
      const res = await fetch(`/api/trinity/proposals/${proposalId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      toast.success(action === "approve" ? "Approved + executed" : "Vetoed");
      void reloadProposals();
    } catch (err) {
      console.error("[trinity/proposals] action failed", err);
      const msg = err instanceof Error ? err.message : "Failed";
      toast.error(msg);
    } finally {
      setActingId(null);
    }
  };

  const toggleEnabledAction = (action: string) => {
    if (!settings) return;
    const set = new Set(settings.enabled_actions);
    if (set.has(action)) set.delete(action);
    else set.add(action);
    void updateSettings({ enabled_actions: Array.from(set) });
  };

  return (
    <MotionPage className="space-y-5">{/* -- Trinity Autonomous command strip -- */}
    <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
      <div className="min-w-0">
        <p className="font-editorial text-[11px] italic text-text-muted mb-0.5">Trinity Proposals</p>
        <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-primary leading-none">Trinity Autonomous</h1>
      </div>
    </div>{/* Mode tiles */}<div className="grid gap-3 md:grid-cols-3">
              {MODE_TILES.map((t) => {
                const active = settings?.mode === t.mode;
                return (
                  <button
                    key={t.mode}
                    onClick={() => updateSettings({ mode: t.mode })}
                    disabled={loadingSettings || savingSettings}
                    className={`card text-left transition ${
                      active
                        ? "border-purple-500/40 bg-purple-500/10"
                        : "hover:border-purple-500/20"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={
                          active ? "text-purple-600" : "text-text-muted"
                        }
                      >
                        {t.icon}
                      </span>
                      <h3 className="text-sm font-bold text-[#111827]">{t.label}</h3>
                      {active && (
                        <span className="ml-auto rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold uppercase text-purple-700">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-text-muted">{t.desc}</p>
                  </button>
                );
              })}
            </div>{/* Enabled actions + veto window */}<div className="glass rounded-xl p-4">
              <h2 className="text-sm font-semibold text-[#111827]">Configure</h2>

              <div className="mt-4 space-y-2">
                <div className="text-xs text-text-muted">Enabled action types</div>
                <div className="flex flex-wrap gap-2">
                  {actionTypes.map((a) => {
                    const enabled = settings?.enabled_actions.includes(a) ?? false;
                    return (
                      <button
                        key={a}
                        onClick={() => toggleEnabledAction(a)}
                        disabled={savingSettings}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                          enabled
                            ? "bg-purple-100 text-purple-700 ring-1 ring-purple-300"
                            : "bg-[rgba(0,0,0,0.04)] text-text-muted hover:bg-[rgba(0,0,0,0.06)]"
                        }`}
                      >
                        {ACTION_LABELS[a] ?? a}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="veto-window"
                    className="block text-xs text-text-muted mb-1"
                  >
                    Autopilot veto window (hours)
                  </label>
                  <input
                    id="veto-window"
                    type="range"
                    min={0}
                    max={24}
                    step={1}
                    value={settings?.veto_window_hours ?? 4}
                    onChange={(e) =>
                      setSettings(
                        settings
                          ? { ...settings, veto_window_hours: Number(e.target.value) }
                          : settings,
                      )
                    }
                    onMouseUp={(e) =>
                      updateSettings({
                        veto_window_hours: Number((e.target as HTMLInputElement).value),
                      })
                    }
                    className="w-full"
                  />
                  <div className="text-xs text-text-muted mt-1">
                    {settings?.veto_window_hours ?? 4}h before autopilot fires.
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="brief-email"
                    className="block text-xs text-text-muted mb-1"
                  >
                    Morning brief email (optional)
                  </label>
                  <input
                    id="brief-email"
                    type="email"
                    value={settings?.daily_brief_email ?? ""}
                    onChange={(e) =>
                      setSettings(
                        settings
                          ? { ...settings, daily_brief_email: e.target.value || null }
                          : settings,
                      )
                    }
                    onBlur={(e) =>
                      updateSettings({
                        daily_brief_email: e.target.value || null,
                      })
                    }
                    placeholder="you@example.com"
                    className="w-full glass rounded-lg px-3 py-2 text-xs"
                  />
                </div>
              </div>

              {savingSettings && (
                <div className="mt-3 flex items-center gap-2 text-xs text-text-muted">
                  <Loader2 size={12} className="animate-spin" /> Saving...
                </div>
              )}
            </div>{/* Tabs */}<div className="flex items-center gap-1 rounded-lg border border-border-subtle bg-surface p-1">
              <button
                onClick={() => setTab("pending")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition ${
                  tab === "pending"
                    ? "bg-[rgba(59,130,246,0.08)] text-brand-accent"
                    : "text-text-muted hover:text-[#111827]"
                }`}
              >
                <Clock size={12} />
                Pending
              </button>
              <button
                onClick={() => setTab("history")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition ${
                  tab === "history"
                    ? "bg-[rgba(59,130,246,0.08)] text-brand-accent"
                    : "text-text-muted hover:text-[#111827]"
                }`}
              >
                <History size={12} />
                History
              </button>
            </div>{loadingProposals ? (
              <div className="py-12 text-center text-sm text-text-muted">Loading...</div>
            ) : proposals.length === 0 ? (
              <div className="glass rounded-xl p-4 flex flex-col items-center justify-center py-12 text-center">
                <Brain size={36} className="mb-3 text-text-muted/30" />
                <p className="text-sm font-medium text-[#111827]">
                  {tab === "pending" ? "No pending proposals" : "No history yet"}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  {tab === "pending"
                    ? "Trinity will post here when she has a recommendation."
                    : "Approved + vetoed proposals will appear here."}
                </p>
              </div>
            ) : (
              <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-3">
                {proposals.map((p) => {
                  const isPending = p.status === "proposed";
                  const acting = actingId === p.id;
                  return (
                    <motion.div key={p.id} variants={itemVariants} className="glass rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-[#111827]">
                              {ACTION_LABELS[p.action_type] ?? p.action_type}
                            </h3>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                STATUS_COLOR[p.status] ?? "bg-[rgba(0,0,0,0.06)] text-[#6B7280]"
                              }`}
                            >
                              {p.status}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-text-muted">
                            {new Date(p.created_at).toLocaleString()}
                          </p>
                        </div>
                        {isPending && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleProposalAction(p.id, "approve")}
                              disabled={acting}
                              className="flex items-center gap-1 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50"
                            >
                              {acting ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <CheckCircle size={12} />
                              )}
                              Approve
                            </button>
                            <button
                              onClick={() => handleProposalAction(p.id, "veto")}
                              disabled={acting}
                              className="flex items-center gap-1 rounded-lg border border-red-500/20 px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                            >
                              <XCircle size={12} />
                              Veto
                            </button>
                          </div>
                        )}
                      </div>
                      {p.rationale && (
                        <p className="mt-3 text-sm text-[#374151]">{p.rationale}</p>
                      )}
                      {p.veto_window_until && p.status === "proposed" && (
                        <p className="mt-2 text-[10px] text-text-muted">
                          Autopilot will execute after{" "}
                          {new Date(p.veto_window_until).toLocaleString()} unless
                          vetoed.
                        </p>
                      )}
                      {p.result && (
                        <pre className="mt-3 overflow-x-auto rounded-lg bg-[rgba(0,0,0,0.04)] border border-[rgba(0,0,0,0.08)] p-3 text-[10px] leading-relaxed text-[#374151]">
                          {JSON.stringify(p.result, null, 2)}
                        </pre>
                      )}
                    </motion.div>
                  );
                })}
              </motion.div>
            )}</MotionPage>
  );
}
