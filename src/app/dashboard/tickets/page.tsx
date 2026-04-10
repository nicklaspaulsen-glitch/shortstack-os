"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  Ticket, Clock, CheckCircle, Loader
} from "lucide-react";
import toast from "react-hot-toast";

interface TicketItem {
  id: string;
  description: string;
  client_id: string | null;
  status: string;
  created_at: string;
  result: {
    type: string;
    category: string;
    message: string;
    priority?: string;
    subject?: string;
  };
}

export default function TicketsPage() {
  useAuth();
  const supabase = createClient();
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("all");
  const [clients, setClients] = useState<Array<{ id: string; business_name: string }>>([]);

  useEffect(() => { fetchTickets(); }, []);

  async function fetchTickets() {
    setLoading(true);
    const [{ data: t }, { data: cl }] = await Promise.all([
      supabase.from("trinity_log")
        .select("*")
        .eq("action_type", "custom")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("clients").select("id, business_name").eq("is_active", true),
    ]);
    setTickets((t || []).filter(item => (item.result as Record<string, unknown>)?.type === "client_request") as TicketItem[]);
    setClients(cl || []);
    setLoading(false);
  }

  async function updateStatus(ticketId: string, status: string) {
    await supabase.from("trinity_log").update({ status }).eq("id", ticketId);
    toast.success(`Ticket marked as ${status}`);
    fetchTickets();
  }

  const filtered = filter === "all" ? tickets : tickets.filter(t => t.status === filter);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader size={20} className="animate-spin text-gold" /></div>;

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2">
            <Ticket size={18} className="text-gold" /> Support Tickets
          </h1>
          <p className="text-xs text-muted mt-0.5">{tickets.length} tickets — client requests auto-created by AI</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5">
        {(["all", "pending", "completed"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-[10px] px-3 py-1.5 rounded-lg capitalize transition-all ${
              filter === f ? "bg-gold/10 text-gold border border-gold/20" : "text-muted border border-white/[0.05]"
            }`}>
            {f} ({f === "all" ? tickets.length : tickets.filter(t => t.status === f).length})
          </button>
        ))}
      </div>

      {/* Tickets */}
      {filtered.length === 0 ? (
        <div className="card text-center py-12">
          <Ticket size={24} className="mx-auto mb-2 text-muted/30" />
          <p className="text-xs text-muted">No tickets found</p>
          <p className="text-[10px] text-muted/50 mt-1">Client requests are automatically created when they chat with Trinity AI</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(ticket => {
            const client = clients.find(c => c.id === ticket.client_id);
            return (
              <div key={ticket.id} className="p-4 rounded-xl transition-all"
                style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${ticket.status === "pending" ? "rgba(245,158,11,0.1)" : "rgba(255,255,255,0.04)"}` }}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      ticket.status === "pending" ? "bg-warning/10" : "bg-success/10"
                    }`}>
                      {ticket.status === "pending" ? <Clock size={16} className="text-warning" /> : <CheckCircle size={16} className="text-success" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-xs font-semibold">{client?.business_name || "Unknown Client"}</p>
                        <span className="text-[8px] px-1.5 py-0.5 rounded-full capitalize" style={{ background: "rgba(200,168,85,0.08)", color: "#c8a855" }}>
                          {ticket.result?.category || "general"}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted leading-relaxed">{ticket.result?.message || ticket.description}</p>
                      <p className="text-[9px] text-muted/40 mt-1">{new Date(ticket.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {ticket.status === "pending" && (
                      <button onClick={() => updateStatus(ticket.id, "completed")}
                        className="btn-primary text-[9px] py-1 px-2">Complete</button>
                    )}
                    {ticket.status === "completed" && (
                      <button onClick={() => updateStatus(ticket.id, "pending")}
                        className="btn-ghost text-[9px] py-1 px-2">Reopen</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
