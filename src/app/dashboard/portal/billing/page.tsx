"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Invoice, Contract } from "@/lib/types";
import toast from "react-hot-toast";
import StatCard from "@/components/ui/stat-card";
import StatusBadge from "@/components/ui/status-badge";
import DataTable from "@/components/ui/data-table";
import { PageLoading } from "@/components/ui/loading";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CreditCard, FileText, DollarSign } from "lucide-react";
import CurrencyDisplay from "@/components/integrations/currency-display";
import { MotionPage } from "@/components/motion/motion-page";

// Map ISO country code → likely local currency. Used to default the
// "show alongside USD" display when geo-IP gives us a country but no
// explicit per-client preference is set. Not exhaustive — covers the
// agency's biggest expected markets. Unknown countries fall back to USD
// (i.e. no conversion display).
const COUNTRY_TO_CURRENCY: Record<string, string> = {
  US: "USD", CA: "CAD", MX: "MXN",
  GB: "GBP", IE: "EUR", FR: "EUR", DE: "EUR", ES: "EUR", IT: "EUR",
  NL: "EUR", BE: "EUR", AT: "EUR", PT: "EUR", FI: "EUR", GR: "EUR",
  DK: "DKK", SE: "SEK", NO: "NOK", IS: "ISK", CH: "CHF",
  PL: "PLN", CZ: "CZK", HU: "HUF", RO: "RON",
  AU: "AUD", NZ: "NZD", JP: "JPY", CN: "CNY", HK: "HKD", SG: "SGD",
  KR: "KRW", IN: "INR", AE: "AED", SA: "SAR", IL: "ILS",
  BR: "BRL", AR: "ARS", CL: "CLP", CO: "COP",
  ZA: "ZAR", NG: "NGN", EG: "EGP",
};

export default function ClientBillingPage() {
  const { profile } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  // Optional second-currency display — derived from the caller's geo-IP.
  // Empty string means "no conversion display" (agency reports in its own
  // currency only). Free-tier providers occasionally fail; that's fine.
  const [displayCurrency, setDisplayCurrency] = useState<string>("");
  const supabase = createClient();

  useEffect(() => {
    if (profile) fetchBilling();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  // Auto-detect the client's local currency from their IP. Fire-and-forget;
  // failure is silent (we just don't show the parenthetical conversion).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/integrations/geo-ip/me")
      .then((res) => res.json())
      .then((data: { success: boolean; lookup?: { country_code?: string } | null }) => {
        if (cancelled || !data.success || !data.lookup?.country_code) return;
        const cur = COUNTRY_TO_CURRENCY[data.lookup.country_code.toUpperCase()];
        if (cur) setDisplayCurrency(cur);
      })
      .catch(() => {
        // Soft-fail — leave displayCurrency empty
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function fetchBilling() {
    if (!profile?.id) { setLoading(false); return; }
    try {
      const { data: clientData, error: clientError } = await supabase.from("clients").select("id, mrr").eq("profile_id", profile.id).single();
      if (clientError && clientError.code !== "PGRST116") throw clientError;
      if (!clientData) { setLoading(false); return; }

      const [{ data: inv }, { data: con }] = await Promise.all([
        supabase.from("invoices").select("*").eq("client_id", clientData.id).order("created_at", { ascending: false }),
        supabase.from("contracts").select("*").eq("client_id", clientData.id).order("created_at", { ascending: false }),
      ]);
      setInvoices(inv || []);
      setContracts(con || []);
    } catch {
      toast.error("Failed to load billing data");
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <MotionPage>
                          <PageLoading />
                        </MotionPage>;

  const totalPaid = invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0);
  const pending = invoices.filter(i => i.status === "sent" || i.status === "overdue");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-header mb-0 flex items-center gap-2"><CreditCard size={18} className="text-warning" /> Billing</h1>
        <p className="text-xs text-text-muted mt-0.5">Invoices, contracts, and payment history</p>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <StatCard label="Total Paid" value={formatCurrency(totalPaid)} icon={<DollarSign size={14} />} changeType="positive" />
        <StatCard label="Pending" value={pending.length} icon={<CreditCard size={14} />} changeType={pending.length > 0 ? "negative" : "positive"} change={pending.length > 0 ? formatCurrency(pending.reduce((s, i) => s + i.amount, 0)) : "All clear"} />
        <StatCard label="Contracts" value={contracts.filter(c => c.status === "signed").length} icon={<FileText size={14} />} />
      </div>

      {displayCurrency && (
        <div className="text-[10px] text-text-muted -mt-2">
          Amounts shown in invoice currency, with local equivalent in <span className="font-mono">{displayCurrency}</span>.
        </div>
      )}

      <div className="glass rounded-xl p-4">
        <h2 className="">Invoices</h2>
        <DataTable
          columns={[
            { key: "description", label: "Description", render: (i: Invoice) => <span className="text-xs">{i.description || "Invoice"}</span> },
            { key: "amount", label: "Amount", render: (i: Invoice) => (
              <span className="text-xs font-mono">
                <CurrencyDisplay amount={i.amount} currency={i.currency || "USD"} displayIn={displayCurrency || undefined} />
              </span>
            ) },
            { key: "status", label: "Status", render: (i: Invoice) => <StatusBadge status={i.status} /> },
            { key: "due_date", label: "Due", render: (i: Invoice) => <span className="text-xs text-text-muted">{i.due_date ? formatDate(i.due_date) : "-"}</span> },
            { key: "paid_at", label: "Paid", render: (i: Invoice) => <span className="text-xs text-text-muted">{i.paid_at ? formatDate(i.paid_at) : "-"}</span> },
            { key: "actions", label: "", render: (i: Invoice) => (i.status === "sent" || i.status === "overdue") ? (
              <button onClick={async (e) => {
                e.stopPropagation();
                try {
                  const res = await fetch("/api/invoices/pay", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ invoice_id: i.id }),
                  });
                  if (!res.ok) { toast.error("Payment failed"); return; }
                  const data = await res.json();
                  if (data.checkout_url) window.location.href = data.checkout_url;
                  else toast.error(data.error || "Could not create payment link");
                } catch { toast.error("Connection error"); }
              }} className="btn-primary text-[9px] py-1 px-2.5">Pay Now</button>
            ) : null },
          ]}
          data={invoices}
          emptyMessage="No invoices yet"
        />
      </div>

      {contracts.length > 0 && (
        <div className="glass rounded-xl p-4">
          <h2 className="">Contracts</h2>
          <DataTable
            columns={[
              { key: "title", label: "Contract", render: (c: Contract) => <span className="text-xs font-medium">{c.title}</span> },
              { key: "value", label: "Value", render: (c: Contract) => (
                <span className="text-xs font-mono">
                  {c.value ? (
                    <CurrencyDisplay amount={c.value} currency="USD" displayIn={displayCurrency || undefined} />
                  ) : "-"}
                </span>
              ) },
              { key: "status", label: "Status", render: (c: Contract) => <StatusBadge status={c.status} /> },
              { key: "start_date", label: "Period", render: (c: Contract) => <span className="text-[10px] text-text-muted">{c.start_date ? formatDate(c.start_date) : "?"} - {c.end_date ? formatDate(c.end_date) : "Ongoing"}</span> },
            ]}
            data={contracts}
            emptyMessage="No contracts"
          />
        </div>
      )}
    </div>
  );
}
