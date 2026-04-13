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
  Film, Megaphone, Download, Sparkles
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import SocialConnect from "@/components/social-connect";

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
  const [tab, setTab] = useState<"overview" | "content" | "ads" | "tasks" | "billing" | "access">("overview");
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
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
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

      {/* Social Accounts */}
      <div className="card">
        <SocialConnect clientId={client.id} clientName={client.business_name} />
      </div>

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

          <div className="card">
            <h3 className="section-header">GHL Sub-Account</h3>
            {client?.ghl_location_id ? (
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-success" />
                <div>
                  <p className="text-xs font-medium">Connected</p>
                  <p className="text-[9px] text-muted font-mono">Location ID: {client.ghl_location_id}</p>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-xs text-muted mb-2">No GHL sub-account linked to this client</p>
                <button onClick={async () => {
                  toast.loading("Creating GHL sub-account...");
                  try {
                    const res = await fetch("/api/ghl/sub-account", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ client_id: id, business_name: client?.business_name, email: client?.email }),
                    });
                    const data = await res.json();
                    toast.dismiss();
                    if (data.success) { toast.success("GHL sub-account created!"); fetchAll(); }
                    else toast.error(data.error || "Failed");
                  } catch { toast.dismiss(); toast.error("Error"); }
                }} className="btn-primary text-[10px] py-1.5 px-3">
                  Create GHL Sub-Account
                </button>
              </div>
            )}
          </div>
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
