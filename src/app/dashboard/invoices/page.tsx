"use client";

import { useState } from "react";
import {
  CreditCard, Plus, Send, Clock, CheckCircle, AlertTriangle,
  FileText, Download, RefreshCw,
  BarChart3, Globe, Copy, ChevronRight,
  X, Search, Zap, ArrowRight
} from "lucide-react";

type MainTab = "all" | "builder" | "recurring" | "reminders" | "templates" | "aging" | "revenue";

interface Invoice {
  id: string;
  client: string;
  amount: number;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  dueDate: string;
  sentDate: string;
  description: string;
  currency: string;
  tax: number;
  recurring: boolean;
  paymentLink: string;
}

const MOCK_INVOICES: Invoice[] = [];

const INVOICE_TEMPLATES: { id: string; name: string; description: string; sections: string[] }[] = [];

const formatCurrency = (amount: number, currency: string = "USD") => {
  if (currency === "EUR") return `€${amount.toLocaleString()}`;
  if (currency === "GBP") return `£${amount.toLocaleString()}`;
  return `$${amount.toLocaleString()}`;
};

export default function InvoicesPage() {
  const [activeTab, setActiveTab] = useState<MainTab>("all");
  const [filter, setFilter] = useState<"all" | "sent" | "paid" | "overdue" | "draft">("all");
  const [search, setSearch] = useState("");
  const [selectedCurrency, setSelectedCurrency] = useState("USD");
  const [taxRate, setTaxRate] = useState(0);
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];
  const filtered = MOCK_INVOICES.filter(inv => {
    const statusMatch = filter === "all" || (filter === "overdue" ? inv.status === "sent" && inv.dueDate < today || inv.status === "overdue" : inv.status === filter);
    const searchMatch = !search || inv.client.toLowerCase().includes(search.toLowerCase()) || inv.id.toLowerCase().includes(search.toLowerCase());
    return statusMatch && searchMatch;
  });

  const totalSent = MOCK_INVOICES.filter(i => i.status === "sent").reduce((s, i) => s + i.amount, 0);
  const totalPaid = MOCK_INVOICES.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0);
  const totalOverdue = MOCK_INVOICES.filter(i => i.status === "overdue").reduce((s, i) => s + i.amount, 0);
  const totalDraft = MOCK_INVOICES.filter(i => i.status === "draft").reduce((s, i) => s + i.amount, 0);
  const recurringTotal = MOCK_INVOICES.filter(i => i.recurring && i.status !== "cancelled").reduce((s, i) => s + i.amount, 0);

  const TABS: { key: MainTab; label: string; icon: React.ReactNode }[] = [
    { key: "all", label: "All Invoices", icon: <CreditCard size={14} /> },
    { key: "builder", label: "Invoice Builder", icon: <Plus size={14} /> },
    { key: "recurring", label: "Recurring", icon: <RefreshCw size={14} /> },
    { key: "reminders", label: "Reminders", icon: <Clock size={14} /> },
    { key: "templates", label: "Templates", icon: <FileText size={14} /> },
    { key: "aging", label: "Aging Report", icon: <AlertTriangle size={14} /> },
    { key: "revenue", label: "Revenue", icon: <BarChart3 size={14} /> },
  ];

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2">
            <CreditCard size={18} className="text-gold" /> Invoices
          </h1>
          <p className="text-xs text-muted mt-0.5">{MOCK_INVOICES.length} invoices | Track payments, reminders, recurring billing</p>
        </div>
        <button onClick={() => setActiveTab("builder")} className="btn-primary text-xs flex items-center gap-1.5">
          <Plus size={12} /> New Invoice
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Outstanding", value: formatCurrency(totalSent), icon: <Clock size={12} />, color: "text-yellow-400" },
          { label: "Collected", value: formatCurrency(totalPaid), icon: <CheckCircle size={12} />, color: "text-green-400" },
          { label: "Overdue", value: formatCurrency(totalOverdue), icon: <AlertTriangle size={12} />, color: "text-red-400" },
          { label: "Draft", value: formatCurrency(totalDraft), icon: <FileText size={12} />, color: "text-muted" },
          { label: "Monthly Recurring", value: formatCurrency(recurringTotal), icon: <RefreshCw size={12} />, color: "text-gold" },
        ].map((stat, i) => (
          <div key={i} className="card text-center p-3">
            <div className={`w-7 h-7 rounded-lg mx-auto mb-1.5 flex items-center justify-center bg-white/5 ${stat.color}`}>{stat.icon}</div>
            <p className="text-lg font-bold">{stat.value}</p>
            <p className="text-[9px] text-muted">{stat.label}</p>
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

      {/* ===== ALL INVOICES ===== */}
      {activeTab === "all" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input value={search} onChange={e => setSearch(e.target.value)} className="input w-full pl-9 text-xs" placeholder="Search invoices..." />
            </div>
            <div className="flex gap-1.5">
              {(["all", "sent", "paid", "overdue", "draft"] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`text-[10px] px-3 py-1.5 rounded-lg capitalize ${
                    filter === f ? "bg-gold/10 text-gold border border-gold/20" : "text-muted border border-white/[0.05]"
                  }`}>{f}</button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {filtered.length === 0 ? (
              <div className="card text-center py-12">
                <CreditCard size={24} className="mx-auto mb-2 text-muted/30" />
                <p className="text-xs text-muted">No invoices found</p>
              </div>
            ) : (
              filtered.map(inv => {
                const isOverdue = (inv.status === "sent" && inv.dueDate < today) || inv.status === "overdue";
                return (
                  <div key={inv.id}>
                    <div onClick={() => setExpandedInvoice(expandedInvoice === inv.id ? null : inv.id)}
                      className={`flex items-center justify-between p-4 rounded-xl bg-surface-light border transition-all cursor-pointer ${
                        isOverdue ? "border-red-400/15" : "border-border hover:border-gold/10"
                      }`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          inv.status === "paid" ? "bg-green-400/10" : isOverdue ? "bg-red-400/10" : inv.status === "draft" ? "bg-surface" : "bg-yellow-400/10"
                        }`}>
                          {inv.status === "paid" ? <CheckCircle size={16} className="text-green-400" /> :
                           isOverdue ? <AlertTriangle size={16} className="text-red-400" /> :
                           inv.status === "draft" ? <FileText size={16} className="text-muted" /> :
                           <Clock size={16} className="text-yellow-400" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold">{inv.client}</p>
                            <span className="text-[8px] font-mono text-muted">{inv.id}</span>
                            {inv.recurring && <RefreshCw size={8} className="text-gold" />}
                            {inv.currency !== "USD" && <Globe size={8} className="text-blue-400" />}
                          </div>
                          <p className="text-[10px] text-muted">{inv.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-lg font-bold">{formatCurrency(inv.amount, inv.currency)}</p>
                          <p className="text-[9px] text-muted">Due: {inv.dueDate}</p>
                        </div>
                        <span className={`text-[9px] px-2 py-0.5 rounded-full ${
                          inv.status === "paid" ? "bg-green-400/10 text-green-400" :
                          isOverdue ? "bg-red-400/10 text-red-400" :
                          inv.status === "draft" ? "bg-white/5 text-muted" :
                          "bg-yellow-400/10 text-yellow-400"
                        }`}>{isOverdue ? "overdue" : inv.status}</span>
                        <ChevronRight size={14} className="text-muted" />
                      </div>
                    </div>
                    {expandedInvoice === inv.id && (
                      <div className="ml-4 mt-2 mb-3 p-3 rounded-lg bg-surface border border-border space-y-2">
                        <div className="grid grid-cols-4 gap-3 text-[10px]">
                          <div><span className="text-muted">Sent:</span> <span>{inv.sentDate || "Not sent"}</span></div>
                          <div><span className="text-muted">Due:</span> <span>{inv.dueDate}</span></div>
                          <div><span className="text-muted">Tax:</span> <span>{inv.tax > 0 ? formatCurrency(inv.tax) : "None"}</span></div>
                          <div><span className="text-muted">Currency:</span> <span>{inv.currency}</span></div>
                        </div>
                        <div className="flex gap-2 pt-2">
                          {inv.status === "sent" && <button className="btn-ghost text-[9px] flex items-center gap-1"><Send size={9} /> Resend</button>}
                          {inv.paymentLink && <button className="btn-ghost text-[9px] flex items-center gap-1"><Copy size={9} /> Copy Pay Link</button>}
                          <button className="btn-ghost text-[9px] flex items-center gap-1"><Download size={9} /> PDF</button>
                          {inv.status === "draft" && <button className="btn-primary text-[9px] flex items-center gap-1"><Send size={9} /> Send</button>}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ===== INVOICE BUILDER ===== */}
      {activeTab === "builder" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-3">
              <div className="card space-y-3">
                <h3 className="text-sm font-semibold">Invoice Builder</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">Client</label>
                    <select className="input w-full text-xs">
                      <option value="">Select client...</option>
                      {Array.from(new Set(MOCK_INVOICES.map(i => i.client))).map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">Currency</label>
                    <select value={selectedCurrency} onChange={e => setSelectedCurrency(e.target.value)} className="input w-full text-xs">
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="SEK">SEK (kr)</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">Description</label>
                  <input className="input w-full text-xs" placeholder="e.g., Growth Package - April 2026" />
                </div>

                {/* Line Items */}
                <div>
                  <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">Line Items</label>
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-12 text-[9px] text-muted uppercase tracking-wider font-semibold py-1 px-2">
                      <span className="col-span-5">Description</span>
                      <span className="col-span-2 text-center">Qty</span>
                      <span className="col-span-2 text-center">Rate</span>
                      <span className="col-span-2 text-right">Amount</span>
                      <span className="col-span-1"></span>
                    </div>
                    {[
                      { desc: "Social Media Management", qty: 1, rate: 997 },
                      { desc: "Paid Ads Management", qty: 1, rate: 1500 },
                    ].map((item, i) => (
                      <div key={i} className="grid grid-cols-12 items-center text-[10px] py-1.5 px-2 rounded bg-surface-light">
                        <span className="col-span-5">{item.desc}</span>
                        <span className="col-span-2 text-center">{item.qty}</span>
                        <span className="col-span-2 text-center">{formatCurrency(item.rate, selectedCurrency)}</span>
                        <span className="col-span-2 text-right font-bold">{formatCurrency(item.qty * item.rate, selectedCurrency)}</span>
                        <button className="col-span-1 text-right text-muted hover:text-red-400"><X size={10} /></button>
                      </div>
                    ))}
                    <button className="text-[9px] text-gold flex items-center gap-1 px-2"><Plus size={9} /> Add Line Item</button>
                  </div>
                </div>

                {/* Tax Calculator */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">Tax Rate (%)</label>
                    <input type="number" value={taxRate} onChange={e => setTaxRate(Number(e.target.value))} className="input w-full text-xs" placeholder="0" />
                  </div>
                  <div>
                    <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">Due In</label>
                    <select className="input w-full text-xs">
                      <option value="7">7 days</option>
                      <option value="14">14 days</option>
                      <option value="30">30 days</option>
                      <option value="60">60 days</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-3">
              <div className="card p-4">
                <h4 className="text-xs font-semibold mb-3">Invoice Summary</h4>
                <div className="space-y-2 text-[10px]">
                  <div className="flex justify-between"><span className="text-muted">Subtotal</span><span>{formatCurrency(2497, selectedCurrency)}</span></div>
                  <div className="flex justify-between"><span className="text-muted">Tax ({taxRate}%)</span><span>{formatCurrency(Math.round(2497 * taxRate / 100), selectedCurrency)}</span></div>
                  <div className="border-t border-border pt-2 flex justify-between font-bold">
                    <span>Total</span><span className="text-gold">{formatCurrency(Math.round(2497 * (1 + taxRate / 100)), selectedCurrency)}</span>
                  </div>
                </div>
                <button className="btn-primary w-full text-xs mt-4 flex items-center justify-center gap-1.5">
                  <Send size={12} /> Create & Send
                </button>
                <button className="btn-secondary w-full text-xs mt-2 flex items-center justify-center gap-1.5">
                  <FileText size={12} /> Save as Draft
                </button>
              </div>

              {/* Quick Invoice from Proposal */}
              <div className="card border-gold/10 p-4">
                <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                  <Zap size={12} className="text-gold" /> Quick Invoice
                </h4>
                <p className="text-[9px] text-muted mb-3">Generate invoice from an accepted proposal</p>
                <select className="input w-full text-xs mb-2">
                  <option value="">Select proposal...</option>
                </select>
                <button className="btn-gold w-full text-xs flex items-center justify-center gap-1.5 bg-gold/10 text-gold border border-gold/20 rounded-lg py-1.5 hover:bg-gold/20 transition-all">
                  <ArrowRight size={12} /> Create from Proposal
                </button>
              </div>

              {/* Payment Link */}
              <div className="card p-4">
                <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                  <CreditCard size={12} className="text-gold" /> Payment Links
                </h4>
                <p className="text-[9px] text-muted mb-2">Stripe-powered payment links for quick collection</p>
                <button className="btn-secondary w-full text-xs flex items-center justify-center gap-1.5">
                  <CreditCard size={12} /> Generate Payment Link
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== RECURRING INVOICES ===== */}
      {activeTab === "recurring" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <RefreshCw size={14} className="text-gold" /> Recurring Invoices
            </h3>
            <button className="btn-primary text-xs flex items-center gap-1.5"><Plus size={12} /> Add Recurring</button>
          </div>
          <div className="space-y-2">
            {MOCK_INVOICES.filter(i => i.recurring).length === 0 ? (
              <div className="card text-center py-8">
                <RefreshCw size={20} className="mx-auto mb-2 text-muted/30" />
                <p className="text-xs text-muted">No recurring invoices yet</p>
              </div>
            ) : MOCK_INVOICES.filter(i => i.recurring).map(inv => (
              <div key={inv.id} className="card p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <RefreshCw size={14} className="text-gold" />
                  <div>
                    <p className="text-xs font-semibold">{inv.client}</p>
                    <p className="text-[10px] text-muted">{inv.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-[10px]">
                  <div className="text-center">
                    <p className="font-bold text-gold">{formatCurrency(inv.amount)}</p>
                    <p className="text-[8px] text-muted">Monthly</p>
                  </div>
                  <div className="text-center">
                    <p className="font-medium">1st of month</p>
                    <p className="text-[8px] text-muted">Next invoice</p>
                  </div>
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-green-400/10 text-green-400">Active</span>
                  <button className="text-[9px] text-muted hover:text-red-400">Pause</button>
                </div>
              </div>
            ))}
          </div>
          <div className="card text-center p-4">
            <p className="text-sm font-bold text-gold">{formatCurrency(recurringTotal)}/mo</p>
            <p className="text-[10px] text-muted">Total monthly recurring revenue from invoices</p>
          </div>
        </div>
      )}

      {/* ===== LATE PAYMENT REMINDERS ===== */}
      {activeTab === "reminders" && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Clock size={14} className="text-gold" /> Late Payment Reminder Settings
          </h3>
          <div className="space-y-2">
            {[
              { delay: "1 day overdue", message: "Friendly reminder that your invoice is due", enabled: true },
              { delay: "3 days overdue", message: "Your invoice is 3 days past due", enabled: true },
              { delay: "7 days overdue", message: "Important: Payment overdue - please resolve", enabled: true },
              { delay: "14 days overdue", message: "Final notice before account review", enabled: false },
              { delay: "30 days overdue", message: "Account suspension warning", enabled: false },
            ].map((reminder, i) => (
              <div key={i} className={`card p-4 flex items-center justify-between ${!reminder.enabled ? "opacity-50" : ""}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${i < 2 ? "bg-yellow-400/10" : i < 4 ? "bg-orange-400/10" : "bg-red-400/10"}`}>
                    <Clock size={14} className={i < 2 ? "text-yellow-400" : i < 4 ? "text-orange-400" : "text-red-400"} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold">{reminder.delay}</p>
                    <p className="text-[10px] text-muted">{reminder.message}</p>
                  </div>
                </div>
                <div className={`w-8 h-4 rounded-full ${reminder.enabled ? "bg-gold" : "bg-surface-light"}`}>
                  <div className={`w-3 h-3 bg-white rounded-full mt-0.5 ${reminder.enabled ? "ml-4" : "ml-0.5"}`} />
                </div>
              </div>
            ))}
          </div>
          {/* Currently overdue */}
          <div className="card">
            <h4 className="text-xs font-semibold mb-3 flex items-center gap-2 text-red-400">
              <AlertTriangle size={12} /> Currently Overdue
            </h4>
            <div className="space-y-1.5">
              {MOCK_INVOICES.filter(i => i.status === "overdue").length === 0 ? (
                <p className="text-[10px] text-muted text-center py-4">No overdue invoices</p>
              ) : MOCK_INVOICES.filter(i => i.status === "overdue").map(inv => (
                <div key={inv.id} className="flex items-center justify-between p-2.5 rounded bg-red-400/5 border border-red-400/10 text-[10px]">
                  <div>
                    <p className="font-semibold">{inv.client} - {inv.id}</p>
                    <p className="text-[9px] text-muted">Due: {inv.dueDate}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-bold text-red-400">{formatCurrency(inv.amount)}</p>
                    <button className="text-[9px] px-2 py-1 rounded bg-gold/10 text-gold hover:bg-gold/20">Send Reminder</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== INVOICE TEMPLATES ===== */}
      {activeTab === "templates" && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Invoice Templates</h3>
          {INVOICE_TEMPLATES.length === 0 && (
            <div className="card text-center py-8">
              <FileText size={20} className="mx-auto mb-2 text-muted/30" />
              <p className="text-xs text-muted">No invoice templates yet</p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {INVOICE_TEMPLATES.map(t => (
              <div key={t.id} className="card p-4 hover:border-gold/10 transition-all cursor-pointer">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center">
                    <FileText size={16} className="text-gold" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold">{t.name}</p>
                    <p className="text-[10px] text-muted">{t.description}</p>
                  </div>
                </div>
                <div className="flex gap-1.5 mt-2">
                  {t.sections.map(s => (
                    <span key={s} className="text-[8px] px-1.5 py-0.5 rounded bg-white/5 text-muted">{s}</span>
                  ))}
                </div>
                <button className="btn-secondary text-[9px] mt-3 w-full">Use Template</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== AGING REPORT ===== */}
      {activeTab === "aging" && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle size={14} className="text-gold" /> Accounts Receivable Aging
          </h3>
          <div className="grid grid-cols-5 gap-3">
            {[
              { range: "Current", amount: totalSent - totalOverdue, count: MOCK_INVOICES.filter(i => i.status === "sent" && i.dueDate >= today).length, color: "text-green-400" },
              { range: "1-7 days", amount: 0, count: 0, color: "text-yellow-400" },
              { range: "8-14 days", amount: 0, count: 0, color: "text-orange-400" },
              { range: "15-30 days", amount: 0, count: 0, color: "text-red-400" },
              { range: "30+ days", amount: 0, count: 0, color: "text-red-400" },
            ].map((bucket, i) => (
              <div key={i} className="card text-center p-3">
                <p className="text-[9px] text-muted uppercase mb-1">{bucket.range}</p>
                <p className={`text-lg font-bold ${bucket.color}`}>{formatCurrency(bucket.amount)}</p>
                <p className="text-[8px] text-muted">{bucket.count} invoice{bucket.count !== 1 ? "s" : ""}</p>
              </div>
            ))}
          </div>
          <div className="card">
            <h4 className="text-xs font-semibold mb-3">Invoice History</h4>
            <div className="space-y-1">
              <div className="grid grid-cols-6 text-[9px] text-muted uppercase tracking-wider font-semibold py-1.5 px-2">
                <span>Invoice</span><span>Client</span><span>Amount</span><span>Due Date</span><span>Status</span><span>Age</span>
              </div>
              {MOCK_INVOICES.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-[10px] text-muted">No invoice history yet</p>
                </div>
              ) : MOCK_INVOICES.map(inv => {
                const dueDate = new Date(inv.dueDate);
                const ageDays = Math.max(0, Math.floor((Date.now() - dueDate.getTime()) / 86400000));
                return (
                  <div key={inv.id} className="grid grid-cols-6 text-[10px] py-2 px-2 rounded bg-surface-light items-center">
                    <span className="font-mono text-muted">{inv.id}</span>
                    <span className="font-medium">{inv.client}</span>
                    <span className="font-bold">{formatCurrency(inv.amount, inv.currency)}</span>
                    <span className="text-muted">{inv.dueDate}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full w-fit ${
                      inv.status === "paid" ? "bg-green-400/10 text-green-400" :
                      inv.status === "overdue" ? "bg-red-400/10 text-red-400" :
                      "bg-yellow-400/10 text-yellow-400"
                    }`}>{inv.status}</span>
                    <span className={ageDays > 7 ? "text-red-400" : "text-muted"}>{ageDays}d</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===== REVENUE SUMMARY ===== */}
      {activeTab === "revenue" && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 size={14} className="text-gold" /> Revenue Summary
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="card text-center p-5">
              <p className="text-[10px] text-muted uppercase mb-1">This Month</p>
              <p className="text-2xl font-bold text-gold">{formatCurrency(totalPaid)}</p>
              <p className="text-[9px] text-muted mt-1">Current month</p>
            </div>
            <div className="card text-center p-5">
              <p className="text-[10px] text-muted uppercase mb-1">This Quarter</p>
              <p className="text-2xl font-bold text-purple-400">{formatCurrency(totalPaid * 3)}</p>
              <p className="text-[9px] text-muted mt-1">Q2 2026</p>
            </div>
            <div className="card text-center p-5">
              <p className="text-[10px] text-muted uppercase mb-1">Year to Date</p>
              <p className="text-2xl font-bold text-green-400">{formatCurrency(totalPaid * 4)}</p>
              <p className="text-[9px] text-muted mt-1">Jan - Apr 2026</p>
            </div>
          </div>
          {/* Monthly bar chart */}
          <div className="card">
            <h4 className="text-xs font-semibold mb-3">Monthly Revenue</h4>
            <div className="flex items-end gap-3 h-40">
              {MOCK_INVOICES.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-[10px] text-muted">No revenue data yet</p>
                </div>
              ) : [
                { month: "Jan", amount: 0 },
                { month: "Feb", amount: 0 },
                { month: "Mar", amount: 0 },
                { month: "Apr", amount: totalPaid },
              ].map((m, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <p className="text-[9px] font-bold">{formatCurrency(m.amount)}</p>
                  <div className="w-full bg-gold rounded-t" style={{ height: `${m.amount > 0 ? Math.max((m.amount / 20000) * 100, 4) : 0}%`, minHeight: m.amount > 0 ? 8 : 2 }} />
                  <span className="text-[8px] text-muted">{m.month}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Collection rate */}
          <div className="card">
            <h4 className="text-xs font-semibold mb-3">Collection Metrics</h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-surface-light rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-green-400">--</p>
                <p className="text-[9px] text-muted">Collection Rate</p>
              </div>
              <div className="bg-surface-light rounded-lg p-3 text-center">
                <p className="text-xl font-bold">--</p>
                <p className="text-[9px] text-muted">Avg Days to Pay</p>
              </div>
              <div className="bg-surface-light rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-gold">{formatCurrency(recurringTotal)}</p>
                <p className="text-[9px] text-muted">Monthly Recurring</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
