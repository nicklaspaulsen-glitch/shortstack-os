"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useAppStore } from "@/lib/store";
import { BrowserModeBanner } from "@/components/read-only-guard";
import { Client, ClientTask, Invoice, ContentCalendarEntry } from "@/lib/types";
import StatCard from "@/components/ui/stat-card";
import StatusBadge from "@/components/ui/status-badge";
import { PageLoading } from "@/components/ui/loading";
import AIInsights from "@/components/ai-insights";
import AgentActivityFeed from "@/components/agent-activity-feed";
import { PrismPanel } from "@/components/prism";
import { formatCurrency, formatDate, formatRelativeTime } from "@/lib/utils";
import {
  Package, CheckCircle, CreditCard, Circle, Bot,
  Sparkles, Film, ArrowRight, Calendar, MessageSquare,
  BarChart3, Zap, Star, Building, MapPin, Globe, Target, Loader, Phone,
  FolderOpen, ImageIcon, Music, FileText, File as FileIcon, ExternalLink
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { MotionPage } from "@/components/motion/motion-page";

const ClientOnboardingWizard = dynamic(() => import("@/components/client-onboarding-wizard"), { ssr: false });
const AutopilotDashboard = dynamic(() => import("@/components/autopilot-dashboard"), { ssr: false });

export default function ClientPortalPage() {
  const { profile } = useAuth();
  const { impersonatedClient, isImpersonating } = useAppStore();
  const [client, setClient] = useState<Client | null>(null);
  const [tasks, setTasks] = useState<ClientTask[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [content, setContent] = useState<ContentCalendarEntry[]>([]);
  const [aiActions, setAiActions] = useState<Array<Record<string, unknown>>>([]);
  const [aiPlan] = useState("");
  const [generatingPlan] = useState(false);
  const [loading, setLoading] = useState(true);
  const [leadCount, setLeadCount] = useState(0);
  const [outreachStats, setOutreachStats] = useState({ sent: 0, replied: 0 });
  const supabase = createClient();

  useEffect(() => {
    if (profile) fetchPortalData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, impersonatedClient]);

  async function fetchPortalData() {
    if (!profile?.id) { setLoading(false); return; }
    try {
      let clientData;
      // Use maybeSingle() so newly-created clients without a matching record
      // land on the empty-portal state instead of an unhandled 406 error.
      if (isImpersonating && impersonatedClient) {
        // Admin is viewing as this client -- look up by client ID
        const { data } = await supabase
          .from("clients")
          .select("*")
          .eq("id", impersonatedClient.id)
          .maybeSingle();
        clientData = data;
      } else {
        // Normal client login -- look up by profile_id
        const { data } = await supabase
          .from("clients")
          .select("*")
          .eq("profile_id", profile.id)
          .maybeSingle();
        clientData = data;
      }

      if (!clientData) {
        setLoading(false);
        return;
      }

      setClient(clientData);

      const [
        { data: tasksData },
        { data: invoicesData },
        { data: contentData },
        { data: aiData },
        { count: leadsCount },
        { data: outreachData },
      ] = await Promise.all([
        supabase.from("client_tasks").select("*").eq("client_id", clientData.id).order("created_at", { ascending: false }),
        supabase.from("invoices").select("*").eq("client_id", clientData.id).order("created_at", { ascending: false }),
        supabase.from("content_calendar").select("*").eq("client_id", clientData.id).order("scheduled_at", { ascending: false }).limit(5),
        supabase.from("trinity_log").select("*").eq("client_id", clientData.id).order("created_at", { ascending: false }).limit(5),
        supabase.from("leads").select("*", { count: "exact", head: true }).eq("client_id", clientData.id),
        supabase.from("outreach_log").select("status").eq("client_id", clientData.id),
      ]);

      setTasks(tasksData || []);
      setInvoices(invoicesData || []);
      setContent(contentData || []);
      setAiActions(aiData || []);
      setLeadCount(leadsCount || 0);
      const sent = (outreachData || []).length;
      const replied = (outreachData || []).filter((o: { status: string }) => o.status === "replied").length;
      setOutreachStats({ sent, replied });
    } catch (err) {
      // Don't toast � empty/onboarding state is a valid UX here (new users
      // hitting this page without a client row). Just log for debugging.
      console.error("[portal] fetchPortalData error:", err);
    } finally {
      setLoading(false);
    }
  }

  // Onboarding flow
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [botName, setBotName] = useState("Trinity");

  useEffect(() => {
    if (!client) return;
    const done = localStorage.getItem(`onboarding_done_${client.id}`);
    if (!done) setShowOnboarding(true);
    const savedBot = localStorage.getItem(`bot_name_${client.id}`);
    if (savedBot) setBotName(savedBot);
  }, [client]);

  if (loading) return <MotionPage>
                          <PageLoading />
                        </MotionPage>;

  if (!client) {
    return <ClientSelfOnboarding profileId={profile?.id || ""} profileEmail={profile?.email || ""} profileName={profile?.full_name || ""} onComplete={fetchPortalData} />;
  }

  const completedTasks = tasks.filter((t) => t.is_completed).length;
  const totalTasks = tasks.length;
  const pendingInvoices = invoices.filter(i => i.status === "sent" || i.status === "overdue");
  const totalPaid = invoices.filter(i => i.status === "paid").reduce((sum, i) => sum + i.amount, 0);
  const publishedContent = content.filter(c => c.status === "published").length;

  if (showOnboarding && client) {
    return (
      <ClientOnboardingWizard
        clientId={client.id}
        clientName={client.business_name}
        industry={client.industry || ""}
        onComplete={async (data) => {
          // Save onboarding data to client metadata
          const existingMeta = (client as Client & { metadata?: Record<string, unknown> }).metadata || {};
          await supabase.from("clients").update({
            metadata: {
              ...existingMeta,
              ...data,
              onboarded_at: new Date().toISOString(),
            },
          }).eq("id", client.id);

          // Launch AI auto-pilot if enabled
          if (data.ai_autopilot_enabled) {
            try {
              await fetch("/api/autopilot/launch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  client_id: client.id,
                  onboarding_data: data,
                }),
              });
            } catch {}
          }

          localStorage.setItem(`onboarding_done_${client.id}`, "true");
          setShowOnboarding(false);
          // Refresh portal data
          fetchPortalData();
        }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <BrowserModeBanner />

      {/* Welcome header */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="glass border relative overflow-hidden"
        style={{ borderColor: "rgba(99,146,255,0.10)" }}
      >
        <div className="absolute inset-0 bg-mesh opacity-40" />
        <div className="relative flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight">Welcome back, {client.contact_name?.split(" ")[0] || "there"}</h1>
            <p className="text-xs text-text-muted mt-0.5">{client.business_name || "Your Business"} � {client.package_tier || "Standard"} Plan</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-[10px] bg-[rgba(212,255,0,0.08)] text-brand-accent px-2.5 py-1 rounded-md border border-[rgba(212,255,0,0.08)]">
              <Star size={10} className="fill-brand-accent" />
              <span className="font-medium">{client.health_score}% Health</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* AI Auto-Pilot Status */}
      {client && <AutopilotDashboard clientId={client.id} />}

      {/* Stats -- portal keeps it clean, light stagger */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2.5">
        <StatCard label="Leads" value={leadCount} icon={<Target size={14} />} />
        <StatCard label="Outreach" value={outreachStats.sent} icon={<Zap size={14} />} change={outreachStats.replied > 0 ? `${outreachStats.replied} replied` : undefined} changeType="positive" />
        <StatCard label="Tasks Done" value={`${completedTasks}/${totalTasks}`} icon={<CheckCircle size={14} />} changeType={completedTasks === totalTasks && totalTasks > 0 ? "positive" : "neutral"} />
        <StatCard label="Content" value={publishedContent} icon={<Film size={14} />} change={`${content.length} total`} />
        <StatCard label="Services" value={(client.services || []).length} icon={<Package size={14} />} />
        <StatCard label="Invoiced" value={formatCurrency(totalPaid)} icon={<CreditCard size={14} />}
          change={pendingInvoices.length > 0 ? `${pendingInvoices.length} pending` : "All paid"}
          changeType={pendingInvoices.length > 0 ? "negative" : "positive"} />
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <Link href="/dashboard/portal/leads" className="card-hover p-3 flex items-center gap-2.5 group border-[rgba(212,255,0,0.1)]">
          <div className="w-8 h-8 bg-[rgba(212,255,0,0.08)] rounded-lg flex items-center justify-center shrink-0">
            <Sparkles size={14} className="text-brand-accent" />
          </div>
          <div>
            <p className="text-xs font-medium group-hover:text-text-primary transition-colors">AI Lead Engine</p>
            <p className="text-[10px] text-text-muted">Find new prospects</p>
          </div>
        </Link>
        <Link href="/dashboard/portal/outreach" className="card-hover p-3 flex items-center gap-2.5 group">
          <div className="w-8 h-8 bg-info/10 rounded-lg flex items-center justify-center shrink-0">
            <Target size={14} className="text-info" />
          </div>
          <div>
            <p className="text-xs font-medium group-hover:text-text-primary transition-colors">Outreach</p>
            <p className="text-[10px] text-text-muted">Email, DM, SMS, calls</p>
          </div>
        </Link>
        <Link href="/dashboard/portal/socials" className="card-hover p-3 flex items-center gap-2.5 group">
          <div className="w-8 h-8 bg-[rgba(212,255,0,0.08)] rounded-lg flex items-center justify-center shrink-0">
            <Globe size={14} className="text-brand-accent" />
          </div>
          <div>
            <p className="text-xs font-medium group-hover:text-text-primary transition-colors">Socials</p>
            <p className="text-[10px] text-text-muted">Connect accounts</p>
          </div>
        </Link>
        <Link href="/dashboard/portal/content" className="card-hover p-3 flex items-center gap-2.5 group">
          <div className="w-8 h-8 bg-info/10 rounded-lg flex items-center justify-center shrink-0">
            <Film size={14} className="text-info" />
          </div>
          <div>
            <p className="text-xs font-medium group-hover:text-text-primary transition-colors">Content</p>
            <p className="text-[10px] text-text-muted">View deliverables</p>
          </div>
        </Link>
        <Link href="/dashboard/portal/reports" className="card-hover p-3 flex items-center gap-2.5 group">
          <div className="w-8 h-8 bg-success/10 rounded-lg flex items-center justify-center shrink-0">
            <BarChart3 size={14} className="text-success" />
          </div>
          <div>
            <p className="text-xs font-medium group-hover:text-text-primary transition-colors">Reports</p>
            <p className="text-[10px] text-text-muted">Performance data</p>
          </div>
        </Link>
        <Link href="/dashboard/portal/support" className="card-hover p-3 flex items-center gap-2.5 group">
          <div className="w-8 h-8 bg-[rgba(212,255,0,0.08)] rounded-lg flex items-center justify-center shrink-0">
            <MessageSquare size={14} className="text-brand-accent" />
          </div>
          <div>
            <p className="text-xs font-medium group-hover:text-text-primary transition-colors">Support</p>
            <p className="text-[10px] text-text-muted">Ask {botName}</p>
          </div>
        </Link>
      </div>

      {/* AI Marketing Plan (shows after onboarding) */}
      {generatingPlan && (
        <PrismPanel padding="py-6" className="text-center">
          <Loader size={20} className="mx-auto mb-2 text-brand-accent animate-spin" />
          <p className="text-xs text-text-muted">AI Chief is creating your custom marketing plan...</p>
        </PrismPanel>
      )}
      {aiPlan && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="glass border"
          style={{ borderColor: "rgba(99,146,255,0.10)" }}
        >
          <h2 className="flex items-center gap-2">
            <Sparkles size={13} className="text-brand-accent" /> Your Custom Marketing Plan
          </h2>
          <pre className="text-[10px] text-text-muted leading-relaxed whitespace-pre-wrap">{aiPlan}</pre>
        </motion.div>
      )}

      {/* AI Recommendations */}
      <AIInsights clientId={client.id} />

      {/* Active Services */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.06 }}
        className="glass border"
        style={{ borderColor: "rgba(99,146,255,0.10)" }}
      >
        <h2 className="flex items-center gap-2"><Zap size={13} className="text-brand-accent" /> Active Services</h2>
        <div className="flex flex-wrap gap-2">
          {(client.services || []).map((service, i) => (
            <div key={i} className="bg-[rgba(212,255,0,0.05)] border border-[rgba(212,255,0,0.08)] rounded-lg px-3 py-2">
              <span className="text-xs text-brand-accent font-medium">{service}</span>
            </div>
          ))}
          {(client.services || []).length === 0 && (
            <p className="text-xs text-text-muted">No active services yet</p>
          )}
        </div>
      </motion.div>

      {/* Dedicated phone number (read-only for client) */}
      <ClientPortalPhoneCard clientId={client.id} />

      {/* Uploaded files (read-only unified list across portal drops + tagged
          content library assets). Mirrors the same section on the agency
          /dashboard/clients/[id] page. */}
      <ClientPortalFilesCard clientId={client.id} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Tasks */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 }}
          className="glass border"
          style={{ borderColor: "rgba(99,146,255,0.10)" }}
        >
          <h2 className="flex items-center gap-2">
            <CheckCircle size={13} className="text-success" /> Task Progress
          </h2>
          {totalTasks > 0 && (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-text-muted">{completedTasks} of {totalTasks} complete</span>
                <span className="text-[10px] font-mono text-brand-accent">{totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0}%</span>
              </div>
              <div className="w-full bg-surface-light rounded-full h-1.5">
                <div className="bg-brand-accent rounded-full h-1.5 transition-all" style={{ width: `${totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0}%` }} />
              </div>
            </div>
          )}
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {tasks.length === 0 ? (
              <p className="text-xs text-text-muted py-3 text-center">No tasks assigned yet</p>
            ) : (
              tasks.map((task) => (
                <div key={task.id} className="flex items-start gap-2 py-1.5 border-b border-border-subtle last:border-0">
                  {task.is_completed ? (
                    <CheckCircle size={14} className="text-success mt-0.5 shrink-0" />
                  ) : (
                    <Circle size={14} className="text-text-muted mt-0.5 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className={`text-xs ${task.is_completed ? "line-through text-text-muted" : ""}`}>{task.title}</p>
                    {task.due_date && <p className="text-[9px] text-text-muted">Due: {formatDate(task.due_date)}</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>

        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.12 }}
          className="glass border"
          style={{ borderColor: "rgba(99,146,255,0.10)" }}
        >
          <h2 className="flex items-center gap-2">
            <Sparkles size={13} className="text-brand-accent" /> Recent Activity
          </h2>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {aiActions.length === 0 ? (
              <p className="text-xs text-text-muted py-3 text-center">No recent activity</p>
            ) : (
              aiActions.map((a, i) => (
                <div key={(a.id as string) || i} className="flex items-start gap-2 py-1.5 border-b border-border-subtle last:border-0">
                  <Bot size={12} className="text-brand-accent mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs">{a.description as string}</p>
                    <p className="text-[9px] text-text-muted">{formatRelativeTime(a.created_at as string)}</p>
                  </div>
                  <StatusBadge status={a.status as string} />
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* Upcoming Content */}
      {content.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.14 }}
          className="glass border"
          style={{ borderColor: "rgba(99,146,255,0.10)" }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="mb-0 flex items-center gap-2">
              <Calendar size={13} className="text-brand-accent" /> Upcoming Content
            </h2>
            <Link href="/dashboard/portal/content" className="text-[10px] text-brand-accent hover:text-[rgba(212,255,0,0.8)] flex items-center gap-0.5">
              View all <ArrowRight size={10} />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {content.slice(0, 3).map((c) => (
              <div key={c.id} className="bg-surface-light border border-border-subtle rounded-lg p-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-text-muted capitalize">{c.platform.replace(/_/g, " ")}</span>
                  <StatusBadge status={c.status} />
                </div>
                <p className="text-xs font-medium truncate">{c.title}</p>
                {c.scheduled_at && <p className="text-[9px] text-text-muted mt-0.5">{formatDate(c.scheduled_at)}</p>}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Agent Activity for this client */}
      <AgentActivityFeed clientId={client.id} />

      {/* Pending Invoices alert */}
      {pendingInvoices.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className=" border border-warning/15"

        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard size={14} className="text-warning" />
              <div>
                <p className="text-xs font-medium">{pendingInvoices.length} invoice{pendingInvoices.length > 1 ? "s" : ""} pending</p>
                <p className="text-[10px] text-text-muted">Total: {formatCurrency(pendingInvoices.reduce((s, i) => s + i.amount, 0))}</p>
              </div>
            </div>
            <Link href="/dashboard/portal/billing" className="btn-secondary text-[10px] py-1 px-2.5">
              View Invoices
            </Link>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// Read-only phone number card for portal users. Shows assigned Twilio
// number + monthly SMS/call usage for this client only. Provisioning is
// agency-side � portal users see "not set up" when empty.
function ClientPortalPhoneCard({ clientId }: { clientId: string }) {
  const [status, setStatus] = useState<{
    phone_number: string | null;
    eleven_agent_id: string | null;
    has_number: boolean;
    usage: { sms_this_month: number; call_minutes_this_month: number };
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/clients/${clientId}/phone`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setStatus(data);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [clientId]);

  if (loading) return null;
  if (!status) return null;

  return (
    <PrismPanel>
      <h2 className="flex items-center gap-2">
        <Phone size={13} className="text-brand-accent" /> Your Phone Number
      </h2>
      {status.has_number ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-mono font-semibold">{status.phone_number}</span>
            <span className="text-[9px] px-2 py-0.5 rounded-full border bg-green-500/10 text-green-400 border-green-500/30 flex items-center gap-1">
              <Phone size={9} /> Active
            </span>
            {status.eleven_agent_id && (
              <span className="text-[9px] px-2 py-0.5 rounded-full border bg-[rgba(212,255,0,0.08)] text-brand-accent border-[rgba(212,255,0,0.25)] flex items-center gap-1">
                <Bot size={9} /> AI caller ready
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <div className="rounded-xl border border-border-subtle bg-surface-light p-3">
              <div className="flex items-center gap-1.5 text-[10px] text-text-muted mb-0.5">
                <MessageSquare size={10} /> SMS this month
              </div>
              <p className="text-base font-bold">{status.usage.sms_this_month}</p>
            </div>
            <div className="rounded-xl border border-border-subtle bg-surface-light p-3">
              <div className="flex items-center gap-1.5 text-[10px] text-text-muted mb-0.5">
                <Phone size={10} /> Call minutes this month
              </div>
              <p className="text-base font-bold">{status.usage.call_minutes_this_month}</p>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-xs text-text-muted">
          No dedicated phone number assigned yet. Your agency can provision one for you.
        </p>
      )}
    </PrismPanel>
  );
}

// Read-only unified files card for portal users. Shows every file they've
// dropped via /dashboard/portal/uploads + any agency-side content_assets
// tagged with their client slug. Backed by GET /api/clients/[id]/files.
interface PortalFileRow {
  id: string;
  name: string;
  url: string | null;
  type: string;
  size: number;
  uploaded_at: string;
  source_tool: string;
}

function portalFormatBytes(bytes: number): string {
  if (!bytes) return "�";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

function portalFileIcon(type: string) {
  const t = (type || "").toLowerCase();
  if (t.startsWith("image") || ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(t))
    return <ImageIcon size={14} className="text-brand-accent" />;
  if (t.startsWith("video") || ["mp4", "mov", "avi", "webm", "mkv"].includes(t))
    return <Film size={14} className="text-brand-accent" />;
  if (t.startsWith("audio") || ["mp3", "wav", "ogg", "m4a", "flac"].includes(t))
    return <Music size={14} className="text-pink-400" />;
  if (["pdf", "doc", "docx", "txt"].includes(t) || t.includes("document"))
    return <FileText size={14} className="text-brand-accent" />;
  return <FileIcon size={14} className="text-text-muted" />;
}

function ClientPortalFilesCard({ clientId }: { clientId: string }) {
  const [files, setFiles] = useState<PortalFileRow[]>([]);
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
        // ignore � show empty state
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [clientId]);

  return (
    <PrismPanel>
      <div className="flex items-center justify-between mb-3">
        <h2 className="flex items-center gap-2 mb-0">
          <FolderOpen size={13} className="text-brand-accent" /> Your Uploaded Files
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-text-muted">
            {loading ? "Loading..." : `${files.length} file${files.length === 1 ? "" : "s"}`}
          </span>
          <Link href="/dashboard/portal/uploads" className="btn-secondary text-[10px] py-1 px-2.5">
            Manage
          </Link>
        </div>
      </div>
      {loading ? (
        <p className="text-xs text-text-muted">Loading files...</p>
      ) : files.length === 0 ? (
        <p className="text-xs text-text-muted">
          You haven&apos;t uploaded any files yet. Drop files in the{" "}
          <Link href="/dashboard/portal/uploads" className="text-brand-accent hover:underline">
            My Uploads
          </Link>{" "}
          page to share them with your agency.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {files.slice(0, 9).map(f => {
            const isImage = (f.type || "").toLowerCase().startsWith("image") || ["png", "jpg", "jpeg", "gif", "webp"].includes((f.type || "").toLowerCase());
            return (
              <a
                key={f.id}
                href={f.url || "#"}
                target={f.url ? "_blank" : undefined}
                rel="noopener noreferrer"
                className={`flex items-center gap-2 p-2 rounded-lg border border-border-subtle bg-surface-light/50 hover:border-[rgba(212,255,0,0.25)] transition-colors min-w-0 ${f.url ? "" : "pointer-events-none opacity-60"}`}
                title={f.name}
              >
                <div className="w-10 h-10 rounded-lg bg-surface flex items-center justify-center shrink-0 overflow-hidden">
                  {isImage && f.url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={f.url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    portalFileIcon(f.type)
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium truncate">{f.name}</p>
                  <div className="flex items-center gap-1.5 text-[9px] text-text-muted">
                    <span>{portalFormatBytes(f.size)}</span>
                    <span className="opacity-40">�</span>
                    <span className="truncate">{f.source_tool}</span>
                  </div>
                  <p className="text-[9px] text-text-muted mt-0.5">{formatRelativeTime(f.uploaded_at)}</p>
                </div>
                {f.url && <ExternalLink size={10} className="text-text-muted shrink-0" />}
              </a>
            );
          })}
        </div>
      )}
      {files.length > 9 && (
        <div className="mt-3 text-center">
          <Link href="/dashboard/portal/uploads" className="text-[10px] text-brand-accent hover:underline">
            View all {files.length} files ?
          </Link>
        </div>
      )}
    </PrismPanel>
  );
}

// Self-service onboarding for clients who don't have a profile yet
function ClientSelfOnboarding({ profileId, profileEmail, profileName, onComplete }: {
  profileId: string; profileEmail: string; profileName: string; onComplete: () => void;
}) {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    business_name: "",
    contact_name: profileName || "",
    email: profileEmail || "",
    phone: "",
    website: "",
    industry: "",
    city: "",
    biggest_challenge: "",
    goals: "",
    ideal_customer: "",
    past_marketing: "",
    budget_range: "",
  });
  const supabase = createClient();

  const steps = [
    {
      title: "Tell us about your business",
      subtitle: "Basic info so we can set up your account",
      fields: [
        { key: "business_name", label: "Business Name", placeholder: "e.g., Bright Smile Dental", required: true, icon: <Building size={14} /> },
        { key: "contact_name", label: "Your Name", placeholder: "e.g., John Smith", required: true, icon: <Bot size={14} /> },
        { key: "phone", label: "Phone", placeholder: "(555) 123-4567", icon: <MessageSquare size={14} /> },
        { key: "website", label: "Website", placeholder: "www.yourbusiness.com", icon: <Globe size={14} /> },
        { key: "industry", label: "Industry", placeholder: "e.g., Dental, Legal, HVAC, Restaurant", required: true, icon: <Building size={14} /> },
        { key: "city", label: "City / Location", placeholder: "e.g., Miami, FL", icon: <MapPin size={14} /> },
      ],
    },
    {
      title: "What are your biggest challenges?",
      subtitle: "Help us understand your pain points",
      fields: [
        { key: "biggest_challenge", label: "Biggest Challenge", placeholder: "e.g., Not enough new customers, social media isn't working, competitors are outranking us...", type: "textarea" },
        { key: "ideal_customer", label: "Describe Your Ideal Customer", placeholder: "e.g., Homeowners aged 30-55 in Miami who need kitchen renovation, budget $20k+", type: "textarea" },
      ],
    },
    {
      title: "Goals & marketing history",
      subtitle: "So we can build the right strategy",
      fields: [
        { key: "goals", label: "What does success look like in 3 months?", placeholder: "e.g., 20 new clients/month, fully booked schedule, 5x more website traffic...", type: "textarea" },
        { key: "past_marketing", label: "What marketing have you tried before?", placeholder: "e.g., Facebook ads (didn't work), Google ads (ok results), word of mouth (works best)...", type: "textarea" },
        { key: "budget_range", label: "Monthly marketing budget range", placeholder: "e.g., $500-$1000, $1000-$2500, $2500+", icon: <Target size={14} /> },
      ],
    },
  ];

  async function handleSubmit() {
    // Every field is optional. Use sensible fallbacks so we can still
    // create the client row even if the user skipped everything.
    setSubmitting(true);

    try {
      // Create client record
      const { data: newClient, error } = await supabase.from("clients").insert({
        business_name: form.business_name || "New Client",
        contact_name: form.contact_name || "",
        email: form.email || "",
        phone: form.phone || null,
        website: form.website || null,
        industry: form.industry || "unspecified",
        profile_id: profileId,
        is_active: true,
        health_score: 100,
        contract_status: "pending",
        services: [],
        mrr: 0,
        metadata: {
          self_onboarded: true,
          city: form.city,
          biggest_challenge: form.biggest_challenge,
          goals: form.goals,
          ideal_customer: form.ideal_customer,
          past_marketing: form.past_marketing,
          budget_range: form.budget_range,
          onboarded_at: new Date().toISOString(),
        },
      }).select("id").single();

      if (error || !newClient) {
        console.error("[portal] self-onboard insert failed:", error);
        toast.error(error?.message || "Couldn't create your profile � try again.");
        return;
      }

      // Notify admin via trinity_log
      await supabase.from("trinity_log").insert({
        action_type: "custom",
        description: `New client self-onboarded: ${form.business_name} (${form.industry}) � ${form.biggest_challenge?.substring(0, 100)}`,
        status: "completed",
        client_id: newClient.id,
      });

      onComplete();
    } finally {
      setSubmitting(false);
    }
  }

  const currentStep = steps[step];

  return (
    <div className="max-w-xl mx-auto py-6 space-y-5">
      {/* Header */}
      <div className="text-center">
        <div className="w-14 h-14 bg-[rgba(212,255,0,0.08)]  flex items-center justify-center mx-auto mb-3 border border-[rgba(212,255,0,0.12)]">
          <Sparkles size={24} className="text-brand-accent" />
        </div>
        <h1 className="text-lg font-bold tracking-tight">Welcome to Trinity</h1>
        <p className="text-xs text-text-muted mt-1">Let&apos;s set up your account — takes less than 2 minutes</p>
        <p className="text-[10px] text-brand-accent mt-1">Complete your detailed onboarding after account creation</p>
      </div>

      {/* Progress */}
      <div className="flex gap-1">
        {steps.map((_, i) => (
          <div key={i} className={`flex-1 h-1 rounded-full transition-all ${i <= step ? "bg-brand-accent" : "bg-surface-light"}`} />
        ))}
      </div>

      {/* Step content */}
      <PrismPanel>
        <p className="text-[10px] text-brand-accent font-medium uppercase tracking-wider mb-0.5">Step {step + 1} of {steps.length}</p>
        <h2 className="text-sm font-semibold mb-0.5">{currentStep.title}</h2>
        <p className="text-[10px] text-text-muted mb-4">{currentStep.subtitle}</p>

        <div className="space-y-3">
          {currentStep.fields.map(f => (
            <div key={f.key}>
              <label className="block text-[10px] text-text-muted mb-1 uppercase tracking-wider font-medium">
                {f.label} {"required" in f && f.required && <span className="text-danger">*</span>}
              </label>
              {"type" in f && f.type === "textarea" ? (
                <textarea
                  value={form[f.key as keyof typeof form]}
                  onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                  className="input w-full h-20 text-xs"
                />
              ) : (
                <div className="relative">
                  {"icon" in f && f.icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">{f.icon as React.ReactNode}</span>}
                  <input
                    type="text"
                    value={form[f.key as keyof typeof form]}
                    onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    placeholder={f.placeholder}
                    className={`input w-full text-xs ${"icon" in f && f.icon ? "pl-9" : ""}`}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </PrismPanel>

      {/* Navigation */}
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}
          className="btn-secondary text-xs disabled:opacity-30">Back</button>

        <div className="flex items-center gap-2">
          {/* Skip � advance one step without filling anything in. Hidden on
              the final step where "Create My Profile" is the action. */}
          {step < steps.length - 1 && (
            <button
              onClick={() => setStep(step + 1)}
              className="text-[11px] text-text-muted hover:text-text-primary transition-colors px-3 py-2 font-medium"
            >
              Skip
            </button>
          )}
          {/* Skip everything � jump straight to submit with whatever
              partial info the user filled in. Always available from
              step 1 onward. */}
          {step > 0 && step < steps.length - 1 && (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="text-[11px] text-text-muted hover:text-brand-accent transition-colors px-3 py-2"
              title="Skip the rest and create your profile now"
            >
              Skip to finish
            </button>
          )}
          {step < steps.length - 1 ? (
            <button onClick={() => setStep(step + 1)}
              className="btn-primary text-xs">Next</button>
          ) : (
            <button onClick={handleSubmit} disabled={submitting}
              className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50">
              {submitting ? <Loader size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {submitting ? "Setting up..." : "Create My Profile"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


