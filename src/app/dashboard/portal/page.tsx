"use client";

import { useEffect, useState } from "react";
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
import { formatCurrency, formatDate, formatRelativeTime } from "@/lib/utils";
import {
  Package, CheckCircle, CreditCard, Circle, Bot,
  Sparkles, Film, ArrowRight, Calendar, MessageSquare,
  BarChart3, Zap, Star, Building, MapPin, Globe, Target, Loader
} from "lucide-react";
import Link from "next/link";

export default function ClientPortalPage() {
  const { profile } = useAuth();
  const { impersonatedClient, isImpersonating } = useAppStore();
  const [client, setClient] = useState<Client | null>(null);
  const [tasks, setTasks] = useState<ClientTask[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [content, setContent] = useState<ContentCalendarEntry[]>([]);
  const [aiActions, setAiActions] = useState<Array<Record<string, unknown>>>([]);
  const [aiPlan, setAiPlan] = useState("");
  const [generatingPlan, setGeneratingPlan] = useState(false);
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
      if (isImpersonating && impersonatedClient) {
        // Admin is viewing as this client -- look up by client ID
        const { data } = await supabase
          .from("clients")
          .select("*")
          .eq("id", impersonatedClient.id)
          .single();
        clientData = data;
      } else {
        // Normal client login -- look up by profile_id
        const { data } = await supabase
          .from("clients")
          .select("*")
          .eq("profile_id", profile.id)
          .single();
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
    } catch {
      // Data fetch failed silently; page shows empty/onboarding state
    } finally {
      setLoading(false);
    }
  }

  // Onboarding flow
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [botName, setBotName] = useState("Trinity");
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!client) return;
    const done = localStorage.getItem(`onboarding_done_${client.id}`);
    if (!done) setShowOnboarding(true);
    const savedBot = localStorage.getItem(`bot_name_${client.id}`);
    if (savedBot) setBotName(savedBot);
  }, [client]);

  if (loading) return <PageLoading />;

  if (!client) {
    return <ClientSelfOnboarding profileId={profile?.id || ""} profileEmail={profile?.email || ""} profileName={profile?.full_name || ""} onComplete={fetchPortalData} />;
  }

  const completedTasks = tasks.filter((t) => t.is_completed).length;
  const totalTasks = tasks.length;
  const pendingInvoices = invoices.filter(i => i.status === "sent" || i.status === "overdue");
  const totalPaid = invoices.filter(i => i.status === "paid").reduce((sum, i) => sum + i.amount, 0);
  const publishedContent = content.filter(c => c.status === "published").length;

  const onboardingQuestions = [
    { key: "biggest_challenge", q: "What is your biggest challenge right now with getting new customers?", placeholder: "e.g., We struggle to get found online, our social media isn't growing..." },
    { key: "goals_3mo", q: "What would success look like for you in the next 3 months?", placeholder: "e.g., 20 new clients, 5x more website traffic, fully booked schedule..." },
    { key: "has_socials", q: "Do you have social media accounts set up? Which ones?", placeholder: "e.g., Instagram @mybusiness, Facebook page, no TikTok yet..." },
    { key: "has_website", q: "Do you have a website? If yes, what is the URL?", placeholder: "e.g., www.mybusiness.com or No, I need one built..." },
    { key: "target_customer", q: "Describe your ideal customer in one sentence.", placeholder: "e.g., Homeowners aged 30-50 in Miami who need kitchen renovation..." },
    { key: "budget", q: "What is your monthly marketing budget range?", placeholder: "e.g., $500-$1000, $1000-$2500, not sure yet..." },
    { key: "competitors", q: "Who are your top 2-3 competitors?", placeholder: "e.g., ABC Dental, Bright Smile Clinic, Miami Family Dentistry..." },
    { key: "past_marketing", q: "What marketing have you tried before?", placeholder: "e.g., Tried Facebook ads but didn't get results, word of mouth works well..." },
    { key: "bot_name", q: "Last one -- what would you like to name your AI assistant?", placeholder: "e.g., Trinity, Max, Nova, Spark, Alex..." },
  ];

  async function finishOnboarding() {
    const name = answers.bot_name || "Trinity";
    setBotName(name);
    setGeneratingPlan(true);

    // Save bot config
    if (client) {
      fetch("/api/bot/customize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: client.id, bot_name: name, bot_personality: "helpful and knowledgeable about their business" }),
      }).catch(() => {});

      // Save onboarding answers to client metadata
      await supabase.from("clients").update({
        metadata: {
          ...((client as unknown as Record<string, unknown>).metadata as Record<string, unknown> || {}),
          biggest_challenge: answers.biggest_challenge,
          goals: answers.goals_3mo,
          has_socials: answers.has_socials,
          has_website: answers.has_website,
          target_customer: answers.target_customer,
          budget: answers.budget,
          competitors: answers.competitors,
          past_marketing: answers.past_marketing,
          onboarded_at: new Date().toISOString(),
        },
      }).eq("id", client.id);

      // AI Chief generates a custom plan
      try {
        const res = await fetch("/api/agents/chief", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: `A new client just onboarded. Create a custom 30-day marketing plan for them. Here is their info:
Business: ${client.business_name} (${client.industry})
Challenge: ${answers.biggest_challenge || "not specified"}
Goals: ${answers.goals_3mo || "grow their business"}
Social media: ${answers.has_socials || "unknown"}
Website: ${answers.has_website || "unknown"}
Target customer: ${answers.target_customer || "local customers"}
Budget: ${answers.budget || "not specified"}
Competitors: ${answers.competitors || "unknown"}
Past marketing: ${answers.past_marketing || "unknown"}

Create a specific 30-day plan with weekly milestones. Even if they gave minimal info, still create a plan based on their industry. Be specific and actionable. No markdown.`,
          }),
        });
        const data = await res.json();
        if (data.reply) setAiPlan(data.reply);
      } catch {}
    }

    setGeneratingPlan(false);
    localStorage.setItem(`onboarding_done_${client?.id}`, "true");
    localStorage.setItem(`bot_name_${client?.id}`, name);
    setShowOnboarding(false);
  }

  if (showOnboarding && client) {
    const q = onboardingQuestions[onboardingStep];
    return (
      <div className="fade-in max-w-xl mx-auto py-8 space-y-5">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-gold/10 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-gold/20">
            <Bot size={24} className="text-gold" />
          </div>
          <h1 className="text-lg font-bold tracking-tight">Welcome to ShortStack</h1>
          <p className="text-xs text-muted mt-1">Help our AI understand your business</p>
        </div>
        <div className="flex gap-1 mb-3">
          {onboardingQuestions.map((_, i) => (
            <div key={i} className={`flex-1 h-1 rounded-full transition-all ${i <= onboardingStep ? "bg-gold" : "bg-surface-light"}`} />
          ))}
        </div>
        <div className="card">
          <p className="text-[10px] text-gold font-medium uppercase tracking-wider mb-1">Question {onboardingStep + 1} of {onboardingQuestions.length}</p>
          <p className="text-sm font-medium mb-3">{q.q}</p>
          {q.key === "bot_name" ? (
            <input value={answers[q.key] || ""} onChange={e => setAnswers({ ...answers, [q.key]: e.target.value })}
              placeholder={q.placeholder} className="input w-full" autoFocus />
          ) : (
            <textarea value={answers[q.key] || ""} onChange={e => setAnswers({ ...answers, [q.key]: e.target.value })}
              placeholder={q.placeholder} className="input w-full h-24" autoFocus />
          )}
        </div>
        <div className="flex justify-between">
          <button onClick={() => setOnboardingStep(Math.max(0, onboardingStep - 1))} disabled={onboardingStep === 0}
            className="btn-secondary text-xs disabled:opacity-30">Back</button>
          {onboardingStep < onboardingQuestions.length - 1 ? (
            <button onClick={() => setOnboardingStep(onboardingStep + 1)} className="btn-primary text-xs">Next</button>
          ) : (
            <button onClick={finishOnboarding} className="btn-primary text-xs">Get Started</button>
          )}
        </div>
        <button onClick={() => { setShowOnboarding(false); localStorage.setItem(`onboarding_done_${client?.id}`, "true"); }}
          className="text-[10px] text-muted hover:text-foreground block mx-auto">Skip for now</button>
      </div>
    );
  }

  return (
    <div className="fade-in space-y-5">
      <BrowserModeBanner />

      {/* Welcome header */}
      <div className="card border-gold/10 relative overflow-hidden">
        <div className="absolute inset-0 bg-mesh opacity-40" />
        <div className="relative flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight">Welcome back, {client.contact_name?.split(" ")[0] || "there"}</h1>
            <p className="text-xs text-muted mt-0.5">{client.business_name || "Your Business"} · {client.package_tier || "Standard"} Plan</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-[10px] bg-gold/[0.08] text-gold px-2.5 py-1 rounded-md border border-gold/15">
              <Star size={10} className="fill-gold" />
              <span className="font-medium">{client.health_score}% Health</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
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
        <Link href="/dashboard/portal/leads" className="card-hover p-3 flex items-center gap-2.5 group border-gold/10">
          <div className="w-8 h-8 bg-gold/10 rounded-lg flex items-center justify-center shrink-0">
            <Sparkles size={14} className="text-gold" />
          </div>
          <div>
            <p className="text-xs font-medium group-hover:text-foreground transition-colors">AI Lead Engine</p>
            <p className="text-[10px] text-muted">Find new prospects</p>
          </div>
        </Link>
        <Link href="/dashboard/portal/outreach" className="card-hover p-3 flex items-center gap-2.5 group">
          <div className="w-8 h-8 bg-info/10 rounded-lg flex items-center justify-center shrink-0">
            <Target size={14} className="text-info" />
          </div>
          <div>
            <p className="text-xs font-medium group-hover:text-foreground transition-colors">Outreach</p>
            <p className="text-[10px] text-muted">Email, DM, SMS, calls</p>
          </div>
        </Link>
        <Link href="/dashboard/portal/socials" className="card-hover p-3 flex items-center gap-2.5 group">
          <div className="w-8 h-8 bg-gold/10 rounded-lg flex items-center justify-center shrink-0">
            <Globe size={14} className="text-gold" />
          </div>
          <div>
            <p className="text-xs font-medium group-hover:text-foreground transition-colors">Socials</p>
            <p className="text-[10px] text-muted">Connect accounts</p>
          </div>
        </Link>
        <Link href="/dashboard/portal/content" className="card-hover p-3 flex items-center gap-2.5 group">
          <div className="w-8 h-8 bg-info/10 rounded-lg flex items-center justify-center shrink-0">
            <Film size={14} className="text-info" />
          </div>
          <div>
            <p className="text-xs font-medium group-hover:text-foreground transition-colors">Content</p>
            <p className="text-[10px] text-muted">View deliverables</p>
          </div>
        </Link>
        <Link href="/dashboard/portal/reports" className="card-hover p-3 flex items-center gap-2.5 group">
          <div className="w-8 h-8 bg-success/10 rounded-lg flex items-center justify-center shrink-0">
            <BarChart3 size={14} className="text-success" />
          </div>
          <div>
            <p className="text-xs font-medium group-hover:text-foreground transition-colors">Reports</p>
            <p className="text-[10px] text-muted">Performance data</p>
          </div>
        </Link>
        <Link href="/dashboard/portal/support" className="card-hover p-3 flex items-center gap-2.5 group">
          <div className="w-8 h-8 bg-gold/10 rounded-lg flex items-center justify-center shrink-0">
            <MessageSquare size={14} className="text-gold" />
          </div>
          <div>
            <p className="text-xs font-medium group-hover:text-foreground transition-colors">Support</p>
            <p className="text-[10px] text-muted">Ask {botName}</p>
          </div>
        </Link>
      </div>

      {/* AI Marketing Plan (shows after onboarding) */}
      {generatingPlan && (
        <div className="card border-gold/10 text-center py-6">
          <Loader size={20} className="mx-auto mb-2 text-gold animate-spin" />
          <p className="text-xs text-muted">AI Chief is creating your custom marketing plan...</p>
        </div>
      )}
      {aiPlan && (
        <div className="card border-gold/10">
          <h2 className="section-header flex items-center gap-2">
            <Sparkles size={13} className="text-gold" /> Your Custom Marketing Plan
          </h2>
          <pre className="text-[10px] text-muted leading-relaxed whitespace-pre-wrap">{aiPlan}</pre>
        </div>
      )}

      {/* AI Recommendations */}
      <AIInsights clientId={client.id} />

      {/* Active Services */}
      <div className="card">
        <h2 className="section-header flex items-center gap-2"><Zap size={13} className="text-gold" /> Active Services</h2>
        <div className="flex flex-wrap gap-2">
          {(client.services || []).map((service, i) => (
            <div key={i} className="bg-gold/[0.06] border border-gold/15 rounded-lg px-3 py-2">
              <span className="text-xs text-gold font-medium">{service}</span>
            </div>
          ))}
          {(client.services || []).length === 0 && (
            <p className="text-xs text-muted">No active services yet</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Tasks */}
        <div className="card">
          <h2 className="section-header flex items-center gap-2">
            <CheckCircle size={13} className="text-success" /> Task Progress
          </h2>
          {totalTasks > 0 && (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted">{completedTasks} of {totalTasks} complete</span>
                <span className="text-[10px] font-mono text-gold">{totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0}%</span>
              </div>
              <div className="w-full bg-surface-light rounded-full h-1.5">
                <div className="bg-gradient-gold rounded-full h-1.5 transition-all" style={{ width: `${totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0}%` }} />
              </div>
            </div>
          )}
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {tasks.length === 0 ? (
              <p className="text-xs text-muted py-3 text-center">No tasks assigned yet</p>
            ) : (
              tasks.map((task) => (
                <div key={task.id} className="flex items-start gap-2 py-1.5 border-b border-border last:border-0">
                  {task.is_completed ? (
                    <CheckCircle size={14} className="text-success mt-0.5 shrink-0" />
                  ) : (
                    <Circle size={14} className="text-muted mt-0.5 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className={`text-xs ${task.is_completed ? "line-through text-muted" : ""}`}>{task.title}</p>
                    {task.due_date && <p className="text-[9px] text-muted">Due: {formatDate(task.due_date)}</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card">
          <h2 className="section-header flex items-center gap-2">
            <Sparkles size={13} className="text-gold" /> Recent Activity
          </h2>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {aiActions.length === 0 ? (
              <p className="text-xs text-muted py-3 text-center">No recent activity</p>
            ) : (
              aiActions.map((a, i) => (
                <div key={(a.id as string) || i} className="flex items-start gap-2 py-1.5 border-b border-border last:border-0">
                  <Bot size={12} className="text-gold mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs">{a.description as string}</p>
                    <p className="text-[9px] text-muted">{formatRelativeTime(a.created_at as string)}</p>
                  </div>
                  <StatusBadge status={a.status as string} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Upcoming Content */}
      {content.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-header mb-0 flex items-center gap-2">
              <Calendar size={13} className="text-gold" /> Upcoming Content
            </h2>
            <Link href="/dashboard/portal/content" className="text-[10px] text-gold hover:text-gold-light flex items-center gap-0.5">
              View all <ArrowRight size={10} />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {content.slice(0, 3).map((c) => (
              <div key={c.id} className="bg-surface-light border border-border rounded-lg p-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-muted capitalize">{c.platform.replace(/_/g, " ")}</span>
                  <StatusBadge status={c.status} />
                </div>
                <p className="text-xs font-medium truncate">{c.title}</p>
                {c.scheduled_at && <p className="text-[9px] text-muted mt-0.5">{formatDate(c.scheduled_at)}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Agent Activity for this client */}
      <AgentActivityFeed clientId={client.id} />

      {/* Pending Invoices alert */}
      {pendingInvoices.length > 0 && (
        <div className="card border-warning/15 bg-warning/[0.03]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard size={14} className="text-warning" />
              <div>
                <p className="text-xs font-medium">{pendingInvoices.length} invoice{pendingInvoices.length > 1 ? "s" : ""} pending</p>
                <p className="text-[10px] text-muted">Total: {formatCurrency(pendingInvoices.reduce((s, i) => s + i.amount, 0))}</p>
              </div>
            </div>
            <Link href="/dashboard/portal/billing" className="btn-secondary text-[10px] py-1 px-2.5">
              View Invoices
            </Link>
          </div>
        </div>
      )}
    </div>
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
    if (!form.business_name || !form.industry) return;
    setSubmitting(true);

    // Create client record
    const { data: newClient, error } = await supabase.from("clients").insert({
      business_name: form.business_name,
      contact_name: form.contact_name,
      email: form.email,
      phone: form.phone || null,
      website: form.website || null,
      industry: form.industry,
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

    if (!error && newClient) {
      // Notify admin via trinity_log
      await supabase.from("trinity_log").insert({
        action_type: "custom",
        description: `New client self-onboarded: ${form.business_name} (${form.industry}) — ${form.biggest_challenge?.substring(0, 100)}`,
        status: "completed",
        client_id: newClient.id,
      });

      onComplete();
    }
    setSubmitting(false);
  }

  const currentStep = steps[step];

  return (
    <div className="fade-in max-w-xl mx-auto py-6 space-y-5">
      {/* Header */}
      <div className="text-center">
        <div className="w-14 h-14 bg-gold/10 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-gold/20">
          <Sparkles size={24} className="text-gold" />
        </div>
        <h1 className="text-lg font-bold tracking-tight">Welcome to ShortStack</h1>
        <p className="text-xs text-muted mt-1">Let&apos;s set up your account — takes less than 2 minutes</p>
      </div>

      {/* Progress */}
      <div className="flex gap-1">
        {steps.map((_, i) => (
          <div key={i} className={`flex-1 h-1 rounded-full transition-all ${i <= step ? "bg-gold" : "bg-surface-light"}`} />
        ))}
      </div>

      {/* Step content */}
      <div className="card">
        <p className="text-[10px] text-gold font-medium uppercase tracking-wider mb-0.5">Step {step + 1} of {steps.length}</p>
        <h2 className="text-sm font-semibold mb-0.5">{currentStep.title}</h2>
        <p className="text-[10px] text-muted mb-4">{currentStep.subtitle}</p>

        <div className="space-y-3">
          {currentStep.fields.map(f => (
            <div key={f.key}>
              <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider font-medium">
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
                  {"icon" in f && f.icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">{f.icon as React.ReactNode}</span>}
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
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}
          className="btn-secondary text-xs disabled:opacity-30">Back</button>
        {step < steps.length - 1 ? (
          <button onClick={() => setStep(step + 1)}
            disabled={step === 0 && (!form.business_name || !form.industry)}
            className="btn-primary text-xs disabled:opacity-50">Next</button>
        ) : (
          <button onClick={handleSubmit} disabled={submitting || !form.business_name}
            className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50">
            {submitting ? <Loader size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {submitting ? "Setting up..." : "Create My Profile"}
          </button>
        )}
      </div>
    </div>
  );
}
