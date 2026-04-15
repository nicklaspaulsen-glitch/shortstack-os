"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useAppStore } from "@/lib/store";
import { formatCurrency } from "@/lib/utils";
import {
  ChevronDown, Search, Users, FileText, DollarSign,
  CheckCircle, AlertTriangle, UserCheck, X
} from "lucide-react";

interface EnrichedClient {
  id: string;
  business_name: string;
  contact_name: string;
  email: string;
  phone: string;
  industry: string;
  package_tier: string;
  mrr: number;
  health_score: number;
  is_active: boolean;
  tasks: { done: number; total: number };
  content_count: number;
  campaign_count: number;
  invoices_pending: number;
  connected_platforms: Array<{ platform: string; account_name: string; is_active: boolean }>;
}

export default function ClientSwitcher() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [clients, setClients] = useState<EnrichedClient[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeClient, setActiveClient] = useState<EnrichedClient | null>(null);
  const { managedClient, setManagedClient } = useAppStore();

  async function fetchClients() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/switch-client");
      const data = await res.json();
      if (data.success) {
        setClients(data.clients);
      }
    } catch (err) {
      console.error("[ClientSwitcher] Failed to fetch clients:", err);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (open && clients.length === 0) {
      fetchClients();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Only show for admins
  if (profile?.role !== "admin") return null;

  const filtered = clients.filter(c =>
    !search || c.business_name.toLowerCase().includes(search.toLowerCase()) ||
    c.contact_name.toLowerCase().includes(search.toLowerCase())
  );

  function selectClient(client: EnrichedClient) {
    setActiveClient(client);
  }

  function manageSelectedClient(client: EnrichedClient) {
    setManagedClient({
      id: client.id,
      business_name: client.business_name,
      contact_name: client.contact_name,
      email: client.email,
      package_tier: client.package_tier,
    });
    setOpen(false);
  }

  return (
    <div className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
          managedClient
            ? "text-gold bg-gold/10 border border-gold/20 hover:bg-gold/15"
            : "text-muted hover:text-foreground bg-surface-light/50 border border-border/50 hover:border-gold/20"
        }`}
      >
        {managedClient ? <UserCheck size={13} /> : <Users size={13} />}
        <span>{managedClient ? managedClient.business_name : "Switch Client"}</span>
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Panel */}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 w-[480px] bg-surface border border-border/50 rounded-xl shadow-2xl shadow-black/50 fade-in overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={14} className="text-gold" />
                <span className="text-xs font-semibold">Client Switcher</span>
                <span className="text-[10px] text-muted bg-surface-light px-1.5 py-0.5 rounded">{clients.length}</span>
              </div>
              <button onClick={() => setOpen(false)} className="text-muted hover:text-foreground">
                <X size={14} />
              </button>
            </div>

            {/* Search */}
            <div className="px-3 py-2 border-b border-border/20">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  placeholder="Search clients..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input w-full pl-8 py-1.5 text-xs"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex">
              {/* Client list */}
              <div className="w-1/2 border-r border-border/20 max-h-[400px] overflow-y-auto">
                {loading ? (
                  <div className="p-4 text-center text-xs text-muted">Loading clients...</div>
                ) : filtered.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted">No clients found</div>
                ) : (
                  filtered.map(client => (
                    <button
                      key={client.id}
                      onClick={() => selectClient(client)}
                      className={`w-full text-left px-3 py-2.5 border-b border-border/10 hover:bg-surface-light/50 transition-colors ${
                        activeClient?.id === client.id ? "bg-gold/5 border-l-2 border-l-gold" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{client.business_name}</p>
                          <p className="text-[10px] text-muted truncate">{client.contact_name}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          {client.is_active ? (
                            <div className="glow-dot bg-success text-success" />
                          ) : (
                            <div className="w-1.5 h-1.5 rounded-full bg-muted" />
                          )}
                          <span className="text-[10px] font-mono text-gold">{formatCurrency(client.mrr)}</span>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>

              {/* Client detail panel */}
              <div className="w-1/2 max-h-[400px] overflow-y-auto">
                {activeClient ? (
                  <div className="p-3 space-y-3">
                    {/* Header */}
                    <div>
                      <h3 className="text-xs font-semibold">{activeClient.business_name}</h3>
                      <p className="text-[10px] text-muted">{activeClient.contact_name} · {activeClient.industry}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] bg-gold/10 text-gold px-1.5 py-0.5 rounded font-medium">
                          {activeClient.package_tier || "No tier"}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          activeClient.health_score > 75 ? "bg-success/10 text-success" :
                          activeClient.health_score > 50 ? "bg-warning/10 text-warning" : "bg-danger/10 text-danger"
                        }`}>
                          {activeClient.health_score}% health
                        </span>
                      </div>
                    </div>

                    {/* Metrics */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-surface-light/50 rounded-lg p-2 border border-border/20">
                        <div className="flex items-center gap-1 mb-0.5">
                          <DollarSign size={10} className="text-gold" />
                          <span className="text-[9px] text-muted uppercase">MRR</span>
                        </div>
                        <p className="text-xs font-bold font-mono">{formatCurrency(activeClient.mrr)}</p>
                      </div>
                      <div className="bg-surface-light/50 rounded-lg p-2 border border-border/20">
                        <div className="flex items-center gap-1 mb-0.5">
                          <CheckCircle size={10} className="text-success" />
                          <span className="text-[9px] text-muted uppercase">Tasks</span>
                        </div>
                        <p className="text-xs font-bold font-mono">{activeClient.tasks.done}/{activeClient.tasks.total}</p>
                      </div>
                      <div className="bg-surface-light/50 rounded-lg p-2 border border-border/20">
                        <div className="flex items-center gap-1 mb-0.5">
                          <FileText size={10} className="text-gold" />
                          <span className="text-[9px] text-muted uppercase">Content</span>
                        </div>
                        <p className="text-xs font-bold font-mono">{activeClient.content_count}</p>
                      </div>
                      <div className="bg-surface-light/50 rounded-lg p-2 border border-border/20">
                        <div className="flex items-center gap-1 mb-0.5">
                          {activeClient.invoices_pending > 0 ? (
                            <AlertTriangle size={10} className="text-warning" />
                          ) : (
                            <DollarSign size={10} className="text-success" />
                          )}
                          <span className="text-[9px] text-muted uppercase">Invoices</span>
                        </div>
                        <p className={`text-xs font-bold font-mono ${activeClient.invoices_pending > 0 ? "text-warning" : ""}`}>
                          {activeClient.invoices_pending} pending
                        </p>
                      </div>
                    </div>

                    {/* Connected platforms */}
                    {activeClient.connected_platforms.length > 0 && (
                      <div>
                        <p className="text-[9px] text-muted uppercase tracking-wider mb-1.5">Connected</p>
                        <div className="flex flex-wrap gap-1">
                          {activeClient.connected_platforms.map((p, i) => (
                            <span key={i} className="text-[10px] bg-surface-light px-2 py-0.5 rounded border border-border/30">
                              {p.platform}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <button
                      onClick={() => manageSelectedClient(activeClient)}
                      className="w-full btn-primary text-xs py-2 flex items-center justify-center gap-1.5"
                    >
                      <UserCheck size={12} /> Manage Client
                    </button>
                  </div>
                ) : (
                  <div className="p-8 text-center text-xs text-muted">
                    <Users size={20} className="mx-auto mb-2 text-muted/50" />
                    Select a client
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
