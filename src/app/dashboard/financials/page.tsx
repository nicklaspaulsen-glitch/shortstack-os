"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import Modal from "@/components/ui/modal";
import {
  DollarSign, TrendingUp, Users, Minus, Plus, Pencil, Trash2,
  PiggyBank, BarChart3, Receipt, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import toast from "react-hot-toast";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Expense {
  id: string;
  name: string;
  cost: number;
  interval: "monthly" | "annual";
  category: string;
}

interface ClientRow {
  mrr: number;
  is_active: boolean;
  created_at: string;
}

const STORAGE_KEY = "ss_expenses";

const EXPENSE_CATEGORIES = [
  "Infrastructure",
  "AI / LLM",
  "Payments",
  "Communication",
  "Marketing",
  "Domain / Hosting",
  "Analytics",
  "Other",
] as const;

const PRESET_EXPENSES: Omit<Expense, "id">[] = [
  { name: "Stripe", cost: 0, interval: "monthly", category: "Payments" },
  { name: "Supabase", cost: 25, interval: "monthly", category: "Infrastructure" },
  { name: "Vercel", cost: 20, interval: "monthly", category: "Infrastructure" },
  { name: "OpenAI", cost: 50, interval: "monthly", category: "AI / LLM" },
  { name: "Anthropic", cost: 60, interval: "monthly", category: "AI / LLM" },
  { name: "Google Cloud", cost: 30, interval: "monthly", category: "Infrastructure" },
  { name: "Twilio", cost: 25, interval: "monthly", category: "Communication" },
  { name: "Domain / Hosting", cost: 15, interval: "monthly", category: "Domain / Hosting" },
  { name: "ElevenLabs", cost: 22, interval: "monthly", category: "AI / LLM" },
  { name: "Resend", cost: 20, interval: "monthly", category: "Communication" },
  { name: "PostHog", cost: 0, interval: "monthly", category: "Analytics" },
  { name: "Zapier", cost: 20, interval: "monthly", category: "Marketing" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function loadExpenses(): Expense[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveExpenses(expenses: Expense[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
}

function monthlyEquivalent(expense: Expense): number {
  return expense.interval === "annual" ? expense.cost / 12 : expense.cost;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FinancialsPage() {
  useAuth();
  const supabase = createClient();

  // Revenue state
  const [clients, setClients] = useState<ClientRow[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [loading, setLoading] = useState(true);

  // Expense state
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<Omit<Expense, "id">>({
    name: "",
    cost: 0,
    interval: "monthly",
    category: "Other",
  });

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  useEffect(() => {
    setExpenses(loadExpenses());
    fetchClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchClients() {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      setLoading(true);
      const { data } = await supabase
        .from("clients")
        .select("mrr, is_active, created_at");
      setClients(data || []);
    } catch (err) {
      console.error("[Financials] fetchClients error:", err);
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Revenue calculations
  // ---------------------------------------------------------------------------

  const activeClients = useMemo(() => clients.filter((c) => c.is_active), [clients]);
  const totalMRR = useMemo(() => activeClients.reduce((s, c) => s + (c.mrr || 0), 0), [activeClients]);
  const avgRevenue = activeClients.length > 0 ? totalMRR / activeClients.length : 0;

  // ---------------------------------------------------------------------------
  // MRR trend (clients grouped by created_at month)
  // ---------------------------------------------------------------------------

  const mrrTrend = useMemo(() => {
    const buckets: Record<string, number> = {};
    const sorted = [...activeClients].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    sorted.forEach((c) => {
      const d = new Date(c.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      buckets[key] = (buckets[key] || 0) + (c.mrr || 0);
    });

    // Build cumulative MRR per month
    const months = Object.keys(buckets).sort();
    let cumulative = 0;
    return months.map((m) => {
      cumulative += buckets[m];
      const label = new Date(m + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      return { month: label, mrr: cumulative };
    });
  }, [activeClients]);

  // ---------------------------------------------------------------------------
  // Expense calculations
  // ---------------------------------------------------------------------------

  const totalMonthlyExpenses = useMemo(
    () => expenses.reduce((s, e) => s + monthlyEquivalent(e), 0),
    [expenses]
  );

  const netProfit = totalMRR - totalMonthlyExpenses;
  const marginPct = totalMRR > 0 ? (netProfit / totalMRR) * 100 : 0;

  // Category breakdown
  const categoryTotals = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach((e) => {
      map[e.category] = (map[e.category] || 0) + monthlyEquivalent(e);
    });
    return Object.entries(map)
      .map(([cat, total]) => ({ category: cat, total }))
      .sort((a, b) => b.total - a.total);
  }, [expenses]);

  // ---------------------------------------------------------------------------
  // Expense CRUD
  // ---------------------------------------------------------------------------

  function persistExpenses(next: Expense[]) {
    setExpenses(next);
    saveExpenses(next);
  }

  function openAdd() {
    setEditing(null);
    setForm({ name: "", cost: 0, interval: "monthly", category: "Other" });
    setShowModal(true);
  }

  function openEdit(exp: Expense) {
    setEditing(exp);
    setForm({ name: exp.name, cost: exp.cost, interval: exp.interval, category: exp.category });
    setShowModal(true);
  }

  function saveExpense() {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (form.cost < 0) {
      toast.error("Cost must be zero or positive");
      return;
    }
    if (editing) {
      const next = expenses.map((e) =>
        e.id === editing.id ? { ...e, ...form } : e
      );
      persistExpenses(next);
      toast.success("Expense updated");
    } else {
      persistExpenses([...expenses, { id: uid(), ...form }]);
      toast.success("Expense added");
    }
    setShowModal(false);
  }

  function deleteExpense(id: string) {
    persistExpenses(expenses.filter((e) => e.id !== id));
    toast.success("Expense removed");
  }

  function addPreset(preset: Omit<Expense, "id">) {
    if (expenses.some((e) => e.name === preset.name)) {
      toast.error(`${preset.name} already added`);
      return;
    }
    persistExpenses([...expenses, { id: uid(), ...preset }]);
    toast.success(`${preset.name} added`);
  }

  // ---------------------------------------------------------------------------
  // Visual bar helpers
  // ---------------------------------------------------------------------------

  const barMax = Math.max(totalMRR, totalMonthlyExpenses, 1);

  function barWidth(value: number): string {
    return `${Math.max((Math.abs(value) / barMax) * 100, 2)}%`;
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2">
            <PiggyBank size={18} className="text-gold" /> Financials
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Profit, expenses, and subscription tracking
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowPresets(!showPresets)}
            className="btn-secondary text-xs flex items-center gap-1.5"
          >
            <Receipt size={12} /> Presets
          </button>
          <button onClick={openAdd} className="btn-primary text-xs flex items-center gap-1.5">
            <Plus size={12} /> Add Expense
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Key Metrics                                                         */}
      {/* ------------------------------------------------------------------ */}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <div className="card p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <DollarSign size={12} className="text-gold" />
            <p className="text-[10px] text-muted uppercase tracking-wider">Monthly Revenue</p>
          </div>
          <p className="text-lg font-bold text-gold">{formatCurrency(totalMRR)}</p>
          <p className="text-[10px] text-muted mt-0.5">{activeClients.length} active clients</p>
        </div>

        <div className="card p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Minus size={12} className="text-red-400" />
            <p className="text-[10px] text-muted uppercase tracking-wider">Monthly Expenses</p>
          </div>
          <p className="text-lg font-bold text-red-400">{formatCurrency(totalMonthlyExpenses)}</p>
          <p className="text-[10px] text-muted mt-0.5">{expenses.length} subscriptions</p>
        </div>

        <div className="card p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp size={12} className={netProfit >= 0 ? "text-green-400" : "text-red-400"} />
            <p className="text-[10px] text-muted uppercase tracking-wider">Net Profit</p>
          </div>
          <p className={`text-lg font-bold ${netProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
            {formatCurrency(netProfit)}
          </p>
          <p className="text-[10px] text-muted mt-0.5 flex items-center gap-0.5">
            {marginPct >= 0 ? (
              <ArrowUpRight size={10} className="text-green-400" />
            ) : (
              <ArrowDownRight size={10} className="text-red-400" />
            )}
            {marginPct.toFixed(1)}% margin
          </p>
        </div>

        <div className="card p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Users size={12} className="text-blue-400" />
            <p className="text-[10px] text-muted uppercase tracking-wider">Avg / Client</p>
          </div>
          <p className="text-lg font-bold text-blue-400">{formatCurrency(avgRevenue)}</p>
          <p className="text-[10px] text-muted mt-0.5">{activeClients.length} clients</p>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Visual Breakdown Bar                                                */}
      {/* ------------------------------------------------------------------ */}

      <div className="card p-4">
        <p className="text-xs font-semibold mb-4 flex items-center gap-1.5">
          <BarChart3 size={13} className="text-gold" /> Revenue vs Expenses vs Profit
        </p>
        <div className="space-y-3">
          {/* Revenue bar */}
          <div>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-muted">Revenue</span>
              <span className="text-gold font-semibold">{formatCurrency(totalMRR)}</span>
            </div>
            <div className="h-5 rounded-lg bg-surface-light border border-border overflow-hidden">
              <div
                className="h-full rounded-lg bg-gold/70 transition-all duration-500"
                style={{ width: barWidth(totalMRR) }}
              />
            </div>
          </div>
          {/* Expenses bar */}
          <div>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-muted">Expenses</span>
              <span className="text-red-400 font-semibold">{formatCurrency(totalMonthlyExpenses)}</span>
            </div>
            <div className="h-5 rounded-lg bg-surface-light border border-border overflow-hidden">
              <div
                className="h-full rounded-lg bg-red-500/60 transition-all duration-500"
                style={{ width: barWidth(totalMonthlyExpenses) }}
              />
            </div>
          </div>
          {/* Profit bar */}
          <div>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-muted">Net Profit</span>
              <span className={`font-semibold ${netProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
                {formatCurrency(netProfit)}
              </span>
            </div>
            <div className="h-5 rounded-lg bg-surface-light border border-border overflow-hidden">
              <div
                className={`h-full rounded-lg transition-all duration-500 ${
                  netProfit >= 0 ? "bg-green-500/60" : "bg-red-500/60"
                }`}
                style={{ width: barWidth(netProfit) }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* MRR Trend                                                           */}
      {/* ------------------------------------------------------------------ */}

      {mrrTrend.length > 1 && (
        <div className="card p-4">
          <p className="text-xs font-semibold mb-3 flex items-center gap-1.5">
            <TrendingUp size={13} className="text-gold" /> MRR Growth Trend
          </p>
          <div className="flex items-end gap-1.5 h-32">
            {mrrTrend.map((item, i) => {
              const maxMRR = Math.max(...mrrTrend.map((t) => t.mrr), 1);
              const height = `${Math.max((item.mrr / maxMRR) * 100, 4)}%`;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[8px] text-muted">{formatCurrency(item.mrr)}</span>
                  <div className="w-full flex-1 flex items-end">
                    <div
                      className="w-full rounded-t-md bg-gold/60 transition-all duration-500 min-h-[4px]"
                      style={{ height }}
                    />
                  </div>
                  <span className="text-[8px] text-muted">{item.month}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Category Breakdown                                                  */}
      {/* ------------------------------------------------------------------ */}

      {categoryTotals.length > 0 && (
        <div className="card p-4">
          <p className="text-xs font-semibold mb-3 flex items-center gap-1.5">
            <Receipt size={13} className="text-gold" /> Expense Categories
          </p>
          <div className="space-y-2">
            {categoryTotals.map((cat) => (
              <div key={cat.category} className="flex items-center gap-3">
                <span className="text-[10px] text-muted w-28 shrink-0">{cat.category}</span>
                <div className="flex-1 h-3 rounded bg-surface-light border border-border overflow-hidden">
                  <div
                    className="h-full rounded bg-red-500/40 transition-all duration-500"
                    style={{
                      width: `${Math.max((cat.total / (totalMonthlyExpenses || 1)) * 100, 2)}%`,
                    }}
                  />
                </div>
                <span className="text-[10px] font-semibold text-foreground w-16 text-right">
                  {formatCurrency(cat.total)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Preset Drawer                                                       */}
      {/* ------------------------------------------------------------------ */}

      {showPresets && (
        <div className="card p-4">
          <p className="text-xs font-semibold mb-3">Quick-Add Presets</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {PRESET_EXPENSES.map((preset) => {
              const exists = expenses.some((e) => e.name === preset.name);
              return (
                <button
                  key={preset.name}
                  onClick={() => addPreset(preset)}
                  disabled={exists}
                  className={`text-left p-2.5 rounded-lg border text-xs transition-all ${
                    exists
                      ? "border-border/30 text-muted/40 cursor-not-allowed"
                      : "border-border hover:border-gold/30 hover:bg-gold/5"
                  }`}
                >
                  <p className="font-semibold">{preset.name}</p>
                  <p className="text-[10px] text-muted">
                    {preset.cost === 0 ? "Usage-based" : `${formatCurrency(preset.cost)}/mo`}
                    {" · "}
                    {preset.category}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Expense Table                                                       */}
      {/* ------------------------------------------------------------------ */}

      <div>
        <p className="section-header text-[10px] uppercase tracking-wider text-muted">
          Expense Subscriptions ({expenses.length})
        </p>

        {expenses.length === 0 ? (
          <div className="card text-center py-12">
            <Receipt size={24} className="mx-auto mb-2 text-muted/30" />
            <p className="text-xs text-muted">No expenses tracked yet</p>
            <p className="text-[10px] text-muted mt-1">
              Add your tool subscriptions to calculate real profit
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {/* Table header */}
            <div className="grid grid-cols-12 gap-2 px-4 py-2 text-[10px] text-muted uppercase tracking-wider font-semibold">
              <div className="col-span-4">Name</div>
              <div className="col-span-2">Category</div>
              <div className="col-span-2 text-right">Cost</div>
              <div className="col-span-2 text-right">Monthly</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>

            {expenses.map((exp) => (
              <div
                key={exp.id}
                className="grid grid-cols-12 gap-2 items-center px-4 py-2.5 rounded-xl bg-surface-light border border-border transition-all hover:border-border/80"
              >
                <div className="col-span-4">
                  <p className="text-sm font-semibold">{exp.name}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] border border-border text-muted">
                    {exp.category}
                  </span>
                </div>
                <div className="col-span-2 text-right">
                  <p className="text-sm">{formatCurrency(exp.cost)}</p>
                  <p className="text-[9px] text-muted">/{exp.interval === "annual" ? "yr" : "mo"}</p>
                </div>
                <div className="col-span-2 text-right">
                  <p className="text-sm font-semibold text-red-400">
                    {formatCurrency(monthlyEquivalent(exp))}
                  </p>
                </div>
                <div className="col-span-2 flex justify-end gap-1.5">
                  <button
                    onClick={() => openEdit(exp)}
                    className="p-1.5 rounded-md hover:bg-surface-light text-muted hover:text-foreground transition-colors"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={() => deleteExpense(exp.id)}
                    className="p-1.5 rounded-md hover:bg-red-500/10 text-muted hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}

            {/* Total row */}
            <div className="grid grid-cols-12 gap-2 px-4 py-2.5 border-t border-border mt-1">
              <div className="col-span-8 text-xs font-semibold text-muted">Total Monthly</div>
              <div className="col-span-2 text-right">
                <p className="text-sm font-bold text-red-400">{formatCurrency(totalMonthlyExpenses)}</p>
              </div>
              <div className="col-span-2" />
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Add / Edit Modal                                                    */}
      {/* ------------------------------------------------------------------ */}

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? "Edit Expense" : "Add Expense"}
        size="sm"
      >
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">
              Name *
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input w-full"
              placeholder="e.g. Supabase Pro"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">
                Cost *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-xs">$</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.cost}
                  onChange={(e) => setForm({ ...form, cost: parseFloat(e.target.value) || 0 })}
                  className="input w-full pl-7"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">
                Interval
              </label>
              <select
                value={form.interval}
                onChange={(e) =>
                  setForm({ ...form, interval: e.target.value as "monthly" | "annual" })
                }
                className="input w-full"
              >
                <option value="monthly">Monthly</option>
                <option value="annual">Annual</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">
              Category
            </label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="input w-full"
            >
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {form.interval === "annual" && form.cost > 0 && (
            <p className="text-[10px] text-muted bg-surface-light border border-border rounded-lg px-3 py-2">
              Monthly equivalent: <span className="text-gold font-semibold">{formatCurrency(form.cost / 12)}</span>/mo
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setShowModal(false)} className="btn-secondary text-xs">
              Cancel
            </button>
            <button onClick={saveExpense} className="btn-primary text-xs flex items-center gap-1.5">
              <DollarSign size={12} /> {editing ? "Update" : "Add Expense"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
