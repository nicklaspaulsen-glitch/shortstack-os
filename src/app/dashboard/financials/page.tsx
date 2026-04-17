"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import Modal from "@/components/ui/modal";
import {
  DollarSign, TrendingUp, Users, Minus, Plus, Pencil, Trash2,
  PiggyBank, BarChart3, Receipt, ArrowUpRight, ArrowDownRight,
  FileText, Download,
  RefreshCw, CheckCircle, Globe, AlertTriangle, Zap, Shield,
  Layers, CreditCard, Calendar, Clock, Target, Percent,
} from "lucide-react";
import toast from "react-hot-toast";
import { StripeIcon, PayPalIcon, SquareIcon } from "@/components/ui/platform-icons";

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

  // Tab state
  const [activeTab, setActiveTab] = useState<"overview" | "expenses" | "invoicing" | "forecasting" | "export">("overview");

  // Expense state
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showModal, setShowModal] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  // Invoice aging mock data
  // ---------------------------------------------------------------------------

  const [invoices] = useState<{ id: string; client: string; amount: number; due: string; status: "overdue" | "due_soon" | "pending" | "paid" }[]>([]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const invoiceTotals = useMemo(() => {
    const overdue = invoices.filter(i => i.status === "overdue").reduce((s, i) => s + i.amount, 0);
    const dueSoon = invoices.filter(i => i.status === "due_soon").reduce((s, i) => s + i.amount, 0);
    const pending = invoices.filter(i => i.status === "pending").reduce((s, i) => s + i.amount, 0);
    const paid = invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0);
    return { overdue, dueSoon, pending, paid };
  }, [invoices]);

  // ---------------------------------------------------------------------------
  // Revenue by plan tier
  // ---------------------------------------------------------------------------

  const revenueByTier = useMemo(() => {
    const tiers = [
      { name: "Starter", price: 497, count: 0, color: "bg-blue-400" },
      { name: "Growth", price: 997, count: 0, color: "bg-green-400" },
      { name: "Pro", price: 2497, count: 0, color: "bg-purple-400" },
      { name: "Business", price: 4997, count: 0, color: "bg-gold" },
      { name: "Unlimited", price: 9997, count: 0, color: "bg-red-400" },
    ];
    activeClients.forEach(c => {
      const mrr = c.mrr || 0;
      const tier = tiers.find(t => t.price === mrr);
      if (tier) tier.count++;
      else {
        const closest = tiers.reduce((prev, curr) =>
          Math.abs(curr.price - mrr) < Math.abs(prev.price - mrr) ? curr : prev
        );
        closest.count++;
      }
    });
    return tiers.map(t => ({ ...t, revenue: t.count * t.price }));
  }, [activeClients]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const totalTierRevenue = revenueByTier.reduce((s, t) => s + t.revenue, 0);

  // ---------------------------------------------------------------------------
  // Payment method distribution mock
  // ---------------------------------------------------------------------------

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [paymentMethods] = useState<{ method: string; count: number; pct: number }[]>([]);

  // ---------------------------------------------------------------------------
  // Financial forecasting
  // ---------------------------------------------------------------------------

  const [forecastMonths] = useState(6);
  const [monthlyGrowthRate] = useState(8);
  const [monthlyChurnRate] = useState(3);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const forecast = useMemo(() => {
    const months: { month: string; projected: number; expenses: number; profit: number }[] = [];
    let currentMRR = totalMRR;
    const now = new Date();
    for (let i = 1; i <= forecastMonths; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const label = date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      const growth = currentMRR * (monthlyGrowthRate / 100);
      const churn = currentMRR * (monthlyChurnRate / 100);
      currentMRR = currentMRR + growth - churn;
      const expenseGrowth = totalMonthlyExpenses * (1 + (i * 0.02));
      months.push({
        month: label,
        projected: Math.round(currentMRR),
        expenses: Math.round(expenseGrowth),
        profit: Math.round(currentMRR - expenseGrowth),
      });
    }
    return months;
  }, [totalMRR, totalMonthlyExpenses, forecastMonths, monthlyGrowthRate, monthlyChurnRate]);

  // Budget vs Actual
  const [budgets] = useState([
    { category: "Infrastructure", budget: 200, actual: 0 },
    { category: "AI / LLM", budget: 300, actual: 0 },
    { category: "Communication", budget: 100, actual: 0 },
    { category: "Marketing", budget: 150, actual: 0 },
    { category: "Domain / Hosting", budget: 50, actual: 0 },
    { category: "Analytics", budget: 50, actual: 0 },
    { category: "Payments", budget: 50, actual: 0 },
  ]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const budgetsWithActual = useMemo(() => {
    return budgets.map(b => {
      const actual = expenses
        .filter(e => e.category === b.category)
        .reduce((s, e) => s + monthlyEquivalent(e), 0);
      return { ...b, actual, variance: b.budget - actual };
    });
  }, [budgets, expenses]);

  // Client Lifetime Value
  const avgClientLifeMonths = 14;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const clv = avgRevenue * avgClientLifeMonths;

  // ARR & Churn
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const annualRecurringRevenue = totalMRR * 12;
  const churnedThisMonth = clients.filter(c => !c.is_active).length;
  const totalClients = clients.length;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const churnRate = totalClients > 0 ? (churnedThisMonth / totalClients) * 100 : 0;

  // Tax estimate
  const estimatedTaxRate = 25;
  const annualProfit = netProfit * 12;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const estimatedTax = annualProfit > 0 ? annualProfit * (estimatedTaxRate / 100) : 0;

  // Stripe sync state
  const [stripeSynced] = useState(false);
  const [lastSyncTime] = useState<string | null>(null);

  // Export state
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [exportFormat, setExportFormat] = useState<"csv" | "pdf" | "xlsx">("csv");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [exportRange, setExportRange] = useState<"month" | "quarter" | "year" | "all">("month");

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

  const TABS = [
    { id: "overview" as const, label: "Overview", icon: BarChart3 },
    { id: "expenses" as const, label: "Expenses", icon: Receipt },
    { id: "invoicing" as const, label: "Invoicing", icon: FileText },
    { id: "forecasting" as const, label: "Forecasting", icon: TrendingUp },
    { id: "export" as const, label: "Export", icon: Download },
  ];

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2">
            <PiggyBank size={18} className="text-gold" /> Financials
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Revenue, expenses, invoicing, and financial planning
          </p>
        </div>
        <div className="flex gap-2">
          {!stripeSynced ? (
            <button onClick={() => toast("Connect Stripe in Settings > Integrations")} className="btn-secondary text-xs flex items-center gap-1.5">
              <StripeIcon size={14} /> Connect Stripe
            </button>
          ) : (
            <span className="text-[10px] text-green-400 flex items-center gap-1">
              <CheckCircle size={10} /> Synced {lastSyncTime || "just now"}
            </span>
          )}
          {activeTab === "expenses" && (
            <button onClick={openAdd} className="btn-primary text-xs flex items-center gap-1.5">
              <Plus size={12} /> Add Expense
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border pb-0">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg transition-colors ${
              activeTab === tab.id
                ? "bg-surface-light text-gold border border-border border-b-transparent -mb-px"
                : "text-muted hover:text-foreground"
            }`}
          >
            <tab.icon size={12} /> {tab.label}
          </button>
        ))}
      </div>

      {/* ================================================================== */}
      {/* OVERVIEW TAB                                                        */}
      {/* ================================================================== */}

      {activeTab === "overview" && (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <div className="card p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <DollarSign size={12} className="text-gold" />
                <p className="text-[10px] text-muted uppercase tracking-wider">MRR</p>
              </div>
              <p className="text-lg font-bold text-gold">{formatCurrency(totalMRR)}</p>
              <p className="text-[10px] text-muted mt-0.5">{activeClients.length} active clients</p>
            </div>

            <div className="card p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Globe size={12} className="text-blue-400" />
                <p className="text-[10px] text-muted uppercase tracking-wider">ARR</p>
              </div>
              <p className="text-lg font-bold text-blue-400">{formatCurrency(annualRecurringRevenue)}</p>
              <p className="text-[10px] text-muted mt-0.5">annualized</p>
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
                <AlertTriangle size={12} className={churnRate > 5 ? "text-red-400" : "text-yellow-400"} />
                <p className="text-[10px] text-muted uppercase tracking-wider">Churn Rate</p>
              </div>
              <p className={`text-lg font-bold ${churnRate > 5 ? "text-red-400" : "text-yellow-400"}`}>
                {churnRate.toFixed(1)}%
              </p>
              <p className="text-[10px] text-muted mt-0.5">{churnedThisMonth} churned / {totalClients} total</p>
            </div>
          </div>

          {/* Extended Metrics Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
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
                <Users size={12} className="text-purple-400" />
                <p className="text-[10px] text-muted uppercase tracking-wider">Avg / Client</p>
              </div>
              <p className="text-lg font-bold text-purple-400">{formatCurrency(avgRevenue)}</p>
              <p className="text-[10px] text-muted mt-0.5">{activeClients.length} clients</p>
            </div>

            <div className="card p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Zap size={12} className="text-gold" />
                <p className="text-[10px] text-muted uppercase tracking-wider">Client LTV</p>
              </div>
              <p className="text-lg font-bold text-gold">{formatCurrency(clv)}</p>
              <p className="text-[10px] text-muted mt-0.5">avg {avgClientLifeMonths} months</p>
            </div>

            <div className="card p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Shield size={12} className="text-orange-400" />
                <p className="text-[10px] text-muted uppercase tracking-wider">Est. Annual Tax</p>
              </div>
              <p className="text-lg font-bold text-orange-400">{formatCurrency(estimatedTax)}</p>
              <p className="text-[10px] text-muted mt-0.5">{estimatedTaxRate}% effective rate</p>
            </div>
          </div>

          {/* Revenue vs Expenses Bar */}
          <div className="card p-4">
            <p className="text-xs font-semibold mb-4 flex items-center gap-1.5">
              <BarChart3 size={13} className="text-gold" /> Revenue vs Expenses vs Profit
            </p>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-muted">Revenue</span>
                  <span className="text-gold font-semibold">{formatCurrency(totalMRR)}</span>
                </div>
                <div className="h-5 rounded-lg bg-surface-light border border-border overflow-hidden">
                  <div className="h-full rounded-lg bg-gold/70 transition-all duration-500" style={{ width: barWidth(totalMRR) }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-muted">Expenses</span>
                  <span className="text-red-400 font-semibold">{formatCurrency(totalMonthlyExpenses)}</span>
                </div>
                <div className="h-5 rounded-lg bg-surface-light border border-border overflow-hidden">
                  <div className="h-full rounded-lg bg-red-500/60 transition-all duration-500" style={{ width: barWidth(totalMonthlyExpenses) }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-muted">Net Profit</span>
                  <span className={`font-semibold ${netProfit >= 0 ? "text-green-400" : "text-red-400"}`}>{formatCurrency(netProfit)}</span>
                </div>
                <div className="h-5 rounded-lg bg-surface-light border border-border overflow-hidden">
                  <div className={`h-full rounded-lg transition-all duration-500 ${netProfit >= 0 ? "bg-green-500/60" : "bg-red-500/60"}`} style={{ width: barWidth(netProfit) }} />
                </div>
              </div>
            </div>
          </div>

          {/* MRR Trend */}
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
                        <div className="w-full rounded-t-md bg-gold/60 transition-all duration-500 min-h-[4px]" style={{ height }} />
                      </div>
                      <span className="text-[8px] text-muted">{item.month}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Revenue by Plan Tier */}
          <div className="card p-4">
            <p className="text-xs font-semibold mb-3 flex items-center gap-1.5">
              <Layers size={13} className="text-gold" /> Revenue by Plan Tier
            </p>
            <div className="space-y-2">
              {revenueByTier.map(tier => (
                <div key={tier.name} className="flex items-center gap-3">
                  <span className="text-[10px] text-muted w-20 shrink-0">{tier.name}</span>
                  <div className="flex-1 h-4 rounded bg-surface-light border border-border overflow-hidden">
                    <div
                      className={`h-full rounded ${tier.color}/60 transition-all duration-500`}
                      style={{ width: `${totalTierRevenue > 0 ? Math.max((tier.revenue / totalTierRevenue) * 100, 2) : 2}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted w-8 text-center">{tier.count}</span>
                  <span className="text-[10px] font-semibold text-foreground w-20 text-right">{formatCurrency(tier.revenue)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Method Distribution */}
          <div className="card p-4">
            <p className="text-xs font-semibold mb-3 flex items-center gap-1.5">
              <CreditCard size={13} className="text-gold" /> Payment Method Distribution
            </p>
            {paymentMethods.length === 0 ? (
              <p className="text-xs text-muted text-center py-6">Connect Stripe to see payment method data</p>
            ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              {paymentMethods.map(pm => (
                <div key={pm.method} className="bg-surface-light border border-border rounded-lg p-3">
                  <p className="text-[10px] text-muted">{pm.method}</p>
                  <p className="text-lg font-bold text-foreground">{pm.count}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <div className="flex-1 h-1.5 rounded bg-surface border border-border overflow-hidden">
                      <div className="h-full rounded bg-gold/60" style={{ width: `${pm.pct}%` }} />
                    </div>
                    <span className="text-[9px] text-muted">{pm.pct}%</span>
                  </div>
                </div>
              ))}
            </div>
            )}
          </div>
        </>
      )}

      {/* ================================================================== */}
      {/* EXPENSES TAB                                                        */}
      {/* ================================================================== */}

      {activeTab === "expenses" && (
        <>
          {/* Expense Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <div className="card p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Minus size={12} className="text-red-400" />
                <p className="text-[10px] text-muted uppercase tracking-wider">Monthly Total</p>
              </div>
              <p className="text-lg font-bold text-red-400">{formatCurrency(totalMonthlyExpenses)}</p>
            </div>
            <div className="card p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Calendar size={12} className="text-orange-400" />
                <p className="text-[10px] text-muted uppercase tracking-wider">Annual Total</p>
              </div>
              <p className="text-lg font-bold text-orange-400">{formatCurrency(totalMonthlyExpenses * 12)}</p>
            </div>
            <div className="card p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Layers size={12} className="text-blue-400" />
                <p className="text-[10px] text-muted uppercase tracking-wider">Categories</p>
              </div>
              <p className="text-lg font-bold text-blue-400">{categoryTotals.length}</p>
            </div>
            <div className="card p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Percent size={12} className={marginPct >= 0 ? "text-green-400" : "text-red-400"} />
                <p className="text-[10px] text-muted uppercase tracking-wider">Profit Margin</p>
              </div>
              <p className={`text-lg font-bold ${marginPct >= 0 ? "text-green-400" : "text-red-400"}`}>{marginPct.toFixed(1)}%</p>
            </div>
          </div>

          {/* Budget vs Actual */}
          <div className="card p-4">
            <p className="text-xs font-semibold mb-3 flex items-center gap-1.5">
              <Target size={13} className="text-gold" /> Budget vs Actual
            </p>
            <div className="space-y-2.5">
              {budgetsWithActual.map(b => (
                <div key={b.category} className="flex items-center gap-3">
                  <span className="text-[10px] text-muted w-28 shrink-0">{b.category}</span>
                  <div className="flex-1 relative">
                    <div className="h-4 rounded bg-surface-light border border-border overflow-hidden">
                      <div
                        className={`h-full rounded transition-all duration-500 ${b.actual > b.budget ? "bg-red-500/60" : "bg-green-500/40"}`}
                        style={{ width: `${Math.min((b.actual / (b.budget || 1)) * 100, 100)}%` }}
                      />
                    </div>
                    {b.budget > 0 && (
                      <div
                        className="absolute top-0 h-4 w-0.5 bg-gold/80"
                        style={{ left: `${Math.min(100, 100)}%` }}
                      />
                    )}
                  </div>
                  <span className="text-[10px] text-muted w-16 text-right">{formatCurrency(b.actual)}</span>
                  <span className="text-[10px] text-muted w-2">/</span>
                  <span className="text-[10px] font-semibold text-foreground w-16">{formatCurrency(b.budget)}</span>
                  <span className={`text-[10px] w-16 text-right font-semibold ${b.variance >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {b.variance >= 0 ? "+" : ""}{formatCurrency(b.variance)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Category Breakdown */}
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
                      <div className="h-full rounded bg-red-500/40 transition-all duration-500" style={{ width: `${Math.max((cat.total / (totalMonthlyExpenses || 1)) * 100, 2)}%` }} />
                    </div>
                    <span className="text-[10px] font-semibold text-foreground w-16 text-right">{formatCurrency(cat.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preset Drawer */}
          <div className="flex gap-2 mb-2">
            <button onClick={() => setShowPresets(!showPresets)} className="btn-secondary text-xs flex items-center gap-1.5">
              <Receipt size={12} /> {showPresets ? "Hide Presets" : "Quick-Add Presets"}
            </button>
          </div>

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
                        exists ? "border-border/30 text-muted/40 cursor-not-allowed" : "border-border hover:border-gold/30 hover:bg-gold/5"
                      }`}
                    >
                      <p className="font-semibold">{preset.name}</p>
                      <p className="text-[10px] text-muted">
                        {preset.cost === 0 ? "Usage-based" : `${formatCurrency(preset.cost)}/mo`} · {preset.category}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Expense Table */}
          <div>
            <p className="section-header text-[10px] uppercase tracking-wider text-muted">
              Expense Subscriptions ({expenses.length})
            </p>

            {expenses.length === 0 ? (
              <div className="card text-center py-12">
                <Receipt size={24} className="mx-auto mb-2 text-muted/30" />
                <p className="text-xs text-muted">No expenses tracked yet</p>
                <p className="text-[10px] text-muted mt-1">Add your tool subscriptions to calculate real profit</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="grid grid-cols-12 gap-2 px-4 py-2 text-[10px] text-muted uppercase tracking-wider font-semibold">
                  <div className="col-span-4">Name</div>
                  <div className="col-span-2">Category</div>
                  <div className="col-span-2 text-right">Cost</div>
                  <div className="col-span-2 text-right">Monthly</div>
                  <div className="col-span-2 text-right">Actions</div>
                </div>
                {expenses.map((exp) => (
                  <div key={exp.id} className="grid grid-cols-12 gap-2 items-center px-4 py-2.5 rounded-xl bg-surface-light border border-border transition-all hover:border-border/80">
                    <div className="col-span-4"><p className="text-sm font-semibold">{exp.name}</p></div>
                    <div className="col-span-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] border border-border text-muted">{exp.category}</span>
                    </div>
                    <div className="col-span-2 text-right">
                      <p className="text-sm">{formatCurrency(exp.cost)}</p>
                      <p className="text-[9px] text-muted">/{exp.interval === "annual" ? "yr" : "mo"}</p>
                    </div>
                    <div className="col-span-2 text-right">
                      <p className="text-sm font-semibold text-red-400">{formatCurrency(monthlyEquivalent(exp))}</p>
                    </div>
                    <div className="col-span-2 flex justify-end gap-1.5">
                      <button onClick={() => openEdit(exp)} className="p-1.5 rounded-md hover:bg-surface-light text-muted hover:text-foreground transition-colors"><Pencil size={12} /></button>
                      <button onClick={() => deleteExpense(exp.id)} className="p-1.5 rounded-md hover:bg-red-500/10 text-muted hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
                    </div>
                  </div>
                ))}
                <div className="grid grid-cols-12 gap-2 px-4 py-2.5 border-t border-border mt-1">
                  <div className="col-span-8 text-xs font-semibold text-muted">Total Monthly</div>
                  <div className="col-span-2 text-right"><p className="text-sm font-bold text-red-400">{formatCurrency(totalMonthlyExpenses)}</p></div>
                  <div className="col-span-2" />
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ================================================================== */}
      {/* INVOICING TAB                                                       */}
      {/* ================================================================== */}

      {activeTab === "invoicing" && (
        <>
          {/* Invoice Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <div className="card p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle size={12} className="text-red-400" />
                <p className="text-[10px] text-muted uppercase tracking-wider">Overdue</p>
              </div>
              <p className="text-lg font-bold text-red-400">{formatCurrency(invoiceTotals.overdue)}</p>
              <p className="text-[10px] text-muted mt-0.5">{invoices.filter(i => i.status === "overdue").length} invoices</p>
            </div>
            <div className="card p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Clock size={12} className="text-yellow-400" />
                <p className="text-[10px] text-muted uppercase tracking-wider">Due Soon</p>
              </div>
              <p className="text-lg font-bold text-yellow-400">{formatCurrency(invoiceTotals.dueSoon)}</p>
              <p className="text-[10px] text-muted mt-0.5">{invoices.filter(i => i.status === "due_soon").length} invoices</p>
            </div>
            <div className="card p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <FileText size={12} className="text-blue-400" />
                <p className="text-[10px] text-muted uppercase tracking-wider">Pending</p>
              </div>
              <p className="text-lg font-bold text-blue-400">{formatCurrency(invoiceTotals.pending)}</p>
              <p className="text-[10px] text-muted mt-0.5">{invoices.filter(i => i.status === "pending").length} invoices</p>
            </div>
            <div className="card p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <CheckCircle size={12} className="text-green-400" />
                <p className="text-[10px] text-muted uppercase tracking-wider">Paid</p>
              </div>
              <p className="text-lg font-bold text-green-400">{formatCurrency(invoiceTotals.paid)}</p>
              <p className="text-[10px] text-muted mt-0.5">{invoices.filter(i => i.status === "paid").length} invoices</p>
            </div>
          </div>

          {/* Invoice Aging Chart */}
          <div className="card p-4">
            <p className="text-xs font-semibold mb-3 flex items-center gap-1.5">
              <Clock size={13} className="text-gold" /> Invoice Aging Report
            </p>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {[
                { label: "Current (0-30)", amount: invoiceTotals.pending + invoiceTotals.dueSoon, color: "bg-green-400" },
                { label: "31-60 Days", amount: invoiceTotals.overdue * 0.4, color: "bg-yellow-400" },
                { label: "61-90 Days", amount: invoiceTotals.overdue * 0.35, color: "bg-orange-400" },
                { label: "90+ Days", amount: invoiceTotals.overdue * 0.25, color: "bg-red-400" },
              ].map(bucket => (
                <div key={bucket.label} className="text-center">
                  <div className="h-20 flex items-end justify-center mb-1">
                    <div
                      className={`w-full max-w-[60px] rounded-t-md ${bucket.color}/60`}
                      style={{ height: `${Math.max((bucket.amount / (invoiceTotals.overdue + invoiceTotals.pending + invoiceTotals.dueSoon || 1)) * 100, 8)}%` }}
                    />
                  </div>
                  <p className="text-[9px] text-muted">{bucket.label}</p>
                  <p className="text-[10px] font-semibold text-foreground">{formatCurrency(bucket.amount)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Invoice List */}
          <div>
            <p className="section-header text-[10px] uppercase tracking-wider text-muted">
              All Invoices ({invoices.length})
            </p>
            {invoices.length === 0 ? (
              <div className="card text-center py-12">
                <FileText size={24} className="mx-auto mb-2 text-muted/30" />
                <p className="text-xs text-muted">No invoices yet. Connect Stripe or create invoices to track here.</p>
              </div>
            ) : (
            <div className="space-y-1.5">
              <div className="grid grid-cols-12 gap-2 px-4 py-2 text-[10px] text-muted uppercase tracking-wider font-semibold">
                <div className="col-span-2">Invoice</div>
                <div className="col-span-3">Client</div>
                <div className="col-span-2 text-right">Amount</div>
                <div className="col-span-3">Due Date</div>
                <div className="col-span-2 text-right">Status</div>
              </div>
              {invoices.map(inv => (
                <div key={inv.id} className="grid grid-cols-12 gap-2 items-center px-4 py-2.5 rounded-xl bg-surface-light border border-border transition-all hover:border-border/80">
                  <div className="col-span-2"><p className="text-xs font-mono font-semibold">{inv.id}</p></div>
                  <div className="col-span-3"><p className="text-sm">{inv.client}</p></div>
                  <div className="col-span-2 text-right"><p className="text-sm font-semibold">{formatCurrency(inv.amount)}</p></div>
                  <div className="col-span-3"><p className="text-xs text-muted">{inv.due}</p></div>
                  <div className="col-span-2 text-right">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                      inv.status === "paid" ? "text-green-400 border-green-400/30 bg-green-400/10" :
                      inv.status === "overdue" ? "text-red-400 border-red-400/30 bg-red-400/10" :
                      inv.status === "due_soon" ? "text-yellow-400 border-yellow-400/30 bg-yellow-400/10" :
                      "text-blue-400 border-blue-400/30 bg-blue-400/10"
                    }`}>
                      {inv.status === "due_soon" ? "Due Soon" : inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <button onClick={() => toast.success("Invoice created (demo)")} className="card-hover p-3 text-left">
              <Plus size={14} className="text-gold mb-1.5" />
              <p className="text-xs font-semibold">Create Invoice</p>
              <p className="text-[10px] text-muted">Generate new invoice</p>
            </button>
            <button onClick={() => toast.success("Reminders sent (demo)")} className="card-hover p-3 text-left">
              <RefreshCw size={14} className="text-blue-400 mb-1.5" />
              <p className="text-xs font-semibold">Send Reminders</p>
              <p className="text-[10px] text-muted">Nudge overdue invoices</p>
            </button>
            <button onClick={() => toast.success("Recurring invoice set up (demo)")} className="card-hover p-3 text-left">
              <Calendar size={14} className="text-purple-400 mb-1.5" />
              <p className="text-xs font-semibold">Recurring Invoice</p>
              <p className="text-[10px] text-muted">Set up auto-billing</p>
            </button>
            <button onClick={() => toast.success("Batch export started (demo)")} className="card-hover p-3 text-left">
              <Download size={14} className="text-green-400 mb-1.5" />
              <p className="text-xs font-semibold">Export Invoices</p>
              <p className="text-[10px] text-muted">Download as PDF/CSV</p>
            </button>
          </div>
        </>
      )}

      {/* ================================================================== */}
      {/* FORECASTING TAB                                                     */}
      {/* ================================================================== */}

      {activeTab === "forecasting" && (
        <>
          {/* Forecast Config */}
          <div className="card p-4">
            <p className="text-xs font-semibold mb-3 flex items-center gap-1.5">
              <Target size={13} className="text-gold" /> Forecast Parameters
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Forecast Period</label>
                <p className="text-sm font-semibold text-foreground">{forecastMonths} months</p>
              </div>
              <div>
                <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Monthly Growth Rate</label>
                <p className="text-sm font-semibold text-green-400">{monthlyGrowthRate}%</p>
              </div>
              <div>
                <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Monthly Churn Rate</label>
                <p className="text-sm font-semibold text-red-400">{monthlyChurnRate}%</p>
              </div>
            </div>
          </div>

          {/* Forecast Chart */}
          <div className="card p-4">
            <p className="text-xs font-semibold mb-3 flex items-center gap-1.5">
              <TrendingUp size={13} className="text-gold" /> Revenue Forecast ({forecastMonths}-Month)
            </p>
            <div className="flex items-end gap-2 h-40">
              {forecast.map((item, i) => {
                const maxVal = Math.max(...forecast.map(f => f.projected), 1);
                const height = `${Math.max((item.projected / maxVal) * 100, 4)}%`;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[8px] text-muted">{formatCurrency(item.projected)}</span>
                    <div className="w-full flex-1 flex items-end">
                      <div className="w-full rounded-t-md bg-gold/50 transition-all duration-500 min-h-[4px]" style={{ height }} />
                    </div>
                    <span className="text-[8px] text-muted">{item.month}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Forecast Table */}
          <div className="card p-4">
            <p className="text-xs font-semibold mb-3 flex items-center gap-1.5">
              <BarChart3 size={13} className="text-gold" /> Projected P&L
            </p>
            <div className="space-y-1.5">
              <div className="grid grid-cols-4 gap-2 px-3 py-2 text-[10px] text-muted uppercase tracking-wider font-semibold">
                <div>Month</div>
                <div className="text-right">Revenue</div>
                <div className="text-right">Expenses</div>
                <div className="text-right">Net Profit</div>
              </div>
              {forecast.map((item, i) => (
                <div key={i} className="grid grid-cols-4 gap-2 px-3 py-2 rounded-lg bg-surface-light border border-border">
                  <div className="text-xs font-semibold">{item.month}</div>
                  <div className="text-xs text-right text-gold">{formatCurrency(item.projected)}</div>
                  <div className="text-xs text-right text-red-400">{formatCurrency(item.expenses)}</div>
                  <div className={`text-xs text-right font-semibold ${item.profit >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {formatCurrency(item.profit)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Key Projections */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
            <div className="card p-3">
              <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Projected MRR ({forecastMonths}mo)</p>
              <p className="text-lg font-bold text-gold">{formatCurrency(forecast[forecast.length - 1]?.projected || 0)}</p>
            </div>
            <div className="card p-3">
              <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Projected ARR ({forecastMonths}mo)</p>
              <p className="text-lg font-bold text-blue-400">{formatCurrency((forecast[forecast.length - 1]?.projected || 0) * 12)}</p>
            </div>
            <div className="card p-3">
              <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Cumulative Profit</p>
              <p className={`text-lg font-bold ${forecast.reduce((s, f) => s + f.profit, 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                {formatCurrency(forecast.reduce((s, f) => s + f.profit, 0))}
              </p>
            </div>
          </div>

          {/* Tax Summary */}
          <div className="card p-4">
            <p className="text-xs font-semibold mb-3 flex items-center gap-1.5">
              <Shield size={13} className="text-gold" /> Tax Summary (Estimated)
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <p className="text-[10px] text-muted">Annual Revenue</p>
                <p className="text-sm font-bold text-gold">{formatCurrency(annualRecurringRevenue)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted">Annual Expenses</p>
                <p className="text-sm font-bold text-red-400">{formatCurrency(totalMonthlyExpenses * 12)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted">Taxable Income</p>
                <p className="text-sm font-bold text-foreground">{formatCurrency(annualProfit)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted">Estimated Tax ({estimatedTaxRate}%)</p>
                <p className="text-sm font-bold text-orange-400">{formatCurrency(estimatedTax)}</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ================================================================== */}
      {/* EXPORT TAB                                                          */}
      {/* ================================================================== */}

      {activeTab === "export" && (
        <>
          {/* Export Config */}
          <div className="card p-4">
            <p className="text-xs font-semibold mb-4 flex items-center gap-1.5">
              <Download size={13} className="text-gold" /> Financial Export
            </p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Format</label>
                <div className="flex gap-2">
                  {(["csv", "pdf", "xlsx"] as const).map(fmt => (
                    <button
                      key={fmt}
                      onClick={() => setExportFormat(fmt)}
                      className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                        exportFormat === fmt ? "border-gold bg-gold/10 text-gold" : "border-border text-muted hover:text-foreground"
                      }`}
                    >
                      {fmt.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Date Range</label>
                <div className="flex gap-2">
                  {(["month", "quarter", "year", "all"] as const).map(range => (
                    <button
                      key={range}
                      onClick={() => setExportRange(range)}
                      className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                        exportRange === range ? "border-gold bg-gold/10 text-gold" : "border-border text-muted hover:text-foreground"
                      }`}
                    >
                      {range.charAt(0).toUpperCase() + range.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Export Types */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
            {[
              { label: "Revenue Report", desc: "MRR, ARR, growth trends", icon: TrendingUp, color: "text-gold" },
              { label: "Expense Report", desc: "All tracked subscriptions", icon: Receipt, color: "text-red-400" },
              { label: "Profit & Loss", desc: "Full P&L statement", icon: BarChart3, color: "text-green-400" },
              { label: "Invoice Report", desc: "All invoices & aging", icon: FileText, color: "text-blue-400" },
              { label: "Tax Summary", desc: "Tax-ready financials", icon: Shield, color: "text-orange-400" },
              { label: "Client Revenue", desc: "Revenue by client/tier", icon: Users, color: "text-purple-400" },
            ].map(report => (
              <button
                key={report.label}
                onClick={() => toast.success(`${report.label} exported as ${exportFormat.toUpperCase()} (demo)`)}
                className="card-hover p-4 text-left"
              >
                <report.icon size={16} className={`${report.color} mb-2`} />
                <p className="text-xs font-semibold">{report.label}</p>
                <p className="text-[10px] text-muted mt-0.5">{report.desc}</p>
                <p className="text-[10px] text-gold mt-2 flex items-center gap-1">
                  <Download size={10} /> Export {exportFormat.toUpperCase()}
                </p>
              </button>
            ))}
          </div>

          {/* Payment Processors */}
          <div className="card p-4">
            <p className="text-xs font-semibold mb-3 flex items-center gap-1.5">
              <CreditCard size={13} className="text-gold" /> Payment Processors
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Stripe */}
              <div className="p-3 rounded-lg border border-border bg-surface-light">
                <div className="flex items-center gap-2 mb-2">
                  <StripeIcon size={22} />
                  <div>
                    <p className="text-xs font-semibold">Stripe</p>
                    <p className="text-[9px] text-muted">
                      {stripeSynced ? `Synced ${lastSyncTime || "just now"}` : "Not connected"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => toast(stripeSynced ? "Syncing..." : "Configure Stripe in Settings > Integrations")}
                  className="w-full text-[10px] py-1.5 rounded bg-gold/10 text-gold hover:bg-gold/20 transition-all flex items-center justify-center gap-1"
                >
                  <RefreshCw size={10} /> {stripeSynced ? "Sync Now" : "Connect"}
                </button>
              </div>
              {/* PayPal */}
              <div className="p-3 rounded-lg border border-border bg-surface-light">
                <div className="flex items-center gap-2 mb-2">
                  <PayPalIcon size={22} />
                  <div>
                    <p className="text-xs font-semibold">PayPal</p>
                    <p className="text-[9px] text-muted">Not connected</p>
                  </div>
                </div>
                <button
                  onClick={() => toast("Configure PayPal in Settings > Integrations")}
                  className="w-full text-[10px] py-1.5 rounded border border-border text-muted hover:text-foreground hover:border-foreground/30 transition-all flex items-center justify-center gap-1"
                >
                  <Plus size={10} /> Connect
                </button>
              </div>
              {/* Square */}
              <div className="p-3 rounded-lg border border-border bg-surface-light">
                <div className="flex items-center gap-2 mb-2">
                  <SquareIcon size={22} />
                  <div>
                    <p className="text-xs font-semibold">Square</p>
                    <p className="text-[9px] text-muted">Not connected</p>
                  </div>
                </div>
                <button
                  onClick={() => toast("Configure Square in Settings > Integrations")}
                  className="w-full text-[10px] py-1.5 rounded border border-border text-muted hover:text-foreground hover:border-foreground/30 transition-all flex items-center justify-center gap-1"
                >
                  <Plus size={10} /> Connect
                </button>
              </div>
            </div>
          </div>

          {/* Import Section */}
          <div className="card p-4">
            <p className="text-xs font-semibold mb-3 flex items-center gap-1.5">
              <FileText size={13} className="text-gold" /> Import Financial Data
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => toast.success("CSV import started (demo)")} className="p-4 rounded-lg border-2 border-dashed border-border hover:border-gold/30 transition-colors text-center">
                <FileText size={20} className="mx-auto mb-2 text-muted" />
                <p className="text-xs font-semibold">Import CSV</p>
                <p className="text-[10px] text-muted mt-0.5">Upload expense/revenue CSV</p>
              </button>
              <button onClick={() => toast.success("QuickBooks import started (demo)")} className="p-4 rounded-lg border-2 border-dashed border-border hover:border-gold/30 transition-colors text-center">
                <Globe size={20} className="mx-auto mb-2 text-muted" />
                <p className="text-xs font-semibold">QuickBooks Import</p>
                <p className="text-[10px] text-muted mt-0.5">Sync from QuickBooks</p>
              </button>
            </div>
          </div>
        </>
      )}

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
