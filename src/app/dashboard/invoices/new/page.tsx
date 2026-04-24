"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  Plus,
  Trash2,
  Send,
  CreditCard,
  Wand2,
} from "lucide-react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";

interface ClientOption {
  id: string;
  business_name: string;
}

interface LineItem {
  description: string;
  qty: number;
  unit_price_cents: number;
}

function centsToDollars(c: number): string {
  return (c / 100).toFixed(2);
}

export default function NewSmartInvoicePage() {
  const router = useRouter();
  const supabase = createClient();
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientId, setClientId] = useState("");
  const [scope, setScope] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [taxCents, setTaxCents] = useState(0);
  const [dueDays, setDueDays] = useState(14);
  const [notes, setNotes] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [reasoning, setReasoning] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [savedInvoiceId, setSavedInvoiceId] = useState<string | null>(null);
  const [paymentLink, setPaymentLink] = useState<string | null>(null);

  // Load clients list for picker.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, business_name")
        .order("business_name");
      if (!cancelled) setClients(data || []);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const subtotal = lineItems.reduce((s, i) => s + i.qty * i.unit_price_cents, 0);
  const total = subtotal + taxCents;

  async function draftWithAI() {
    if (!clientId) {
      toast.error("Pick a client first");
      return;
    }
    if (!scope.trim()) {
      toast.error("Describe the scope first");
      return;
    }
    setDrafting(true);
    setReasoning("");
    try {
      // We need an invoice to draft against. Create a shell invoice, then hit the drafter.
      const shellRes = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId, line_items: [] }),
      });
      if (!shellRes.ok) {
        const err = await shellRes.json().catch(() => ({}));
        throw new Error(err.error || "Couldn't create invoice shell");
      }
      const { invoice } = await shellRes.json();
      setSavedInvoiceId(invoice.id);

      const draftRes = await fetch(
        `/api/invoices/${invoice.id}/draft-line-items`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scope, apply: false }),
        },
      );
      if (!draftRes.ok) {
        const err = await draftRes.json().catch(() => ({}));
        throw new Error(err.error || "AI draft failed");
      }
      const draft = await draftRes.json();
      setLineItems(draft.line_items || []);
      setReasoning(draft.reasoning || "");
      toast.success("AI drafted the line items — review and adjust");
    } catch (err) {
      console.error("[draft] error:", err);
      toast.error(err instanceof Error ? err.message : "AI draft failed");
    } finally {
      setDrafting(false);
    }
  }

  function updateItem(idx: number, patch: Partial<LineItem>) {
    setLineItems((cur) =>
      cur.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    );
  }

  function addItem() {
    setLineItems((cur) => [
      ...cur,
      { description: "", qty: 1, unit_price_cents: 0 },
    ]);
  }

  function removeItem(idx: number) {
    setLineItems((cur) => cur.filter((_, i) => i !== idx));
  }

  async function saveDraft() {
    if (!clientId) {
      toast.error("Pick a client first");
      return;
    }
    if (lineItems.length === 0) {
      toast.error("Add at least one line item");
      return;
    }
    setSaving(true);
    try {
      const body = {
        line_items: lineItems,
        tax_cents: taxCents,
        notes,
        due_date: new Date(Date.now() + dueDays * 86_400_000)
          .toISOString()
          .slice(0, 10),
      };
      let url = "/api/invoices";
      let method: "POST" | "PATCH" = "POST";
      if (savedInvoiceId) {
        url = `/api/invoices/${savedInvoiceId}`;
        method = "PATCH";
      }
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          method === "POST" ? { client_id: clientId, ...body } : body,
        ),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Save failed");
      }
      const { invoice } = await res.json();
      setSavedInvoiceId(invoice.id);
      toast.success("Draft saved");
    } catch (err) {
      console.error("[save] error:", err);
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function createPaymentLink() {
    if (!savedInvoiceId) {
      await saveDraft();
    }
    const id = savedInvoiceId;
    if (!id) return;
    try {
      const res = await fetch(`/api/invoices/${id}/payment-link`, { method: "POST" });
      if (res.status === 501) {
        const err = await res.json();
        toast(err.error, { icon: "⚙️", duration: 7000 });
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Stripe error");
      }
      const { payment_link } = await res.json();
      setPaymentLink(payment_link);
      toast.success("Payment link ready");
    } catch (err) {
      console.error("[payment-link] error:", err);
      toast.error(err instanceof Error ? err.message : "Stripe error");
    }
  }

  async function sendInvoice() {
    if (!savedInvoiceId) {
      await saveDraft();
    }
    const id = savedInvoiceId;
    if (!id) return;
    try {
      const res = await fetch(`/api/invoices/${id}/send`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Send failed");
      }
      const result = await res.json();
      if (result.email_sent) toast.success("Invoice sent");
      else toast(result.email_skipped_reason || "Marked sent (email skipped)", { icon: "💡" });
      router.push("/dashboard/invoices");
    } catch (err) {
      console.error("[send] error:", err);
      toast.error(err instanceof Error ? err.message : "Send failed");
    }
  }

  return (
    <div className="fade-in space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/invoices"
          className="text-muted hover:text-foreground"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-lg font-bold">New smart invoice</h1>
          <p className="text-[10px] text-muted">
            Describe the scope in plain English — Claude will draft line items
            you can edit, then generate a Stripe payment link or send it straight away.
          </p>
        </div>
      </div>

      {/* Client + scope */}
      <div className="card p-5 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">
              Client
            </label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="input w-full text-xs"
            >
              <option value="">Select client...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.business_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">
              Due in
            </label>
            <select
              value={dueDays}
              onChange={(e) => setDueDays(Number(e.target.value))}
              className="input w-full text-xs"
            >
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-[9px] text-muted uppercase tracking-wider block mb-1 flex items-center gap-1">
            <Sparkles size={9} className="text-gold" /> Scope (AI will draft line items from this)
          </label>
          <textarea
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            placeholder="e.g., 'Video editing for Acme — 3 reels + 1 long-form YouTube, plus 5 thumbnails for April deliverables.'"
            rows={3}
            className="input w-full text-xs resize-none"
          />
        </div>

        <button
          onClick={draftWithAI}
          disabled={drafting || !clientId || !scope.trim()}
          className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-40"
        >
          {drafting ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Wand2 size={12} />
          )}
          {drafting ? "Drafting..." : "Draft with AI"}
        </button>

        {reasoning && (
          <p className="text-[10px] text-muted italic border-l-2 border-gold/30 pl-2">
            {reasoning}
          </p>
        )}
      </div>

      {/* Line items */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Line items</h3>
          <button
            onClick={addItem}
            className="text-[10px] text-gold flex items-center gap-1 hover:underline"
          >
            <Plus size={10} /> Add line
          </button>
        </div>

        {lineItems.length === 0 ? (
          <p className="text-[11px] text-muted text-center py-4">
            No line items yet. Use AI draft above or add them manually.
          </p>
        ) : (
          <div className="space-y-1.5">
            <div className="grid grid-cols-12 text-[9px] text-muted uppercase tracking-wider font-semibold py-1 px-2">
              <span className="col-span-6">Description</span>
              <span className="col-span-1 text-center">Qty</span>
              <span className="col-span-2 text-center">Rate</span>
              <span className="col-span-2 text-right">Amount</span>
              <span className="col-span-1"></span>
            </div>
            {lineItems.map((item, i) => (
              <div
                key={i}
                className="grid grid-cols-12 items-center gap-1 text-[11px] py-1 px-2 rounded bg-surface-light"
              >
                <input
                  value={item.description}
                  onChange={(e) => updateItem(i, { description: e.target.value })}
                  placeholder="Description"
                  className="col-span-6 input !py-1 text-[11px] bg-transparent border-0"
                />
                <input
                  type="number"
                  min={1}
                  value={item.qty}
                  onChange={(e) => updateItem(i, { qty: Math.max(1, Number(e.target.value)) })}
                  className="col-span-1 input !py-1 text-[11px] text-center bg-transparent border-0"
                />
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={(item.unit_price_cents / 100).toFixed(2)}
                  onChange={(e) =>
                    updateItem(i, {
                      unit_price_cents: Math.round(Number(e.target.value) * 100),
                    })
                  }
                  className="col-span-2 input !py-1 text-[11px] text-center bg-transparent border-0"
                />
                <span className="col-span-2 text-right font-bold">
                  ${centsToDollars(item.qty * item.unit_price_cents)}
                </span>
                <button
                  onClick={() => removeItem(i)}
                  className="col-span-1 text-right text-muted hover:text-red-400"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Totals */}
        <div className="pt-2 border-t border-border space-y-1">
          <div className="flex justify-between text-[11px]">
            <span className="text-muted">Subtotal</span>
            <span>${centsToDollars(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted">Tax</span>
            <div className="flex items-center gap-1">
              <span className="text-muted">$</span>
              <input
                type="number"
                min={0}
                step={0.01}
                value={(taxCents / 100).toFixed(2)}
                onChange={(e) => setTaxCents(Math.round(Number(e.target.value) * 100))}
                className="input !py-0.5 w-24 text-[11px] text-right"
              />
            </div>
          </div>
          <div className="flex justify-between text-sm font-bold pt-1 border-t border-border">
            <span>Total</span>
            <span className="text-gold">${centsToDollars(total)}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="card p-5 space-y-2">
        <label className="text-[9px] text-muted uppercase tracking-wider block">
          Notes (shown in the email + payment link)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g., 'Thanks for working with us this month. Payment terms: Net 14.'"
          rows={2}
          className="input w-full text-xs resize-none"
        />
      </div>

      {paymentLink && (
        <div className="card border-gold/30 bg-gold/5 p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold">Stripe payment link ready</p>
            <a
              href={paymentLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-gold underline break-all"
            >
              {paymentLink}
            </a>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(paymentLink);
              toast.success("Link copied");
            }}
            className="btn-secondary text-[10px]"
          >
            Copy
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 flex-wrap justify-end">
        <button
          onClick={saveDraft}
          disabled={saving || !clientId || lineItems.length === 0}
          className="btn-secondary text-xs flex items-center gap-1.5 disabled:opacity-40"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : null}
          Save draft
        </button>
        <button
          onClick={createPaymentLink}
          disabled={!clientId || lineItems.length === 0}
          className="btn-secondary text-xs flex items-center gap-1.5 disabled:opacity-40"
        >
          <CreditCard size={12} /> Create payment link
        </button>
        <button
          onClick={sendInvoice}
          disabled={!clientId || lineItems.length === 0}
          className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-40"
        >
          <Send size={12} /> Send to client
        </button>
      </div>
    </div>
  );
}
