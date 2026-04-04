"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Client, Contract, Invoice } from "@/lib/types";
import StatCard from "@/components/ui/stat-card";
import StatusBadge from "@/components/ui/status-badge";
import DataTable from "@/components/ui/data-table";
import Modal from "@/components/ui/modal";
import { PageLoading } from "@/components/ui/loading";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Users, DollarSign, FileText, Plus, Search, Heart, ArrowUpRight, UserPlus, Download } from "lucide-react";
import toast from "react-hot-toast";

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { const t = setTimeout(() => setLoading(false), 3000); return () => clearTimeout(t); }, []);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showInviteModal, setShowInviteModal] = useState<Client | null>(null);
  const [tab, setTab] = useState<"clients" | "contracts" | "invoices">("clients");
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const [
      { data: clientsData },
      { data: contractsData },
      { data: invoicesData },
    ] = await Promise.all([
      supabase.from("clients").select("*").order("created_at", { ascending: false }),
      supabase.from("contracts").select("*").order("created_at", { ascending: false }),
      supabase.from("invoices").select("*").order("created_at", { ascending: false }),
    ]);
    setClients(clientsData || []);
    setContracts(contractsData || []);
    setInvoices(invoicesData || []);
    setLoading(false);
  }

  const activeClients = clients.filter((c) => c.is_active);
  const totalMRR = activeClients.reduce((sum, c) => sum + (c.mrr || 0), 0);
  const avgHealth = activeClients.length > 0
    ? Math.round(activeClients.reduce((sum, c) => sum + c.health_score, 0) / activeClients.length)
    : 0;

  const filteredClients = clients.filter((c) =>
    !searchQuery || c.business_name.toLowerCase().includes(searchQuery.toLowerCase()) || c.contact_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  async function addClient(formData: FormData) {
    const { error } = await supabase.from("clients").insert({
      business_name: formData.get("business_name"),
      contact_name: formData.get("contact_name"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      website: formData.get("website"),
      industry: formData.get("industry"),
      package_tier: formData.get("package_tier"),
      mrr: parseFloat(formData.get("mrr") as string) || 0,
      services: (formData.get("services") as string)?.split(",").map((s) => s.trim()) || [],
    });
    if (error) {
      toast.error("Failed to add client");
    } else {
      toast.success("Client added");
      setShowAddModal(false);
      fetchData();
    }
  }

  if (loading) return <PageLoading />;

  return (
    <div className="fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0">Client Portal</h1>
          <p className="text-muted text-sm">Manage clients, contracts, and invoices</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Add Client
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Active Clients" value={activeClients.length} icon={<Users size={18} />} />
        <StatCard label="Total MRR" value={formatCurrency(totalMRR)} icon={<DollarSign size={18} />} />
        <StatCard label="Avg Health Score" value={`${avgHealth}%`} icon={<Heart size={18} />} changeType={avgHealth > 75 ? "positive" : avgHealth > 50 ? "neutral" : "negative"} />
        <StatCard label="Active Contracts" value={contracts.filter((c) => c.status === "signed").length} icon={<FileText size={18} />} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface rounded-lg p-1 w-fit">
        {(["clients", "contracts", "invoices"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm rounded-md capitalize transition-all ${
              tab === t ? "bg-gold text-black font-medium" : "text-muted hover:text-white"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Search */}
      {tab === "clients" && (
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input w-full pl-10"
          />
        </div>
      )}

      {/* Clients Table */}
      {tab === "clients" && (
        <DataTable
          columns={[
            { key: "business_name", label: "Business", render: (c: Client) => (
              <div>
                <p className="font-medium">{c.business_name}</p>
                <p className="text-xs text-muted">{c.contact_name}</p>
              </div>
            )},
            { key: "services", label: "Services", render: (c: Client) => (
              <div className="flex flex-wrap gap-1">
                {(c.services || []).slice(0, 3).map((s, i) => (
                  <span key={i} className="badge bg-surface-light text-xs">{s}</span>
                ))}
              </div>
            )},
            { key: "package_tier", label: "Package", render: (c: Client) => (
              <span className="text-gold font-medium">{c.package_tier || "-"}</span>
            )},
            { key: "mrr", label: "MRR", render: (c: Client) => formatCurrency(c.mrr) },
            { key: "contract_status", label: "Contract", render: (c: Client) => <StatusBadge status={c.contract_status} /> },
            { key: "health_score", label: "Health", render: (c: Client) => (
              <div className="flex items-center gap-2">
                <div className="w-16 bg-surface-light rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${c.health_score > 75 ? "bg-success" : c.health_score > 50 ? "bg-warning" : "bg-danger"}`}
                    style={{ width: `${c.health_score}%` }}
                  />
                </div>
                <span className="text-xs">{c.health_score}%</span>
              </div>
            )},
            { key: "is_active", label: "Status", render: (c: Client) => (
              <StatusBadge status={c.is_active ? "active" : "inactive"} />
            )},
          ]}
          data={filteredClients}
          onRowClick={(c) => router.push(`/dashboard/clients/${c.id}`)}
          emptyMessage="No clients yet."
        />
      )}

      {/* Contracts Table */}
      {tab === "contracts" && (
        <DataTable
          columns={[
            { key: "title", label: "Contract" },
            { key: "client_id", label: "Client", render: (c: Contract) => clients.find((cl) => cl.id === c.client_id)?.business_name || "-" },
            { key: "value", label: "Value", render: (c: Contract) => c.value ? formatCurrency(c.value) : "-" },
            { key: "status", label: "Status", render: (c: Contract) => <StatusBadge status={c.status} /> },
            { key: "start_date", label: "Start", render: (c: Contract) => c.start_date ? formatDate(c.start_date) : "-" },
            { key: "end_date", label: "End", render: (c: Contract) => c.end_date ? formatDate(c.end_date) : "-" },
            { key: "document_url", label: "Doc", render: (c: Contract) => c.document_url ? (
              <a href={c.document_url} target="_blank" rel="noopener" className="text-gold"><ArrowUpRight size={16} /></a>
            ) : "-" },
          ]}
          data={contracts}
          emptyMessage="No contracts yet."
        />
      )}

      {/* Invoices Table */}
      {tab === "invoices" && (
        <DataTable
          columns={[
            { key: "description", label: "Description", render: (inv: Invoice) => inv.description || "Invoice" },
            { key: "client_id", label: "Client", render: (inv: Invoice) => clients.find((c) => c.id === inv.client_id)?.business_name || "-" },
            { key: "amount", label: "Amount", render: (inv: Invoice) => formatCurrency(inv.amount) },
            { key: "status", label: "Status", render: (inv: Invoice) => <StatusBadge status={inv.status} /> },
            { key: "due_date", label: "Due", render: (inv: Invoice) => inv.due_date ? formatDate(inv.due_date) : "-" },
            { key: "paid_at", label: "Paid", render: (inv: Invoice) => inv.paid_at ? formatDate(inv.paid_at) : "-" },
          ]}
          data={invoices}
          emptyMessage="No invoices yet."
        />
      )}

      {/* Add Client Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Client" size="lg">
        <form onSubmit={(e) => { e.preventDefault(); addClient(new FormData(e.currentTarget)); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted mb-1">Business Name *</label>
              <input name="business_name" className="input w-full" required />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Contact Name *</label>
              <input name="contact_name" className="input w-full" required />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Email *</label>
              <input name="email" type="email" className="input w-full" required />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Phone</label>
              <input name="phone" className="input w-full" />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Website</label>
              <input name="website" className="input w-full" />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Industry</label>
              <input name="industry" className="input w-full" />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Package Tier</label>
              <select name="package_tier" className="input w-full">
                <option value="">Select...</option>
                <option value="Starter">Starter</option>
                <option value="Growth">Growth</option>
                <option value="Enterprise">Enterprise</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">MRR ($)</label>
              <input name="mrr" type="number" step="0.01" className="input w-full" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-muted mb-1">Services (comma separated)</label>
            <input name="services" className="input w-full" placeholder="Social Media, Ads, Website" />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setShowAddModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Add Client</button>
          </div>
        </form>
      </Modal>

      {/* Client Detail Modal */}
      <Modal
        isOpen={!!selectedClient}
        onClose={() => setSelectedClient(null)}
        title={selectedClient?.business_name || "Client Details"}
        size="xl"
      >
        {selectedClient && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted">Contact</p>
                <p className="font-medium">{selectedClient.contact_name}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Email</p>
                <p>{selectedClient.email}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Phone</p>
                <p>{selectedClient.phone || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Package</p>
                <p className="text-gold font-medium">{selectedClient.package_tier || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted">MRR</p>
                <p className="font-bold">{formatCurrency(selectedClient.mrr)}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Health Score</p>
                <p className={selectedClient.health_score > 75 ? "text-success" : selectedClient.health_score > 50 ? "text-warning" : "text-danger"}>
                  {selectedClient.health_score}%
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted mb-2">Services</p>
              <div className="flex flex-wrap gap-2">
                {(selectedClient.services || []).map((s, i) => (
                  <span key={i} className="badge bg-gold/10 text-gold">{s}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted mb-2">Contract Status</p>
              <StatusBadge status={selectedClient.contract_status} />
            </div>
            <div className="flex gap-3 pt-4 border-t border-border">
              <button onClick={() => { setSelectedClient(null); setShowInviteModal(selectedClient); }}
                className="btn-primary flex items-center gap-2">
                <UserPlus size={16} /> Give Portal Access
              </button>
              <button onClick={async () => {
                toast.loading("Generating contract...");
                const res = await fetch("/api/contracts/generate", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ client_id: selectedClient.id }),
                });
                toast.dismiss();
                if (res.ok) {
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a"); a.href = url;
                  a.download = `${selectedClient.business_name}_contract.pdf`; a.click();
                  toast.success("Contract downloaded!");
                } else { toast.error("Failed to generate contract"); }
              }} className="btn-secondary flex items-center gap-2">
                <Download size={16} /> Generate Contract PDF
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Invite Client to Portal Modal */}
      <Modal isOpen={!!showInviteModal} onClose={() => setShowInviteModal(null)} title="Give Client Portal Access">
        {showInviteModal && (
          <form onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            toast.loading("Creating account...");
            const res = await fetch("/api/clients/invite", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: fd.get("email"),
                full_name: fd.get("full_name"),
                password: fd.get("password"),
                client_id: showInviteModal.id,
              }),
            });
            toast.dismiss();
            const data = await res.json();
            if (data.success) {
              toast.success("Client account created! They can now log in.");
              setShowInviteModal(null);
            } else {
              toast.error(data.error || "Failed to create account");
            }
          }} className="space-y-4">
            <p className="text-sm text-muted">Create a login for <span className="text-gold font-medium">{showInviteModal.business_name}</span> so they can access their portal.</p>
            <div>
              <label className="block text-sm text-muted mb-1">Full Name *</label>
              <input name="full_name" className="input w-full" defaultValue={showInviteModal.contact_name} required />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Email *</label>
              <input name="email" type="email" className="input w-full" defaultValue={showInviteModal.email} required />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Password *</label>
              <input name="password" type="text" className="input w-full" placeholder="Set their initial password" required minLength={6} />
            </div>
            <div className="bg-surface-light rounded-lg p-3 text-xs text-muted">
              The client will be able to log in at shortstack-os.vercel.app and see: their active services, task checklist, invoices, contracts, and deliverables.
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setShowInviteModal(null)} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary flex items-center gap-2">
                <UserPlus size={16} /> Create Account
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
