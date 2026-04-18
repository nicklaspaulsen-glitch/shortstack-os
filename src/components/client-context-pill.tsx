"use client";

/**
 * ClientContextPill — a small floating pill in the corner that shows which
 * client the admin is currently viewing/managing data for. Click to switch
 * or clear.
 *
 * Only renders when a managedClient is set (admin has selected a client).
 */

import { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { useAuth } from "@/lib/auth-context";
import { X, ChevronDown, Users, Building2, RefreshCw, Search } from "lucide-react";

interface ClientOption {
  id: string;
  business_name: string;
  contact_name?: string;
  email?: string;
  package_tier?: string;
  avatar_url?: string;
}

export default function ClientContextPill() {
  const { managedClient, setManagedClient } = useAppStore();
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  // Only show for admin + team roles, never for clients themselves
  const isAdmin = profile?.role === "admin" || profile?.role === "team_member";

  useEffect(() => {
    if (!open || !isAdmin) return;
    setLoading(true);
    fetch("/api/clients")
      .then(r => r.ok ? r.json() : { clients: [] })
      .then(d => setClients(d.clients || []))
      .finally(() => setLoading(false));
  }, [open, isAdmin]);

  if (!isAdmin) return null;

  const initials = (managedClient?.business_name || "?")
    .split(" ")
    .slice(0, 2)
    .map(w => w[0])
    .join("")
    .toUpperCase();

  const filtered = clients.filter(c =>
    !search || c.business_name.toLowerCase().includes(search.toLowerCase()) ||
    c.contact_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      {/* Floating pill — shown when managing a client */}
      {managedClient ? (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-gradient-to-r from-gold/20 to-amber-500/10 border border-gold/40 backdrop-blur-md rounded-full pl-2 pr-3 py-2 shadow-lg shadow-gold/20">
          {/* Avatar */}
          <div className="relative w-7 h-7 rounded-full bg-gradient-to-br from-gold to-amber-500 flex items-center justify-center text-black text-[11px] font-bold shadow-inner">
            {initials}
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-background animate-pulse" />
          </div>

          {/* Label */}
          <div className="min-w-0 max-w-[200px]">
            <p className="text-[9px] text-gold/80 uppercase tracking-wider leading-none">Viewing</p>
            <p className="text-[11px] font-semibold text-foreground truncate leading-tight">{managedClient.business_name}</p>
          </div>

          {/* Change button */}
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/10 hover:bg-white/20 text-[10px] font-medium transition-colors ml-1"
            title="Switch client"
          >
            <RefreshCw size={9} />
            Switch
          </button>

          {/* Clear button */}
          <button
            onClick={() => setManagedClient(null)}
            className="p-1 rounded-full hover:bg-white/10 text-muted hover:text-red-400 transition-colors"
            title="Exit client view"
          >
            <X size={11} />
          </button>
        </div>
      ) : (
        /* When no client is managed — tiny chip to open the switcher */
        clients.length > 0 || open ? (
          <button
            onClick={() => setOpen(true)}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-surface/90 border border-border backdrop-blur-md rounded-full px-3 py-1.5 shadow-lg hover:border-gold/30 transition-all text-[11px] text-muted hover:text-foreground"
          >
            <Users size={11} />
            <span>View as client</span>
            <ChevronDown size={10} />
          </button>
        ) : null
      )}

      {/* Modal — client picker */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 fade-in"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-md max-h-[70vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 size={14} className="text-gold" />
                <h3 className="text-sm font-semibold">Switch Client View</h3>
              </div>
              <button onClick={() => setOpen(false)} className="p-1 text-muted hover:text-foreground">
                <X size={14} />
              </button>
            </div>

            {/* Search */}
            <div className="px-4 py-2 border-b border-border">
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search clients..."
                  className="w-full pl-7 pr-3 py-2 rounded-lg bg-surface-light border border-border text-xs focus:outline-none focus:border-gold/50"
                  autoFocus
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2">
              {/* Clear option */}
              {managedClient && (
                <button
                  onClick={() => {
                    setManagedClient(null);
                    setOpen(false);
                  }}
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg text-left hover:bg-surface-light/60 transition-colors mb-1 border border-transparent hover:border-red-400/20"
                >
                  <div className="w-8 h-8 rounded-full bg-red-500/15 text-red-400 flex items-center justify-center">
                    <X size={14} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-red-400">Exit client view</p>
                    <p className="text-[10px] text-muted">Return to agency dashboard</p>
                  </div>
                </button>
              )}

              {loading ? (
                <div className="py-8 text-center text-xs text-muted flex items-center justify-center gap-2">
                  <RefreshCw size={12} className="animate-spin" /> Loading...
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted">
                  {search ? "No clients match your search" : "No clients yet"}
                </div>
              ) : (
                filtered.map(c => {
                  const isCurrent = managedClient?.id === c.id;
                  const clientInitials = c.business_name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        setManagedClient({
                          id: c.id,
                          business_name: c.business_name,
                          contact_name: c.contact_name || "",
                          email: c.email || "",
                          package_tier: c.package_tier || "Growth",
                        });
                        setOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all mb-1 ${
                        isCurrent
                          ? "bg-gold/10 border border-gold/30"
                          : "hover:bg-surface-light/60 border border-transparent"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shadow-inner ${
                        isCurrent
                          ? "bg-gradient-to-br from-gold to-amber-500 text-black"
                          : "bg-surface-light text-foreground"
                      }`}>
                        {clientInitials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium truncate ${isCurrent ? "text-gold" : "text-foreground"}`}>
                          {c.business_name}
                        </p>
                        <p className="text-[10px] text-muted truncate">
                          {c.contact_name || c.email || c.package_tier}
                        </p>
                      </div>
                      {isCurrent && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gold/15 text-gold">Active</span>}
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer tip */}
            <div className="px-4 py-2 border-t border-border bg-surface-light/30">
              <p className="text-[9px] text-muted text-center">
                💡 Everything you do while viewing a client is scoped to them
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
