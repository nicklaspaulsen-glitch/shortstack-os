"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Client, Contract, Invoice, ClientTask, ContentScript, Campaign, ContentCalendarEntry } from "@/lib/types";
import StatCard from "@/components/ui/stat-card";
import StatusBadge from "@/components/ui/status-badge";
import DataTable from "@/components/ui/data-table";
import { PageLoading } from "@/components/ui/loading";
import { formatCurrency, formatDate, formatRelativeTime } from "@/lib/utils";
import {
  ArrowLeft, Package, FileText, CreditCard, CheckCircle, Circle,
  Film, Megaphone, Download, UserPlus, Sparkles, Send
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

export default function ClientDetailPage() {
  const { id } = useParams();
  const [client, setClient] = useState<Client | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [tasks, setTasks] = useState<ClientTask[]>([]);
  const [scripts, setScripts] = useState<ContentScript[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [calendar, setCalendar] = useState<ContentCalendarEntry[]>([]);
  const [aiActions, setAiActions] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "content" | "ads" | "tasks" | "billing">("overview");
  const supabase = createClient();

  useEffect(() => {
    if (id) fetchAll();
  }, [id]);

  async function fetchAll() {
    setLoading(true);
    const [
      { data: c },
      { data: con },
      { data: inv },
      { data: t },
      { data: s },
      { data: camp },
      { data: cal },
      { data: ai },
    ] = await Promise.all([
      supabase.from("clients").select("*").eq("id", id).single(),
      supabase.from("contracts").select("*").eq("client_id", id).order("created_at", { ascending: false }),
      supabase.from("invoices").select("*").eq("client_id", id).order("created_at", { ascending: false }),
      supabase.from("client_tasks").select("*").eq("client_id", id).order("created_at", { ascending: false }),
      supabase.from("content_scripts").select("*").eq("client_id", id).order("created_at", { ascending: false }),
      supabase.from("campaigns").select("*").eq("client_id", id).order("created_at", { ascending: false }),
      supabase.from("content_calendar").select("*").eq("client_id", id).order("scheduled_at", { ascending: false }),
      supabase.from("trinity_log").select("*").eq("client_id", id).order("created_at", { ascending: false }).limit(20),
    ]);
    setClient(c); setContracts(con || []); setInvoices(inv || []);
    setTasks(t || []); setScripts(s || []); setCampaigns(camp || []);
    setCalendar(cal || []); setAiActions(ai || []);
    setLoading(false);
  }

  if (loading) return <PageLoading />;
  if (!client) return <div className="text-muted p-8">Client not found</div>;

  const completedTasks = tasks.filter(t => t.is_completed).length;
  const totalPaid = invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0);
  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
  const publishedContent = calendar.filter(c => c.status === "published").length;

  const tabs = [
    { key: "overview" as const, label: "Overview" },
    { key: "content" as const, label: `Content (${scripts.length})` },
    { key: "ads" as const, label: `Ads (${campaigns.length})` },
    { key: "tasks" as const, label: `Tasks (${tasks.length})` },
    { key: "billing" as const, label: `Billing (${invoices.length})` },
  ];

  return (
    <div className="fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/clients" className="p-2 rounded-lg hover:bg-surface-light text-muted hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{client.business_name}</h1>
          <p className="text-muted text-sm">{client.contact_name} · {client.email} · {client.package_tier || "Standard"} Plan</p>
        </div>
        <div className="flex gap-2">
          <button onClick={async () => {
            toast.loading("Generating welcome doc...");
            const res = await fetch(`/api/clients/welcome-doc?id=${client.id}`);
            toast.dismiss();
            if (res.ok) {
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a"); a.href = url;
              a.download = `${client.business_name}_welcome.pdf`; a.click();
              toast.success("Welcome doc downloaded!");
            } else toast.error("Failed");
          }} className="btn-secondary flex items-center gap-2 text-sm">
            <Download size={14} /> Welcome Doc
          </button>
          <button onClick={async () => {
            toast.loading("Generating contract...");
            const res = await fetch("/api/contracts/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ client_id: client.id }),
            });
            toast.dismiss();
            if (res.ok) {
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a"); a.href = url;
              a.download = `${client.business_name}_contract.pdf`; a.click();
              toast.success("Contract downloaded!");
            } else toast.error("Failed");
          }} className="btn-primary flex items-center gap-2 text-sm">
            <FileText size={14} /> Contract PDF
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="MRR" value={formatCurrency(client.mrr)} icon={<CreditCard size={18} />} />
        <StatCard label="Health Score" value={`${client.health_score}%`} changeType={client.health_score > 75 ? "positive" : "negative"} />
        <StatCard label="Tasks Done" value={`${completedTasks}/${tasks.length}`} icon={<CheckCircle size={18} />} />
        <StatCard label="Content Published" value={publishedContent} icon={<Film size={18} />} />
        <StatCard label="Ad Spend" value={formatCurrency(totalSpend)} icon={<Megaphone size={18} />} />
      </div>

      {/* Services */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium">Active Services</h3>
          <StatusBadge status={client.contract_status} />
        </div>
        <div className="flex flex-wrap gap-2">
          {(client.services || []).map((s, i) => (
            <span key={i} className="bg-gold/10 border border-gold/20 rounded-lg px-3 py-1.5 text-gold text-sm">{s}</span>
          ))}
          {(client.services || []).length === 0 && <span className="text-muted text-sm">No services assigned</span>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface rounded-lg p-1 w-fit">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm rounded-md transition-all ${tab === t.key ? "bg-gold text-black font-medium" : "text-muted hover:text-white"}`}
          >{t.label}</button>
        ))}
      </div>

      {/* Overview */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* AI Actions */}
          <div className="card">
            <h3 className="section-header flex items-center gap-2"><Sparkles size={16} className="text-gold" /> AI Agent Activity</h3>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {aiActions.length === 0 ? (
                <p className="text-muted text-sm">No AI actions for this client yet</p>
              ) : aiActions.map((a, i) => (
                <div key={i} className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
                  <StatusBadge status={a.status as string} />
                  <div>
                    <p className="text-sm">{a.description as string}</p>
                    <p className="text-xs text-muted">{formatRelativeTime(a.created_at as string)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Tasks */}
          <div className="card">
            <h3 className="section-header">Task Checklist</h3>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {tasks.length === 0 ? (
                <p className="text-muted text-sm">No tasks</p>
              ) : tasks.map(task => (
                <div key={task.id} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                  {task.is_completed ? <CheckCircle size={16} className="text-success shrink-0" /> : <Circle size={16} className="text-muted shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${task.is_completed ? "line-through text-muted" : ""}`}>{task.title}</p>
                    {task.due_date && <p className="text-xs text-muted">Due: {formatDate(task.due_date)}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {tab === "content" && (
        <div className="space-y-4">
          <DataTable
            columns={[
              { key: "title", label: "Script", render: (s: ContentScript) => (
                <div>
                  <p className="font-medium">{s.title}</p>
                  <p className="text-xs text-muted">{s.script_type === "long_form" ? "Long Form" : "Short Form"}</p>
                </div>
              )},
              { key: "status", label: "Status", render: (s: ContentScript) => <StatusBadge status={s.status} /> },
              { key: "target_platform", label: "Platform", render: (s: ContentScript) => <span className="capitalize text-sm">{s.target_platform?.replace("_", " ") || "-"}</span> },
              { key: "created_at", label: "Created", render: (s: ContentScript) => <span className="text-xs text-muted">{formatDate(s.created_at)}</span> },
              { key: "actions", label: "", render: (s: ContentScript) => (
                <button onClick={async () => {
                  const res = await fetch(`/api/content/pdf?id=${s.id}`);
                  if (res.ok) { const blob = await res.blob(); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${s.title}_script.pdf`; a.click(); }
                }} className="text-gold text-xs hover:text-gold-light"><Download size={14} /></button>
              )},
            ]}
            data={scripts}
            emptyMessage="No content scripts yet"
          />
          <h3 className="section-header mt-6">Content Calendar</h3>
          <DataTable
            columns={[
              { key: "title", label: "Content" },
              { key: "platform", label: "Platform", render: (c: ContentCalendarEntry) => <span className="capitalize text-sm">{c.platform.replace("_", " ")}</span> },
              { key: "scheduled_at", label: "Scheduled", render: (c: ContentCalendarEntry) => c.scheduled_at ? formatDate(c.scheduled_at) : "TBD" },
              { key: "status", label: "Status", render: (c: ContentCalendarEntry) => <StatusBadge status={c.status} /> },
            ]}
            data={calendar}
            emptyMessage="No content scheduled"
          />
        </div>
      )}

      {/* Ads */}
      {tab === "ads" && (
        <DataTable
          columns={[
            { key: "name", label: "Campaign" },
            { key: "platform", label: "Platform", render: (c: Campaign) => <span className="capitalize">{c.platform.replace("_", " ")}</span> },
            { key: "status", label: "Status", render: (c: Campaign) => <StatusBadge status={c.status} /> },
            { key: "spend", label: "Spend", render: (c: Campaign) => formatCurrency(c.spend) },
            { key: "roas", label: "ROAS", render: (c: Campaign) => <span className={c.roas >= 2 ? "text-success font-bold" : "text-warning"}>{c.roas.toFixed(1)}x</span> },
            { key: "conversions", label: "Conv." },
          ]}
          data={campaigns}
          emptyMessage="No ad campaigns"
        />
      )}

      {/* Tasks */}
      {tab === "tasks" && (
        <DataTable
          columns={[
            { key: "title", label: "Task", render: (t: ClientTask) => (
              <div className="flex items-center gap-2">
                {t.is_completed ? <CheckCircle size={14} className="text-success" /> : <Circle size={14} className="text-muted" />}
                <span className={t.is_completed ? "line-through text-muted" : ""}>{t.title}</span>
              </div>
            )},
            { key: "due_date", label: "Due", render: (t: ClientTask) => t.due_date ? formatDate(t.due_date) : "-" },
            { key: "is_completed", label: "Status", render: (t: ClientTask) => <StatusBadge status={t.is_completed ? "completed" : "pending"} /> },
          ]}
          data={tasks}
          emptyMessage="No tasks"
        />
      )}

      {/* Billing */}
      {tab === "billing" && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Total Paid" value={formatCurrency(totalPaid)} />
            <StatCard label="Active Contracts" value={contracts.filter(c => c.status === "signed").length} />
            <StatCard label="MRR" value={formatCurrency(client.mrr)} />
          </div>
          <h3 className="section-header">Contracts</h3>
          <DataTable
            columns={[
              { key: "title", label: "Contract" },
              { key: "value", label: "Value", render: (c: Contract) => c.value ? formatCurrency(c.value) : "-" },
              { key: "status", label: "Status", render: (c: Contract) => <StatusBadge status={c.status} /> },
              { key: "start_date", label: "Start", render: (c: Contract) => c.start_date ? formatDate(c.start_date) : "-" },
            ]}
            data={contracts}
            emptyMessage="No contracts"
          />
          <h3 className="section-header">Invoices</h3>
          <DataTable
            columns={[
              { key: "description", label: "Description", render: (i: Invoice) => i.description || "Invoice" },
              { key: "amount", label: "Amount", render: (i: Invoice) => formatCurrency(i.amount) },
              { key: "status", label: "Status", render: (i: Invoice) => <StatusBadge status={i.status} /> },
              { key: "due_date", label: "Due", render: (i: Invoice) => i.due_date ? formatDate(i.due_date) : "-" },
            ]}
            data={invoices}
            emptyMessage="No invoices"
          />
        </div>
      )}
    </div>
  );
}
