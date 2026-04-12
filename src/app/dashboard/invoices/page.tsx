"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { Invoice } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import StatusBadge from "@/components/ui/status-badge";
import {
  CreditCard, Plus, Send,
  Clock, CheckCircle, AlertTriangle, Loader
} from "lucide-react";
import Modal from "@/components/ui/modal";
import toast from "react-hot-toast";

export default function InvoicesPage() {
  useAuth();
  const supabase = createClient();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Array<{ id: string; business_name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<"all" | "sent" | "paid" | "overdue">("all");
  const [form, setForm] = useState({
    client_id: "", amount: "", description: "", due_days: "7",
  });

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const [{ data: inv }, { data: cl }] = await Promise.all([
      supabase.from("invoices").select("*").order("created_at", { ascending: false }),
      supabase.from("clients").select("id, business_name").eq("is_active", true),
    ]);
    setInvoices(inv || []);
    setClients(cl || []);
    setLoading(false);
  }

  async function createInvoice() {
    if (!form.client_id || !form.amount) { toast.error("Client and amount required"); return; }
    setCreating(true);
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + parseInt(form.due_days));

    await supabase.from("invoices").insert({
      client_id: form.client_id,
      amount: parseFloat(form.amount),
      description: form.description || `Invoice — ${clients.find(c => c.id === form.client_id)?.business_name}`,
      status: "sent",
      due_date: dueDate.toISOString().split("T")[0],
    });

    toast.success("Invoice created!");
    setShowCreate(false);
    setForm({ client_id: "", amount: "", description: "", due_days: "7" });
    fetchData();
    setCreating(false);
  }

  async function sendPaymentLink(invoice: Invoice) {
    toast.loading("Creating payment link...");
    try {
      const res = await fetch("/api/invoices/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice_id: invoice.id }),
      });
      toast.dismiss();
      const data = await res.json();
      if (data.checkout_url) {
        navigator.clipboard.writeText(data.checkout_url);
        toast.success("Payment link copied! Send to client.");
      } else {
        toast.error(data.error || "Failed to create link");
      }
    } catch { toast.dismiss(); toast.error("Error"); }
  }

  const today = new Date().toISOString().split("T")[0];
  const filtered = invoices.filter(inv => {
    if (filter === "all") return true;
    if (filter === "overdue") return inv.status === "sent" && inv.due_date && inv.due_date < today;
    return inv.status === filter;
  });

  const totalSent = invoices.filter(i => i.status === "sent").reduce((s, i) => s + i.amount, 0);
  const totalPaid = invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0);
  const totalOverdue = invoices.filter(i => i.status === "sent" && i.due_date && i.due_date < today).reduce((s, i) => s + i.amount, 0);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader size={20} className="animate-spin text-gold" /></div>;

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2">
            <CreditCard size={18} className="text-gold" /> Invoices
          </h1>
          <p className="text-xs text-muted mt-0.5">{invoices.length} invoices · Track payments and send reminders</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary text-xs flex items-center gap-1.5">
          <Plus size={12} /> New Invoice
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="card text-center">
          <p className="text-[10px] text-muted">Outstanding</p>
          <p className="text-xl font-bold text-warning">{formatCurrency(totalSent)}</p>
        </div>
        <div className="card text-center">
          <p className="text-[10px] text-muted">Collected</p>
          <p className="text-xl font-bold text-success">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="card text-center">
          <p className="text-[10px] text-muted">Overdue</p>
          <p className="text-xl font-bold text-danger">{formatCurrency(totalOverdue)}</p>
        </div>
        <div className="card text-center">
          <p className="text-[10px] text-muted">Total</p>
          <p className="text-xl font-bold text-foreground">{formatCurrency(totalPaid + totalSent)}</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5">
        {(["all", "sent", "paid", "overdue"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-[10px] px-3 py-1.5 rounded-lg transition-all capitalize ${
              filter === f ? "bg-gold/10 text-gold border border-gold/20" : "text-muted border border-white/[0.05]"
            }`}>
            {f} {f !== "all" && `(${f === "overdue" ? invoices.filter(i => i.status === "sent" && i.due_date && i.due_date < today).length : invoices.filter(i => i.status === f).length})`}
          </button>
        ))}
      </div>

      {/* Invoice list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="card text-center py-12">
            <CreditCard size={24} className="mx-auto mb-2 text-muted/30" />
            <p className="text-xs text-muted">No invoices found</p>
          </div>
        ) : (
          filtered.map(inv => {
            const isOverdue = inv.status === "sent" && inv.due_date && inv.due_date < today;
            return (
              <div key={inv.id} className={`flex items-center justify-between p-4 rounded-xl transition-all bg-surface-light border ${isOverdue ? "border-danger/15" : "border-border"}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    inv.status === "paid" ? "bg-success/10" : isOverdue ? "bg-danger/10" : "bg-warning/10"
                  }`}>
                    {inv.status === "paid" ? <CheckCircle size={16} className="text-success" /> :
                     isOverdue ? <AlertTriangle size={16} className="text-danger" /> :
                     <Clock size={16} className="text-warning" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{inv.description || "Invoice"}</p>
                    <p className="text-[10px] text-muted">
                      Due: {inv.due_date ? formatDate(inv.due_date) : "—"}
                      {isOverdue && <span className="text-danger ml-1">OVERDUE</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <p className="text-lg font-bold">{formatCurrency(inv.amount)}</p>
                  <StatusBadge status={inv.status} />
                  {inv.status === "sent" && (
                    <button onClick={() => sendPaymentLink(inv)}
                      className="btn-ghost text-[9px] flex items-center gap-1">
                      <Send size={10} /> Payment Link
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Invoice" size="md">
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Client *</label>
            <select value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })} className="input w-full">
              <option value="">Select client</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.business_name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Amount *</label>
              <input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}
                className="input w-full" placeholder="2497" />
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Due In (days)</label>
              <select value={form.due_days} onChange={e => setForm({ ...form, due_days: e.target.value })} className="input w-full">
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
                <option value="60">60 days</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-semibold">Description</label>
            <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              className="input w-full" placeholder="e.g. Growth Package — April 2026" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setShowCreate(false)} className="btn-secondary text-xs">Cancel</button>
            <button onClick={createInvoice} disabled={creating} className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50">
              {creating ? <Loader size={12} className="animate-spin" /> : <CreditCard size={12} />}
              {creating ? "Creating..." : "Create & Send"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
