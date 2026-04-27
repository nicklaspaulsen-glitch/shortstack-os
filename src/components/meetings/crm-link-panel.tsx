"use client";

/**
 * Side-panel for linking a meeting to a CRM contact (lead) or deal, then
 * pushing the summary + action items into the lead's activity feed.
 *
 * - Loads /api/leads and /api/crm/pipeline for picker options.
 * - PATCHes the meeting row to set lead_id / deal_id.
 * - POSTs to /api/meetings/[id]/sync-to-crm to create a lead_note row +
 *   one lead_follow_ups row per dated action item.
 *
 * Component is dumb about ownership — the API enforces tenant boundaries.
 */
import { useEffect, useMemo, useState } from "react";
import { Link2, Loader2, Send, User, Briefcase, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";

interface LeadOption {
  id: string;
  business_name: string | null;
  owner_name: string | null;
  email: string | null;
}

interface DealOption {
  id: string;
  title: string | null;
  client_name: string | null;
  stage: string | null;
}

interface Props {
  meetingId: string;
  leadId: string | null;
  dealId: string | null;
  hasSummary: boolean;
  syncedAt: string | null;
  onLinked: (next: { lead_id: string | null; deal_id: string | null }) => void;
  onSynced: () => void;
}

export default function CrmLinkPanel({
  meetingId,
  leadId,
  dealId,
  hasSummary,
  syncedAt,
  onLinked,
  onSynced,
}: Props) {
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [deals, setDeals] = useState<DealOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [leadsRes, dealsRes] = await Promise.all([
          fetch("/api/leads?limit=200").then((r) => (r.ok ? r.json() : { leads: [] })),
          fetch("/api/crm/pipeline").then((r) => (r.ok ? r.json() : { deals: [] })),
        ]);
        if (cancelled) return;
        const leadsList: LeadOption[] = leadsRes.leads || leadsRes.data || [];
        const dealsList: DealOption[] = dealsRes.deals || dealsRes.data || [];
        setLeads(leadsList);
        setDeals(dealsList);
      } catch (err) {
        console.error("[crm-link-panel] load error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredLeads = useMemo(() => {
    if (!search) return leads.slice(0, 20);
    const q = search.toLowerCase();
    return leads
      .filter(
        (l) =>
          (l.business_name || "").toLowerCase().includes(q) ||
          (l.owner_name || "").toLowerCase().includes(q) ||
          (l.email || "").toLowerCase().includes(q),
      )
      .slice(0, 20);
  }, [leads, search]);

  const filteredDeals = useMemo(() => {
    if (!search) return deals.slice(0, 20);
    const q = search.toLowerCase();
    return deals
      .filter(
        (d) =>
          (d.title || "").toLowerCase().includes(q) ||
          (d.client_name || "").toLowerCase().includes(q),
      )
      .slice(0, 20);
  }, [deals, search]);

  const linkedLead = leads.find((l) => l.id === leadId) || null;
  const linkedDeal = deals.find((d) => d.id === dealId) || null;

  async function setLink(field: "lead_id" | "deal_id", value: string | null) {
    setLinking(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Link failed");
      }
      const next = {
        lead_id: field === "lead_id" ? value : leadId,
        deal_id: field === "deal_id" ? value : dealId,
      };
      onLinked(next);
      toast.success("Linked");
    } catch (err) {
      console.error("[crm-link-panel] link error:", err);
      toast.error(err instanceof Error ? err.message : "Link failed");
    } finally {
      setLinking(false);
    }
  }

  async function syncToCrm() {
    if (!leadId) {
      toast.error("Link a contact first");
      return;
    }
    if (!hasSummary) {
      toast.error("Run analysis to generate a summary first");
      return;
    }
    setSyncing(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/sync-to-crm`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Sync failed");
      }
      const data = await res.json();
      const followUps =
        data.follow_ups_created > 0
          ? ` + ${data.follow_ups_created} follow-up${data.follow_ups_created === 1 ? "" : "s"}`
          : "";
      toast.success(`Pushed to CRM (note created${followUps})`);
      onSynced();
    } catch (err) {
      console.error("[crm-link-panel] sync error:", err);
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="card p-4 space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
        <Link2 size={11} /> CRM linking
      </h3>

      {loading ? (
        <p className="text-[11px] text-muted flex items-center gap-1.5">
          <Loader2 size={11} className="animate-spin" /> Loading contacts and deals...
        </p>
      ) : (
        <>
          <div className="space-y-1.5">
            <div className="text-[10px] text-muted">Contact</div>
            {linkedLead ? (
              <div className="flex items-center justify-between p-2 rounded-md bg-white/[0.04]">
                <div className="flex items-center gap-1.5 text-[11px] truncate">
                  <User size={10} className="text-gold flex-shrink-0" />
                  <span className="truncate">
                    {linkedLead.business_name || linkedLead.owner_name || "Unnamed"}
                  </span>
                </div>
                <button
                  onClick={() => setLink("lead_id", null)}
                  disabled={linking}
                  className="text-[9px] text-muted hover:text-red-400"
                >
                  Unlink
                </button>
              </div>
            ) : (
              <p className="text-[10px] text-muted">No contact linked yet.</p>
            )}

            <div className="text-[10px] text-muted mt-2">Deal</div>
            {linkedDeal ? (
              <div className="flex items-center justify-between p-2 rounded-md bg-white/[0.04]">
                <div className="flex items-center gap-1.5 text-[11px] truncate">
                  <Briefcase size={10} className="text-gold flex-shrink-0" />
                  <span className="truncate">
                    {linkedDeal.title || linkedDeal.client_name || "Unnamed"}
                  </span>
                </div>
                <button
                  onClick={() => setLink("deal_id", null)}
                  disabled={linking}
                  className="text-[9px] text-muted hover:text-red-400"
                >
                  Unlink
                </button>
              </div>
            ) : (
              <p className="text-[10px] text-muted">No deal linked yet.</p>
            )}
          </div>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contacts or deals..."
            className="input w-full text-xs"
          />

          {(filteredLeads.length > 0 || filteredDeals.length > 0) && (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {filteredLeads.map((l) => (
                <button
                  key={`lead-${l.id}`}
                  onClick={() => setLink("lead_id", l.id)}
                  disabled={linking || l.id === leadId}
                  className="w-full text-left p-2 rounded-md hover:bg-white/[0.05] transition-all flex items-center gap-1.5 text-[11px] disabled:opacity-50"
                >
                  <User size={10} className="text-muted flex-shrink-0" />
                  <span className="truncate">
                    {l.business_name || l.owner_name || l.email || "Unnamed"}
                  </span>
                </button>
              ))}
              {filteredDeals.map((d) => (
                <button
                  key={`deal-${d.id}`}
                  onClick={() => setLink("deal_id", d.id)}
                  disabled={linking || d.id === dealId}
                  className="w-full text-left p-2 rounded-md hover:bg-white/[0.05] transition-all flex items-center gap-1.5 text-[11px] disabled:opacity-50"
                >
                  <Briefcase size={10} className="text-muted flex-shrink-0" />
                  <span className="truncate">
                    {d.title || d.client_name || "Unnamed deal"}
                    {d.stage ? ` · ${d.stage}` : ""}
                  </span>
                </button>
              ))}
            </div>
          )}

          <button
            onClick={syncToCrm}
            disabled={syncing || !leadId || !hasSummary}
            className="btn-primary w-full text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {syncing ? (
              <Loader2 size={12} className="animate-spin" />
            ) : syncedAt ? (
              <CheckCircle2 size={12} />
            ) : (
              <Send size={12} />
            )}
            {syncedAt ? "Re-sync to CRM" : "Sync to CRM"}
          </button>

          {syncedAt && (
            <p className="text-[10px] text-muted text-center">
              Last synced {new Date(syncedAt).toLocaleString()}
            </p>
          )}
          {!hasSummary && (
            <p className="text-[10px] text-muted text-center">
              Run Claude analysis first to generate the note body.
            </p>
          )}
        </>
      )}
    </div>
  );
}
