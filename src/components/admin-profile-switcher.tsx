"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import Modal from "@/components/ui/modal";
import {
  ChevronDown, Search, X, Eye, EyeOff, Shield,
  UserPlus, Settings, Loader, Plus
} from "lucide-react";
import toast from "react-hot-toast";

function PasswordInput({ name, placeholder, required, minLength }: { name: string; placeholder: string; required?: boolean; minLength?: number }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input name={name} type={show ? "text" : "password"} className="input w-full text-xs pr-9" placeholder={placeholder} required={required} minLength={minLength} />
      <button type="button" onClick={() => setShow(!show)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-white transition-colors">
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

interface ClientAccount {
  id: string;
  business_name: string;
  contact_name: string;
  email: string;
  phone: string;
  package_tier: string;
  mrr: number;
  health_score: number;
  is_active: boolean;
  profile_id?: string;
  tasks: { done: number; total: number };
  content_count: number;
  invoices_pending: number;
  connected_platforms: Array<{ platform: string; account_name: string }>;
}

export default function AdminProfileSwitcher() {
  const { profile } = useAuth();
  const router = useRouter();
  const { impersonatedClient, setImpersonatedClient, isImpersonating } = useAppStore();
  const [open, setOpen] = useState(false);
  const [clients, setClients] = useState<ClientAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [showCreateProfile, setShowCreateProfile] = useState<ClientAccount | null>(null);
  const [creating, setCreating] = useState(false);

  if (profile?.role !== "admin") return null;

  async function fetchClients() {
    if (clients.length > 0) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/switch-client");
      const data = await res.json();
      if (data.success) setClients(data.clients);
    } catch {}
    setLoading(false);
  }

  function switchTo(client: ClientAccount) {
    setImpersonatedClient({
      id: client.id,
      business_name: client.business_name,
      contact_name: client.contact_name,
      email: client.email,
      package_tier: client.package_tier,
      profile_id: client.profile_id,
    });
    setOpen(false);
    // Navigate to their portal view
    router.push(`/dashboard/clients/${client.id}`);
  }

  function manageClient(client: ClientAccount) {
    setOpen(false);
    router.push(`/dashboard/clients/${client.id}`);
  }

  async function createClientProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!showCreateProfile) return;
    setCreating(true);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/clients/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: fd.get("email"),
          full_name: fd.get("full_name"),
          password: fd.get("password"),
          client_id: showCreateProfile.id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Client profile created! They can now log in.");
        setShowCreateProfile(null);
        // Refresh client list
        setClients([]);
        fetchClients();
      } else {
        toast.error(data.error || "Failed to create profile");
      }
    } catch {
      toast.error("Connection error");
    }
    setCreating(false);
  }

  const filtered = clients.filter(c =>
    !search || c.business_name.toLowerCase().includes(search.toLowerCase()) ||
    c.contact_name.toLowerCase().includes(search.toLowerCase())
  );

  // Impersonation active banner
  if (isImpersonating && impersonatedClient) {
    return (
      <div className="mx-2 mb-1">
        <div className="bg-warning/10 border border-warning/20 rounded-lg px-2.5 py-2">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <Eye size={11} className="text-warning" />
              <span className="text-[9px] text-warning font-semibold uppercase tracking-wider">Viewing as</span>
            </div>
            <button onClick={() => setImpersonatedClient(null)} className="text-warning hover:text-white transition-colors" title="Exit">
              <X size={12} />
            </button>
          </div>
          <p className="text-xs font-medium truncate">{impersonatedClient.business_name}</p>
          <p className="text-[10px] text-muted truncate">{impersonatedClient.contact_name}</p>
          <button onClick={() => setImpersonatedClient(null)}
            className="w-full mt-1.5 text-[10px] bg-warning/10 hover:bg-warning/20 text-warning px-2 py-1 rounded flex items-center justify-center gap-1 transition-colors">
            <EyeOff size={10} /> Back to Admin
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mx-2 mb-1 relative">
        <button
          onClick={() => { setOpen(!open); fetchClients(); }}
          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left bg-surface-light/30 hover:bg-surface-light/60 border border-border/30 hover:border-gold/15 transition-all"
        >
          <div className="w-6 h-6 bg-gold/10 rounded-md flex items-center justify-center shrink-0">
            <Shield size={12} className="text-gold" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-muted font-medium">Accounts</p>
            <p className="text-[10px] text-muted/60">{clients.length > 0 ? `${clients.length} clients` : "Manage clients"}</p>
          </div>
          <ChevronDown size={12} className={`text-muted transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {/* Dropdown */}
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute left-0 top-full mt-1 z-50 w-72 bg-surface border border-border/50 rounded-xl shadow-2xl shadow-black/50 fade-in overflow-hidden">
              {/* Header */}
              <div className="px-3 py-2 border-b border-border/20 flex items-center justify-between">
                <span className="text-[10px] text-muted font-semibold uppercase tracking-wider">Client Accounts</span>
                <button onClick={() => { setOpen(false); router.push("/dashboard/onboard"); }}
                  className="text-[10px] text-gold hover:text-gold-light flex items-center gap-0.5">
                  <Plus size={10} /> New Client
                </button>
              </div>

              {/* Search */}
              <div className="p-2 border-b border-border/20">
                <div className="relative">
                  <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    type="text"
                    placeholder="Search clients..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="input w-full pl-7 py-1 text-[10px]"
                    autoFocus
                  />
                </div>
              </div>

              {/* Client list */}
              <div className="max-h-[320px] overflow-y-auto">
                {loading ? (
                  <div className="p-4 text-center text-[10px] text-muted">Loading...</div>
                ) : filtered.length === 0 ? (
                  <div className="p-4 text-center text-[10px] text-muted">No clients found</div>
                ) : (
                  filtered.map(client => (
                    <div
                      key={client.id}
                      className="px-3 py-2 hover:bg-surface-light/50 border-b border-border/10 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${client.is_active ? "bg-success" : "bg-muted"}`} />
                          <div className="min-w-0">
                            <p className="text-[11px] font-medium truncate">{client.business_name}</p>
                            <p className="text-[9px] text-muted truncate">
                              {client.contact_name} · {client.package_tier || "No tier"} · {formatCurrency(client.mrr)}/mo
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1 mt-1.5 pl-3.5">
                        <button onClick={() => switchTo(client)}
                          className="text-[9px] bg-gold/10 text-gold hover:bg-gold/20 px-2 py-0.5 rounded flex items-center gap-0.5 transition-colors">
                          <Eye size={9} /> View as
                        </button>
                        <button onClick={() => manageClient(client)}
                          className="text-[9px] bg-surface-light text-muted hover:text-white px-2 py-0.5 rounded flex items-center gap-0.5 transition-colors">
                          <Settings size={9} /> Manage
                        </button>
                        {!client.profile_id ? (
                          <button onClick={() => { setOpen(false); setShowCreateProfile(client); }}
                            className="text-[9px] bg-accent/10 text-accent hover:bg-accent/20 px-2 py-0.5 rounded flex items-center gap-0.5 transition-colors">
                            <UserPlus size={9} /> Create Login
                          </button>
                        ) : (
                          <span className="text-[9px] text-success/60 flex items-center gap-0.5">
                            <Shield size={8} /> Has login
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Create Profile Modal */}
      <Modal isOpen={!!showCreateProfile} onClose={() => setShowCreateProfile(null)} title="Create Client Login">
        {showCreateProfile && (
          <form onSubmit={createClientProfile} className="space-y-3">
            <p className="text-xs text-muted">
              Create a login for <span className="text-gold font-medium">{showCreateProfile.business_name}</span> so they can access their client portal.
            </p>
            <div>
              <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider">Full Name</label>
              <input name="full_name" className="input w-full text-xs" defaultValue={showCreateProfile.contact_name} required />
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider">Email</label>
              <input name="email" type="email" className="input w-full text-xs" defaultValue={showCreateProfile.email} required />
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider">Password</label>
              <PasswordInput name="password" placeholder="Set initial password" required minLength={6} />
            </div>
            <div className="bg-surface-light/50 rounded-lg p-2.5 border border-border/20">
              <p className="text-[10px] text-muted">
                The client will be able to log in and see: services, task checklist, invoices, contracts, and deliverables.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowCreateProfile(null)} className="btn-secondary text-xs">Cancel</button>
              <button type="submit" disabled={creating} className="btn-primary text-xs flex items-center gap-1.5">
                {creating ? <Loader size={12} className="animate-spin" /> : <UserPlus size={12} />}
                {creating ? "Creating..." : "Create Account"}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
