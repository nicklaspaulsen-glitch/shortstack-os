"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  GitMerge, Search, Trash2, Loader, AlertTriangle, CheckCircle
} from "lucide-react";
import toast from "react-hot-toast";

interface DuplicateGroup {
  key: string;
  field: string;
  leads: Array<{ id: string; business_name: string; email: string | null; phone: string | null; status: string; created_at: string }>;
}

export default function DedupPage() {
  useAuth();
  const supabase = createClient();
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { findDuplicates(); }, []);

  async function findDuplicates() {
    try {
    setLoading(true);
    const { data: leads } = await supabase
      .from("leads")
      .select("id, business_name, email, phone, status, created_at")
      .order("created_at", { ascending: false })
      .limit(2000);

    if (!leads) { return; }

    const groups: Record<string, DuplicateGroup> = {};

    // Find duplicates by email
    leads.forEach(lead => {
      if (lead.email) {
        const key = `email:${lead.email.toLowerCase()}`;
        if (!groups[key]) groups[key] = { key, field: "email", leads: [] };
        groups[key].leads.push(lead);
      }
    });

    // Find duplicates by phone
    leads.forEach(lead => {
      if (lead.phone) {
        const normalized = lead.phone.replace(/\D/g, "");
        if (normalized.length >= 7) {
          const key = `phone:${normalized}`;
          if (!groups[key]) groups[key] = { key, field: "phone", leads: [] };
          groups[key].leads.push(lead);
        }
      }
    });

    // Find duplicates by name (exact match)
    leads.forEach(lead => {
      const key = `name:${lead.business_name.toLowerCase().trim()}`;
      if (!groups[key]) groups[key] = { key, field: "name", leads: [] };
      groups[key].leads.push(lead);
    });

    // Only keep groups with 2+ leads
    const dupes = Object.values(groups).filter(g => g.leads.length >= 2);
    setDuplicates(dupes);
    } catch (err) {
      console.error("[Dedup] findDuplicates error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function mergeDuplicates(group: DuplicateGroup) {
    setMerging(group.key);

    // Keep the first lead (oldest), delete the rest
    const keep = group.leads[group.leads.length - 1]; // oldest
    const deleteIds = group.leads.filter(l => l.id !== keep.id).map(l => l.id);

    try {
      // Delete duplicates
      for (const id of deleteIds) {
        await supabase.from("leads").delete().eq("id", id);
      }

      toast.success(`Merged ${group.leads.length} leads → kept "${keep.business_name}"`);
      findDuplicates();
    } catch { toast.error("Merge failed"); }

    setMerging(null);
  }

  async function deleteAllDuplicates() {
    if (!confirm(`Delete ${duplicates.reduce((s, g) => s + g.leads.length - 1, 0)} duplicate leads?`)) return;

    let deleted = 0;
    for (const group of duplicates) {
      const keep = group.leads[group.leads.length - 1];
      for (const lead of group.leads) {
        if (lead.id !== keep.id) {
          await supabase.from("leads").delete().eq("id", lead.id);
          deleted++;
        }
      }
    }

    toast.success(`Deleted ${deleted} duplicates!`);
    findDuplicates();
  }

  if (loading) return <div className="flex items-center justify-center py-20"><Loader size={20} className="animate-spin text-gold" /></div>;

  const totalDupes = duplicates.reduce((s, g) => s + g.leads.length - 1, 0);

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2">
            <GitMerge size={18} className="text-gold" /> Dedup & Merge
          </h1>
          <p className="text-xs text-muted mt-0.5">{duplicates.length} duplicate groups found · {totalDupes} removable leads</p>
        </div>
        <div className="flex gap-2">
          <button onClick={findDuplicates} className="btn-secondary text-xs flex items-center gap-1.5">
            <Search size={12} /> Rescan
          </button>
          {totalDupes > 0 && (
            <button onClick={deleteAllDuplicates} className="btn-primary text-xs flex items-center gap-1.5">
              <Trash2 size={12} /> Clean All ({totalDupes})
            </button>
          )}
        </div>
      </div>

      {duplicates.length === 0 ? (
        <div className="card text-center py-16">
          <CheckCircle size={32} className="mx-auto mb-3 text-success/30" />
          <p className="text-sm text-foreground font-semibold mb-1">No duplicates found</p>
          <p className="text-xs text-muted">Your lead database is clean!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {duplicates.map(group => (
            <div key={group.key} className="card">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={14} className="text-warning" />
                  <span className="text-xs font-semibold">{group.leads.length} matches by {group.field}</span>
                  <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: "rgba(245,158,11,0.08)", color: "#f59e0b" }}>
                    {group.field === "email" ? group.leads[0].email : group.field === "phone" ? group.leads[0].phone : group.leads[0].business_name}
                  </span>
                </div>
                <button onClick={() => mergeDuplicates(group)} disabled={merging === group.key}
                  className="btn-secondary text-[9px] py-1 px-2.5 flex items-center gap-1">
                  {merging === group.key ? <Loader size={10} className="animate-spin" /> : <GitMerge size={10} />}
                  Merge
                </button>
              </div>
              <div className="space-y-1">
                {group.leads.map((lead, i) => (
                  <div key={lead.id} className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-[10px] ${i === group.leads.length - 1 ? "bg-success/[0.03] border border-success/10" : "bg-surface-light"}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-muted font-mono">{lead.business_name}</span>
                      <span className="text-muted/50">{lead.email || "—"}</span>
                      <span className="text-muted/50">{lead.phone || "—"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted/40">{lead.status}</span>
                      {i === group.leads.length - 1 && <span className="text-[8px] text-success">KEEP</span>}
                      {i < group.leads.length - 1 && <span className="text-[8px] text-danger">REMOVE</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
