"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  Rocket, CheckCircle, Circle, ArrowRight,
  Users, Zap, Bot, Globe, CreditCard, Settings,
  MessageSquare, Mail, Loader, Crown, Monitor
} from "lucide-react";

interface Step {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  link: string;
  linkLabel: string;
}

const STEPS: Step[] = [
  { id: "profile", title: "Complete Your Profile", description: "Add your name, avatar, and timezone", icon: <Settings size={16} />, link: "/dashboard/profile", linkLabel: "Edit Profile" },
  { id: "plan", title: "Choose a Plan", description: "Select Starter, Growth, or Enterprise", icon: <Crown size={16} />, link: "/dashboard/pricing", linkLabel: "View Plans" },
  { id: "client", title: "Add Your First Client", description: "Onboard a client with the wizard", icon: <Users size={16} />, link: "/dashboard/onboard", linkLabel: "Onboard Client" },
  { id: "leads", title: "Scrape Some Leads", description: "Use Lead Finder to discover prospects", icon: <Zap size={16} />, link: "/dashboard/scraper", linkLabel: "Find Leads" },
  { id: "outreach", title: "Set Up Outreach", description: "Configure your email and SMS templates", icon: <Mail size={16} />, link: "/dashboard/sms-templates", linkLabel: "SMS Templates" },
  { id: "agents", title: "Configure AI Agents", description: "Set lead targets, platforms, and schedules", icon: <Bot size={16} />, link: "/dashboard/agent-controls", linkLabel: "Agent Controls" },
  { id: "social", title: "Connect Social Accounts", description: "Link Instagram, Facebook, Google, etc", icon: <Globe size={16} />, link: "/dashboard/integrations", linkLabel: "Connect" },
  { id: "stripe", title: "Set Up Payments", description: "Configure Stripe for client billing", icon: <CreditCard size={16} />, link: "/dashboard/settings", linkLabel: "Settings" },
  { id: "telegram", title: "Connect Telegram", description: "Get notifications and control agents remotely", icon: <MessageSquare size={16} />, link: "/dashboard/settings", linkLabel: "Settings" },
  { id: "extension", title: "Install Browser Extension", description: "AI assistant that works on any webpage for your clients", icon: <Monitor size={16} />, link: "/dashboard/settings", linkLabel: "Get Extension" },
];

export default function GettingStartedPage() {
  const { profile } = useAuth();
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (profile?.id) checkProgress();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  async function checkProgress() {
    if (!profile?.id) return;
    setLoading(true);
    const done = new Set<string>();

    try {
      // Check profile completeness
      if (profile.full_name && profile.full_name.trim().length > 0) done.add("profile");

      // Check plan
      if (profile.plan_tier) done.add("plan");

      // Check clients
      const { count: clientCount } = await supabase
        .from("clients")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);
      if (clientCount && clientCount > 0) done.add("client");

      // Check leads
      const { count: leadCount } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true });
      if (leadCount && leadCount > 0) done.add("leads");

      // Check outreach templates (SMS templates or email templates)
      const { count: templateCount } = await supabase
        .from("trinity_log")
        .select("*", { count: "exact", head: true })
        .in("action_type", ["sms_template", "email_template", "outreach"]);
      if (templateCount && templateCount > 0) done.add("outreach");

      // Check agent config
      const { count: agentCount } = await supabase
        .from("trinity_log")
        .select("*", { count: "exact", head: true })
        .eq("action_type", "agent_config");
      if (agentCount && agentCount > 0) done.add("agents");

      // Check social accounts
      const { count: socialCount } = await supabase
        .from("social_accounts")
        .select("*", { count: "exact", head: true });
      if (socialCount && socialCount > 0) done.add("social");

      // Check Stripe (profile has stripe_customer_id)
      if (profile.stripe_customer_id) done.add("stripe");

      // Check Telegram (check settings or env)
      const { data: settings } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "telegram_bot_token")
        .single();
      if (settings?.value) done.add("telegram");
    } catch {
      // If some queries fail, that's fine — just show what we can
    }

    // Also merge any manual overrides from localStorage
    try {
      const saved = localStorage.getItem("ss_onboarding_completed");
      if (saved) {
        const manual = JSON.parse(saved) as string[];
        manual.forEach(id => done.add(id));
      }
    } catch { /* ignore */ }

    setCompleted(done);
    setLoading(false);
  }

  function toggleStep(id: string) {
    setCompleted(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      // Persist manual overrides
      localStorage.setItem("ss_onboarding_completed", JSON.stringify(Array.from(next)));
      return next;
    });
  }

  const progress = Math.round((completed.size / STEPS.length) * 100);

  return (
    <div className="fade-in space-y-5 max-w-2xl">
      <div>
        <h1 className="page-header mb-0 flex items-center gap-2">
          <Rocket size={18} className="text-gold" /> Getting Started
        </h1>
        <p className="text-xs text-muted mt-0.5">Complete these steps to set up your agency OS</p>
      </div>

      {/* Progress */}
      <div className="card border-gold/10">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold">{completed.size}/{STEPS.length} completed</span>
          <span className="text-xs text-gold font-mono">{progress}%</span>
        </div>
        <div className="w-full h-2 rounded-full bg-surface-light">
          <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: "linear-gradient(90deg, #c8a855, #10b981)" }} />
        </div>
        {progress === 100 && (
          <p className="text-xs text-success mt-2 flex items-center gap-1"><CheckCircle size={12} /> All done! Your agency is fully set up.</p>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader size={20} className="animate-spin text-gold" />
        </div>
      ) : (
        <div className="space-y-2">
          {STEPS.map((step, i) => {
            const done = completed.has(step.id);
            // Check if previous step is done (for sequential guidance)
            const prevDone = i === 0 || completed.has(STEPS[i - 1].id);
            const isCurrent = !done && prevDone;

            return (
              <div key={step.id}
                className={`p-4 rounded-xl flex items-center gap-4 transition-all border ${
                  done ? "bg-success/[0.02] border-success/10 opacity-70" :
                  isCurrent ? "bg-gold/[0.03] border-gold/15" :
                  "bg-surface-light border-border"
                }`}>
                <button onClick={() => toggleStep(step.id)} className="shrink-0">
                  {done
                    ? <CheckCircle size={20} className="text-success" />
                    : <Circle size={20} className={isCurrent ? "text-gold" : "text-gray-600"} />
                  }
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={done ? "text-success" : isCurrent ? "text-gold" : "text-muted"}>{step.icon}</span>
                    <p className={`text-sm font-semibold ${done ? "line-through text-muted" : "text-foreground"}`}>{step.title}</p>
                    {isCurrent && <span className="text-[8px] bg-gold/10 text-gold px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">Next</span>}
                  </div>
                  <p className="text-[10px] text-muted mt-0.5">{step.description}</p>
                </div>
                <Link href={step.link} className={`text-[9px] py-1 px-2.5 flex items-center gap-1 shrink-0 rounded-lg font-medium transition-all ${
                  isCurrent ? "bg-gold text-black hover:opacity-90" : "btn-secondary"
                }`}>
                  {step.linkLabel} <ArrowRight size={9} />
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick tip */}
      {!loading && completed.size < STEPS.length && (
        <div className="card border-gold/10 bg-gold/[0.02]">
          <p className="text-[10px] text-muted">
            <span className="text-gold font-semibold">Tip:</span> Steps are auto-detected from your actual data. You can also manually check them off by clicking the circle.
          </p>
        </div>
      )}
    </div>
  );
}
