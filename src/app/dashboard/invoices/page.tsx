"use client";

import { ArrowRight, ArrowsClockwise, CaretRight, ChartBar, CheckCircle, Clock, Copy, CreditCard, FileText, Globe, Lightning, MagnifyingGlass, PaperPlaneTilt, Plus, Sparkle, Warning, X } from "@phosphor-icons/react";

import { useState, useEffect } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { EmptyState } from "@/components/ui/empty-state-illustration";
import { PrismPanel, PRISM_RAINBOW_GRADIENT } from "@/components/prism";
import { MotionPage } from "@/components/motion/motion-page";

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

// Reserved for future user-saved templates. Keep empty so the UI renders the
// honest empty state rather than fake fixtures.
const INVOICE_TEMPLATES: { id: string; name: string; description: string; sections: string[] }[] = [];

const formatCurrency = (amount: number, currency: string = "USD") => {
  if (currency === "EUR") return `€${amount.toLocaleString()}`;
  if (currency === "GBP") return `£${amount.toLocaleString()}`;
  return `$${amount.toLocaleString()}`;
};

const RAINBOW_BAR = {
  height: 3,
  background: PRISM_RAINBOW_GRADIENT,
};

const containerVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } };
const itemVariants = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.32, 0.72, 0, 1] as [number, number, number, number] } } };

export default function InvoicesPage() {
  const [activeTab, setActiveTab] = useState<MainTab>("all");
  const [filter, setFilter] = useState<"all" | "sent" | "paid" | "overdue" | "draft">("all");
  const [search, setSearch] = useState("");
  const [selectedCurrency, setSelectedCurrency] = useState("USD");
  const [taxRate, setTaxRate] = useState(0);
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);
  const [invoicesData, setInvoicesData] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("invoices")
          .select("id, client_id, description, amount, status, due_date, paid_at, created_at, currency, clients:client_id(business_name)")
          .order("created_at", { ascending: false });
        if (cancelled) return;
        if (error) {
          console.error("[invoices] fetch error:", error);
          toast.error("Couldn't load invoices — try refreshing.");
          setInvoicesData([]);
        } else {
          const mapped: Invoice[] = (data || []).map((row: Record<string, unknown>) => {
            const rawClients = row.clients;
            const clientName = Array.isArray(rawClients)
              ? ((rawClients[0] as { business_name?: string } | undefined)?.business_name ?? "Unknown")
              : ((rawClients as { business_name?: string } | null)?.business_name ?? "Unknown");
            const status = (row.status as Invoice["status"]) || "draft";
            return {
              id: (row.id as string).slice(0, 8),
              client: clientName,
              amount: Number(row.amount) || 0,
              status,
              dueDate: (row.due_date as string) || "",
              sentDate: (row.created_at as string)?.slice(0, 10) || "",
              description: (row.description as string) || "Invoice",
              currency: (row.currency as string) || "USD",
              tax: 0,
              recurring: false,
              paymentLink: "",
            };
          });
          setInvoicesData(mapped);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("[invoices] fetch error:", err);
          toast.error("Couldn't load invoices — try refreshing.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [supabase]);

  const today = new Date().toISOString().split("T")[0];
  const filtered = invoicesData.filter(inv => {
    const statusMatch = filter === "all" || (filter === "overdue" ? inv.status === "sent" && inv.dueDate < today || inv.status === "overdue" : inv.status === filter);
    const searchMatch = !search || inv.client.toLowerCase().includes(search.toLowerCase()) || inv.id.toLowerCase().includes(search.toLowerCase());
    return statusMatch && searchMatch;
  });

  const totalSent = invoicesData.filter(i => i.status === "sent").reduce((s, i) => s + i.amount, 0);
  const totalPaid = invoicesData.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0);
  const totalOverdue = invoicesData.filter(i => i.status === "overdue").reduce((s, i) => s + i.amount, 0);
  const totalDraft = invoicesData.filter(i => i.status === "draft").reduce((s, i) => s + i.amount, 0);
  const recurringTotal = invoicesData.filter(i => i.recurring && i.status !== "cancelled").reduce((s, i) => s + i.amount, 0);

  const TABS: { key: MainTab; label: string; icon: React.ReactNode }[] = [
    { key: "all", label: "All Invoices", icon: <CreditCard size={14} /> },
    { key: "builder", label: "Invoice Builder", icon: <Plus size={14} /> },
    { key: "recurring", label: "Recurring", icon: <ArrowsClockwise size={14} /> },
    { key: "reminders", label: "Reminders", icon: <Clock size={14} /> },
    { key: "templates", label: "Templates", icon: <FileText size={14} /> },
    { key: "aging", label: "Aging Report", icon: <Warning size={14} /> },
    { key: "revenue", label: "Revenue", icon: <ChartBar size={14} /> },
  ];

  return (
    <MotionPage className="space-y-5">{/* Hero Header */}{/* -- Invoices command strip -- */}
    <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-[0.2em] text-text-muted font-editorial italic mb-1">Billing &amp; Invoices</p>
        <h1 className="text-2xl font-display font-bold text-text-primary">Invoices</h1>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex gap-2">
                  <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                    <Link
                      href="/dashboard/invoices/new"
                      className="btn-pill text-xs flex items-center gap-1.5"
                    >
                      <Sparkle size={12} /> AI Smart Invoice
                    </Link>
                  </motion.div>
                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setActiveTab("builder")}
                    className="btn-pill-ghost text-xs flex items-center gap-1.5"
                  >
                    <Plus size={12} /> New Invoice
                  </motion.button>
                </div>
      </div>
    </div>{/* Loading note */}{loading && (
              <p className="text-[11px] text-text-muted flex items-center gap-1.5"><ArrowsClockwise size={11} className="animate-spin" /> Loading invoices…</p>
            )}{/* Stats */}<div className="space-y-3 mb-4">
  <div className="grid grid-cols-2 lg:grid-cols-[4fr_2fr_2fr] gap-3">
    <motion.div
      className="col-span-2 lg:col-span-1 glass rounded-2xl p-5 flex items-center gap-4 shadow-[0_2px_16px_rgba(0,0,0,0.35)]"
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
    >
      <div>
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Collected</p>
        <p className="font-display text-3xl font-bold tracking-[-0.03em] text-emerald-400 tabular-nums">{formatCurrency(totalPaid)}</p>
        <p className="text-[11px] text-text-muted mt-1.5">payments received</p>
      </div>
    </motion.div>
    <motion.div
      className="glass rounded-2xl p-5 flex flex-col justify-center shadow-[0_2px_16px_rgba(0,0,0,0.35)]"
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, delay: 0.10, ease: [0.22, 1, 0.36, 1] }}
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Outstanding</p>
      <p className="font-display text-2xl font-bold tracking-[-0.02em] text-amber-400 tabular-nums">{formatCurrency(totalSent)}</p>
      <p className="text-[11px] text-text-muted mt-1.5">awaiting payment</p>
    </motion.div>
    <motion.div
      className="glass rounded-2xl p-5 flex flex-col justify-center shadow-[0_2px_16px_rgba(0,0,0,0.35)]"
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, delay: 0.14, ease: [0.22, 1, 0.36, 1] }}
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Overdue</p>
      <p className="font-display text-2xl font-bold tracking-[-0.02em] text-rose-400 tabular-nums">{formatCurrency(totalOverdue)}</p>
      <p className="text-[11px] text-text-muted mt-1.5">past due date</p>
    </motion.div>
  </div>
  <div className="grid grid-cols-2 gap-3">
    <motion.div
      className="glass rounded-2xl p-5 flex flex-col justify-center shadow-[0_2px_16px_rgba(0,0,0,0.35)]"
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Draft</p>
      <p className="font-display text-2xl font-bold tracking-[-0.02em] text-text-muted tabular-nums">{formatCurrency(totalDraft)}</p>
      <p className="text-[11px] text-text-muted mt-1.5">not yet sent</p>
    </motion.div>
    <motion.div
      className="glass rounded-2xl p-5 flex flex-col justify-center shadow-[0_2px_16px_rgba(0,0,0,0.35)]"
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Monthly Recurring</p>
      <p className="font-display text-2xl font-bold tracking-[-0.02em] text-brand-accent tabular-nums">{formatCurrency(recurringTotal)}</p>
      <p className="text-[11px] text-text-muted mt-1.5">active subscriptions</p>
    </motion.div>
  </div>
</div>{/* Tabs */}<div className="tab-pill-strip">
              {TABS.map(t => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`tab-pill${activeTab === t.key ? " active" : ""}`}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>{/* ===== ALL INVOICES ===== */}{activeTab === "all" && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="glass rounded-lg w-full pl-9 pr-3 py-2 text-xs bg-transparent border border-border-subtle focus:outline-none focus:ring-1 focus:ring-brand-accent/20 placeholder:text-text-muted/50" 
                      placeholder="Search invoices..."
                      aria-label="Search invoices"
 />
                  </div>
                  <div className="tab-pill-strip">
                    {(["all", "sent", "paid", "overdue", "draft"] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`tab-pill capitalize${filter === f ? " active" : ""}`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                <PrismPanel rainbow padding="p-0" className="overflow-hidden">
                  {filtered.length === 0 ? (
                    <div className="p-4">
                      <EmptyState
                        type="no-invoices"
                        title="No Invoices Yet"
                        description="Create your first invoice to start tracking payments, set up recurring billing, and get paid faster."
                        action={
                          <button onClick={() => setActiveTab("builder")} className="btn-primary text-xs">
                            Create Invoice
                          </button>
                        }
 />
                    </div>
                  ) : (
                    <motion.div className="divide-y divide-border-subtle" variants={containerVariants} initial="hidden" animate="visible">
                      {filtered.map((inv) => {
                        const isOverdue = (inv.status === "sent" && inv.dueDate < today) || inv.status === "overdue";
                        return (
                          <div key={inv.id}>
                            <motion.div
                              variants={itemVariants}
                              onClick={() => setExpandedInvoice(expandedInvoice === inv.id ? null : inv.id)}
                              className={`flex items-center justify-between p-4 transition-all cursor-pointer hover:bg-[rgba(212,255,0,0.05)] ${
                                isOverdue ? "bg-rose-400/10" : ""
                              }`}
>
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                  inv.status === "paid" ? "bg-emerald-400/10" : isOverdue ? "bg-rose-400/10" : inv.status === "draft" ? "bg-surface" : "bg-amber-400/10"
                                }`}>
                                  {inv.status === "paid" ? <CheckCircle size={16} className="text-emerald-400" /> :
                                   isOverdue ? <Warning size={16} className="text-rose-400" /> :
                                   inv.status === "draft" ? <FileText size={16} className="text-text-muted" /> :
                                   <Clock size={16} className="text-amber-400" />}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-semibold">{inv.client}</p>
                                    <span className="text-[8px] font-mono text-text-muted">{inv.id}</span>
                                    {inv.recurring && <ArrowsClockwise size={8} className="text-brand-accent" />}
                                    {inv.currency !== "USD" && <Globe size={8} className="text-indigo-400" />}
                                  </div>
                                  <p className="text-[10px] text-text-muted">{inv.description}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <p className="text-lg font-bold">{formatCurrency(inv.amount, inv.currency)}</p>
                                  <p className="text-[9px] text-text-muted">Due: {inv.dueDate}</p>
                                </div>
                                <span className={`text-[9px] px-2 py-0.5 rounded-full ${
                                  inv.status === "paid" ? "bg-emerald-400/10 text-emerald-400 border border-emerald-400/20" :
                                  isOverdue ? "bg-rose-400/10 text-rose-400 border border-rose-400/20" :
                                  inv.status === "draft" ? "bg-white/[0.05] text-text-muted border border-border-subtle" :
                                  inv.status === "sent" ? "bg-indigo-400/10 text-indigo-400 border border-indigo-400/20" :
                                  "bg-amber-400/10 text-amber-400 border border-amber-400/20"
                                }`}>{isOverdue ? "overdue" : inv.status}</span>
                                <CaretRight size={14} className="text-text-muted" />
                              </div>
                            </motion.div>
                            {expandedInvoice === inv.id && (
                              <div className="ml-4 mb-3 p-3 rounded-lg bg-surface border border-border-subtle space-y-2 mx-4">
                                <div className="grid grid-cols-4 gap-3 text-[10px]">
                                  <div><span className="text-text-muted">Sent:</span> <span>{inv.sentDate || "Not sent"}</span></div>
                                  <div><span className="text-text-muted">Due:</span> <span>{inv.dueDate}</span></div>
                                  <div><span className="text-text-muted">Tax:</span> <span>{inv.tax> 0 ? formatCurrency(inv.tax) : "None"}</span></div>
                                  <div><span className="text-text-muted">Currency:</span> <span>{inv.currency}</span></div>
                                </div>
                                <div className="flex gap-2 pt-2 items-center">
                                  <Link href="/dashboard/billing" className="btn-ghost text-[9px] flex items-center gap-1">
                                    <ArrowRight size={9} /> Manage in Stripe portal
                                  </Link>
                                  {inv.paymentLink && (
                                    <button
                                      onClick={() => {
                                        navigator.clipboard.writeText(inv.paymentLink)
                                          .then(() => toast.success("Payment link copied"))
                                          .catch(() => toast.error("Copy failed"));
                                      }}
                                      className="btn-ghost text-[9px] flex items-center gap-1">
                                      <Copy size={9} /> Copy Pay Link
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </motion.div>
                  )}
                </PrismPanel>
              </div>
            )}{/* ===== INVOICE BUILDER ===== */}{activeTab === "builder" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-2 space-y-3">
                    <PrismPanel glow padding="p-4" className="space-y-3">
                      <h3 className="text-sm font-semibold">Invoice Builder</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[9px] text-text-muted uppercase tracking-wider block mb-1">Client</label>
                          <select className="input w-full text-xs">
                            <option value="">Select client...</option>
                            {Array.from(new Set(invoicesData.map(i => i.client))).map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[9px] text-text-muted uppercase tracking-wider block mb-1">Currency</label>
                          <select value={selectedCurrency} onChange={e => setSelectedCurrency(e.target.value)} className="input w-full text-xs">
                            <option value="USD">USD ($)</option>
                            <option value="EUR">EUR (€)</option>
                            <option value="GBP">GBP (£)</option>
                            <option value="SEK">SEK (kr)</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="text-[9px] text-text-muted uppercase tracking-wider block mb-1">Description</label>
                        <input className="input w-full text-xs" placeholder="e.g., Growth Package - April 2026" />
                      </div>

                      {/* Line Items */}
                      <div>
                        <label className="text-[9px] text-text-muted uppercase tracking-wider block mb-1">Line Items</label>
                        <div className="space-y-1.5">
                          <div className="grid grid-cols-12 text-[9px] text-text-muted uppercase tracking-wider font-semibold py-1 px-2">
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
                              <button
                                onClick={() => toast("The in-app invoice builder is being replaced with Stripe's hosted invoices. Use /dashboard/billing ? Stripe portal to create real invoices today.", { icon: "??", duration: 6000 })}
                                className="col-span-1 text-right text-text-muted hover:text-rose-400"><X size={10} /></button>
                            </div>
                          ))}
                          <button
                            onClick={() => toast("In-app line items aren't wired. Create invoices via Stripe's hosted portal at /dashboard/billing.", { icon: "??", duration: 6000 })}
                            className="text-[9px] text-brand-accent flex items-center gap-1 px-2"><Plus size={9} /> Add Line Item</button>
                        </div>
                      </div>

                      {/* Tax Calculator */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[9px] text-text-muted uppercase tracking-wider block mb-1">Tax Rate (%)</label>
                          <input type="number" value={taxRate} onChange={e => setTaxRate(Number(e.target.value))} className="input w-full text-xs" placeholder="0" />
                        </div>
                        <div>
                          <label className="text-[9px] text-text-muted uppercase tracking-wider block mb-1">Due In</label>
                          <select className="input w-full text-xs">
                            <option value="7">7 days</option>
                            <option value="14">14 days</option>
                            <option value="30">30 days</option>
                            <option value="60">60 days</option>
                          </select>
                        </div>
                      </div>
                    </PrismPanel>
                  </div>

                  {/* Sidebar */}
                  <div className="space-y-3">
                    <PrismPanel padding="p-4">
                      <h4 className="text-xs font-semibold mb-3">Invoice Summary</h4>
                      <div className="space-y-2 text-[10px]">
                        <div className="flex justify-between"><span className="text-text-muted">Subtotal</span><span>{formatCurrency(2497, selectedCurrency)}</span></div>
                        <div className="flex justify-between"><span className="text-text-muted">Tax ({taxRate}%)</span><span>{formatCurrency(Math.round(2497 * taxRate / 100), selectedCurrency)}</span></div>
                        <div className="border-t border-border-subtle pt-2 flex justify-between font-bold">
                          <span>Total</span><span className="text-brand-accent font-bold">{formatCurrency(Math.round(2497 * (1 + taxRate / 100)), selectedCurrency)}</span>
                        </div>
                      </div>
                      <Link href="/dashboard/billing" className="btn-primary w-full text-xs mt-4 flex items-center justify-center gap-1.5">
                        <PaperPlaneTilt size={12} /> Create in Stripe portal
                      </Link>
                      <button
                        onClick={() => toast("Draft invoices save to Stripe. Open /dashboard/billing ? Manage subscription to draft there.", { icon: "??", duration: 6000 })}
                        className="btn-secondary w-full text-xs mt-2 flex items-center justify-center gap-1.5">
                        <FileText size={12} /> Save as Draft
                      </button>
                    </PrismPanel>

                    {/* Quick Invoice from Proposal */}
                    <PrismPanel padding="p-4">
                      <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                        <Lightning size={12} className="text-brand-accent" /> Quick Invoice
                      </h4>
                      <p className="text-[9px] text-text-muted mb-3">Generate invoice from an accepted proposal</p>
                      <select className="input w-full text-xs mb-2">
                        <option value="">Select proposal...</option>
                      </select>
                      <button
                        onClick={() => toast("Proposals ? invoice pipeline ships with the proposals module. Track progress on the roadmap.", { icon: "??", duration: 6000 })}
                        className="w-full text-xs flex items-center justify-center gap-1.5 bg-[rgba(212,255,0,0.08)] text-brand-accent border border-[rgba(212,255,0,0.25)] rounded-lg py-1.5 hover:bg-[rgba(212,255,0,0.14)] transition-all">
                        <ArrowRight size={12} /> Create from Proposal
                      </button>
                    </PrismPanel>

                    {/* Payment Link */}
                    <PrismPanel padding="p-4">
                      <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                        <CreditCard size={12} className="text-brand-accent" /> Payment Links
                      </h4>
                      <p className="text-[9px] text-text-muted mb-2">Stripe-powered payment links for quick collection</p>
                      <Link href="/dashboard/clients" className="btn-secondary w-full text-xs flex items-center justify-center gap-1.5">
                        <CreditCard size={12} /> Open client ? Subscribe
                      </Link>
                    </PrismPanel>
                  </div>
                </div>
              </div>
            )}{/* ===== RECURRING INVOICES ===== */}{activeTab === "recurring" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <ArrowsClockwise size={14} className="text-brand-accent" /> Recurring Invoices
                  </h3>
                  <Link href="/dashboard/clients" className="btn-primary text-xs flex items-center gap-1.5">
                    <Plus size={12} /> Add Recurring
                  </Link>
                </div>
                <div className="space-y-2">
                  {invoicesData.filter(i => i.recurring).length === 0 ? (
                    <PrismPanel padding="py-8 px-4" className="text-center">
                      <ArrowsClockwise size={20} className="mx-auto mb-2 text-text-muted/30" />
                      <p className="text-xs text-text-muted">No recurring invoices yet</p>
                    </PrismPanel>
                  ) : invoicesData.filter(i => i.recurring).map((inv, index) => (
                    <motion.div
                      key={inv.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.18, delay: index * 0.05 }}
                      className="glass rounded-xl p-4 flex items-center justify-between border border-border-subtle" 
>
                      <div className="flex items-center gap-3">
                        <ArrowsClockwise size={14} className="text-brand-accent" />
                        <div>
                          <p className="text-xs font-semibold">{inv.client}</p>
                          <p className="text-[10px] text-text-muted">{inv.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-[10px]">
                        <div className="text-center">
                          <p className="font-bold text-brand-accent">{formatCurrency(inv.amount)}</p>
                          <p className="text-[8px] text-text-muted">Monthly</p>
                        </div>
                        <div className="text-center">
                          <p className="font-medium">1st of month</p>
                          <p className="text-[8px] text-text-muted">Next invoice</p>
                        </div>
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">Active</span>
                        <button
                          onClick={() => toast("Pause recurring from the Stripe customer portal — use Billing ? Manage subscription.", { icon: "??", duration: 6000 })}
                          className="text-[9px] text-text-muted hover:text-rose-400">Pause</button>
                      </div>
                    </motion.div>
                  ))}
                </div>
                <PrismPanel padding="p-4" className="text-center">
                  <p className="text-sm font-bold text-brand-accent">{formatCurrency(recurringTotal)}/mo</p>
                  <p className="text-[10px] text-text-muted">Total monthly recurring revenue from invoices</p>
                </PrismPanel>
              </div>
            )}{/* ===== LATE PAYMENT REMINDERS ===== */}{activeTab === "reminders" && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Clock size={14} className="text-brand-accent" /> Late Payment Reminder Settings
                </h3>
                <div className="space-y-2">
                  {[
                    { delay: "1 day overdue", message: "Friendly reminder that your invoice is due", enabled: true },
                    { delay: "3 days overdue", message: "Your invoice is 3 days past due", enabled: true },
                    { delay: "7 days overdue", message: "Important: Payment overdue - please resolve", enabled: true },
                    { delay: "14 days overdue", message: "Final notice before account review", enabled: false },
                    { delay: "30 days overdue", message: "Account suspension warning", enabled: false },
                  ].map((reminder, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.18, delay: i * 0.05 }}
                      className={`glass rounded-xl p-4 flex items-center justify-between border border-border-subtle ${!reminder.enabled ? "opacity-50" : ""}`} 
>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${i < 2 ? "bg-amber-400/10" : i < 4 ? "bg-orange-400/10" : "bg-rose-400/10"}`}>
                          <Clock size={14} className={i < 2 ? "text-amber-400" : i < 4 ? "text-orange-400" : "text-rose-400"} />
                        </div>
                        <div>
                          <p className="text-xs font-semibold">{reminder.delay}</p>
                          <p className="text-[10px] text-text-muted">{reminder.message}</p>
                        </div>
                      </div>
                      <div className={`w-8 h-4 rounded-full ${reminder.enabled ? "bg-brand-accent" : "bg-surface-light"}`}>
                        <div className={`w-3 h-3 bg-white rounded-full mt-0.5 ${reminder.enabled ? "ml-4" : "ml-0.5"}`} />
                      </div>
                    </motion.div>
                  ))}
                </div>
                {/* Currently overdue */}
                <PrismPanel padding="p-4">
                  <h4 className="text-xs font-semibold mb-3 flex items-center gap-2 text-rose-400">
                    <Warning size={12} /> Currently Overdue
                  </h4>
                  <div className="space-y-1.5">
                    {invoicesData.filter(i => i.status === "overdue").length === 0 ? (
                      <p className="text-[10px] text-text-muted text-center py-4">No overdue invoices</p>
                    ) : invoicesData.filter(i => i.status === "overdue").map(inv => (
                      <div key={inv.id} className="flex items-center justify-between p-2.5 rounded bg-rose-400/10 border border-rose-400/20 text-[10px]">
                        <div>
                          <p className="font-semibold">{inv.client} - {inv.id}</p>
                          <p className="text-[9px] text-text-muted">Due: {inv.dueDate}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="font-bold text-rose-400">{formatCurrency(inv.amount)}</p>
                          <button
                            onClick={() => toast("Automated reminders are coming. For now, contact the client directly or use Stripe's payment reminder emails.", { icon: "??", duration: 6000 })}
                            className="text-[9px] px-2 py-1 rounded bg-[rgba(212,255,0,0.08)] text-brand-accent hover:bg-[rgba(212,255,0,0.14)]">PaperPlaneTilt Reminder</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </PrismPanel>
              </div>
            )}{/* ===== INVOICE TEMPLATES ===== */}{activeTab === "templates" && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Invoice Templates</h3>
                {INVOICE_TEMPLATES.length === 0 && (
                  <PrismPanel padding="py-8 px-4" className="text-center">
                    <FileText size={20} className="mx-auto mb-2 text-text-muted/30" />
                    <p className="text-xs text-text-muted">No invoice templates yet</p>
                  </PrismPanel>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {INVOICE_TEMPLATES.map((t, index) => (
                    <motion.div
                      key={t.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.22, delay: index * 0.06 }}
                      whileHover={{ y: -3 }}
                      className="glass rounded-xl p-4 cursor-pointer border border-border-subtle spotlight-card"
                      onMouseMove={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        e.currentTarget.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
                        e.currentTarget.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
                      }}
>
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-lg bg-[rgba(212,255,0,0.08)] flex items-center justify-center">
                          <FileText size={16} className="text-brand-accent" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold">{t.name}</p>
                          <p className="text-[10px] text-text-muted">{t.description}</p>
                        </div>
                      </div>
                      <div className="flex gap-1.5 mt-2">
                        {t.sections.map(s => (
                          <span key={s} className="text-[8px] px-1.5 py-0.5 rounded bg-white/[0.03] text-text-muted">{s}</span>
                        ))}
                      </div>
                      <button
                        onClick={() => toast("Invoice templates aren't yet persisted. Create invoices via Stripe at /dashboard/billing for now.", { icon: "??", duration: 6000 })}
                        className="btn-secondary text-[9px] mt-3 w-full">Use Template</button>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}{/* ===== AGING REPORT ===== */}{activeTab === "aging" && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Warning size={14} className="text-brand-accent" /> Accounts Receivable Aging
                </h3>
                <div className="grid grid-cols-5 gap-3">
                  {[
                    { range: "Current", amount: totalSent - totalOverdue, count: invoicesData.filter(i => i.status === "sent" && i.dueDate>= today).length, color: "text-emerald-400" },
                    { range: "1-7 days", amount: 0, count: 0, color: "text-amber-400" },
                    { range: "8-14 days", amount: 0, count: 0, color: "text-orange-400" },
                    { range: "15-30 days", amount: 0, count: 0, color: "text-rose-400" },
                    { range: "30+ days", amount: 0, count: 0, color: "text-rose-400" },
                  ].map((bucket, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.22, delay: i * 0.06 }}
                      whileHover={{ y: -2 }}
                      className="glass rounded-xl text-center p-3 overflow-hidden border border-border-subtle spotlight-card"
                      onMouseMove={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        e.currentTarget.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
                        e.currentTarget.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
                      }}
>
                      <div className="absolute top-0 left-0 right-0" style={RAINBOW_BAR} />
                      <p className="text-[9px] text-text-muted uppercase mb-1">{bucket.range}</p>
                      <p className={`text-lg font-bold ${bucket.color}`}>{formatCurrency(bucket.amount)}</p>
                      <p className="text-[8px] text-text-muted">{bucket.count} invoice{bucket.count !== 1 ? "s" : ""}</p>
                    </motion.div>
                  ))}
                </div>
                <PrismPanel padding="p-0" className="overflow-hidden">
                  <div className="p-3 border-b border-border-subtle">
                    <h4 className="text-xs font-semibold">Invoice History</h4>
                  </div>
                  <div className="divide-y divide-border-subtle">
                    <div className="grid grid-cols-6 text-[9px] text-text-muted uppercase tracking-wider font-semibold py-1.5 px-3">
                      <span>Invoice</span><span>Client</span><span>Amount</span><span>Due Date</span><span>Status</span><span>Age</span>
                    </div>
                    {invoicesData.length === 0 ? (
                      <div className="text-center py-6">
                        <p className="text-[10px] text-text-muted">No invoice history yet</p>
                      </div>
                    ) : invoicesData.map((inv, index) => {
                      const dueDate = new Date(inv.dueDate);
                      const ageDays = Math.max(0, Math.floor((Date.now() - dueDate.getTime()) / 86400000));
                      return (
                        <motion.div
                          key={inv.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.18, delay: index * 0.03 }}
                          className="grid grid-cols-6 text-[10px] py-2 px-3 hover:bg-indigo-500/5 transition-colors items-center"
>
                          <span className="font-mono text-text-muted">{inv.id}</span>
                          <span className="font-medium">{inv.client}</span>
                          <span className="font-bold">{formatCurrency(inv.amount, inv.currency)}</span>
                          <span className="text-text-muted">{inv.dueDate}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full w-fit ${
                            inv.status === "paid" ? "bg-emerald-400/10 text-emerald-400 border border-emerald-400/20" :
                            inv.status === "overdue" ? "bg-rose-400/10 text-rose-400 border border-rose-400/20" :
                            "bg-amber-400/10 text-amber-400 border border-amber-400/20"
                          }`}>{inv.status}</span>
                          <span className={ageDays> 7 ? "text-rose-400" : "text-text-muted"}>{ageDays}d</span>
                        </motion.div>
                      );
                    })}
                  </div>
                </PrismPanel>
              </div>
            )}{/* ===== REVENUE SUMMARY ===== */}{activeTab === "revenue" && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <ChartBar size={14} className="text-brand-accent" /> Revenue Summary
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: "Paid Invoices", value: formatCurrency(totalPaid), sub: "All-time collected", color: "text-emerald-400" },
                    { label: "Outstanding", value: formatCurrency(totalSent), sub: "Sent, not paid", color: "text-brand-accent" },
                    { label: "Overdue", value: formatCurrency(totalOverdue), sub: "Needs chasing", color: "text-rose-400" },
                  ].map((card, index) => (
                    <motion.div
                      key={card.label}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.22, delay: index * 0.06 }}
                      whileHover={{ y: -2 }}
                      className="glass rounded-xl text-center p-5 overflow-hidden border border-border-subtle spotlight-card"
                      onMouseMove={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        e.currentTarget.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
                        e.currentTarget.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
                      }}
>
                      <div className="absolute top-0 left-0 right-0" style={RAINBOW_BAR} />
                      <p className="text-[10px] text-text-muted uppercase mb-1">{card.label}</p>
                      <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
                      <p className="text-[9px] text-text-muted mt-1">{card.sub}</p>
                    </motion.div>
                  ))}
                </div>
                {/* Monthly bar chart */}
                <PrismPanel padding="p-4">
                  <h4 className="text-xs font-semibold mb-3">Monthly Revenue</h4>
                  <div className="flex items-end gap-3 h-40">
                    {invoicesData.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center">
                        <p className="text-[10px] text-text-muted">No revenue data yet</p>
                      </div>
                    ) : [
                      { month: "Jan", amount: 0 },
                      { month: "Feb", amount: 0 },
                      { month: "Mar", amount: 0 },
                      { month: "Apr", amount: totalPaid },
                    ].map((m, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <p className="text-[9px] font-bold">{formatCurrency(m.amount)}</p>
                        <div className="w-full bg-brand-accent rounded-t" style={{ height: `${m.amount> 0 ? Math.max((m.amount / 20000) * 100, 4) : 0}%`, minHeight: m.amount> 0 ? 8 : 2 }} />
                        <span className="text-[8px] text-text-muted">{m.month}</span>
                      </div>
                    ))}
                  </div>
                </PrismPanel>
                {/* Collection rate */}
                <PrismPanel padding="p-4">
                  <h4 className="text-xs font-semibold mb-3">Collection Metrics</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-surface-light rounded-lg p-3 text-center">
                      <p className="text-xl font-bold text-emerald-400">--</p>
                      <p className="text-[9px] text-text-muted">Collection Rate</p>
                    </div>
                    <div className="bg-surface-light rounded-lg p-3 text-center">
                      <p className="text-xl font-bold">--</p>
                      <p className="text-[9px] text-text-muted">Avg Days to Pay</p>
                    </div>
                    <div className="bg-surface-light rounded-lg p-3 text-center">
                      <p className="text-xl font-bold text-brand-accent">{formatCurrency(recurringTotal)}</p>
                      <p className="text-[9px] text-text-muted">Monthly Recurring</p>
                    </div>
                  </div>
                </PrismPanel>
              </div>
            )}</MotionPage>
  );
}


