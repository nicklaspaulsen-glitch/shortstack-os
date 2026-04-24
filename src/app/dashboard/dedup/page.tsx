"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import PageHero from "@/components/ui/page-hero";
import { Copy, Phone, Building2, CheckCircle, Loader2, RefreshCw, AlertTriangle } from "lucide-react";

interface Lead {
  id: string;
  business_name: string | null;
  owner_name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  source: string | null;
  status: string | null;
  created_at: string;
  user_id: string | null;
}

interface DuplicateGroup {
  key: string;
  matchType: "phone" | "business_name";
  leads: Lead[];
}

function normalizePhone(p: string | null): string {
  if (!p) return "";
  return p.replace(/\D/g, "");
}

function normalizeName(n: string | null): string {
  if (!n) return "";
  return n.toLowerCase().trim().replace(/\s+/g, " ");
}

function completeness(lead: Lead): number {
  const fields: (keyof Lead)[] = ["business_name", "owner_name", "phone", "email", "city", "state", "source"];
  return fields.filter(f => lead[f] != null && lead[f] !== "").length;
}

function FieldRow({ label, a, b }: { label: string; a: string | null; b: string | null }) {
  const differs = (a ?? "") !== (b ?? "");
  return (
    <div className={`grid grid-cols-[100px_1fr_1fr] gap-2 py-1.5 text-xs ${differs ? "text-white" : "text-muted"}`}>
      <span className="text-muted/70 font-medium">{label}</span>
      <span className={differs && a ? "text-white" : ""}>{a ?? "—"}</span>
      <span className={differs && b ? "text-emerald-400" : ""}>{b ?? "—"}</span>
    </div>
  );
}

export default function DedupPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState<Record<string, boolean>>({});
  const [merged, setMerged] = useState<Set<string>>(new Set());
  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("leads")
      .select("id, business_name, owner_name, phone, email, city, state, source, status, created_at, user_id")
      .not("status", "eq", "merged")
      .order("created_at", { ascending: false })
      .limit(2000);
    const rows = (data as Lead[]) ?? [];
    setLeads(rows);

    // Group by phone
    const phoneMap: Record<string, Lead[]> = {};
    const nameMap: Record<string, Lead[]> = {};

    for (const lead of rows) {
      const phone = normalizePhone(lead.phone);
      if (phone.length >= 7) {
        (phoneMap[phone] ??= []).push(lead);
      }
      const name = normalizeName(lead.business_name);
      if (name.length >= 3) {
        const key = `${lead.user_id ?? ""}:${name}`;
        (nameMap[key] ??= []).push(lead);
      }
    }

    const found: DuplicateGroup[] = [];
    const seenIds = new Set<string>();

    for (const [phone, group] of Object.entries(phoneMap)) {
      if (group.length < 2) continue;
      const ids = group.map(l => l.id).sort().join(",");
      if (seenIds.has(ids)) continue;
      seenIds.add(ids);
      found.push({ key: `phone:${phone}`, matchType: "phone", leads: group.slice(0, 5) });
    }
    for (const [nameKey, group] of Object.entries(nameMap)) {
      if (group.length < 2) continue;
      const ids = group.map(l => l.id).sort().join(",");
      if (seenIds.has(ids)) continue;
      seenIds.add(ids);
      found.push({ key: `name:${nameKey}`, matchType: "business_name", leads: group.slice(0, 5) });
    }

    setGroups(found);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const handleMerge = useCallback(async (group: DuplicateGroup) => {
    setMerging(m => ({ ...m, [group.key]: true }));

    // Keep the most complete record, soft-delete the rest
    const sorted = [...group.leads].sort((a, b) => completeness(b) - completeness(a));
    const winner = sorted[0];
    const losers = sorted.slice(1);

    // Update winner with any missing fields from losers
    const patch: Partial<Lead> = {};
    for (const loser of losers) {
      const fields: (keyof Lead)[] = ["owner_name", "email", "city", "state", "source"];
      for (const f of fields) {
        if (!winner[f] && loser[f]) (patch as Record<string, unknown>)[f] = loser[f];
      }
    }
    if (Object.keys(patch).length > 0) {
      await supabase.from("leads").update(patch).eq("id", winner.id);
    }
    // Soft-delete duplicates
    for (const loser of losers) {
      await supabase.from("leads").update({ status: "merged" }).eq("id", loser.id);
    }

    setMerged(s => { const n = new Set(s); n.add(group.key); return n; });
    setMerging(m => ({ ...m, [group.key]: false }));
    // Refresh after short delay
    setTimeout(load, 800);
  }, [supabase, load]);

  const pendingGroups = groups.filter(g => !merged.has(g.key));

  return (
    <div className="space-y-6">
      <PageHero
        title="Lead Deduplication"
        subtitle="Finds leads sharing the same phone or business name — preview, then merge."
        icon={<Copy className="w-6 h-6" />}
        gradient="green"
        actions={
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm transition-colors border border-white/15 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Re-scan
          </button>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card-premium p-4 text-center">
          <div className="text-2xl font-bold text-white">{leads.length.toLocaleString()}</div>
          <div className="text-xs text-muted mt-0.5">Leads scanned</div>
        </div>
        <div className="card-premium p-4 text-center">
          <div className={`text-2xl font-bold ${pendingGroups.length > 0 ? "text-amber-400" : "text-emerald-400"}`}>
            {pendingGroups.length}
          </div>
          <div className="text-xs text-muted mt-0.5">Duplicate groups</div>
        </div>
        <div className="card-premium p-4 text-center">
          <div className="text-2xl font-bold text-emerald-400">{merged.size}</div>
          <div className="text-xs text-muted mt-0.5">Merged this session</div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card-premium p-5 animate-pulse">
              <div className="h-4 bg-white/10 rounded w-1/3 mb-4" />
              <div className="h-24 bg-white/5 rounded" />
            </div>
          ))}
        </div>
      ) : pendingGroups.length === 0 ? (
        <div className="card-premium p-12 text-center text-muted">
          <CheckCircle className="w-12 h-12 mx-auto mb-4 text-emerald-400 opacity-50" />
          <p className="font-semibold text-white/70 mb-1">
            {merged.size > 0 ? "All duplicates resolved!" : "No duplicates found"}
          </p>
          <p className="text-sm">
            {merged.size > 0
              ? `Merged ${merged.size} group${merged.size !== 1 ? "s" : ""} this session.`
              : "Your leads database looks clean across phone numbers and business names."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-amber-400/80">
            <AlertTriangle className="w-4 h-4" />
            {pendingGroups.length} duplicate group{pendingGroups.length !== 1 ? "s" : ""} found — review and merge below.
          </div>

          {pendingGroups.map(group => {
            const sorted = [...group.leads].sort((a, b) => completeness(b) - completeness(a));
            const winner = sorted[0];
            const loser = sorted[1];
            const isMerging = merging[group.key];

            return (
              <div key={group.key} className="card-premium overflow-hidden">
                {/* Header */}
                <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {group.matchType === "phone"
                      ? <Phone className="w-4 h-4 text-blue-400" />
                      : <Building2 className="w-4 h-4 text-purple-400" />}
                    <span className="text-xs text-muted">
                      Match by <span className="text-white">{group.matchType === "phone" ? "phone number" : "business name"}</span>
                    </span>
                    <span className="text-xs text-muted">— {group.leads.length} records</span>
                  </div>
                  <button
                    onClick={() => handleMerge(group)}
                    disabled={isMerging}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-xs font-medium border border-emerald-500/25 transition-colors disabled:opacity-50"
                  >
                    {isMerging ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                    {isMerging ? "Merging…" : "Merge"}
                  </button>
                </div>

                {/* Side-by-side diff */}
                <div className="p-5">
                  <div className="grid grid-cols-[100px_1fr_1fr] gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted/60 mb-2 pb-2 border-b border-white/5">
                    <span>Field</span>
                    <span className="text-white/40">Keep (most complete)</span>
                    <span className="text-emerald-400/60">Merge from</span>
                  </div>

                  <div className="divide-y divide-white/5">
                    <FieldRow label="Business" a={winner.business_name} b={loser?.business_name ?? null} />
                    <FieldRow label="Owner" a={winner.owner_name} b={loser?.owner_name ?? null} />
                    <FieldRow label="Phone" a={winner.phone} b={loser?.phone ?? null} />
                    <FieldRow label="Email" a={winner.email} b={loser?.email ?? null} />
                    <FieldRow label="City" a={winner.city} b={loser?.city ?? null} />
                    <FieldRow label="Source" a={winner.source} b={loser?.source ?? null} />
                    <FieldRow label="Status" a={winner.status} b={loser?.status ?? null} />
                  </div>

                  {group.leads.length > 2 && (
                    <p className="text-[10px] text-muted mt-3">
                      + {group.leads.length - 2} more duplicate{group.leads.length - 2 !== 1 ? "s" : ""} will also be soft-deleted.
                    </p>
                  )}

                  <p className="text-[10px] text-muted/60 mt-2">
                    Merge sets <code className="font-mono">status = &apos;merged&apos;</code> on duplicates. No data is permanently deleted.
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
