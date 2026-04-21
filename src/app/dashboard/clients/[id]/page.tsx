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
  ArrowLeft, FileText, CreditCard, CheckCircle, Circle,
  Film, Megaphone, Download, Sparkles, Plus, Loader, Rocket,
  Target, Palette, BarChart3, ChevronDown, ChevronRight, Zap,
  Phone, MessageSquare, Bot, FolderOpen, ImageIcon, Music, File as FileIcon,
  ExternalLink
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import SocialConnect from "@/components/social-connect";
import ClientBillingPanel from "@/components/clients/client-billing-panel";

export default function ClientDetailPage() {
  const params = useParams();
  const id = params?.id;
  const [client, setClient] = useState<Client | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [tasks, setTasks] = useState<ClientTask[]>([]);
  const [scripts, setScripts] = useState<ContentScript[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [calendar, setCalendar] = useState<ContentCalendarEntry[]>([]);
  const [aiActions, setAiActions] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "content" | "ads" | "tasks" | "billing" | "payments" | "access">("overview");
  const [pageAccess, setPageAccess] = useState<Record<string, boolean>>({
    portal: true, content: true, billing: true, reports: true, socials: true,
    workflows: false, analytics: false, ads: false, websites: false,
  });
  const supabase = createClient();

  useEffect(() => {
    if (id) fetchAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function fetchAll() {
    try {
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
    } catch (err) {
      console.error("[ClientDetailPage] fetch error:", err);
    } finally {
      setLoading(false);
    }
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
    { key: "payments" as const, label: "Payments" },
    { key: "access" as const, label: "Access" },
  ];

  return (
    <div className="fade-in space-y-6">
      {/* Client banner — makes it clear you're managing a specific client */}
      <div className="bg-gold/[0.06] border border-gold/15 rounded-xl px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gold/10 rounded-lg flex items-center justify-center">
            <span className="text-gold text-sm font-bold">{client.business_name.charAt(0)}</span>
          </div>
          <div>
            <p className="text-[10px] text-gold uppercase tracking-wider font-bold">Managing Client Account</p>
            <p className="text-xs font-semibold">{client.business_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[9px] px-2 py-0.5 rounded-full ${client.is_active ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
            {client.is_active ? "Active" : "Inactive"}
          </span>
          <span className="text-[9px] text-muted">{client.package_tier || "Standard"} · ${client.mrr}/mo</span>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/clients" className="p-2 rounded-lg hover:bg-surface-light text-muted hover:text-foreground transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{client.business_name}</h1>
          <p className="text-muted text-sm">{client.contact_name} · {client.email} · {client.package_tier || "Standard"} Plan</p>
        </div>
        <div className="flex gap-2">
          <button onClick={async () => {
            const tid = "welcome-doc";
            toast.loading("Generating welcome doc...", { id: tid });
            try {
              const res = await fetch(`/api/clients/welcome-doc?id=${client.id}`);
              if (res.ok) {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a"); a.href = url;
                a.download = `${client.business_name}_welcome.pdf`; a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                toast.success("Welcome doc downloaded!", { id: tid });
              } else toast.error("Failed", { id: tid });
            } catch { toast.error("Failed", { id: tid }); }
          }} className="btn-secondary flex items-center gap-2 text-sm">
            <Download size={14} /> Welcome Doc
          </button>
          <button onClick={async () => {
            const tid = "contract-pdf";
            toast.loading("Generating contract...", { id: tid });
            try {
              const res = await fetch("/api/contracts/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ client_id: client.id }),
              });
              if (res.ok) {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a"); a.href = url;
                a.download = `${client.business_name}_contract.pdf`; a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                toast.success("Contract downloaded!", { id: tid });
              } else toast.error("Failed", { id: tid });
            } catch { toast.error("Failed", { id: tid }); }
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

      {/* Social Accounts */}
      <div className="card">
        <SocialConnect clientId={client.id} clientName={client.business_name} />
      </div>

      {/* Dedicated Phone Number — mirrors mail-setup pattern on /dashboard/domains.
          Agency provisions a Twilio number + ElevenAgent per client; read-only
          view lives in /dashboard/portal. */}
      <ClientPhoneSection clientId={client.id} clientName={client.business_name} readOnly={false} />

      {/* Uploaded Files — union of client_uploads (portal drops) + tagged
          content_assets. Backed by /api/clients/[id]/files. */}
      <ClientFilesSection clientId={client.id} />

      {/* Tabs */}
      <div className="tab-group w-fit">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={tab === t.key ? "tab-item-active" : "tab-item-inactive"}
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
                <div key={(a.id as string) || i} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
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
                <div key={task.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
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
                  if (res.ok) {
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url; a.download = `${s.title}_script.pdf`;
                    a.click();
                    // Revoke the blob URL so we don't leak memory every time
                    // the user downloads a script.
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                  }
                }} aria-label={`Download ${s.title} as PDF`} className="text-gold text-xs hover:text-gold-light"><Download size={14} /></button>
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

      {/* Tasks — Onboarding Checklist + Custom Tasks */}
      {tab === "tasks" && (
        <ClientTasksTab
          clientId={client.id}
          tasks={tasks}
          onRefresh={fetchAll}
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

      {/* Payments — agency Stripe Connect flow. Shows connect CTA if the
          caller hasn't connected their Stripe yet; otherwise renders the
          payment-link + invoice tools backed by the agency's connected account. */}
      {tab === "payments" && <ClientBillingPanel clientId={client.id} />}

      {/* Access Control */}
      {tab === "access" && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="section-header">Page Access Control</h3>
            <p className="text-[10px] text-muted mb-4">Choose which pages this client can see in their portal. Changes save automatically.</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {Object.entries(pageAccess).map(([page, enabled]) => (
                <button key={page} onClick={async () => {
                  const updated = { ...pageAccess, [page]: !enabled };
                  setPageAccess(updated);
                  await supabase.from("clients").update({
                    metadata: { ...((client as unknown as Record<string, unknown>)?.metadata as Record<string, unknown> || {}), page_access: updated },
                  }).eq("id", id);
                  toast.success(`${page} ${!enabled ? "enabled" : "disabled"} for client`);
                }}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                    enabled ? "border-success/30 bg-success/[0.05]" : "border-border opacity-60"
                  }`}>
                  <span className="text-xs font-medium capitalize">{page}</span>
                  <div className={`w-8 h-4 rounded-full transition-colors ${enabled ? "bg-success" : "bg-surface-light"}`}>
                    <div className={`w-3.5 h-3.5 rounded-full bg-white shadow transition-all mt-[1px] ${enabled ? "ml-4" : "ml-[1px]"}`} />
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <h3 className="section-header">Social Media Accounts</h3>
            <SocialConnect clientId={id as string} clientName={client?.business_name} />
          </div>

          {/* Telegram Bot */}
          <TelegramBotSetup clientId={id as string} client={client} onUpdate={fetchAll} />

        </div>
      )}
    </div>
  );
}

/* ─── Per-client Phone Number section ─────────────────────────────────
   Mirrors the Resend mail-setup flow on /dashboard/domains: shows the
   client's assigned Twilio number, monthly SMS + call minutes for this
   client only, and a "Provision a number" button that calls the existing
   /api/twilio/provision endpoint (which auto-sets webhooks + creates an
   ElevenAgent). `readOnly` hides the provision button for portal users. */
interface PhoneStatus {
  phone_number: string | null;
  eleven_agent_id: string | null;
  eleven_phone_number_id: string | null;
  has_number: boolean;
  usage: { sms_this_month: number; call_minutes_this_month: number };
  plan: {
    plan_tier: string;
    cap: number | "unlimited";
    current: number;
    remaining: number | "unlimited";
  };
}

function ClientPhoneSection({
  clientId,
  clientName,
  readOnly,
}: {
  clientId: string;
  clientName: string;
  readOnly: boolean;
}) {
  const [status, setStatus] = useState<PhoneStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [provisioning, setProvisioning] = useState(false);
  const [areaCode, setAreaCode] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/phone`);
      if (res.ok) {
        const data = await res.json();
        setStatus(data as PhoneStatus);
      }
    } catch {
      // ignore — UI will show "not set up" with stale data
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  async function provision() {
    setProvisioning(true);
    const tid = toast.loading("Provisioning phone number...");
    try {
      const res = await fetch("/api/twilio/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          area_code: areaCode || undefined,
          country: "US",
          agent_name: `${clientName} AI Caller`,
        }),
      });
      const data = await res.json();
      toast.dismiss(tid);
      if (res.status === 402) {
        // Plan-tier cap hit — surface upgrade prompt.
        toast.error(
          data.error || `Phone number limit reached for ${data.plan_tier} plan.`,
          { duration: 7000 },
        );
      } else if (data.success) {
        toast.success(`Number provisioned: ${data.phone_number}`);
        await load();
      } else {
        toast.error(data.error || "Failed to provision number");
      }
    } catch {
      toast.dismiss(tid);
      toast.error("Failed to provision number");
    }
    setProvisioning(false);
  }

  if (loading) {
    return (
      <div className="card">
        <h3 className="section-header flex items-center gap-2">
          <Phone size={13} className="text-gold" /> Dedicated Phone Number
        </h3>
        <p className="text-xs text-muted">Loading...</p>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="card">
        <h3 className="section-header flex items-center gap-2">
          <Phone size={13} className="text-gold" /> Dedicated Phone Number
        </h3>
        <p className="text-xs text-muted">Unable to load phone status.</p>
      </div>
    );
  }

  const capLabel =
    status.plan.cap === "unlimited"
      ? "Unlimited"
      : `${status.plan.current} of ${status.plan.cap}`;
  const capHit =
    status.plan.cap !== "unlimited" && status.plan.current >= status.plan.cap;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="section-header flex items-center gap-2 mb-0">
          <Phone size={13} className="text-gold" /> Dedicated Phone Number
        </h3>
        <span className="text-[10px] text-muted">
          Plan: <span className="text-gold font-semibold">{status.plan.plan_tier}</span>
          <span className="mx-1.5 opacity-40">·</span>
          <span className={capHit ? "text-red-400" : ""}>{capLabel} numbers</span>
        </span>
      </div>

      {status.has_number ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono font-semibold">{status.phone_number}</span>
              <span className="text-[9px] px-2 py-0.5 rounded-full border bg-green-500/10 text-green-400 border-green-500/30 flex items-center gap-1">
                <Phone size={9} /> Active
              </span>
              {status.eleven_agent_id ? (
                <span className="text-[9px] px-2 py-0.5 rounded-full border bg-blue-500/10 text-blue-400 border-blue-500/30 flex items-center gap-1">
                  <Bot size={9} /> AI agent ready
                </span>
              ) : (
                <span className="text-[9px] px-2 py-0.5 rounded-full border bg-slate-500/10 text-slate-400 border-slate-500/30 flex items-center gap-1">
                  <Bot size={9} /> AI agent not configured
                </span>
              )}
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText(status.phone_number || ""); toast.success("Copied"); }}
              className="text-[10px] px-2.5 py-1 rounded-lg border border-border text-muted hover:text-foreground flex items-center gap-1"
            >
              Copy
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div className="rounded-xl border border-border bg-surface-light p-3">
              <div className="flex items-center gap-1.5 text-[10px] text-muted mb-0.5">
                <MessageSquare size={10} /> SMS this month
              </div>
              <p className="text-base font-bold">{status.usage.sms_this_month}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface-light p-3">
              <div className="flex items-center gap-1.5 text-[10px] text-muted mb-0.5">
                <Phone size={10} /> Call minutes this month
              </div>
              <p className="text-base font-bold">{status.usage.call_minutes_this_month}</p>
            </div>
          </div>
          <p className="text-[10px] text-muted mt-1">
            Inbound SMS + voice route to this client automatically via the Twilio webhook.
          </p>
        </div>
      ) : readOnly ? (
        <p className="text-xs text-muted">
          No dedicated phone number assigned yet. Your agency can provision one for you.
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted">
            No phone number assigned yet. Provisioning buys a Twilio number, wires the SMS + voice webhooks, and creates an ElevenAgent for AI calling.
          </p>
          {capHit && (
            <p className="text-[11px] text-red-400">
              You&apos;re at your plan&apos;s phone number cap ({capLabel}). <Link href="/dashboard/pricing" className="underline">Upgrade</Link> to provision more.
            </p>
          )}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={areaCode}
              onChange={(e) => setAreaCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
              placeholder="Area code (optional)"
              className="input text-xs w-40"
            />
            <button
              onClick={provision}
              disabled={provisioning || capHit}
              className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              {provisioning ? <Loader size={12} className="animate-spin" /> : <Plus size={12} />}
              {provisioning ? "Provisioning..." : "Provision a number"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Client Files Section ────────────────────────────────────────────
   Unified list of every file a client has uploaded across ShortStack:
   - Portal drops (client_uploads)
   - Content library assets tagged with the client (content_assets)
   Backed by GET /api/clients/[id]/files. */
interface ClientFile {
  id: string;
  name: string;
  url: string | null;
  type: string;
  size: number;
  uploaded_at: string;
  source_tool: string;
}

function formatFileBytes(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

function fileIconFor(type: string) {
  const t = (type || "").toLowerCase();
  if (t.startsWith("image") || ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(t))
    return <ImageIcon size={14} className="text-blue-400" />;
  if (t.startsWith("video") || ["mp4", "mov", "avi", "webm", "mkv"].includes(t))
    return <Film size={14} className="text-purple-400" />;
  if (t.startsWith("audio") || ["mp3", "wav", "ogg", "m4a", "flac"].includes(t))
    return <Music size={14} className="text-pink-400" />;
  if (["pdf", "doc", "docx", "txt"].includes(t) || t.includes("document"))
    return <FileText size={14} className="text-gold" />;
  return <FileIcon size={14} className="text-muted" />;
}

function ClientFilesSection({ clientId, readOnly = false }: { clientId: string; readOnly?: boolean }) {
  const [files, setFiles] = useState<ClientFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/clients/${clientId}/files`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setFiles(data.files || []);
        }
      } catch {
        // best-effort — UI shows empty state below
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [clientId]);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="section-header flex items-center gap-2 mb-0">
          <FolderOpen size={13} className="text-gold" /> Uploaded Files
        </h3>
        <span className="text-[10px] text-muted">
          {loading ? "Loading..." : `${files.length} file${files.length === 1 ? "" : "s"}`}
        </span>
      </div>
      {loading ? (
        <p className="text-xs text-muted">Loading files...</p>
      ) : files.length === 0 ? (
        <p className="text-xs text-muted">
          {readOnly
            ? "You haven't uploaded any files yet. Drop files in the My Uploads page to share them with your agency."
            : "No files uploaded yet. Client portal drops and tagged content library assets appear here."}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {files.map(f => {
            const isImage = (f.type || "").toLowerCase().startsWith("image") || ["png", "jpg", "jpeg", "gif", "webp"].includes((f.type || "").toLowerCase());
            return (
              <a
                key={f.id}
                href={f.url || "#"}
                target={f.url ? "_blank" : undefined}
                rel="noopener noreferrer"
                className={`flex items-center gap-2 p-2 rounded-lg border border-border bg-surface-light/50 hover:border-gold/30 transition-colors min-w-0 ${f.url ? "" : "pointer-events-none opacity-60"}`}
                title={f.name}
              >
                <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center shrink-0 overflow-hidden">
                  {isImage && f.url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={f.url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    fileIconFor(f.type)
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium truncate">{f.name}</p>
                  <div className="flex items-center gap-1.5 text-[9px] text-muted">
                    <span>{formatFileBytes(f.size)}</span>
                    <span className="opacity-40">·</span>
                    <span className="truncate">{f.source_tool}</span>
                  </div>
                  <p className="text-[9px] text-muted mt-0.5">{formatRelativeTime(f.uploaded_at)}</p>
                </div>
                {f.url && <ExternalLink size={10} className="text-muted shrink-0" />}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Telegram Bot Setup Component ────────────────────────────────── */
function TelegramBotSetup({ clientId, client, onUpdate }: { clientId: string; client: Client | null; onUpdate: () => void }) {
  const [token, setToken] = useState("");
  const [setting, setSetting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const hasBot = !!(client as unknown as Record<string, unknown>)?.telegram_bot_username;

  async function setupBot() {
    if (!token.trim()) { toast.error("Paste the bot token from @BotFather"); return; }
    setSetting(true);
    try {
      const res = await fetch("/api/telegram/setup-bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId, bot_token: token }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Bot @${data.bot_username} connected!`);
        setToken("");
        onUpdate();
      } else {
        toast.error(data.error || "Failed to setup bot");
      }
    } catch { toast.error("Connection error"); }
    setSetting(false);
  }

  async function removeBot() {
    if (!confirm("Remove the Telegram bot for this client?")) return;
    setRemoving(true);
    try {
      const res = await fetch("/api/telegram/setup-bot", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId }),
      });
      const data = await res.json();
      if (data.success) { toast.success("Bot removed"); onUpdate(); }
    } catch { toast.error("Error"); }
    setRemoving(false);
  }

  return (
    <div className="card">
      <h3 className="section-header flex items-center gap-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-[#26A5E4]">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
        </svg>
        Client Telegram Bot
      </h3>

      {hasBot ? (
        <div className="space-y-2">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-success/[0.05] border border-success/20">
            <div className="w-2 h-2 rounded-full bg-success" />
            <div className="flex-1">
              <p className="text-xs font-medium">@{(client as unknown as Record<string, unknown>)?.telegram_bot_username as string}</p>
              <p className="text-[9px] text-muted">Bot connected and active</p>
            </div>
            <button onClick={removeBot} disabled={removing}
              className="text-[9px] text-danger hover:text-danger/80 transition-colors">
              {removing ? "Removing..." : "Remove"}
            </button>
          </div>
          <p className="text-[9px] text-muted">
            The client can message this bot to check project status, tasks, invoices, and content.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted">
            Give this client their own Telegram bot for project updates and communication.
          </p>
          <ol className="text-[10px] text-muted space-y-1 list-decimal list-inside">
            <li>Open Telegram and message <span className="font-mono text-foreground">@BotFather</span></li>
            <li>Send <span className="font-mono text-foreground">/newbot</span> and follow the steps</li>
            <li>Copy the bot token and paste it below</li>
          </ol>
          <div className="flex gap-2">
            <input
              type="text"
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="123456:ABC-DEF1234..."
              className="input flex-1 text-xs font-mono"
            />
            <button onClick={setupBot} disabled={setting}
              className="btn-primary text-[10px] px-3 py-1.5 shrink-0">
              {setting ? "Setting up..." : "Connect Bot"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Onboarding Phases ──────────────────────────────────────────── */
const ONBOARDING_PHASES = [
  {
    phase: "Setup & Discovery",
    icon: <Rocket size={14} />,
    color: "text-blue-400",
    bg: "bg-blue-400/10",
    tasks: [
      { title: "Complete client onboarding form", description: "Fill in business details, goals, and preferences" },
      { title: "Connect social media accounts", description: "Link Instagram, TikTok, Facebook, LinkedIn via Zernio" },
      { title: "Upload brand assets (logo, colors, fonts)", description: "Add brand kit to Design Studio for consistent content" },
      { title: "Set up client portal access", description: "Ensure client can log in and view their dashboard" },
      { title: "Schedule discovery call", description: "30-min call to understand business goals and pain points" },
      { title: "Define target audience personas", description: "Create 2-3 ideal customer profiles" },
      { title: "Audit existing online presence", description: "Review website, social profiles, Google Business listing" },
    ],
  },
  {
    phase: "Strategy & Planning",
    icon: <Target size={14} />,
    color: "text-gold",
    bg: "bg-gold/10",
    tasks: [
      { title: "Create content strategy document", description: "Define content pillars, posting frequency, and tone" },
      { title: "Build first month content calendar", description: "Plan 30 days of posts across all platforms" },
      { title: "Set up hashtag strategy", description: "Research and save platform-specific hashtag sets" },
      { title: "Define KPIs and success metrics", description: "Agree on engagement, growth, and conversion targets" },
      { title: "Competitor analysis complete", description: "Analyze top 3-5 competitors and identify opportunities" },
      { title: "SEO keyword research", description: "Identify target keywords for website and content" },
    ],
  },
  {
    phase: "Content Production",
    icon: <Palette size={14} />,
    color: "text-purple-400",
    bg: "bg-purple-400/10",
    tasks: [
      { title: "Write first 5 video scripts", description: "Use AI Script Lab to create platform-specific scripts" },
      { title: "Design social media templates", description: "Create branded templates in Design Studio" },
      { title: "Generate first batch of thumbnails", description: "Create thumbnails for upcoming content" },
      { title: "Record/produce first video", description: "First piece of content ready for review" },
      { title: "Client reviews and approves first content", description: "Get sign-off on initial content batch" },
      { title: "Set up content approval workflow", description: "Define review process and turnaround times" },
    ],
  },
  {
    phase: "Launch & Growth",
    icon: <BarChart3 size={14} />,
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
    tasks: [
      { title: "Publish first week of content", description: "Launch across all connected platforms" },
      { title: "Set up engagement monitoring", description: "Configure Social Manager inbox and auto-replies" },
      { title: "Launch lead generation campaign", description: "Start outreach via DM, email, or ads" },
      { title: "Set up automated reporting", description: "Schedule weekly/monthly performance reports" },
      { title: "First performance review (Week 2)", description: "Review metrics and adjust strategy" },
      { title: "Scale content production", description: "Increase posting frequency based on results" },
      { title: "Launch paid ad campaigns", description: "Set up Meta/TikTok/Google ads if included in plan" },
    ],
  },
  {
    phase: "Optimization & Scaling",
    icon: <Zap size={14} />,
    color: "text-pink-400",
    bg: "bg-pink-400/10",
    tasks: [
      { title: "A/B test content formats", description: "Compare video vs carousel vs static performance" },
      { title: "Optimize posting times", description: "Use analytics to find best posting windows" },
      { title: "Set up retargeting campaigns", description: "Re-engage website visitors and video viewers" },
      { title: "Launch email/SMS sequences", description: "Nurture leads with automated follow-ups" },
      { title: "Monthly strategy review", description: "Comprehensive performance review and planning" },
      { title: "Expand to new platforms", description: "Add platforms based on audience research" },
    ],
  },
];

/* ─── Client Tasks Tab Component ─────────────────────────────────── */
function ClientTasksTab({ clientId, tasks, onRefresh }: {
  clientId: string;
  tasks: ClientTask[];
  onRefresh: () => void;
}) {
  const supabase = createClient();
  const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>({ "Setup & Discovery": true, "Strategy & Planning": true });
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [addingTask, setAddingTask] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [taskView, setTaskView] = useState<"checklist" | "custom">("checklist");

  const onboardingTaskMap = new Map<string, ClientTask>();
  tasks.forEach(t => onboardingTaskMap.set(t.title, t));

  const allOnboardingTitles = new Set(ONBOARDING_PHASES.flatMap(p => p.tasks.map(t => t.title)));
  const customTasks = tasks.filter(t => !allOnboardingTitles.has(t.title));
  const onboardingTasks = tasks.filter(t => allOnboardingTitles.has(t.title));

  const totalOnboarding = ONBOARDING_PHASES.reduce((s, p) => s + p.tasks.length, 0);
  const completedOnboarding = onboardingTasks.filter(t => t.is_completed).length;
  const progressPercent = totalOnboarding > 0 ? Math.round((completedOnboarding / totalOnboarding) * 100) : 0;

  async function toggleTask(taskTitle: string, currentlyCompleted: boolean) {
    const existing = onboardingTaskMap.get(taskTitle);
    if (existing) {
      await supabase.from("client_tasks").update({
        is_completed: !currentlyCompleted,
        completed_at: !currentlyCompleted ? new Date().toISOString() : null,
      }).eq("id", existing.id);
    } else {
      const phase = ONBOARDING_PHASES.find(p => p.tasks.some(t => t.title === taskTitle));
      const taskDef = phase?.tasks.find(t => t.title === taskTitle);
      await supabase.from("client_tasks").insert({
        client_id: clientId,
        title: taskTitle,
        description: taskDef?.description || null,
        is_completed: true,
        completed_at: new Date().toISOString(),
      });
    }
    onRefresh();
  }

  async function seedOnboardingTasks() {
    setSeeding(true);
    const existingTitles = new Set(tasks.map(t => t.title));
    const toInsert = ONBOARDING_PHASES.flatMap(phase =>
      phase.tasks
        .filter(t => !existingTitles.has(t.title))
        .map(t => ({
          client_id: clientId,
          title: t.title,
          description: t.description,
          is_completed: false,
        }))
    );
    if (toInsert.length > 0) {
      await supabase.from("client_tasks").insert(toInsert);
      toast.success(`Created ${toInsert.length} onboarding tasks`);
    } else {
      toast.success("All onboarding tasks already exist");
    }
    setSeeding(false);
    onRefresh();
  }

  async function addCustomTask() {
    if (!newTaskTitle.trim()) return;
    setAddingTask(true);
    await supabase.from("client_tasks").insert({
      client_id: clientId,
      title: newTaskTitle.trim(),
      is_completed: false,
    });
    setNewTaskTitle("");
    setAddingTask(false);
    onRefresh();
  }

  async function toggleCustomTask(taskId: string, currentlyCompleted: boolean) {
    await supabase.from("client_tasks").update({
      is_completed: !currentlyCompleted,
      completed_at: !currentlyCompleted ? new Date().toISOString() : null,
    }).eq("id", taskId);
    onRefresh();
  }

  return (
    <div className="space-y-5">
      {/* Progress header */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-xs font-bold">Client Onboarding Progress</h3>
            <p className="text-[10px] text-muted">{completedOnboarding} of {totalOnboarding} steps completed</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-lg font-bold font-mono ${progressPercent === 100 ? "text-success" : "text-gold"}`}>
              {progressPercent}%
            </span>
            {onboardingTasks.length === 0 && (
              <button onClick={seedOnboardingTasks} disabled={seeding}
                className="btn-primary text-[10px] py-1.5 px-3 flex items-center gap-1">
                {seeding ? <Loader size={10} className="animate-spin" /> : <Rocket size={10} />}
                {seeding ? "Creating..." : "Initialize Checklist"}
              </button>
            )}
          </div>
        </div>
        <div className="h-2 bg-surface-light rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${progressPercent === 100 ? "bg-success" : "bg-gold"}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex gap-2 mt-3">
          {ONBOARDING_PHASES.map(phase => {
            const phaseCompleted = phase.tasks.filter(t => onboardingTaskMap.get(t.title)?.is_completed).length;
            const phaseTotal = phase.tasks.length;
            const done = phaseCompleted === phaseTotal && onboardingTasks.length > 0;
            return (
              <div key={phase.phase} className={`flex-1 text-center p-2 rounded-lg ${done ? "bg-success/10" : "bg-surface-light"}`}>
                <div className={`flex items-center justify-center gap-1 ${done ? "text-success" : phase.color}`}>
                  {phase.icon}
                  <span className="text-[8px] font-bold">{phaseCompleted}/{phaseTotal}</span>
                </div>
                <p className="text-[7px] text-muted mt-0.5 truncate">{phase.phase}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* View toggle */}
      <div className="tab-group w-fit">
        <button onClick={() => setTaskView("checklist")}
          className={taskView === "checklist" ? "tab-item-active" : "tab-item-inactive"}>
          Onboarding Checklist
        </button>
        <button onClick={() => setTaskView("custom")}
          className={taskView === "custom" ? "tab-item-active" : "tab-item-inactive"}>
          Custom Tasks ({customTasks.length})
        </button>
      </div>

      {/* Onboarding checklist */}
      {taskView === "checklist" && (
        <div className="space-y-3">
          {ONBOARDING_PHASES.map(phase => {
            const isExpanded = expandedPhases[phase.phase] ?? false;
            const phaseCompleted = phase.tasks.filter(t => onboardingTaskMap.get(t.title)?.is_completed).length;
            const allDone = phaseCompleted === phase.tasks.length && onboardingTasks.length > 0;

            return (
              <div key={phase.phase} className={`card overflow-hidden ${allDone ? "border-success/20" : ""}`}>
                <button
                  onClick={() => setExpandedPhases(prev => ({ ...prev, [phase.phase]: !prev[phase.phase] }))}
                  className="w-full p-3 flex items-center justify-between hover:bg-surface-light/50 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-lg ${phase.bg} flex items-center justify-center ${phase.color}`}>
                      {allDone ? <CheckCircle size={14} className="text-success" /> : phase.icon}
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-semibold">{phase.phase}</p>
                      <p className="text-[9px] text-muted">{phaseCompleted} of {phase.tasks.length} completed</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {allDone && <span className="text-[8px] text-success font-bold bg-success/10 px-2 py-0.5 rounded-full">DONE</span>}
                    {isExpanded ? <ChevronDown size={14} className="text-muted" /> : <ChevronRight size={14} className="text-muted" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-3 pb-3 space-y-1">
                    {phase.tasks.map(taskDef => {
                      const existing = onboardingTaskMap.get(taskDef.title);
                      const isCompleted = existing?.is_completed ?? false;
                      return (
                        <button
                          key={taskDef.title}
                          onClick={() => toggleTask(taskDef.title, isCompleted)}
                          className={`w-full flex items-start gap-2.5 p-2 rounded-lg text-left transition-colors hover:bg-surface-light/50 ${isCompleted ? "opacity-60" : ""}`}
                        >
                          {isCompleted
                            ? <CheckCircle size={14} className="text-success shrink-0 mt-0.5" />
                            : <Circle size={14} className="text-muted shrink-0 mt-0.5" />}
                          <div>
                            <p className={`text-[11px] font-medium ${isCompleted ? "line-through text-muted" : ""}`}>{taskDef.title}</p>
                            <p className="text-[9px] text-muted">{taskDef.description}</p>
                            {existing?.completed_at && (
                              <p className="text-[8px] text-success mt-0.5">Completed {formatRelativeTime(existing.completed_at)}</p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Custom tasks */}
      {taskView === "custom" && (
        <div className="space-y-3">
          <div className="card p-3 flex items-center gap-2">
            <input
              value={newTaskTitle}
              onChange={e => setNewTaskTitle(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addCustomTask()}
              placeholder="Add a custom task..."
              className="input flex-1 text-xs"
            />
            <button onClick={addCustomTask} disabled={addingTask || !newTaskTitle.trim()}
              className="btn-primary text-[10px] py-1.5 px-3 flex items-center gap-1">
              {addingTask ? <Loader size={10} className="animate-spin" /> : <Plus size={10} />}
              Add
            </button>
          </div>

          {customTasks.length === 0 ? (
            <div className="card-static text-center py-8">
              <Circle size={24} className="text-muted mx-auto mb-2" />
              <p className="text-xs text-muted">No custom tasks yet</p>
              <p className="text-[10px] text-muted/60">Add tasks specific to this client above</p>
            </div>
          ) : (
            <div className="space-y-1">
              {customTasks.map(task => (
                <button
                  key={task.id}
                  onClick={() => toggleCustomTask(task.id, task.is_completed)}
                  className={`w-full card card-hover p-3 flex items-center gap-3 text-left ${task.is_completed ? "opacity-60" : ""}`}
                >
                  {task.is_completed
                    ? <CheckCircle size={14} className="text-success shrink-0" />
                    : <Circle size={14} className="text-muted shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium ${task.is_completed ? "line-through text-muted" : ""}`}>{task.title}</p>
                    {task.description && <p className="text-[9px] text-muted truncate">{task.description}</p>}
                  </div>
                  <StatusBadge status={task.is_completed ? "completed" : "pending"} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
