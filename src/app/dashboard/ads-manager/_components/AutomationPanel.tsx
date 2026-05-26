"use client";

/**
 * AutomationPanel — Revealbot automation rules management.
 *
 * Lists all rules, lets the user enable/disable, delete, and create new
 * rules. Each rule has conditions (field + operator + value + time_range)
 * and actions (pause, enable, adjust budget).
 *
 * Talks to:
 *   GET    /api/ads/revealbot/rules          — list rules
 *   POST   /api/ads/revealbot/rules          — create rule
 *   GET    /api/ads/revealbot/accounts       — populate account picker
 *   PATCH  /api/ads/revealbot/rules/[id]     — enable / disable
 *   DELETE /api/ads/revealbot/rules/[id]     — delete
 *   GET    /api/ads/revealbot/rules/[id]     — execution history
 */

import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Trash,
  CircleNotch,
  ArrowsClockwise,
  CaretDown,
  CaretRight,
  CheckCircle,
  XCircle,
  ToggleLeft,
  ToggleRight,
  ClockCounterClockwise,
  Lightning,
  WarningCircle,
} from "@phosphor-icons/react";
import toast from "react-hot-toast";

// ── Types (mirrored from revealbot-client.ts) ───────────────────────────────
type AutomationField =
  | "spend"
  | "impressions"
  | "clicks"
  | "conversions"
  | "ctr"
  | "roas"
  | "cpa"
  | "reach"
  | "frequency"
  | "cpc"
  | "cpm";

type AutomationOperator =
  | "greater_than"
  | "less_than"
  | "equals"
  | "not_equals"
  | "greater_than_or_equal"
  | "less_than_or_equal";

type AutomationTimeRange =
  | "today"
  | "yesterday"
  | "last_7_days"
  | "last_14_days"
  | "last_30_days"
  | "this_month"
  | "last_month"
  | "lifetime";

type AutomationActionType =
  | "pause"
  | "enable"
  | "increase_budget"
  | "decrease_budget"
  | "set_budget"
  | "send_notification";

interface AutomationCondition {
  field: AutomationField;
  operator: AutomationOperator;
  value: number;
  time_range?: AutomationTimeRange;
}

interface AutomationAction {
  type: AutomationActionType;
  value?: number;
  notification_message?: string;
}

interface RevealbotRule {
  id: string;
  name: string;
  entity_type: "campaign" | "ad_set" | "ad";
  ad_account_id: string;
  status: "enabled" | "disabled";
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  created_at: string;
  updated_at?: string;
}

interface RevealbotExecution {
  id: string;
  rule_id: string;
  status: "success" | "failure" | "skipped";
  affected_entities: number;
  executed_at: string;
  error?: string | null;
}

interface RevealbotAccount {
  id: string;
  name: string;
  platform: string;
}

// ── Constants ───────────────────────────────────────────────────────────────
const FIELD_LABELS: Record<AutomationField, string> = {
  spend: "Spend",
  impressions: "Impressions",
  clicks: "Clicks",
  conversions: "Conversions",
  ctr: "CTR",
  roas: "ROAS",
  cpa: "CPA",
  reach: "Reach",
  frequency: "Frequency",
  cpc: "CPC",
  cpm: "CPM",
};

const OPERATOR_LABELS: Record<AutomationOperator, string> = {
  greater_than: ">",
  less_than: "<",
  equals: "=",
  not_equals: "≠",
  greater_than_or_equal: "≥",
  less_than_or_equal: "≤",
};

const TIME_RANGE_LABELS: Record<AutomationTimeRange, string> = {
  today: "Today",
  yesterday: "Yesterday",
  last_7_days: "Last 7 days",
  last_14_days: "Last 14 days",
  last_30_days: "Last 30 days",
  this_month: "This month",
  last_month: "Last month",
  lifetime: "Lifetime",
};

const ACTION_LABELS: Record<AutomationActionType, string> = {
  pause: "Pause",
  enable: "Enable",
  increase_budget: "Increase budget",
  decrease_budget: "Decrease budget",
  set_budget: "Set budget to",
  send_notification: "Send notification",
};

const ACTION_NEEDS_VALUE: Record<AutomationActionType, boolean> = {
  pause: false,
  enable: false,
  increase_budget: true,
  decrease_budget: true,
  set_budget: true,
  send_notification: false,
};

// ── Blank condition / action for new-rule form ───────────────────────────────
const blankCondition = (): AutomationCondition => ({
  field: "spend",
  operator: "greater_than",
  value: 0,
  time_range: "last_7_days",
});

const blankAction = (): AutomationAction => ({ type: "pause" });

// ── Helpers ──────────────────────────────────────────────────────────────────
function summariseConditions(conditions: AutomationCondition[]): string {
  return conditions
    .map(
      (c) =>
        `${FIELD_LABELS[c.field]} ${OPERATOR_LABELS[c.operator]} ${c.value}${c.time_range ? ` (${TIME_RANGE_LABELS[c.time_range]})` : ""}`,
    )
    .join(" AND ");
}

function summariseActions(actions: AutomationAction[]): string {
  return actions
    .map((a) => {
      const label = ACTION_LABELS[a.type];
      if (a.type === "increase_budget" || a.type === "decrease_budget") {
        return `${label} by ${a.value ?? 0}%`;
      }
      if (a.type === "set_budget") return `${label} $${a.value ?? 0}`;
      if (a.type === "send_notification")
        return `${label}${a.notification_message ? `: "${a.notification_message}"` : ""}`;
      return label;
    })
    .join(", ");
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

// ── Main component ───────────────────────────────────────────────────────────
export default function AutomationPanel() {
  const [rules, setRules] = useState<RevealbotRule[]>([]);
  const [accounts, setAccounts] = useState<RevealbotAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [notConnected, setNotConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Execution history
  const [historyRuleId, setHistoryRuleId] = useState<string | null>(null);
  const [executions, setExecutions] = useState<RevealbotExecution[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadRules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ads/revealbot/rules");
      if (res.status === 400) {
        setNotConnected(true);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { rules: RevealbotRule[] };
      setRules(data.rules ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load rules");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/ads/revealbot/accounts");
      if (!res.ok) return;
      const data = (await res.json()) as { accounts: RevealbotAccount[] };
      setAccounts(data.accounts ?? []);
    } catch {
      // non-fatal — account picker degrades to manual input
    }
  }, []);

  useEffect(() => {
    void loadRules();
    void loadAccounts();
  }, [loadRules, loadAccounts]);

  const toggleRule = async (rule: RevealbotRule) => {
    const next = rule.status === "enabled" ? "disabled" : "enabled";
    setTogglingId(rule.id);
    try {
      const res = await fetch(`/api/ads/revealbot/rules/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error || "Toggle failed");
      }
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, status: next } : r)),
      );
      toast.success(`Rule ${next}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Toggle failed");
    } finally {
      setTogglingId(null);
    }
  };

  const deleteRule = async (ruleId: string) => {
    setDeletingId(ruleId);
    try {
      const res = await fetch(`/api/ads/revealbot/rules/${ruleId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error || "Delete failed");
      }
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
      if (historyRuleId === ruleId) setHistoryRuleId(null);
      toast.success("Rule deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  const showHistory = async (ruleId: string) => {
    if (historyRuleId === ruleId) {
      setHistoryRuleId(null);
      return;
    }
    setHistoryRuleId(ruleId);
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/ads/revealbot/rules/${ruleId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        executions: RevealbotExecution[];
      };
      setExecutions(data.executions ?? []);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not load history",
      );
      setHistoryRuleId(null);
    } finally {
      setLoadingHistory(false);
    }
  };

  // ── Not-connected empty state ────────────────────────────────────────────
  if (!loading && notConnected) {
    return (
      <div className="glass-panel rounded-xl py-16 flex flex-col items-center text-center gap-3">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{
            background: "rgba(124,92,252,0.10)",
            border: "1px solid rgba(124,92,252,0.22)",
          }}
        >
          <Lightning size={22} style={{ color: "#7C5CFC" }} />
        </div>
        <p className="text-sm font-semibold text-text-primary">
          Revealbot not connected
        </p>
        <p className="text-xs text-text-muted max-w-xs">
          Connect your Revealbot account in the{" "}
          <strong className="text-text-primary">Connect</strong> tab, then
          return here to manage automation rules.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => void loadRules()}
          disabled={loading}
          className="bg-[rgba(13,17,32,0.7)] border border-border-subtle rounded px-2.5 py-1.5 text-xs hover:bg-[rgba(212,255,0,0.06)] inline-flex items-center gap-1.5 disabled:opacity-50 text-text-muted"
        >
          <ArrowsClockwise size={12} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>

        <button
          onClick={() => setShowCreate((v) => !v)}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition"
          style={{
            background: showCreate
              ? "rgba(124,92,252,0.18)"
              : "rgba(124,92,252,0.12)",
            border: "1px solid rgba(124,92,252,0.28)",
            color: "#7C5CFC",
          }}
        >
          <Plus size={13} />
          New Rule
        </button>
      </div>

      {/* ── Create form ─────────────────────────────────────────────────── */}
      {showCreate && (
        <CreateRuleForm
          accounts={accounts}
          onCreated={(newRule) => {
            setRules((prev) => [newRule, ...prev]);
            setShowCreate(false);
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {/* ── Rules list ──────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-text-muted text-sm gap-2">
          <CircleNotch className="animate-spin" size={16} />
          Loading rules…
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      ) : rules.length === 0 ? (
        <div className="glass-panel rounded-xl py-12 flex flex-col items-center text-center gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{
              background: "rgba(124,92,252,0.10)",
              border: "1px solid rgba(124,92,252,0.22)",
            }}
          >
            <Lightning size={22} style={{ color: "#7C5CFC" }} />
          </div>
          <p className="text-sm text-text-muted">No automation rules yet.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="text-[11px] font-semibold px-3 py-1.5 rounded-lg transition"
            style={{
              background: "rgba(124,92,252,0.14)",
              border: "1px solid rgba(124,92,252,0.28)",
              color: "#7C5CFC",
            }}
          >
            Create your first rule
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <div key={rule.id} className="glass-panel rounded-xl overflow-hidden">
              {/* Rule header row */}
              <div className="flex items-start gap-3 px-4 py-3">
                {/* Toggle */}
                <button
                  onClick={() => void toggleRule(rule)}
                  disabled={togglingId === rule.id}
                  className="mt-0.5 shrink-0 transition disabled:opacity-50"
                  title={rule.status === "enabled" ? "Disable rule" : "Enable rule"}
                >
                  {togglingId === rule.id ? (
                    <CircleNotch
                      size={18}
                      className="animate-spin text-text-muted"
                    />
                  ) : rule.status === "enabled" ? (
                    <ToggleRight size={20} style={{ color: "#7C5CFC" }} />
                  ) : (
                    <ToggleLeft size={20} className="text-text-muted/50" />
                  )}
                </button>

                {/* Name + summary */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-semibold text-text-primary truncate">
                      {rule.name}
                    </span>
                    <span
                      className="text-[9.5px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                      style={{
                        background: "rgba(124,92,252,0.12)",
                        color: "#7C5CFC",
                        border: "1px solid rgba(124,92,252,0.22)",
                      }}
                    >
                      {rule.entity_type.replace("_", " ")}
                    </span>
                    {rule.status === "disabled" && (
                      <span className="text-[9.5px] font-semibold uppercase tracking-wider text-text-muted/60">
                        Disabled
                      </span>
                    )}
                  </div>

                  <p className="text-[10.5px] text-text-muted mt-1 truncate">
                    <strong className="text-text-primary/70">If</strong>{" "}
                    {summariseConditions(rule.conditions)}{" "}
                    <strong className="text-text-primary/70">→</strong>{" "}
                    {summariseActions(rule.actions)}
                  </p>

                  <p className="text-[9.5px] text-text-muted/60 mt-1">
                    Created {formatDate(rule.created_at)} · Account{" "}
                    <code className="font-mono">{rule.ad_account_id}</code>
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <button
                    onClick={() => void showHistory(rule.id)}
                    className="rounded border border-border-subtle bg-[rgba(13,17,32,0.7)] px-2 py-1 text-[10px] text-text-muted hover:text-text-primary hover:bg-[rgba(212,255,0,0.06)] flex items-center gap-1"
                    title="View execution history"
                  >
                    <ClockCounterClockwise size={11} />
                    History
                    {historyRuleId === rule.id ? (
                      <CaretDown size={9} />
                    ) : (
                      <CaretRight size={9} />
                    )}
                  </button>

                  <button
                    onClick={() => void deleteRule(rule.id)}
                    disabled={deletingId === rule.id}
                    className="rounded border border-red-500/20 bg-red-500/05 px-2 py-1 text-[10px] text-red-400 hover:bg-red-500/10 disabled:opacity-50 flex items-center gap-1"
                    title="Delete rule"
                  >
                    {deletingId === rule.id ? (
                      <CircleNotch size={11} className="animate-spin" />
                    ) : (
                      <Trash size={11} />
                    )}
                  </button>
                </div>
              </div>

              {/* Execution history panel */}
              {historyRuleId === rule.id && (
                <div
                  className="border-t px-4 py-3 space-y-2"
                  style={{ borderColor: "rgba(124,92,252,0.14)" }}
                >
                  <p className="text-[10.5px] font-semibold text-text-muted uppercase tracking-wider">
                    Execution history
                  </p>
                  {loadingHistory ? (
                    <div className="flex items-center gap-2 text-xs text-text-muted py-2">
                      <CircleNotch size={12} className="animate-spin" />
                      Loading…
                    </div>
                  ) : executions.length === 0 ? (
                    <p className="text-xs text-text-muted py-2">
                      No executions recorded yet.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {executions.map((ex) => (
                        <div
                          key={ex.id}
                          className="flex items-center gap-2 text-[10.5px]"
                        >
                          {ex.status === "success" ? (
                            <CheckCircle
                              size={12}
                              className="shrink-0 text-emerald-400"
                            />
                          ) : ex.status === "failure" ? (
                            <XCircle
                              size={12}
                              className="shrink-0 text-red-400"
                            />
                          ) : (
                            <WarningCircle
                              size={12}
                              className="shrink-0 text-amber-400"
                            />
                          )}
                          <span className="text-text-muted/70">
                            {formatDate(ex.executed_at)}
                          </span>
                          <span
                            className={
                              ex.status === "success"
                                ? "text-emerald-400"
                                : ex.status === "failure"
                                  ? "text-red-400"
                                  : "text-amber-400"
                            }
                          >
                            {ex.status}
                          </span>
                          <span className="text-text-muted">
                            {ex.affected_entities} entit
                            {ex.affected_entities === 1 ? "y" : "ies"} affected
                          </span>
                          {ex.error && (
                            <span className="text-red-400/70 truncate">
                              {ex.error}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Create rule form ─────────────────────────────────────────────────────────
interface CreateRuleFormProps {
  accounts: RevealbotAccount[];
  onCreated: (rule: RevealbotRule) => void;
  onCancel: () => void;
}

function CreateRuleForm({ accounts, onCreated, onCancel }: CreateRuleFormProps) {
  const [name, setName] = useState("");
  const [entityType, setEntityType] = useState<"campaign" | "ad_set" | "ad">("campaign");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [manualAccountId, setManualAccountId] = useState("");
  const [conditions, setConditions] = useState<AutomationCondition[]>([
    blankCondition(),
  ]);
  const [actions, setActions] = useState<AutomationAction[]>([blankAction()]);
  const [saving, setSaving] = useState(false);

  const effectiveAccountId =
    accounts.length > 0 ? accountId : manualAccountId;

  const addCondition = () =>
    setConditions((prev) => [...prev, blankCondition()]);
  const removeCondition = (i: number) =>
    setConditions((prev) => prev.filter((_, idx) => idx !== i));
  const updateCondition = (
    i: number,
    patch: Partial<AutomationCondition>,
  ) =>
    setConditions((prev) =>
      prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)),
    );

  const addAction = () =>
    setActions((prev) => [...prev, blankAction()]);
  const removeAction = (i: number) =>
    setActions((prev) => prev.filter((_, idx) => idx !== i));
  const updateAction = (i: number, patch: Partial<AutomationAction>) =>
    setActions((prev) =>
      prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)),
    );

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Give the rule a name");
      return;
    }
    if (!effectiveAccountId.trim()) {
      toast.error("Select or enter an ad account ID");
      return;
    }
    if (conditions.length === 0) {
      toast.error("Add at least one condition");
      return;
    }
    if (actions.length === 0) {
      toast.error("Add at least one action");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/ads/revealbot/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          entity_type: entityType,
          ad_account_id: effectiveAccountId.trim(),
          conditions,
          actions,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          (data as { error?: string }).error || "Failed to create rule",
        );
      }
      toast.success("Rule created!");
      onCreated((data as { rule: RevealbotRule }).rule);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  };

  const fieldClass =
    "bg-[rgba(13,17,32,0.9)] border border-border-subtle rounded px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:border-[rgba(124,92,252,0.45)]";

  return (
    <div
      className="rounded-xl p-5 space-y-5"
      style={{
        background: "rgba(124,92,252,0.04)",
        border: "1px solid rgba(124,92,252,0.20)",
      }}
    >
      <p className="text-[13px] font-semibold text-text-primary">
        New automation rule
      </p>

      {/* Rule name */}
      <div className="space-y-1.5">
        <label className="text-[10.5px] font-semibold uppercase tracking-wider text-text-muted">
          Rule name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Pause low-ROAS campaigns"
          className={fieldClass + " w-full"}
        />
      </div>

      {/* Entity type + account */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[10.5px] font-semibold uppercase tracking-wider text-text-muted">
            Apply to
          </label>
          <select
            value={entityType}
            onChange={(e) =>
              setEntityType(e.target.value as typeof entityType)
            }
            className={fieldClass + " w-full"}
          >
            <option value="campaign">Campaigns</option>
            <option value="ad_set">Ad Sets</option>
            <option value="ad">Ads</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10.5px] font-semibold uppercase tracking-wider text-text-muted">
            Ad account
          </label>
          {accounts.length > 0 ? (
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className={fieldClass + " w-full"}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name || a.id}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={manualAccountId}
              onChange={(e) => setManualAccountId(e.target.value)}
              placeholder="act_123456789"
              className={fieldClass + " w-full font-mono text-xs"}
            />
          )}
        </div>
      </div>

      {/* Conditions */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[10.5px] font-semibold uppercase tracking-wider text-text-muted">
            Conditions (IF)
          </label>
          <button
            onClick={addCondition}
            className="text-[10px] text-text-muted hover:text-text-primary flex items-center gap-1"
          >
            <Plus size={10} /> Add
          </button>
        </div>
        {conditions.map((cond, i) => (
          <div key={i} className="flex items-center gap-2 flex-wrap">
            <select
              value={cond.field}
              onChange={(e) =>
                updateCondition(i, { field: e.target.value as AutomationField })
              }
              className={fieldClass + " min-w-0 flex-1"}
            >
              {(Object.keys(FIELD_LABELS) as AutomationField[]).map((f) => (
                <option key={f} value={f}>
                  {FIELD_LABELS[f]}
                </option>
              ))}
            </select>
            <select
              value={cond.operator}
              onChange={(e) =>
                updateCondition(i, {
                  operator: e.target.value as AutomationOperator,
                })
              }
              className={fieldClass + " w-20"}
            >
              {(Object.keys(OPERATOR_LABELS) as AutomationOperator[]).map(
                (op) => (
                  <option key={op} value={op}>
                    {OPERATOR_LABELS[op]}
                  </option>
                ),
              )}
            </select>
            <input
              type="number"
              step="any"
              value={cond.value}
              onChange={(e) =>
                updateCondition(i, { value: Number(e.target.value) })
              }
              className={fieldClass + " w-20 tabular-nums"}
            />
            <select
              value={cond.time_range ?? ""}
              onChange={(e) =>
                updateCondition(i, {
                  time_range: (e.target.value || undefined) as
                    | AutomationTimeRange
                    | undefined,
                })
              }
              className={fieldClass + " flex-1 min-w-0"}
            >
              <option value="">No time range</option>
              {(Object.keys(TIME_RANGE_LABELS) as AutomationTimeRange[]).map(
                (tr) => (
                  <option key={tr} value={tr}>
                    {TIME_RANGE_LABELS[tr]}
                  </option>
                ),
              )}
            </select>
            {conditions.length > 1 && (
              <button
                onClick={() => removeCondition(i)}
                className="text-text-muted/50 hover:text-red-400 transition"
                title="Remove condition"
              >
                <XCircle size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[10.5px] font-semibold uppercase tracking-wider text-text-muted">
            Actions (THEN)
          </label>
          <button
            onClick={addAction}
            className="text-[10px] text-text-muted hover:text-text-primary flex items-center gap-1"
          >
            <Plus size={10} /> Add
          </button>
        </div>
        {actions.map((action, i) => (
          <div key={i} className="flex items-center gap-2 flex-wrap">
            <select
              value={action.type}
              onChange={(e) => {
                const type = e.target.value as AutomationActionType;
                updateAction(i, {
                  type,
                  value: ACTION_NEEDS_VALUE[type] ? (action.value ?? 10) : undefined,
                });
              }}
              className={fieldClass + " flex-1 min-w-0"}
            >
              {(Object.keys(ACTION_LABELS) as AutomationActionType[]).map(
                (at) => (
                  <option key={at} value={at}>
                    {ACTION_LABELS[at]}
                  </option>
                ),
              )}
            </select>
            {ACTION_NEEDS_VALUE[action.type] && (
              <>
                <input
                  type="number"
                  step="any"
                  value={action.value ?? ""}
                  onChange={(e) =>
                    updateAction(i, { value: Number(e.target.value) })
                  }
                  placeholder="0"
                  className={fieldClass + " w-20 tabular-nums"}
                />
                <span className="text-[10.5px] text-text-muted">
                  {action.type === "set_budget" ? "$" : "%"}
                </span>
              </>
            )}
            {action.type === "send_notification" && (
              <input
                type="text"
                value={action.notification_message ?? ""}
                onChange={(e) =>
                  updateAction(i, { notification_message: e.target.value })
                }
                placeholder="Message…"
                className={fieldClass + " flex-1"}
              />
            )}
            {actions.length > 1 && (
              <button
                onClick={() => removeAction(i)}
                className="text-text-muted/50 hover:text-red-400 transition"
                title="Remove action"
              >
                <XCircle size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Buttons */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => void handleSubmit()}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition disabled:opacity-50"
          style={{
            background: "rgba(124,92,252,0.22)",
            border: "1px solid rgba(124,92,252,0.40)",
            color: "#7C5CFC",
          }}
        >
          {saving && <CircleNotch size={12} className="animate-spin" />}
          {saving ? "Creating…" : "Create rule"}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-xs text-text-muted hover:text-text-primary border border-border-subtle bg-[rgba(13,17,32,0.5)] transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
