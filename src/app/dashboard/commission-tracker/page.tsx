"use client";

import { useState } from "react";
import {
  DollarSign, Users, Award, Plus, X, Calendar,
  Percent, CheckCircle, Clock, ArrowUpRight,
  Star, Target, BarChart3, CreditCard, Zap, Trash2,
  Trophy
} from "lucide-react";
import PageHero from "@/components/ui/page-hero";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
type ActiveTab = "overview" | "rules" | "leaderboard" | "deals" | "payouts";

interface CommissionRule {
  id: string;
  name: string;
  type: "new_deal" | "renewal" | "upsell" | "referral";
  percentage: number;
  flatBonus: number;
  minDealSize: number;
  active: boolean;
}

interface SalesPerson {
  id: string;
  name: string;
  initials: string;
  color: string;
  totalEarned: number;
  dealsClosed: number;
  thisMonth: number;
  avatar?: string;
}

interface CommissionDeal {
  id: string;
  dealName: string;
  client: string;
  dealValue: number;
  commissionRate: number;
  commissionAmount: number;
  salesPerson: string;
  closedDate: string;
  status: "pending" | "approved" | "paid";
  type: "new_deal" | "renewal" | "upsell" | "referral";
}

interface MonthlyPayout {
  month: string;
  totalPaid: number;
  dealsCount: number;
  topEarner: string;
  topEarnerAmount: number;
}

/* ------------------------------------------------------------------ */
/*  Mock Data                                                          */
/* ------------------------------------------------------------------ */
const COMMISSION_RULES: CommissionRule[] = [];

const SALES_TEAM: SalesPerson[] = [];

const COMMISSION_DEALS: CommissionDeal[] = [];

const MONTHLY_PAYOUTS: MonthlyPayout[] = [];

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  new_deal: { label: "New Deal", color: "text-green-400", bg: "bg-green-400/10" },
  renewal: { label: "Renewal", color: "text-blue-400", bg: "bg-blue-400/10" },
  upsell: { label: "Upsell", color: "text-purple-400", bg: "bg-purple-400/10" },
  referral: { label: "Referral", color: "text-gold", bg: "bg-gold/10" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Pending", color: "text-yellow-400", bg: "bg-yellow-400/10" },
  approved: { label: "Approved", color: "text-blue-400", bg: "bg-blue-400/10" },
  paid: { label: "Paid", color: "text-green-400", bg: "bg-green-400/10" },
};

const fmtCurrency = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function CommissionTrackerPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [rules, setRules] = useState<CommissionRule[]>(COMMISSION_RULES);
  const [deals] = useState<CommissionDeal[]>(COMMISSION_DEALS);
  const [showAddRule, setShowAddRule] = useState(false);

  // Add rule form
  const [newRuleName, setNewRuleName] = useState("");
  const [newRuleType, setNewRuleType] = useState<"new_deal" | "renewal" | "upsell" | "referral">("new_deal");
  const [newRulePercentage, setNewRulePercentage] = useState(10);
  const [newRuleBonus, setNewRuleBonus] = useState(0);
  const [newRuleMinDeal, setNewRuleMinDeal] = useState(0);

  /* ------- Computed ------- */
  const totalEarned = deals.reduce((s, d) => s + d.commissionAmount, 0);
  const totalPending = deals.filter(d => d.status === "pending").reduce((s, d) => s + d.commissionAmount, 0);
  const totalPaid = deals.filter(d => d.status === "paid").reduce((s, d) => s + d.commissionAmount, 0);
  const thisMonth = deals.filter(d => d.closedDate.startsWith("2026-04")).reduce((s, d) => s + d.commissionAmount, 0);

  /* ------- Handlers ------- */
  const toggleRule = (id: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, active: !r.active } : r));
  };

  const deleteRule = (id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
  };

  const handleAddRule = () => {
    if (!newRuleName) return;
    const newRule: CommissionRule = {
      id: `r${Date.now()}`,
      name: newRuleName,
      type: newRuleType,
      percentage: newRulePercentage,
      flatBonus: newRuleBonus,
      minDealSize: newRuleMinDeal,
      active: true,
    };
    setRules(prev => [...prev, newRule]);
    setNewRuleName("");
    setNewRulePercentage(10);
    setNewRuleBonus(0);
    setNewRuleMinDeal(0);
    setShowAddRule(false);
  };

  const maxPayoutMonth = MONTHLY_PAYOUTS.length > 0 ? Math.max(...MONTHLY_PAYOUTS.map(p => p.totalPaid)) : 1;

  const TABS: { key: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { key: "overview", label: "Overview", icon: <BarChart3 size={14} /> },
    { key: "rules", label: "Commission Rules", icon: <Percent size={14} /> },
    { key: "leaderboard", label: "Leaderboard", icon: <Trophy size={14} /> },
    { key: "deals", label: "Deal Breakdown", icon: <DollarSign size={14} /> },
    { key: "payouts", label: "Payout History", icon: <CreditCard size={14} /> },
  ];

  return (
    <div className="fade-in space-y-5">
      <PageHero
        icon={<Award size={28} />}
        title="Commission Tracker"
        subtitle="Track sales commissions, rules, and payouts."
        gradient="green"
        actions={
          <button onClick={() => { setShowAddRule(true); setActiveTab("rules"); }} className="px-3 py-1.5 rounded-lg bg-white/15 border border-white/25 text-white text-xs font-semibold hover:bg-white/25 transition-all flex items-center gap-1.5">
            <Plus size={12} /> Add Rule
          </button>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Earned", value: fmtCurrency(totalEarned), icon: <DollarSign size={14} />, color: "text-gold", sub: `${deals.length} deals` },
          { label: "Pending", value: fmtCurrency(totalPending), icon: <Clock size={14} />, color: "text-yellow-400", sub: `${deals.filter(d => d.status === "pending").length} awaiting` },
          { label: "Paid Out", value: fmtCurrency(totalPaid), icon: <CheckCircle size={14} />, color: "text-green-400", sub: `${deals.filter(d => d.status === "paid").length} processed` },
          { label: "This Month", value: fmtCurrency(thisMonth), icon: <Calendar size={14} />, color: "text-blue-400", sub: "April 2026" },
        ].map((card, i) => (
          <div key={i} className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-white/5 ${card.color}`}>
                {card.icon}
              </div>
              <p className="text-[10px] text-muted uppercase tracking-wider">{card.label}</p>
            </div>
            <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
            <p className="text-[9px] text-muted mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface rounded-lg p-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 text-xs rounded-md flex items-center gap-2 whitespace-nowrap transition-all ${
              activeTab === t.key ? "bg-gold text-black font-medium" : "text-muted hover:text-foreground"
            }`}>{t.icon} {t.label}</button>
        ))}
      </div>

      {/* ============================================================ */}
      {/*  OVERVIEW                                                     */}
      {/* ============================================================ */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          {/* Quick leaderboard + payout chart side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Mini leaderboard */}
            <div className="card">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Trophy size={13} className="text-gold" /> Top Earners
              </h3>
              <div className="space-y-2">
                {[...SALES_TEAM].sort((a, b) => b.totalEarned - a.totalEarned).slice(0, 5).map((person, i) => (
                  <div key={person.id} className="flex items-center gap-3">
                    <span className={`text-[10px] w-5 text-center font-bold ${i === 0 ? "text-gold" : i === 1 ? "text-blue-300" : i === 2 ? "text-orange-400" : "text-muted"}`}>
                      #{i + 1}
                    </span>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                      style={{ background: person.color }}>
                      {person.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold truncate">{person.name}</p>
                      <p className="text-[9px] text-muted">{person.dealsClosed} deals closed</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-gold">{fmtCurrency(person.totalEarned)}</p>
                      <p className="text-[9px] text-emerald-400 flex items-center gap-0.5 justify-end">
                        <ArrowUpRight size={8} /> {fmtCurrency(person.thisMonth)} this mo
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Payout trend */}
            <div className="card">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <BarChart3 size={13} className="text-blue-400" /> Monthly Payouts
              </h3>
              <div className="flex items-end gap-2 h-36">
                {MONTHLY_PAYOUTS.slice().reverse().map((p, idx) => {
                  const h = (p.totalPaid / maxPayoutMonth) * 100;
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                      <div className="opacity-0 group-hover:opacity-100 absolute -top-7 bg-surface border border-border rounded px-1.5 py-0.5 text-[9px] font-bold whitespace-nowrap z-10 shadow-lg">
                        {fmtCurrency(p.totalPaid)}
                      </div>
                      <div className="w-full rounded-t-md bg-gold/70 hover:bg-gold transition-colors"
                        style={{ height: `${h}%`, minHeight: 4 }} />
                      <span className="text-[7px] text-muted whitespace-nowrap">{p.month.replace(" 20", " '")}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Commission by type breakdown */}
          <div className="card">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Target size={13} className="text-purple-400" /> Commission by Type
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(["new_deal", "renewal", "upsell", "referral"] as const).map(type => {
                const typeDeals = deals.filter(d => d.type === type);
                const typeTotal = typeDeals.reduce((s, d) => s + d.commissionAmount, 0);
                const cfg = TYPE_CONFIG[type];
                return (
                  <div key={type} className="p-3 rounded-xl bg-surface-light border border-border text-center">
                    <p className={`text-[10px] font-medium ${cfg.color}`}>{cfg.label}</p>
                    <p className="text-lg font-bold mt-1">{fmtCurrency(typeTotal)}</p>
                    <p className="text-[9px] text-muted">{typeDeals.length} deals</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent deals */}
          <div className="card">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Zap size={13} className="text-gold" /> Recent Commission Deals
            </h3>
            <div className="space-y-1.5">
              {deals.slice(0, 5).map(deal => {
                const typeCfg = TYPE_CONFIG[deal.type];
                const statusCfg = STATUS_CONFIG[deal.status];
                return (
                  <div key={deal.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-light">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${typeCfg.bg}`}>
                      <DollarSign size={12} className={typeCfg.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold truncate">{deal.dealName}</p>
                      <p className="text-[9px] text-muted">{deal.client} &middot; {deal.salesPerson}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-bold text-gold">{fmtCurrency(deal.commissionAmount)}</p>
                      <span className={`text-[8px] px-1.5 py-0.5 rounded-full ${statusCfg.bg} ${statusCfg.color}`}>{statusCfg.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/*  COMMISSION RULES                                             */}
      {/* ============================================================ */}
      {activeTab === "rules" && (
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Percent size={13} className="text-gold" /> Commission Rules
              </h3>
              <button onClick={() => setShowAddRule(true)} className="btn-primary text-xs flex items-center gap-1.5">
                <Plus size={10} /> Add Rule
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="text-[9px] text-muted uppercase tracking-wider border-b border-border">
                    <th className="text-left py-2">Rule Name</th>
                    <th className="text-center py-2">Type</th>
                    <th className="text-center py-2">Commission %</th>
                    <th className="text-center py-2">Flat Bonus</th>
                    <th className="text-center py-2">Min Deal Size</th>
                    <th className="text-center py-2">Status</th>
                    <th className="text-right py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map(rule => {
                    const typeCfg = TYPE_CONFIG[rule.type];
                    return (
                      <tr key={rule.id} className={`border-b border-border/30 ${!rule.active ? "opacity-50" : ""}`}>
                        <td className="py-3 font-medium">{rule.name}</td>
                        <td className="py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] ${typeCfg.bg} ${typeCfg.color}`}>
                            {typeCfg.label}
                          </span>
                        </td>
                        <td className="py-3 text-center font-bold text-gold">{rule.percentage}%</td>
                        <td className="py-3 text-center">{rule.flatBonus > 0 ? fmtCurrency(rule.flatBonus) : "-"}</td>
                        <td className="py-3 text-center">{rule.minDealSize > 0 ? fmtCurrency(rule.minDealSize) : "None"}</td>
                        <td className="py-3 text-center">
                          <button onClick={() => toggleRule(rule.id)}
                            className={`w-8 h-4 rounded-full transition-all flex items-center mx-auto ${
                              rule.active ? "bg-gold justify-end" : "bg-surface justify-start"
                            }`}>
                            <div className="w-3 h-3 bg-white rounded-full mx-0.5 shadow" />
                          </button>
                        </td>
                        <td className="py-3 text-right">
                          <button onClick={() => deleteRule(rule.id)} className="text-muted hover:text-red-400 transition-colors">
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Rule examples */}
          <div className="card">
            <h3 className="text-xs font-semibold mb-2 flex items-center gap-2">
              <Star size={12} className="text-gold" /> How Rules Work
            </h3>
            <div className="space-y-1.5 text-[10px] text-muted">
              <p>Commission is calculated as: <span className="text-gold font-bold">(Deal Value x Commission %) + Flat Bonus</span></p>
              <p>Rules only apply to deals above the minimum deal size threshold.</p>
              <p>Multiple rules can stack if they match different deal types.</p>
              <p>Toggle rules on/off without deleting them.</p>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/*  LEADERBOARD                                                  */}
      {/* ============================================================ */}
      {activeTab === "leaderboard" && (
        <div className="space-y-4">
          {/* Podium top 3 */}
          <div className="grid grid-cols-3 gap-3">
            {[...SALES_TEAM].sort((a, b) => b.totalEarned - a.totalEarned).slice(0, 3).map((person, i) => {
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const heights = ["h-40", "h-32", "h-28"];
              const medals = ["text-gold", "text-blue-300", "text-orange-400"];
              const borders = ["border-gold/30", "border-blue-300/30", "border-orange-400/30"];
              return (
                <div key={person.id} className={`card p-4 text-center border ${borders[i]} flex flex-col justify-end`}>
                  <div className={`mx-auto mb-2 ${medals[i]}`}>
                    {i === 0 ? <Trophy size={24} /> : <Award size={20} />}
                  </div>
                  <div className="w-14 h-14 rounded-full flex items-center justify-center text-sm font-bold text-white mx-auto mb-2"
                    style={{ background: person.color }}>
                    {person.initials}
                  </div>
                  <p className="text-xs font-bold">{person.name}</p>
                  <p className="text-xl font-bold text-gold mt-1">{fmtCurrency(person.totalEarned)}</p>
                  <p className="text-[9px] text-muted">{person.dealsClosed} deals &middot; {fmtCurrency(person.thisMonth)} this mo</p>
                </div>
              );
            })}
          </div>

          {/* Full leaderboard table */}
          <div className="card">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Users size={13} className="text-gold" /> Full Sales Leaderboard
            </h3>
            <div className="space-y-2">
              {[...SALES_TEAM].sort((a, b) => b.totalEarned - a.totalEarned).map((person, i) => {
                const maxEarned = Math.max(...SALES_TEAM.map(p => p.totalEarned), 1);
                return (
                  <div key={person.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-light border border-border">
                    <span className={`text-sm font-bold w-6 text-center ${
                      i === 0 ? "text-gold" : i === 1 ? "text-blue-300" : i === 2 ? "text-orange-400" : "text-muted"
                    }`}>
                      {i + 1}
                    </span>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{ background: person.color }}>
                      {person.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold">{person.name}</p>
                      <div className="mt-1 h-2 rounded-full bg-surface overflow-hidden">
                        <div className="h-full rounded-full bg-gold/70" style={{ width: `${(person.totalEarned / maxEarned) * 100}%` }} />
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-gold">{fmtCurrency(person.totalEarned)}</p>
                      <div className="flex gap-3 text-[9px] text-muted mt-0.5">
                        <span>{person.dealsClosed} deals</span>
                        <span className="text-emerald-400">{fmtCurrency(person.thisMonth)} this mo</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Performance stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="card p-3 text-center">
              <p className="text-[10px] text-muted">Total Team Commission</p>
              <p className="text-xl font-bold text-gold">{fmtCurrency(SALES_TEAM.reduce((s, p) => s + p.totalEarned, 0))}</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-[10px] text-muted">Avg Per Person</p>
              <p className="text-xl font-bold text-blue-400">{fmtCurrency(SALES_TEAM.length > 0 ? Math.round(SALES_TEAM.reduce((s, p) => s + p.totalEarned, 0) / SALES_TEAM.length) : 0)}</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-[10px] text-muted">Total Deals Closed</p>
              <p className="text-xl font-bold text-purple-400">{SALES_TEAM.reduce((s, p) => s + p.dealsClosed, 0)}</p>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/*  DEAL BREAKDOWN                                               */}
      {/* ============================================================ */}
      {activeTab === "deals" && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <DollarSign size={13} className="text-gold" /> Deal-by-Deal Commission Breakdown
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="text-[9px] text-muted uppercase tracking-wider border-b border-border">
                    <th className="text-left py-2">Deal</th>
                    <th className="text-left py-2">Client</th>
                    <th className="text-left py-2">Sales Rep</th>
                    <th className="text-center py-2">Type</th>
                    <th className="text-right py-2">Deal Value</th>
                    <th className="text-center py-2">Rate</th>
                    <th className="text-right py-2">Commission</th>
                    <th className="text-center py-2">Status</th>
                    <th className="text-center py-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {deals.map(deal => {
                    const typeCfg = TYPE_CONFIG[deal.type];
                    const statusCfg = STATUS_CONFIG[deal.status];
                    return (
                      <tr key={deal.id} className="border-b border-border/30 hover:bg-white/[0.02]">
                        <td className="py-2.5 font-medium">{deal.dealName}</td>
                        <td className="py-2.5 text-muted">{deal.client}</td>
                        <td className="py-2.5">{deal.salesPerson}</td>
                        <td className="py-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] ${typeCfg.bg} ${typeCfg.color}`}>{typeCfg.label}</span>
                        </td>
                        <td className="py-2.5 text-right">{fmtCurrency(deal.dealValue)}</td>
                        <td className="py-2.5 text-center font-bold">{deal.commissionRate}%</td>
                        <td className="py-2.5 text-right font-bold text-gold">{fmtCurrency(deal.commissionAmount)}</td>
                        <td className="py-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] ${statusCfg.bg} ${statusCfg.color}`}>{statusCfg.label}</span>
                        </td>
                        <td className="py-2.5 text-center text-muted">{deal.closedDate}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border font-bold text-xs">
                    <td className="py-3" colSpan={4}>Totals</td>
                    <td className="py-3 text-right">{fmtCurrency(deals.reduce((s, d) => s + d.dealValue, 0))}</td>
                    <td></td>
                    <td className="py-3 text-right text-gold">{fmtCurrency(totalEarned)}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/*  PAYOUT HISTORY                                               */}
      {/* ============================================================ */}
      {activeTab === "payouts" && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <CreditCard size={13} className="text-gold" /> Monthly Payout History
            </h3>
            <div className="space-y-2">
              {MONTHLY_PAYOUTS.map((payout, i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-surface-light border border-border">
                  <div className="w-12 text-center flex-shrink-0">
                    <p className="text-[9px] text-muted">{payout.month.split(" ")[0]}</p>
                    <p className="text-sm font-bold">{payout.month.split(" ")[1]}</p>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold">Total Paid: <span className="text-gold">{fmtCurrency(payout.totalPaid)}</span></p>
                      <p className="text-[10px] text-muted">{payout.dealsCount} deals</p>
                    </div>
                    <div className="h-2 rounded-full bg-surface overflow-hidden">
                      <div className="h-full rounded-full bg-gold/70" style={{ width: `${(payout.totalPaid / maxPayoutMonth) * 100}%` }} />
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[9px] text-muted">Top Earner</p>
                    <p className="text-[10px] font-semibold">{payout.topEarner}</p>
                    <p className="text-[9px] text-gold">{fmtCurrency(payout.topEarnerAmount)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payout summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="card p-3 text-center">
              <p className="text-[10px] text-muted">Total All-Time Payouts</p>
              <p className="text-xl font-bold text-gold">{fmtCurrency(MONTHLY_PAYOUTS.reduce((s, p) => s + p.totalPaid, 0))}</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-[10px] text-muted">Avg Monthly Payout</p>
              <p className="text-xl font-bold text-blue-400">{fmtCurrency(MONTHLY_PAYOUTS.length > 0 ? Math.round(MONTHLY_PAYOUTS.reduce((s, p) => s + p.totalPaid, 0) / MONTHLY_PAYOUTS.length) : 0)}</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-[10px] text-muted">Avg Deals/Month</p>
              <p className="text-xl font-bold text-purple-400">{MONTHLY_PAYOUTS.length > 0 ? Math.round(MONTHLY_PAYOUTS.reduce((s, p) => s + p.dealsCount, 0) / MONTHLY_PAYOUTS.length) : 0}</p>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/*  ADD RULE MODAL                                               */}
      {/* ============================================================ */}
      {showAddRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Plus size={14} className="text-gold" /> Add Commission Rule
              </h3>
              <button onClick={() => setShowAddRule(false)} className="text-muted hover:text-foreground">
                <X size={16} />
              </button>
            </div>

            <div>
              <label className="block text-[9px] text-muted mb-1 uppercase tracking-wider">Rule Name *</label>
              <input value={newRuleName} onChange={e => setNewRuleName(e.target.value)}
                className="input w-full text-xs" placeholder="e.g., Q2 New Deal Bonus" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[9px] text-muted mb-1 uppercase tracking-wider">Deal Type</label>
                <select value={newRuleType} onChange={e => setNewRuleType(e.target.value as typeof newRuleType)}
                  className="input w-full text-xs">
                  <option value="new_deal">New Deal</option>
                  <option value="renewal">Renewal</option>
                  <option value="upsell">Upsell</option>
                  <option value="referral">Referral</option>
                </select>
              </div>
              <div>
                <label className="block text-[9px] text-muted mb-1 uppercase tracking-wider">Commission %</label>
                <div className="relative">
                  <input type="number" value={newRulePercentage}
                    onChange={e => setNewRulePercentage(Number(e.target.value))}
                    className="input w-full text-xs pr-8" min={0} max={100} />
                  <Percent size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[9px] text-muted mb-1 uppercase tracking-wider">Flat Bonus ($)</label>
                <div className="relative">
                  <DollarSign size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input type="number" value={newRuleBonus}
                    onChange={e => setNewRuleBonus(Number(e.target.value))}
                    className="input w-full text-xs pl-8" min={0} />
                </div>
              </div>
              <div>
                <label className="block text-[9px] text-muted mb-1 uppercase tracking-wider">Min Deal Size ($)</label>
                <div className="relative">
                  <DollarSign size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input type="number" value={newRuleMinDeal}
                    onChange={e => setNewRuleMinDeal(Number(e.target.value))}
                    className="input w-full text-xs pl-8" min={0} />
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="p-3 rounded-xl bg-surface-light border border-border">
              <p className="text-[9px] text-muted uppercase tracking-wider mb-1">Rule Preview</p>
              <p className="text-[11px]">
                {newRulePercentage}% commission
                {newRuleBonus > 0 ? ` + ${fmtCurrency(newRuleBonus)} bonus` : ""}
                {" "}on{" "}
                <span className="text-gold font-semibold">{TYPE_CONFIG[newRuleType].label.toLowerCase()}</span> deals
                {newRuleMinDeal > 0 ? ` above ${fmtCurrency(newRuleMinDeal)}` : ""}
              </p>
              <p className="text-[9px] text-muted mt-1">
                Example: {fmtCurrency(5000)} deal = <span className="text-gold font-bold">{fmtCurrency(5000 * (newRulePercentage / 100) + newRuleBonus)}</span> commission
              </p>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setShowAddRule(false)} className="btn-secondary flex-1 text-xs">Cancel</button>
              <button onClick={handleAddRule} disabled={!newRuleName}
                className="btn-primary flex-1 text-xs flex items-center justify-center gap-1.5 disabled:opacity-40">
                <Plus size={12} /> Add Rule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
