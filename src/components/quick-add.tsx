"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Plus, Users, DollarSign, CreditCard, X, Loader
} from "lucide-react";
import toast from "react-hot-toast";

type QuickAddType = "lead" | "deal" | "invoice" | null;

export default function QuickAdd() {
  const [open, setOpen] = useState<QuickAddType>(null);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  // Lead form
  const [lead, setLead] = useState({ business_name: "", email: "", phone: "", industry: "" });
  // Deal form
  const [deal, setDeal] = useState({ title: "", amount: "" });
  // Invoice form
  const [invoice, setInvoice] = useState({ client_id: "", amount: "", description: "" });
  const [clients, setClients] = useState<Array<{ id: string; business_name: string }>>([]);

  useEffect(() => {
    supabase.from("clients").select("id, business_name").eq("is_active", true).then(({ data }) => {
      setClients(data || []);
    });
  }, []);

  // Global shortcut: Shift+N opens quick add menu
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return;

      if (e.shiftKey && e.key === "N") {
        e.preventDefault();
        setOpen("lead");
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  async function saveLead() {
    if (!lead.business_name) { toast.error("Business name required"); return; }
    setSaving(true);
    await supabase.from("leads").insert({
      business_name: lead.business_name,
      email: lead.email || null,
      phone: lead.phone || null,
      industry: lead.industry || null,
      source: "manual",
      status: "new",
    });
    toast.success("Lead added!");
    setLead({ business_name: "", email: "", phone: "", industry: "" });
    setOpen(null);
    setSaving(false);
  }

  async function saveDeal() {
    if (!deal.title || !deal.amount) { toast.error("Title and amount required"); return; }
    setSaving(true);
    await supabase.from("deals").insert({
      title: deal.title,
      amount: parseFloat(deal.amount),
      status: "open",
      stage: "prospect",
    });
    toast.success("Deal added!");
    setDeal({ title: "", amount: "" });
    setOpen(null);
    setSaving(false);
  }

  async function saveInvoice() {
    if (!invoice.client_id || !invoice.amount) { toast.error("Client and amount required"); return; }
    setSaving(true);
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);
    await supabase.from("invoices").insert({
      client_id: invoice.client_id,
      amount: parseFloat(invoice.amount),
      description: invoice.description || "Invoice",
      status: "sent",
      due_date: dueDate.toISOString().split("T")[0],
    });
    toast.success("Invoice created!");
    setInvoice({ client_id: "", amount: "", description: "" });
    setOpen(null);
    setSaving(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9998]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(null)} />
      <div className="relative max-w-sm mx-auto mt-[20vh]">
        <div className="rounded-2xl overflow-hidden fade-in bg-surface border border-border">
          {/* Type selector */}
          <div className="flex border-b border-border">
            {([
              { type: "lead" as const, icon: <Users size={12} />, label: "Lead" },
              { type: "deal" as const, icon: <DollarSign size={12} />, label: "Deal" },
              { type: "invoice" as const, icon: <CreditCard size={12} />, label: "Invoice" },
            ]).map(t => (
              <button key={t.type} onClick={() => setOpen(t.type)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-all ${
                  open === t.type ? "text-gold border-b-2 border-gold" : "text-gray-500"
                }`}>
                {t.icon} {t.label}
              </button>
            ))}
            <button onClick={() => setOpen(null)} className="px-3 text-gray-500 hover:text-foreground"><X size={14} /></button>
          </div>

          <div className="p-4 space-y-3">
            {open === "lead" && (
              <>
                <input value={lead.business_name} onChange={e => setLead({ ...lead, business_name: e.target.value })}
                  className="input w-full text-xs" placeholder="Business name *" autoFocus />
                <input value={lead.email} onChange={e => setLead({ ...lead, email: e.target.value })}
                  className="input w-full text-xs" placeholder="Email" />
                <input value={lead.phone} onChange={e => setLead({ ...lead, phone: e.target.value })}
                  className="input w-full text-xs" placeholder="Phone" />
                <input value={lead.industry} onChange={e => setLead({ ...lead, industry: e.target.value })}
                  className="input w-full text-xs" placeholder="Industry" />
                <button onClick={saveLead} disabled={saving} className="btn-primary w-full text-xs flex items-center justify-center gap-1.5 disabled:opacity-50">
                  {saving ? <Loader size={12} className="animate-spin" /> : <Plus size={12} />}
                  {saving ? "Adding..." : "Add Lead"}
                </button>
              </>
            )}

            {open === "deal" && (
              <>
                <input value={deal.title} onChange={e => setDeal({ ...deal, title: e.target.value })}
                  className="input w-full text-xs" placeholder="Deal title *" autoFocus />
                <input type="number" value={deal.amount} onChange={e => setDeal({ ...deal, amount: e.target.value })}
                  className="input w-full text-xs" placeholder="Amount ($)" />
                <button onClick={saveDeal} disabled={saving} className="btn-primary w-full text-xs flex items-center justify-center gap-1.5 disabled:opacity-50">
                  {saving ? <Loader size={12} className="animate-spin" /> : <Plus size={12} />}
                  {saving ? "Adding..." : "Add Deal"}
                </button>
              </>
            )}

            {open === "invoice" && (
              <>
                <select value={invoice.client_id} onChange={e => setInvoice({ ...invoice, client_id: e.target.value })}
                  className="input w-full text-xs" autoFocus>
                  <option value="">Select client *</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.business_name}</option>)}
                </select>
                <input type="number" value={invoice.amount} onChange={e => setInvoice({ ...invoice, amount: e.target.value })}
                  className="input w-full text-xs" placeholder="Amount ($)" />
                <input value={invoice.description} onChange={e => setInvoice({ ...invoice, description: e.target.value })}
                  className="input w-full text-xs" placeholder="Description" />
                <button onClick={saveInvoice} disabled={saving} className="btn-primary w-full text-xs flex items-center justify-center gap-1.5 disabled:opacity-50">
                  {saving ? <Loader size={12} className="animate-spin" /> : <Plus size={12} />}
                  {saving ? "Creating..." : "Create Invoice"}
                </button>
              </>
            )}
          </div>

          <div className="px-4 pb-3 text-center">
            <p className="text-[8px] text-gray-600">Press <kbd className="px-1 py-0.5 rounded text-[7px] bg-surface-light">Shift+N</kbd> to open from anywhere</p>
          </div>
        </div>
      </div>
    </div>
  );
}
