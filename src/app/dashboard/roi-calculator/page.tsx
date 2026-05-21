"use client";

import { useState, useMemo } from "react";
import { MotionPage } from "@/components/motion/motion-page";
import {
  Calculator,
  TrendingUp,
  DollarSign,
  Users,
  Clock,
  Target,
  RefreshCw,
  Bookmark,
  ChevronDown,
  Info,
} from "lucide-react";

// ── Preset scenarios ────────────────────────────────────────────────────────

const PRESETS = [
  { label: "Starter",     clients: 3,  retainer: 1500, overhead: 2000,  hoursPerClient: 20, cac: 500,  churnRate: 6 },
  { label: "Growing",     clients: 8,  retainer: 2500, overhead: 5000,  hoursPerClient: 15, cac: 800,  churnRate: 4 },
  { label: "Established", clients: 15, retainer: 3500, overhead: 10000, hoursPerClient: 12, cac: 1200, churnRate: 3 },
  { label: "Scale",       clients: 25, retainer: 5000, overhead: 20000, hoursPerClient: 10, cac: 1500, churnRate: 2 },
];

// ── Number formatting ────────────────────────────────────────────────────────

function fmt(n: number, style: "currency" | "percent" | "number" = "number", decimals = 0): string {
  if (style === "currency") {
    return n >= 1000
      ? `$${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)}k`
      : `$${Math.round(n).toLocaleString()}`;
  }
  if (style === "percent") return `${n.toFixed(decimals)}%`;
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

function fmtLong(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${Math.round(n).toLocaleString()}`;
}

// ── Slider component ─────────────────────────────────────────────────────────

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  tooltip?: string;
}

function Slider({ label, value, min, max, step, onChange, format, tooltip }: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100;
  const display = format ? format(value) : value.toLocaleString();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium text-text-secondary uppercase tracking-[0.12em]">{label}</span>
          {tooltip && (
            <span className="group relative">
              <Info size={11} className="text-text-muted cursor-help" />
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-48 px-2.5 py-1.5 bg-surface-light border border-border-subtle rounded-lg text-[10px] text-text-secondary leading-snug opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-10 text-center">
                {tooltip}
              </span>
            </span>
          )}
        </div>
        <span className="text-sm font-bold text-brand-accent font-ui tabular-nums">{display}</span>
      </div>
      <div className="relative h-1.5 bg-surface-light rounded-full">
        <div
          className="absolute left-0 top-0 h-full bg-brand-accent rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
          aria-label={label}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-brand-accent rounded-full border-2 border-[#020711] shadow transition-all pointer-events-none"
          style={{ left: `calc(${pct}% - 7px)` }}
        />
      </div>
    </div>
  );
}

// ── Metric card ──────────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
  accent?: "lime" | "green" | "red" | "amber" | "indigo" | "default";
  span?: boolean;
}

const ACCENT_MAP: Record<NonNullable<MetricCardProps["accent"]>, string> = {
  lime:    "text-brand-accent",
  green:   "text-emerald-400",
  red:     "text-red-400",
  amber:   "text-amber-400",
  indigo:  "text-indigo-400",
  default: "text-text-primary",
};

function MetricCard({ label, value, sub, accent = "default", span }: MetricCardProps) {
  const color = ACCENT_MAP[accent];
  return (
    <div className={`glass rounded-xl p-4 flex flex-col gap-1 ${span ? "col-span-2" : ""}`}>
      <p className="text-[10px] font-medium text-text-muted uppercase tracking-[0.14em] leading-none">{label}</p>
      <p className={`font-display text-2xl font-bold tabular-nums leading-none mt-1 ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-text-muted leading-snug mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function RoiCalculatorPage() {
  const [clients, setClients]           = useState(8);
  const [retainer, setRetainer]         = useState(2500);
  const [overhead, setOverhead]         = useState(5000);
  const [cac, setCac]                   = useState(800);
  const [hoursPerClient, setHoursPerClient] = useState(15);
  const [churnRate, setChurnRate]       = useState(4);
  const [teamSize, setTeamSize]         = useState(2);
  const [activePreset, setActivePreset] = useState<number | null>(1);
  const [showDetail, setShowDetail]     = useState(false);

  function applyPreset(i: number) {
    const p = PRESETS[i];
    setClients(p.clients);
    setRetainer(p.retainer);
    setOverhead(p.overhead);
    setHoursPerClient(p.hoursPerClient);
    setCac(p.cac);
    setChurnRate(p.churnRate);
    setActivePreset(i);
  }

  const metrics = useMemo(() => {
    const mrr           = clients * retainer;
    const arr           = mrr * 12;
    const monthlyProfit = mrr - overhead;
    const margin        = mrr > 0 ? (monthlyProfit / mrr) * 100 : 0;
    const totalHours    = clients * hoursPerClient;
    const hourlyRate    = totalHours > 0 ? mrr / totalHours : 0;
    const ltv           = churnRate > 0 ? retainer / (churnRate / 100) : retainer * 36;
    const ltvCac        = cac > 0 ? ltv / cac : 0;
    const breakEven     = cac > 0 && monthlyProfit > 0 ? cac / (mrr / clients) : 0;
    const capacityPerPerson = 160; // hrs/month
    const totalCapacity = teamSize * capacityPerPerson;
    const utilization   = totalCapacity > 0 ? (totalHours / totalCapacity) * 100 : 0;
    const revenuePerHead = teamSize > 0 ? mrr / teamSize : 0;
    const annualProfit  = monthlyProfit * 12;
    const maxClientsAtCap = teamSize * capacityPerPerson / (hoursPerClient || 1);

    return {
      mrr, arr, monthlyProfit, margin, totalHours, hourlyRate,
      ltv, ltvCac, breakEven, utilization, revenuePerHead, annualProfit, maxClientsAtCap,
    };
  }, [clients, retainer, overhead, cac, hoursPerClient, churnRate, teamSize]);

  const profitAccent = metrics.monthlyProfit >= 0 ? "green" : "red";
  const marginAccent = metrics.margin >= 50 ? "green" : metrics.margin >= 20 ? "amber" : "red";
  const ltvAccent    = metrics.ltvCac >= 3 ? "green" : metrics.ltvCac >= 1 ? "amber" : "red";
  const utilAccent   = metrics.utilization > 90 ? "red" : metrics.utilization > 70 ? "amber" : "green";

  return (
    <MotionPage className="space-y-5 max-w-[1200px] mx-auto">
      {/* ── Slim editorial header ───────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
        <div className="min-w-0">
          <p className="font-editorial text-[11px] italic text-text-muted mb-0.5">Agency Finance</p>
          <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-primary leading-none truncate">
            ROI Calculator
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Model revenue, margins, and LTV across retainer scenarios
          </p>
        </div>
        <div className="shrink-0">
          <Calculator size={20} className="text-brand-accent opacity-60" />
        </div>
      </div>

      {/* ── Preset selector ─────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        {PRESETS.map((p, i) => (
          <button
            key={p.label}
            onClick={() => applyPreset(i)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
              activePreset === i
                ? "bg-[rgba(212,255,0,0.12)] border-[rgba(212,255,0,0.35)] text-brand-accent"
                : "bg-surface border-border-subtle text-text-muted hover:text-text-primary hover:border-border-strong"
            }`}
          >
            <Bookmark size={11} />
            {p.label}
          </button>
        ))}
        <button
          onClick={() => setActivePreset(null)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs text-text-muted hover:text-text-primary border border-transparent hover:border-border-subtle transition-all"
        >
          <RefreshCw size={10} />
          Custom
        </button>
      </div>

      {/* ── Main 2-col layout ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-5">
        {/* Left — inputs */}
        <div className="glass rounded-2xl p-5 space-y-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">Scenario Inputs</p>

          <div className="space-y-5">
            <Slider
              label="Active clients"
              value={clients}
              min={1} max={50} step={1}
              onChange={(v) => { setClients(v); setActivePreset(null); }}
              format={(v) => `${v} clients`}
              tooltip="Number of retainer-paying clients at present"
            />
            <Slider
              label="Monthly retainer"
              value={retainer}
              min={500} max={15000} step={100}
              onChange={(v) => { setRetainer(v); setActivePreset(null); }}
              format={(v) => `$${v.toLocaleString()}`}
              tooltip="Average monthly fee charged per client"
            />
            <Slider
              label="Monthly overhead"
              value={overhead}
              min={500} max={50000} step={250}
              onChange={(v) => { setOverhead(v); setActivePreset(null); }}
              format={(v) => `$${v.toLocaleString()}`}
              tooltip="Total fixed costs: salaries, tools, office, subscriptions"
            />
            <Slider
              label="Hours per client / month"
              value={hoursPerClient}
              min={2} max={80} step={1}
              onChange={(v) => { setHoursPerClient(v); setActivePreset(null); }}
              format={(v) => `${v}h`}
              tooltip="Average hours your team spends on each client per month"
            />
            <Slider
              label="Customer acquisition cost"
              value={cac}
              min={100} max={10000} step={50}
              onChange={(v) => { setCac(v); setActivePreset(null); }}
              format={(v) => `$${v.toLocaleString()}`}
              tooltip="Total spend (ads + sales time + onboarding) to land one client"
            />
            <Slider
              label="Monthly churn rate"
              value={churnRate}
              min={0.5} max={20} step={0.5}
              onChange={(v) => { setChurnRate(v); setActivePreset(null); }}
              format={(v) => `${v}%`}
              tooltip="% of clients who cancel each month. 3–5% is typical for agencies"
            />
            <Slider
              label="Team size"
              value={teamSize}
              min={1} max={20} step={1}
              onChange={(v) => { setTeamSize(v); setActivePreset(null); }}
              format={(v) => `${v} people`}
              tooltip="Full-time equivalents delivering client work"
            />
          </div>
        </div>

        {/* Right — metrics grid */}
        <div className="space-y-3">
          {/* Primary metrics */}
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              label="Monthly Revenue"
              value={fmtLong(metrics.mrr)}
              sub={`from ${clients} clients at ${fmt(retainer, "currency")} each`}
              accent="lime"
            />
            <MetricCard
              label="Annual Run Rate"
              value={fmtLong(metrics.arr)}
              sub="if client count holds constant"
              accent="lime"
            />
            <MetricCard
              label="Monthly Profit"
              value={fmtLong(metrics.monthlyProfit)}
              sub={`after $${overhead.toLocaleString()} overhead`}
              accent={profitAccent as "green" | "red"}
            />
            <MetricCard
              label="Profit Margin"
              value={fmt(metrics.margin, "percent", 1)}
              sub={metrics.margin >= 50 ? "Healthy" : metrics.margin >= 20 ? "Tight — watch overhead" : "Negative — reduce costs"}
              accent={marginAccent as "green" | "amber" | "red"}
            />
          </div>

          {/* LTV / efficiency */}
          <div className="grid grid-cols-3 gap-3">
            <MetricCard
              label="Client LTV"
              value={fmtLong(metrics.ltv)}
              sub={`at ${churnRate}% churn`}
            />
            <MetricCard
              label="LTV : CAC"
              value={`${metrics.ltvCac.toFixed(1)}x`}
              sub={metrics.ltvCac >= 3 ? "Excellent (>3x)" : metrics.ltvCac >= 1 ? "Acceptable" : "Below break-even"}
              accent={ltvAccent as "green" | "amber" | "red"}
            />
            <MetricCard
              label="Break-even"
              value={metrics.breakEven > 0 ? `${metrics.breakEven.toFixed(1)} mo` : "—"}
              sub="months to recover CAC"
            />
          </div>

          {/* Capacity / rates */}
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              label="Effective Hourly Rate"
              value={`$${Math.round(metrics.hourlyRate)}/hr`}
              sub={`across ${metrics.totalHours}h / month total`}
              accent="indigo"
            />
            <MetricCard
              label="Revenue per Head"
              value={fmtLong(metrics.revenuePerHead)}
              sub={`per team member / month`}
              accent="indigo"
            />
          </div>

          {/* Team utilization */}
          <div className="glass rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">Team utilization</p>
              <span className={`text-sm font-bold tabular-nums ${
                metrics.utilization > 90 ? "text-red-400" : metrics.utilization > 70 ? "text-amber-400" : "text-emerald-400"
              }`}>
                {fmt(metrics.utilization, "percent", 0)}
              </span>
            </div>
            <div className="h-2 bg-surface-light rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  metrics.utilization > 90 ? "bg-red-400" : metrics.utilization > 70 ? "bg-amber-400" : "bg-emerald-400"
                }`}
                style={{ width: `${Math.min(metrics.utilization, 100)}%` }}
              />
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-[10px] text-text-muted">Current load</p>
                <p className="text-xs font-bold text-text-primary tabular-nums">{metrics.totalHours}h / mo</p>
              </div>
              <div>
                <p className="text-[10px] text-text-muted">Team capacity</p>
                <p className="text-xs font-bold text-text-primary tabular-nums">{teamSize * 160}h / mo</p>
              </div>
              <div>
                <p className="text-[10px] text-text-muted">Max clients</p>
                <p className="text-xs font-bold text-text-primary tabular-nums">{Math.floor(metrics.maxClientsAtCap)}</p>
              </div>
            </div>
          </div>

          {/* Expandable detail section */}
          <button
            onClick={() => setShowDetail(!showDetail)}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-border-subtle bg-surface hover:bg-surface-light text-text-muted text-xs transition-all"
          >
            <span className="font-medium">Annualized projections</span>
            <ChevronDown size={13} className={`transition-transform ${showDetail ? "rotate-180" : ""}`} />
          </button>

          {showDetail && (
            <div className="grid grid-cols-3 gap-3">
              <MetricCard
                label="Annual Profit"
                value={fmtLong(metrics.annualProfit)}
                sub="at current run rate"
                accent={metrics.annualProfit >= 0 ? "green" : "red"}
              />
              <MetricCard
                label="Annual Revenue"
                value={fmtLong(metrics.arr)}
                accent="lime"
              />
              <MetricCard
                label="Overhead / yr"
                value={fmtLong(overhead * 12)}
                accent="default"
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Key insights ─────────────────────────────────────────────── */}
      <div className="glass rounded-2xl p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted mb-3">
          What the numbers say
        </p>
        <div className="space-y-2">
          {metrics.margin < 0 && (
            <div className="flex items-start gap-2 text-xs text-red-400">
              <span className="mt-0.5 shrink-0">•</span>
              <span>
                You&apos;re spending more than you earn. Add {Math.ceil((overhead - metrics.mrr) / retainer + 1)} more client(s)
                or cut ${Math.round(overhead - metrics.mrr).toLocaleString()} from overhead to break even.
              </span>
            </div>
          )}
          {metrics.ltvCac < 3 && metrics.ltvCac > 0 && (
            <div className="flex items-start gap-2 text-xs text-amber-400">
              <span className="mt-0.5 shrink-0">•</span>
              <span>
                LTV:CAC of {metrics.ltvCac.toFixed(1)}x is below the 3x benchmark. Raise retainers,
                lower acquisition cost, or improve retention to reach {fmt(cac * 3, "currency")} LTV.
              </span>
            </div>
          )}
          {metrics.utilization > 90 && (
            <div className="flex items-start gap-2 text-xs text-red-400">
              <span className="mt-0.5 shrink-0">•</span>
              <span>
                Team is at {fmt(metrics.utilization, "percent", 0)} utilization — new clients will require
                hiring or reducing scope. Maximum sustainable load is around {Math.floor(metrics.maxClientsAtCap * 0.85)} clients.
              </span>
            </div>
          )}
          {metrics.margin >= 50 && metrics.ltvCac >= 3 && metrics.utilization <= 80 && (
            <div className="flex items-start gap-2 text-xs text-emerald-400">
              <span className="mt-0.5 shrink-0">•</span>
              <span>
                Strong margins, healthy LTV:CAC, and room to scale. At current capacity
                you can add {Math.floor(metrics.maxClientsAtCap - clients)} more clients without additional headcount.
              </span>
            </div>
          )}
          {metrics.breakEven > 6 && (
            <div className="flex items-start gap-2 text-xs text-text-muted">
              <span className="mt-0.5 shrink-0">•</span>
              <span>
                {fmt(metrics.breakEven, "number", 1)}-month CAC payback is long. Consider reducing
                acquisition spend, offering shorter onboarding, or increasing retainer rates on new clients.
              </span>
            </div>
          )}
          {metrics.margin >= 0 && metrics.ltvCac >= 3 && metrics.breakEven <= 6 && metrics.utilization <= 90 && !(metrics.margin >= 50 && metrics.ltvCac >= 3 && metrics.utilization <= 80) && (
            <div className="flex items-start gap-2 text-xs text-text-muted">
              <span className="mt-0.5 shrink-0">•</span>
              <span>Numbers look reasonable. Optimize one constraint at a time — margins, CAC, or retention.</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Metric legend ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { icon: <DollarSign size={12} />, label: "MRR",    desc: "Monthly Recurring Revenue — your baseline income" },
          { icon: <Target size={12} />,      label: "LTV:CAC", desc: "Lifetime value vs. cost to acquire. 3x+ is healthy" },
          { icon: <Clock size={12} />,       label: "$/hr",   desc: "Effective hourly rate — a proxy for operational efficiency" },
          { icon: <TrendingUp size={12} />,  label: "Margin", desc: "Revenue minus overhead. 40–60% is a solid agency target" },
          { icon: <Users size={12} />,       label: "Util %", desc: "Team load vs. total capacity (160h/person/month assumed)" },
        ].slice(0, 4).map((item) => (
          <div key={item.label} className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-surface border border-border-subtle">
            <span className="text-brand-accent mt-0.5 shrink-0">{item.icon}</span>
            <div>
              <p className="text-[10px] font-semibold text-text-primary">{item.label}</p>
              <p className="text-[9px] text-text-muted leading-snug">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </MotionPage>
  );
}
