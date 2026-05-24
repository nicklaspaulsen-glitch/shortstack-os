"use client";
import { ArrowsClockwise, Buildings, CheckCircle, CircleNotch, Copy, Phone, Warning } from "@phosphor-icons/react";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";

import { MotionPage } from "@/components/motion/motion-page";

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
    <div className={`grid grid-cols-[100px_1fr_1fr] gap-2 py-1.5 text-xs ${differs ? "text-text-primary" : "text-text-muted"}`}>
      <span className="text-text-muted/70 font-medium">{label}</span>
      <span className={differs && a ? "text-text-primary" : ""}>{a ?? "—"}</span>
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
    <MotionPage className="space-y-6">{/* -- Lead Deduplication command strip -- */}
    <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
      <div className="min-w-0">
        <p className="font-editorial text-[11px] italic text-text-muted mb-0.5">DEDUPLICATION</p>
        <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-primary leading-none">Lead Deduplication</h1>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
                  onClick={load}
                  disabled={loading}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/5 hover:bg-black/10 text-text-primary text-sm transition-colors border border-border-subtle disabled:opacity-50"
                >
                  <ArrowsClockwise className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                  Re-scan
                </button>
      </div>
    </div>{/* Summary */}<div className="grid grid-cols-2 lg:grid-cols-[4fr_2fr_2fr] gap-3 mb-4">
              {/* Focal tile */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04, duration: 0.36 }}
                className="flex items-start gap-3 bg-white border border-[rgba(0,0,0,0.07)] rounded-2xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Leads Scanned</p>
                  <p className="font-display text-3xl font-bold tracking-[-0.03em] text-text-primary tabular-nums">{leads.length.toLocaleString()}</p>
                </div>
              </motion.div>
              {/* Support tile: Duplicate Groups */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.10, duration: 0.36 }}
                className="bg-white border border-[rgba(0,0,0,0.07)] rounded-2xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Duplicate Groups</p>
                <p className={`font-display text-2xl font-bold tracking-[-0.02em] tabular-nums ${pendingGroups.length > 0 ? "text-amber-400" : "text-emerald-400"}`}>{pendingGroups.length}</p>
              </motion.div>
              {/* Support tile: Merged */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14, duration: 0.36 }}
                className="bg-white border border-[rgba(0,0,0,0.07)] rounded-2xl p-5 shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted mb-1.5">Merged</p>
                <p className="font-display text-2xl font-bold tracking-[-0.02em] text-emerald-400 tabular-nums">{merged.size}</p>
                <p className="text-[10px] text-text-muted mt-1">this session</p>
              </motion.div>
            </div>{loading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="glass rounded-xl p-5 animate-pulse">
                    <div className="h-4 bg-black/6 rounded w-1/3 mb-4" />
                    <div className="h-24 bg-black/4 rounded" />
                  </div>
                ))}
              </div>
            ) : pendingGroups.length === 0 ? (
              <div className="glass rounded-xl p-12 text-center text-text-muted">
                <CheckCircle className="w-12 h-12 mx-auto mb-4 text-emerald-600 opacity-50" />
                <p className="font-semibold text-text-primary/70 mb-1">
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
                  <Warning className="w-4 h-4" />
                  {pendingGroups.length} duplicate group{pendingGroups.length !== 1 ? "s" : ""} found — review and merge below.
                </div>

                {pendingGroups.map((group, idx) => {
                  const sorted = [...group.leads].sort((a, b) => completeness(b) - completeness(a));
                  const winner = sorted[0];
                  const loser = sorted[1];
                  const isMerging = merging[group.key];

                  return (
                    <motion.div key={group.key} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.04 }} whileHover={{ y: -4, scale: 1.01 }} className="glass rounded-xl overflow-hidden">
                      {/* Header */}
                      <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          {group.matchType === "phone"
                            ? <Phone className="w-4 h-4 text-blue-400" />
                            : <Buildings className="w-4 h-4 text-purple-400" />}
                          <span className="text-xs text-text-muted">
                            Match by <span className="text-text-primary font-medium">{group.matchType === "phone" ? "phone number" : "business name"}</span>
                          </span>
                          <span className="text-xs text-text-muted">— {group.leads.length} records</span>
                        </div>
                        <button
                          onClick={() => handleMerge(group)}
                          disabled={isMerging}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-xs font-medium border border-emerald-500/25 transition-colors disabled:opacity-50"
                        >
                          {isMerging ? <CircleNotch className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                          {isMerging ? "Merging…" : "Merge"}
                        </button>
                      </div>

                      {/* Side-by-side diff */}
                      <div className="p-5">
                        <div className="grid grid-cols-[100px_1fr_1fr] gap-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted/60 mb-2 pb-2 border-b border-white/5">
                          <span>Field</span>
                          <span className="text-text-primary/40">Keep (most complete)</span>
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
                          <p className="text-[10px] text-text-muted mt-3">
                            + {group.leads.length - 2} more duplicate{group.leads.length - 2 !== 1 ? "s" : ""} will also be soft-deleted.
                          </p>
                        )}

                        <p className="text-[10px] text-text-muted/60 mt-2">
                          Merge sets <code className="font-mono">status = &apos;merged&apos;</code> on duplicates. No data is permanently deleted.
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}</MotionPage>
  );
}
