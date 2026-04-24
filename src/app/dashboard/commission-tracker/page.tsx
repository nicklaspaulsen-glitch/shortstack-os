"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import PageHero from "@/components/ui/page-hero";
import Modal from "@/components/ui/modal";
import toast from "react-hot-toast";
import {
  DollarSign, Plus, Trash2, Download,
  Loader, CheckCircle, Clock, Search
} from "lucide-react";

type CommissionStatus = "pending" | "approved" | "paid";

interface Commission {
  id: string;
  user_id: string;
  team_member_id: string | null;
  deal_id: string | null;
  amount_cents: number;
  percentage: number;
  status: CommissionStatus;
  notes: string | null;
  paid_at: string | null;
  created_at: string;
}

interface FormState {
  rep_name: string;
  deal_ref: string;
  amount: string;
  rate: string;
  notes: string;
}

const STATUS_CONFIG: Record<
  CommissionStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  pending: {
    label: "Pending",
    color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
    icon: <Clock size={11} />,
  },
  approved: {
    label: "Approved",
    color: "text-blue-400 bg-blue-400/10 border-blue-400/20",
    icon: <CheckCircle size={11} />,
  },
  paid: {
    label: "Paid",
    color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    icon: <CheckCircle size={11} />,
  },
};

function fmtUSD(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD",
  }).format(cents / 100);
}

function downloadCSV(rows: Commission[]) {
  const headers = ["Rep", "Deal Ref", "Amount", "Rate %", "Status", "Notes", "Paid At", "Created"];
  const lines = rows.map(r => [
    (r.notes || "").split("|")[0] || "Unknown",
    r.deal_id || "",
    (r.amount_cents / 100).toFixed(2),
    r.percentage,
    r.status,
    r.notes || "",
    r.paid_at || "",
    r.created_at,
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "commissions.csv";
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

const EMPTY_FORM: FormState = { rep_name: "", deal_ref: "", amount: "", rate: "", notes: "" };

export default function CommissionTrackerPage() {
  const supabase = createClient();
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<CommissionStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("commissions")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setCommissions(data as Commission[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    return commissions.filter(c => {
      const matchStatus = filterStatus === "all" || c.status === filterStatus;
      const repName = (c.notes || "").split("|")[0] || "";
      const matchSearch =
        !search ||
        repName.toLowerCase().includes(search.toLowerCase()) ||
        (c.deal_id || "").toLowerCase().includes(search.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [commissions, filterStatus, search]);

  const totals = useMemo(() => ({
    total: filtered.reduce((s, c) => s + c.amount_cents, 0),
    paid: filtered
      .filter(c => c.status === "paid")
      .reduce((s, c) => s + c.amount_cents, 0),
    pending: filtered
      .filter(c => c.status !== "paid")
      .reduce((s, c) => s + c.amount_cents, 0),
  }), [filtered]);

  async function createCommission() {
    if (!form.rep_name.trim() || !form.amount) {
      toast.error("Rep name and amount required");
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Not authenticated"); setSaving(false); return; }
    const { error } = await supabase.from("commissions").insert({
      user_id: user.id,
      amount_cents: Math.round(parseFloat(form.amount) * 100),
      percentage: parseFloat(form.rate) || 0,
      status: "pending" as CommissionStatus,
      deal_id: form.deal_ref || null,
      notes: form.rep_name + (form.notes ? "|" + form.notes : ""),
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Commission added");
    setShowCreate(false);
    setForm(EMPTY_FORM);
    load();
  }

  async function markPaid(id: string) {
    setMarkingPaid(id);
    const { error } = await supabase
      .from("commissions")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", id);
    setMarkingPaid(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Marked as paid");
    setCommissions(prev =>
      prev.map(c =>
        c.id === id ? { ...c, status: "paid", paid_at: new Date().toISOString() } : c
      )
    );
  }

  async function deleteCommission(id: string) {
    if (!confirm("Delete this commission?")) return;
    await supabase.from("commissions").delete().eq("id", id);
    setCommissions(prev => prev.filter(c => c.id !== id));
    toast.success("Deleted");
  }

  function setF(key: keyof FormState, val: string) {
    setForm(f => ({ ...f, [key]: val }));
  }

  return (
    <div className="space-y-6">
      <PageHero
        title="Commission Tracker"
        subtitle="Track, approve, and pay sales commissions for your team."
        icon={<DollarSign size={22} />}
        gradient="green"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadCSV(filtered)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-colors border border-white/20"
            >
              <Download size={13} /> Export CSV
            </button>
            <button
              onClick={() => { setForm(EMPTY_FORM); setShowCreate(true); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors border border-white/20"
            >
              <Plus size={13} /> Add
            </button>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search rep or deal…"
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-400/50"
          />
        </div>
        <div className="flex gap-1">
          {(["all", "pending", "approved", "paid"] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                filterStatus === s
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30"
                  : "bg-white/5 text-white/50 hover:text-white border border-white/10"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-14 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-12 text-center">
          <DollarSign size={36} className="mx-auto mb-3 text-white/20" />
          <p className="text-white/40 text-sm">No commissions found.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-white/10 text-xs text-white/40">
                <tr>
                  <th className="text-left px-4 py-3">Rep</th>
                  <th className="text-left px-4 py-3">Deal Ref</th>
                  <th className="text-right px-4 py-3">Amount</th>
                  <th className="text-right px-4 py-3">Rate</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map(c => {
                  const repName = (c.notes || "").split("|")[0] || "Unknown";
                  const cfg = STATUS_CONFIG[c.status];
                  return (
                    <tr key={c.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 font-medium text-white">{repName}</td>
                      <td className="px-4 py-3 text-white/50">{c.deal_id || "—"}</td>
                      <td className="px-4 py-3 text-right font-medium text-white">
                        {fmtUSD(c.amount_cents)}
                      </td>
                      <td className="px-4 py-3 text-right text-white/60">
                        {c.percentage}%
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${cfg.color}`}
                        >
                          {cfg.icon}
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {c.status !== "paid" && (
                            <button
                              onClick={() => markPaid(c.id)}
                              disabled={markingPaid === c.id}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs transition-colors disabled:opacity-50"
                            >
                              {markingPaid === c.id ? (
                                <Loader size={11} className="animate-spin" />
                              ) : (
                                <CheckCircle size={11} />
                              )}{" "}
                              Pay
                            </button>
                          )}
                          <button
                            onClick={() => deleteCommission(c.id)}
                            className="p-1.5 rounded-lg hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t border-white/10">
                <tr className="text-sm font-semibold">
                  <td colSpan={2} className="px-4 py-3 text-white/60">
                    Totals ({filtered.length})
                  </td>
                  <td className="px-4 py-3 text-right text-white">
                    {fmtUSD(totals.total)}
                  </td>
                  <td />
                  <td className="px-4 py-3">
                    <span className="text-xs text-emerald-400 mr-2">
                      {fmtUSD(totals.paid)} paid
                    </span>
                    <span className="text-xs text-yellow-400">
                      {fmtUSD(totals.pending)} pending
                    </span>
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Add Commission"
      >
        <div className="space-y-3">
          {(
            [
              { key: "rep_name" as keyof FormState, label: "Rep Name *", placeholder: "Jane Smith", type: "text" },
              { key: "deal_ref" as keyof FormState, label: "Deal Reference", placeholder: "DEAL-001", type: "text" },
              { key: "amount" as keyof FormState, label: "Amount ($) *", placeholder: "500.00", type: "number" },
              { key: "rate" as keyof FormState, label: "Rate (%)", placeholder: "10", type: "number" },
              { key: "notes" as keyof FormState, label: "Notes", placeholder: "Optional", type: "text" },
            ]
          ).map(({ key, label, placeholder, type }) => (
            <div key={key}>
              <label className="block text-xs text-white/50 mb-1">{label}</label>
              <input
                type={type || "text"}
                value={form[key]}
                onChange={e => setF(key, e.target.value)}
                placeholder={placeholder}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-400/50"
              />
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 rounded-lg border border-white/10 text-white/60 hover:text-white text-sm"
            >
              Cancel
            </button>
            <button
              onClick={createCommission}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50"
            >
              {saving && <Loader size={13} className="animate-spin" />}
              Add Commission
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
