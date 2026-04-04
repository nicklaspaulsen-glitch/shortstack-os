"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TeamMember, Deal, Payroll } from "@/lib/types";
import StatCard from "@/components/ui/stat-card";
import StatusBadge from "@/components/ui/status-badge";
import DataTable from "@/components/ui/data-table";
import Modal from "@/components/ui/modal";
import { PageLoading } from "@/components/ui/loading";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Users, DollarSign, Trophy, Plus, FileDown, Briefcase } from "lucide-react";
import toast from "react-hot-toast";

type Tab = "team" | "deals" | "payroll";

export default function TeamPage() {
  const [tab, setTab] = useState<Tab>("team");
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [payroll, setPayroll] = useState<Payroll[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { const t = setTimeout(() => setLoading(false), 3000); return () => clearTimeout(t); }, []);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddDeal, setShowAddDeal] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const [{ data: m }, { data: d }, { data: p }] = await Promise.all([
      supabase.from("team_members").select("*").order("full_name"),
      supabase.from("deals").select("*").order("created_at", { ascending: false }),
      supabase.from("payroll").select("*").order("month", { ascending: false }),
    ]);
    setMembers(m || []);
    setDeals(d || []);
    setPayroll(p || []);
    setLoading(false);
  }

  const totalPayroll = payroll
    .filter((p) => p.month === new Date().toISOString().slice(0, 7) + "-01")
    .reduce((sum, p) => sum + p.total_amount, 0);

  const totalDealsWon = deals.filter((d) => d.status === "won").reduce((sum, d) => sum + d.amount, 0);
  const dealsThisMonth = deals.filter((d) => d.status === "won" && d.closed_at && d.closed_at.startsWith(new Date().toISOString().slice(0, 7))).length;

  async function addTeamMember(formData: FormData) {
    const { error } = await supabase.from("team_members").insert({
      full_name: formData.get("full_name"),
      email: formData.get("email"),
      role: formData.get("role"),
      base_pay: parseFloat(formData.get("base_pay") as string) || 0,
      commission_rate: parseFloat(formData.get("commission_rate") as string) || 0,
      payment_method: formData.get("payment_method"),
      country: formData.get("country"),
    });
    if (error) toast.error("Failed to add");
    else { toast.success("Team member added"); setShowAddMember(false); fetchData(); }
  }

  async function addDeal(formData: FormData) {
    const { error } = await supabase.from("deals").insert({
      client_name: formData.get("client_name"),
      service: formData.get("service"),
      amount: parseFloat(formData.get("amount") as string) || 0,
      status: formData.get("status"),
      closed_by: formData.get("closed_by") || null,
      cold_called_by: formData.get("cold_called_by") || null,
      closed_at: formData.get("status") === "won" ? new Date().toISOString() : null,
    });
    if (error) toast.error("Failed to add deal");
    else { toast.success("Deal added"); setShowAddDeal(false); fetchData(); }
  }

  async function generatePayroll() {
    const month = new Date();
    month.setDate(1);
    const monthStr = month.toISOString().split("T")[0];

    for (const member of members) {
      const memberDeals = deals.filter(
        (d) => d.closed_by === member.id && d.status === "won" &&
        d.closed_at && d.closed_at.startsWith(month.toISOString().slice(0, 7))
      );
      const commissionTotal = memberDeals.reduce((sum, d) => sum + d.amount, 0) * (member.commission_rate / 100);
      const total = member.base_pay + commissionTotal;

      const { data: existing } = await supabase
        .from("payroll")
        .select("id")
        .eq("team_member_id", member.id)
        .eq("month", monthStr)
        .single();

      if (existing) {
        await supabase.from("payroll").update({
          base_amount: member.base_pay,
          commission_amount: commissionTotal,
          total_amount: total,
          deals_closed: memberDeals.length,
        }).eq("id", existing.id);
      } else {
        await supabase.from("payroll").insert({
          team_member_id: member.id,
          month: monthStr,
          base_amount: member.base_pay,
          commission_amount: commissionTotal,
          total_amount: total,
          deals_closed: memberDeals.length,
        });
      }
    }
    toast.success("Payroll generated");
    fetchData();
  }

  if (loading) return <PageLoading />;

  return (
    <div className="fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0">Team & Payroll</h1>
          <p className="text-muted text-sm">Manage team, deals, and payroll</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAddMember(true)} className="btn-secondary flex items-center gap-2">
            <Plus size={16} /> Add Member
          </button>
          <button onClick={() => setShowAddDeal(true)} className="btn-primary flex items-center gap-2">
            <Trophy size={16} /> Log Deal
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Team Members" value={members.filter((m) => m.is_active).length} icon={<Users size={18} />} />
        <StatCard label="Deals Won (Total)" value={formatCurrency(totalDealsWon)} icon={<Trophy size={18} />} />
        <StatCard label="Deals This Month" value={dealsThisMonth} icon={<Briefcase size={18} />} />
        <StatCard label="Payroll This Month" value={formatCurrency(totalPayroll)} icon={<DollarSign size={18} />} />
      </div>

      <div className="flex gap-1 bg-surface rounded-lg p-1 w-fit">
        {(["team", "deals", "payroll"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm rounded-md capitalize transition-all ${tab === t ? "bg-gold text-black font-medium" : "text-muted hover:text-white"}`}
          >{t}</button>
        ))}
      </div>

      {tab === "team" && (
        <DataTable
          columns={[
            { key: "full_name", label: "Name", render: (m: TeamMember) => (
              <div>
                <p className="font-medium">{m.full_name}</p>
                <p className="text-xs text-muted">{m.email}</p>
              </div>
            )},
            { key: "role", label: "Role", render: (m: TeamMember) => <span className="text-gold">{m.role}</span> },
            { key: "base_pay", label: "Base Pay", render: (m: TeamMember) => formatCurrency(m.base_pay) },
            { key: "commission_rate", label: "Commission", render: (m: TeamMember) => `${m.commission_rate}%` },
            { key: "payment_method", label: "Payment", render: (m: TeamMember) => m.payment_method || "-" },
            { key: "country", label: "Country", render: (m: TeamMember) => m.country || "-" },
            { key: "is_active", label: "Status", render: (m: TeamMember) => <StatusBadge status={m.is_active ? "active" : "inactive"} /> },
          ]}
          data={members}
          emptyMessage="No team members yet."
        />
      )}

      {tab === "deals" && (
        <DataTable
          columns={[
            { key: "client_name", label: "Client" },
            { key: "service", label: "Service" },
            { key: "amount", label: "Amount", render: (d: Deal) => formatCurrency(d.amount) },
            { key: "status", label: "Status", render: (d: Deal) => <StatusBadge status={d.status} /> },
            { key: "closed_by", label: "Closed By", render: (d: Deal) => members.find((m) => m.id === d.closed_by)?.full_name || "-" },
            { key: "cold_called_by", label: "Cold Called By", render: (d: Deal) => members.find((m) => m.id === d.cold_called_by)?.full_name || "-" },
            { key: "closed_at", label: "Closed", render: (d: Deal) => d.closed_at ? formatDate(d.closed_at) : "-" },
          ]}
          data={deals}
          emptyMessage="No deals logged yet."
        />
      )}

      {tab === "payroll" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={generatePayroll} className="btn-primary flex items-center gap-2">
              <FileDown size={16} /> Generate Payroll
            </button>
          </div>
          <DataTable
            columns={[
              { key: "team_member_id", label: "Team Member", render: (p: Payroll) => members.find((m) => m.id === p.team_member_id)?.full_name || "-" },
              { key: "month", label: "Month", render: (p: Payroll) => formatDate(p.month) },
              { key: "base_amount", label: "Base", render: (p: Payroll) => formatCurrency(p.base_amount) },
              { key: "commission_amount", label: "Commission", render: (p: Payroll) => formatCurrency(p.commission_amount) },
              { key: "total_amount", label: "Total", render: (p: Payroll) => <span className="text-gold font-bold">{formatCurrency(p.total_amount)}</span> },
              { key: "deals_closed", label: "Deals" },
              { key: "status", label: "Status", render: (p: Payroll) => <StatusBadge status={p.status} /> },
            ]}
            data={payroll}
            emptyMessage="No payroll records. Click 'Generate Payroll' to calculate."
          />
        </div>
      )}

      {/* Add Team Member Modal */}
      <Modal isOpen={showAddMember} onClose={() => setShowAddMember(false)} title="Add Team Member">
        <form onSubmit={(e) => { e.preventDefault(); addTeamMember(new FormData(e.currentTarget)); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted mb-1">Full Name *</label>
              <input name="full_name" className="input w-full" required />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Email *</label>
              <input name="email" type="email" className="input w-full" required />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Role *</label>
              <select name="role" className="input w-full" required>
                <option value="Cold Caller">Cold Caller</option>
                <option value="Video Editor">Video Editor</option>
                <option value="Ads Manager">Ads Manager</option>
                <option value="Account Manager">Account Manager</option>
                <option value="Content Creator">Content Creator</option>
                <option value="Developer">Developer</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Country</label>
              <input name="country" className="input w-full" />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Base Pay ($)</label>
              <input name="base_pay" type="number" step="0.01" className="input w-full" />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Commission Rate (%)</label>
              <input name="commission_rate" type="number" step="0.01" className="input w-full" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-muted mb-1">Payment Method</label>
            <select name="payment_method" className="input w-full">
              <option value="bank_transfer">Bank Transfer</option>
              <option value="paypal">PayPal</option>
              <option value="wise">Wise</option>
              <option value="crypto">Crypto</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setShowAddMember(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Add Member</button>
          </div>
        </form>
      </Modal>

      {/* Add Deal Modal */}
      <Modal isOpen={showAddDeal} onClose={() => setShowAddDeal(false)} title="Log Deal">
        <form onSubmit={(e) => { e.preventDefault(); addDeal(new FormData(e.currentTarget)); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted mb-1">Client Name *</label>
              <input name="client_name" className="input w-full" required />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Service *</label>
              <input name="service" className="input w-full" required />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Amount ($) *</label>
              <input name="amount" type="number" step="0.01" className="input w-full" required />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Status *</label>
              <select name="status" className="input w-full" required>
                <option value="open">Open</option>
                <option value="won">Won</option>
                <option value="lost">Lost</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Closed By</label>
              <select name="closed_by" className="input w-full">
                <option value="">Select...</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Cold Called By</label>
              <select name="cold_called_by" className="input w-full">
                <option value="">Select...</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setShowAddDeal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Log Deal</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
