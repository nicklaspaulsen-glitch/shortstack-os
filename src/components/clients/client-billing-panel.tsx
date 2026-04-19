"use client";

/**
 * Client Billing & Payments panel — renders inside the client detail page as a
 * dedicated tab. Requires the caller agency to have connected their Stripe
 * account first (/dashboard/settings → Accept Payments from Clients). If not,
 * we show a CTA linking there and hide the action forms.
 *
 * Features:
 *   - Create a Stripe Payment Link for a one-off charge (amount + name).
 *     Returns a copyable URL.
 *   - Send a Stripe invoice (one or more line items + due-date) via the
 *     agency's connected Stripe — Stripe emails the hosted invoice URL.
 *   - Lists past payment links and past invoices w/ live status.
 *
 * All API calls go through /api/clients/[id]/payment-links and
 * /api/clients/[id]/invoices — those endpoints already handle access checks
 * and set { stripeAccount } on every Stripe request.
 */

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Link2, Send, Plus, Trash2, Copy, ExternalLink, Loader2, AlertTriangle, DollarSign, Receipt, CheckCircle2,
} from "lucide-react";
import Link from "next/link";

type PaymentLink = {
  id: string;
  stripe_payment_link_id: string;
  url: string;
  amount_cents: number;
  currency: string;
  product_name: string | null;
  active: boolean;
  created_at: string;
};

type ClientInvoice = {
  id: string;
  agency_stripe_invoice_id: string;
  amount_cents: number;
  currency: string;
  status: string;
  hosted_invoice_url: string | null;
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
};

type ConnectStatus = {
  connected: boolean;
  account?: {
    fully_onboarded: boolean;
    charges_enabled: boolean;
    business_name: string | null;
    default_currency: string | null;
  };
};

export default function ClientBillingPanel({ clientId }: { clientId: string }) {
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Payment links
  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [creatingLink, setCreatingLink] = useState(false);
  const [linkAmount, setLinkAmount] = useState("");
  const [linkName, setLinkName] = useState("");
  const [linkDesc, setLinkDesc] = useState("");

  // Invoices
  const [invoices, setInvoices] = useState<ClientInvoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [sendingInvoice, setSendingInvoice] = useState(false);
  const [invoiceDays, setInvoiceDays] = useState(14);
  const [invoiceMemo, setInvoiceMemo] = useState("");
  const [invoiceItems, setInvoiceItems] = useState<Array<{ description: string; amount: string }>>([
    { description: "", amount: "" },
  ]);

  const fetchStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch("/api/integrations/stripe-connect/status");
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus({ connected: false });
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  const fetchLinks = useCallback(async () => {
    setLoadingLinks(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/payment-links`);
      const data = await res.json();
      setLinks(data.links || []);
    } catch {
      setLinks([]);
    } finally {
      setLoadingLinks(false);
    }
  }, [clientId]);

  const fetchInvoices = useCallback(async () => {
    setLoadingInvoices(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/invoices`);
      const data = await res.json();
      setInvoices(data.invoices || []);
    } catch {
      setInvoices([]);
    } finally {
      setLoadingInvoices(false);
    }
  }, [clientId]);

  useEffect(() => {
    void fetchStatus();
    void fetchLinks();
    void fetchInvoices();
  }, [fetchStatus, fetchLinks, fetchInvoices]);

  async function createLink() {
    const amountCents = Math.round(Number(linkAmount) * 100);
    if (!amountCents || amountCents < 50) {
      toast.error("Amount must be at least $0.50");
      return;
    }
    if (!linkName.trim()) {
      toast.error("Product name required");
      return;
    }
    setCreatingLink(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/payment-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount_cents: amountCents,
          product_name: linkName.trim(),
          description: linkDesc.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create payment link");
      toast.success("Payment link created");
      setLinkAmount("");
      setLinkName("");
      setLinkDesc("");
      await fetchLinks();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setCreatingLink(false);
    }
  }

  async function sendInvoice() {
    const cleanItems = invoiceItems
      .map((i) => ({
        description: i.description.trim(),
        amount_cents: Math.round(Number(i.amount) * 100),
      }))
      .filter((i) => i.amount_cents > 0 && i.description);

    if (!cleanItems.length) {
      toast.error("Add at least one line item");
      return;
    }
    setSendingInvoice(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          line_items: cleanItems,
          due_days: invoiceDays,
          memo: invoiceMemo || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send invoice");
      toast.success("Invoice sent");
      setInvoiceMemo("");
      setInvoiceDays(14);
      setInvoiceItems([{ description: "", amount: "" }]);
      await fetchInvoices();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSendingInvoice(false);
    }
  }

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url).then(
      () => toast.success("Copied"),
      () => toast.error("Failed to copy"),
    );
  }

  if (loadingStatus) {
    return (
      <div className="card flex items-center gap-2 animate-pulse">
        <Loader2 size={14} className="animate-spin text-muted" />
        <p className="text-xs text-muted">Checking Stripe connection...</p>
      </div>
    );
  }

  if (!status?.connected) {
    return (
      <div className="card border-gold/30 bg-gold/[0.03]">
        <div className="flex items-start gap-3">
          <DollarSign size={18} className="text-gold shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold">Connect Stripe to bill this client</h3>
            <p className="text-[10px] text-muted mt-1">
              Connect your own Stripe account once, then send invoices and create payment
              links for any client — all money lands directly in your Stripe balance.
            </p>
          </div>
          <Link
            href="/dashboard/settings?tab=billing"
            className="btn-primary text-xs flex items-center gap-1.5 whitespace-nowrap"
          >
            <Link2 size={12} /> Connect Stripe
          </Link>
        </div>
      </div>
    );
  }

  const fullyOnboarded = status.account?.fully_onboarded;
  const chargesEnabled = status.account?.charges_enabled;

  return (
    <div className="space-y-5">
      {!fullyOnboarded && (
        <div className="card border-warning/30 bg-warning/[0.05]">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={14} className="text-warning shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-warning">Finish Stripe onboarding</p>
              <p className="text-[10px] text-muted mt-0.5">
                Your connected Stripe account isn&apos;t fully verified yet. {chargesEnabled ? "You can create charges but payouts may be paused." : "You can't accept charges until onboarding completes."}
              </p>
            </div>
            <Link
              href="/dashboard/settings?tab=billing"
              className="btn-primary text-[10px] py-1 px-2.5"
            >
              Finish setup
            </Link>
          </div>
        </div>
      )}

      {/* ── Create Payment Link ────────────────────────────── */}
      <div className="card">
        <h3 className="section-header flex items-center gap-2">
          <Link2 size={14} className="text-gold" /> Create Payment Link
        </h3>
        <p className="text-[10px] text-muted mb-3">
          Generate a Stripe-hosted checkout URL you can paste anywhere — DMs, email, SMS, proposal docs.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input
            type="text"
            value={linkName}
            onChange={(e) => setLinkName(e.target.value)}
            placeholder="Product name (e.g. Monthly Retainer)"
            className="input text-xs"
          />
          <input
            type="number"
            step="0.01"
            min="0.50"
            value={linkAmount}
            onChange={(e) => setLinkAmount(e.target.value)}
            placeholder="Amount ($)"
            className="input text-xs"
          />
          <button
            onClick={createLink}
            disabled={creatingLink || !chargesEnabled}
            className="btn-primary text-xs flex items-center justify-center gap-1.5"
          >
            {creatingLink ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            Generate link
          </button>
        </div>
        <input
          type="text"
          value={linkDesc}
          onChange={(e) => setLinkDesc(e.target.value)}
          placeholder="Optional description shown at checkout"
          className="input text-xs mt-2 w-full"
        />
      </div>

      {/* ── Past payment links ────────────────────────────── */}
      <div className="card">
        <h3 className="section-header">Payment Links</h3>
        {loadingLinks ? (
          <div className="text-xs text-muted">Loading...</div>
        ) : links.length === 0 ? (
          <p className="text-xs text-muted py-3">No payment links yet</p>
        ) : (
          <div className="space-y-2">
            {links.map((link) => (
              <div key={link.id} className="p-3 rounded-xl border border-border bg-surface-light/30 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{link.product_name || "Payment"}</p>
                  <p className="text-[9px] text-muted font-mono truncate">{link.url}</p>
                </div>
                <span className="text-sm font-bold text-gold shrink-0">
                  {(link.amount_cents / 100).toFixed(2)} {link.currency.toUpperCase()}
                </span>
                <button
                  onClick={() => copyUrl(link.url)}
                  className="text-xs p-2 rounded-lg hover:bg-surface-light text-muted hover:text-foreground"
                  aria-label="Copy URL"
                >
                  <Copy size={12} />
                </button>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs p-2 rounded-lg hover:bg-surface-light text-muted hover:text-foreground"
                  aria-label="Open checkout"
                >
                  <ExternalLink size={12} />
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Send Invoice ──────────────────────────────────── */}
      <div className="card">
        <h3 className="section-header flex items-center gap-2">
          <Receipt size={14} className="text-gold" /> Send Invoice
        </h3>
        <p className="text-[10px] text-muted mb-3">
          Stripe will email the client a hosted invoice page. Payment lands in your account.
        </p>
        <div className="space-y-2 mb-3">
          {invoiceItems.map((item, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="text"
                value={item.description}
                onChange={(e) => {
                  const next = [...invoiceItems];
                  next[i].description = e.target.value;
                  setInvoiceItems(next);
                }}
                placeholder={`Line item #${i + 1} description`}
                className="input text-xs flex-1"
              />
              <input
                type="number"
                step="0.01"
                min="0.50"
                value={item.amount}
                onChange={(e) => {
                  const next = [...invoiceItems];
                  next[i].amount = e.target.value;
                  setInvoiceItems(next);
                }}
                placeholder="Amount ($)"
                className="input text-xs w-28"
              />
              {invoiceItems.length > 1 && (
                <button
                  onClick={() => setInvoiceItems(invoiceItems.filter((_, j) => j !== i))}
                  className="text-xs p-2 rounded-lg text-muted hover:text-danger"
                  aria-label="Remove line"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          onClick={() => setInvoiceItems([...invoiceItems, { description: "", amount: "" }])}
          className="text-[10px] text-gold hover:underline flex items-center gap-1 mb-3"
        >
          <Plus size={10} /> Add line item
        </button>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="text-[10px] text-muted block mb-1">Net days until due</label>
            <input
              type="number"
              min="1"
              max="365"
              value={invoiceDays}
              onChange={(e) => setInvoiceDays(Number(e.target.value))}
              className="input text-xs w-full"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted block mb-1">Memo (shown on invoice)</label>
            <input
              type="text"
              value={invoiceMemo}
              onChange={(e) => setInvoiceMemo(e.target.value)}
              placeholder="Thank you for your business"
              className="input text-xs w-full"
            />
          </div>
        </div>
        <button
          onClick={sendInvoice}
          disabled={sendingInvoice || !chargesEnabled}
          className="btn-primary text-xs flex items-center gap-1.5"
        >
          {sendingInvoice ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
          Send invoice to client
        </button>
      </div>

      {/* ── Past invoices ─────────────────────────────────── */}
      <div className="card">
        <h3 className="section-header">Client Invoices (via your Stripe)</h3>
        {loadingInvoices ? (
          <div className="text-xs text-muted">Loading...</div>
        ) : invoices.length === 0 ? (
          <p className="text-xs text-muted py-3">No invoices sent yet</p>
        ) : (
          <div className="space-y-2">
            {invoices.map((inv) => (
              <div
                key={inv.id}
                className={`p-3 rounded-xl border flex items-center gap-3 ${
                  inv.status === "paid" ? "bg-success/[0.04] border-success/20" : "bg-surface-light/30 border-border"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">
                    {inv.status === "paid" && <CheckCircle2 size={10} className="inline text-success mr-1" />}
                    {inv.agency_stripe_invoice_id}
                  </p>
                  <p className="text-[9px] text-muted">
                    {inv.due_date ? `Due ${new Date(inv.due_date).toLocaleDateString()}` : ""}
                    {inv.paid_at ? ` · Paid ${new Date(inv.paid_at).toLocaleDateString()}` : ""}
                  </p>
                </div>
                <span
                  className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                    inv.status === "paid"
                      ? "bg-success/10 text-success"
                      : inv.status === "open"
                      ? "bg-gold/10 text-gold"
                      : "bg-surface-light text-muted"
                  }`}
                >
                  {inv.status}
                </span>
                <span className="text-sm font-bold text-gold shrink-0">
                  {(inv.amount_cents / 100).toFixed(2)} {inv.currency.toUpperCase()}
                </span>
                {inv.hosted_invoice_url && (
                  <a
                    href={inv.hosted_invoice_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs p-2 rounded-lg hover:bg-surface-light text-muted hover:text-foreground"
                    aria-label="Open hosted invoice"
                  >
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
