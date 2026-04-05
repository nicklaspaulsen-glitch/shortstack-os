"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { BrowserModeBanner } from "@/components/read-only-guard";
import { Client, ClientTask, Invoice, Contract } from "@/lib/types";
import StatCard from "@/components/ui/stat-card";
import StatusBadge from "@/components/ui/status-badge";
import { PageLoading } from "@/components/ui/loading";
import EmptyState from "@/components/ui/empty-state";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Package, CheckCircle, FileText, CreditCard, Circle } from "lucide-react";

export default function ClientPortalPage() {
  const { profile } = useAuth();
  const [client, setClient] = useState<Client | null>(null);
  const [tasks, setTasks] = useState<ClientTask[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (profile) fetchPortalData();
  }, [profile]);

  async function fetchPortalData() {
    // Find client record linked to this user
    const { data: clientData } = await supabase
      .from("clients")
      .select("*")
      .eq("profile_id", profile!.id)
      .single();

    if (!clientData) {
      setLoading(false);
      return;
    }

    setClient(clientData);

    const [{ data: tasksData }, { data: invoicesData }, { data: contractsData }] = await Promise.all([
      supabase.from("client_tasks").select("*").eq("client_id", clientData.id).order("created_at", { ascending: false }),
      supabase.from("invoices").select("*").eq("client_id", clientData.id).order("created_at", { ascending: false }),
      supabase.from("contracts").select("*").eq("client_id", clientData.id).order("created_at", { ascending: false }),
    ]);

    setTasks(tasksData || []);
    setInvoices(invoicesData || []);
    setContracts(contractsData || []);
    setLoading(false);
  }

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [botName, setBotName] = useState("Trinity");
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // Check if client has completed onboarding questions
  useEffect(() => {
    if (!client) return;
    const done = localStorage.getItem(`onboarding_done_${client.id}`);
    if (!done) setShowOnboarding(true);
    const savedBot = localStorage.getItem(`bot_name_${client.id}`);
    if (savedBot) setBotName(savedBot);
  }, [client]);

  if (loading) return <PageLoading />;

  if (!client) {
    return (
      <EmptyState
        icon={<Package size={48} />}
        title="No Client Profile Found"
        description="Your account hasn&apos;t been linked to a client profile yet. Contact the admin."
      />
    );
  }

  const completedTasks = tasks.filter((t) => t.is_completed).length;
  const totalTasks = tasks.length;
  const paidInvoices = invoices.filter((i) => i.status === "paid");
  const totalPaid = paidInvoices.reduce((sum, i) => sum + i.amount, 0);

  const onboardingQuestions = [
    { key: "biggest_challenge", q: "What is your biggest challenge right now with getting new customers?", placeholder: "e.g., We struggle to get found online, our social media isn't growing..." },
    { key: "goals_3mo", q: "What would success look like for you in the next 3 months?", placeholder: "e.g., 20 new clients, 5x more website traffic, fully booked schedule..." },
    { key: "target_customer", q: "Describe your ideal customer in one sentence.", placeholder: "e.g., Homeowners aged 30-50 in Miami who need kitchen renovation..." },
    { key: "competitors", q: "Who are your top 2-3 competitors?", placeholder: "e.g., ABC Dental, Bright Smile Clinic, Miami Family Dentistry..." },
    { key: "past_marketing", q: "What marketing have you tried before? What worked and what didn't?", placeholder: "e.g., Tried Facebook ads but didn't get results, word of mouth works well..." },
    { key: "bot_name", q: "Last one — what would you like to name your personal AI assistant?", placeholder: "e.g., Trinity, Max, Nova, Spark, Alex..." },
  ];

  async function finishOnboarding() {
    const name = answers.bot_name || "Trinity";
    setBotName(name);
    localStorage.setItem(`onboarding_done_${client?.id}`, "true");
    localStorage.setItem(`bot_name_${client?.id}`, name);
    setShowOnboarding(false);

    // Save bot config + pain points to server
    if (client) {
      fetch("/api/bot/customize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: client.id,
          bot_name: name,
          bot_personality: "helpful and knowledgeable about their business",
        }),
      }).catch(() => {});
    }
  }

  if (showOnboarding && client) {
    const q = onboardingQuestions[onboardingStep];
    return (
      <div className="fade-in max-w-xl mx-auto py-12 space-y-6">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gold/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🤖</span>
          </div>
          <h1 className="text-xl font-bold">Let&apos;s Get to Know You</h1>
          <p className="text-sm text-muted mt-1">Help our AI understand your business so it can assist you better</p>
        </div>
        <div className="flex gap-1 mb-4">
          {onboardingQuestions.map((_, i) => (
            <div key={i} className={`flex-1 h-1.5 rounded-full ${i <= onboardingStep ? "bg-gold" : "bg-surface-light"}`} />
          ))}
        </div>
        <div className="card">
          <p className="text-sm font-medium text-gold mb-1">Question {onboardingStep + 1} of {onboardingQuestions.length}</p>
          <p className="text-lg font-medium mb-4">{q.q}</p>
          {q.key === "bot_name" ? (
            <input value={answers[q.key] || ""} onChange={e => setAnswers({ ...answers, [q.key]: e.target.value })}
              placeholder={q.placeholder} className="input w-full text-lg py-3" autoFocus />
          ) : (
            <textarea value={answers[q.key] || ""} onChange={e => setAnswers({ ...answers, [q.key]: e.target.value })}
              placeholder={q.placeholder} className="input w-full h-28" autoFocus />
          )}
        </div>
        <div className="flex justify-between">
          <button onClick={() => setOnboardingStep(Math.max(0, onboardingStep - 1))} disabled={onboardingStep === 0}
            className="btn-secondary disabled:opacity-30">Back</button>
          {onboardingStep < onboardingQuestions.length - 1 ? (
            <button onClick={() => setOnboardingStep(onboardingStep + 1)} className="btn-primary">Next</button>
          ) : (
            <button onClick={finishOnboarding} className="btn-primary">Start Using {answers.bot_name || "Trinity"}</button>
          )}
        </div>
        <button onClick={() => { setShowOnboarding(false); localStorage.setItem(`onboarding_done_${client?.id}`, "true"); }}
          className="text-xs text-muted hover:text-white block mx-auto mt-2">Skip for now</button>
      </div>
    );
  }

  return (
    <div className="fade-in space-y-6">
      <BrowserModeBanner />
      <div>
        <h1 className="page-header mb-0">Welcome, {client.contact_name} — {botName} is ready</h1>
        <p className="text-muted text-sm">{client.business_name} &middot; {client.package_tier || "Standard"} Plan</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Active Services" value={(client.services || []).length} icon={<Package size={18} />} />
        <StatCard label="Tasks Complete" value={`${completedTasks}/${totalTasks}`} icon={<CheckCircle size={18} />} />
        <StatCard label="Contract Status" value={client.contract_status.replace("_", " ")} icon={<FileText size={18} />} />
        <StatCard label="Total Invoiced" value={formatCurrency(totalPaid)} icon={<CreditCard size={18} />} />
      </div>

      {/* Active Services */}
      <div className="card">
        <h2 className="section-header">Active Services</h2>
        <div className="flex flex-wrap gap-3">
          {(client.services || []).map((service, i) => (
            <div key={i} className="bg-gold/10 border border-gold/20 rounded-lg px-4 py-3">
              <span className="text-gold font-medium">{service}</span>
            </div>
          ))}
          {(client.services || []).length === 0 && (
            <p className="text-muted text-sm">No active services</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Task Checklist */}
        <div className="card">
          <h2 className="section-header">Task Checklist</h2>
          <div className="space-y-3">
            {tasks.length === 0 ? (
              <p className="text-muted text-sm">No tasks assigned</p>
            ) : (
              tasks.map((task) => (
                <div key={task.id} className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
                  {task.is_completed ? (
                    <CheckCircle size={18} className="text-success mt-0.5 shrink-0" />
                  ) : (
                    <Circle size={18} className="text-muted mt-0.5 shrink-0" />
                  )}
                  <div>
                    <p className={`text-sm ${task.is_completed ? "line-through text-muted" : ""}`}>{task.title}</p>
                    {task.due_date && (
                      <p className="text-xs text-muted">Due: {formatDate(task.due_date)}</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Invoices */}
        <div className="card">
          <h2 className="section-header">Invoice History</h2>
          <div className="space-y-3">
            {invoices.length === 0 ? (
              <p className="text-muted text-sm">No invoices yet</p>
            ) : (
              invoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div>
                    <p className="text-sm">{inv.description || "Invoice"}</p>
                    <p className="text-xs text-muted">{inv.due_date ? formatDate(inv.due_date) : "-"}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{formatCurrency(inv.amount)}</span>
                    <StatusBadge status={inv.status} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Contracts */}
      <div className="card">
        <h2 className="section-header">Contracts</h2>
        <div className="space-y-3">
          {contracts.length === 0 ? (
            <p className="text-muted text-sm">No contracts on file</p>
          ) : (
            contracts.map((contract) => (
              <div key={contract.id} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
                <div>
                  <p className="font-medium">{contract.title}</p>
                  <p className="text-xs text-muted">
                    {contract.start_date ? formatDate(contract.start_date) : "?"} — {contract.end_date ? formatDate(contract.end_date) : "Ongoing"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {contract.value && <span className="font-medium">{formatCurrency(contract.value)}</span>}
                  <StatusBadge status={contract.status} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
