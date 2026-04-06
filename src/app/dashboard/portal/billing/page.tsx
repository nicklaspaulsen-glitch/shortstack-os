"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Invoice, Contract } from "@/lib/types";
import StatCard from "@/components/ui/stat-card";
import StatusBadge from "@/components/ui/status-badge";
import DataTable from "@/components/ui/data-table";
import { PageLoading } from "@/components/ui/loading";
import { formatCurrency, formatDate } from "@/lib/utils";
import { CreditCard, FileText, DollarSign } from "lucide-react";

export default function ClientBillingPage() {
  const { profile } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (profile) fetchBilling();
  }, [profile]);

  async function fetchBilling() {
    const { data: clientData } = await supabase.from("clients").select("id, mrr").eq("profile_id", profile!.id).single();
    if (!clientData) { setLoading(false); return; }

    const [{ data: inv }, { data: con }] = await Promise.all([
      supabase.from("invoices").select("*").eq("client_id", clientData.id).order("created_at", { ascending: false }),
      supabase.from("contracts").select("*").eq("client_id", clientData.id).order("created_at", { ascending: false }),
    ]);
    setInvoices(inv || []);
    setContracts(con || []);
    setLoading(false);
  }

  if (loading) return <PageLoading />;

  const totalPaid = invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0);
  const pending = invoices.filter(i => i.status === "sent" || i.status === "overdue");

  return (
    <div className="fade-in space-y-5">
      <div>
        <h1 className="page-header mb-0 flex items-center gap-2"><CreditCard size={18} className="text-warning" /> Billing</h1>
        <p className="text-xs text-muted mt-0.5">Invoices, contracts, and payment history</p>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <StatCard label="Total Paid" value={formatCurrency(totalPaid)} icon={<DollarSign size={14} />} changeType="positive" />
        <StatCard label="Pending" value={pending.length} icon={<CreditCard size={14} />} changeType={pending.length > 0 ? "negative" : "positive"} change={pending.length > 0 ? formatCurrency(pending.reduce((s, i) => s + i.amount, 0)) : "All clear"} />
        <StatCard label="Contracts" value={contracts.filter(c => c.status === "signed").length} icon={<FileText size={14} />} />
      </div>

      <div className="card">
        <h2 className="section-header">Invoices</h2>
        <DataTable
          columns={[
            { key: "description", label: "Description", render: (i: Invoice) => <span className="text-xs">{i.description || "Invoice"}</span> },
            { key: "amount", label: "Amount", render: (i: Invoice) => <span className="text-xs font-mono">{formatCurrency(i.amount)}</span> },
            { key: "status", label: "Status", render: (i: Invoice) => <StatusBadge status={i.status} /> },
            { key: "due_date", label: "Due", render: (i: Invoice) => <span className="text-xs text-muted">{i.due_date ? formatDate(i.due_date) : "-"}</span> },
            { key: "paid_at", label: "Paid", render: (i: Invoice) => <span className="text-xs text-muted">{i.paid_at ? formatDate(i.paid_at) : "-"}</span> },
            { key: "actions", label: "", render: (i: Invoice) => (i.status === "sent" || i.status === "overdue") ? (
              <button onClick={async (e) => {
                e.stopPropagation();
                const res = await fetch("/api/invoices/pay", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ invoice_id: i.id }),
                });
                const data = await res.json();
                if (data.checkout_url) window.location.href = data.checkout_url;
              }} className="btn-primary text-[9px] py-1 px-2.5">Pay Now</button>
            ) : null },
          ]}
          data={invoices}
          emptyMessage="No invoices yet"
        />
      </div>

      {contracts.length > 0 && (
        <div className="card">
          <h2 className="section-header">Contracts</h2>
          <DataTable
            columns={[
              { key: "title", label: "Contract", render: (c: Contract) => <span className="text-xs font-medium">{c.title}</span> },
              { key: "value", label: "Value", render: (c: Contract) => <span className="text-xs font-mono">{c.value ? formatCurrency(c.value) : "-"}</span> },
              { key: "status", label: "Status", render: (c: Contract) => <StatusBadge status={c.status} /> },
              { key: "start_date", label: "Period", render: (c: Contract) => <span className="text-[10px] text-muted">{c.start_date ? formatDate(c.start_date) : "?"} - {c.end_date ? formatDate(c.end_date) : "Ongoing"}</span> },
            ]}
            data={contracts}
            emptyMessage="No contracts"
          />
        </div>
      )}
    </div>
  );
}
