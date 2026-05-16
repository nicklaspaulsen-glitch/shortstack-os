"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Rocket, CheckCircle, Circle, ArrowRight,
  Users, Zap, Bot, Globe, CreditCard, Settings,
  MessageSquare, Mail, Loader, Crown, Monitor
} from "lucide-react";
import { MotionPage } from "@/components/motion/motion-page";

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
  { id: "social", title: "Connect Social Accounts", description: "Link Instagram, Facebook, Google, etc", icon: <Globe size={16} />, link: "/dashboard/integrations-hub", linkLabel: "Connect" },
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
    } catch (err) {
      // Partial failure is fine — just surface a debug log.
      console.warn("Onboarding progress check partial failure:", err);
    }

    // Also merge any manual overrides from localStorage
    try {
      const saved = localStorage.getItem("ss_onboarding_completed");
      if (saved) {
        const manual = JSON.parse(saved) as string[];
        manual.forEach(id => done.add(id));
      }
    } catch (err) {
      // Malformed localStorage; safe to ignore.
      console.warn("Failed to parse saved onboarding state:", err);
    }

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
    <MotionPage className="fade-in space-y-5 max-w-2xl">{/* -- Getting Started command strip -- */}
    <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
      <div className="min-w-0">
        <p className="font-editorial text-[11px] italic text-text-muted mb-0.5">GETTING STARTED</p>
        <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-primary leading-none">Getting Started</h1>
      </div>
    </div>{/* Progress */}<motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="bg-white border border-[rgba(0,0,0,0.06)] rounded-xl p-4 relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-[#111827]">{completed.size}/{STEPS.length} completed</span>
                <span className="text-xs text-brand-accent font-mono">{progress}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[rgba(0,0,0,0.06)]">
                <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: "linear-gradient(90deg, #2563EB, #3B82F6)" }} />
              </div>
              {progress === 100 && (
                <p className="text-xs text-green-700 mt-2 flex items-center gap-1"><CheckCircle size={12} /> All done! Your agency is fully set up.</p>
              )}
            </motion.div>{loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader size={20} className="animate-spin text-brand-accent" />
              </div>
            ) : (
              <div className="space-y-2">
                {STEPS.map((step, i) => {
                  const done = completed.has(step.id);
                  // Check if previous step is done (for sequential guidance)
                  const prevDone = i === 0 || completed.has(STEPS[i - 1].id);
                  const isCurrent = !done && prevDone;

                  return (
                    <motion.div key={step.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className={`p-4 bg-white border rounded-xl flex items-center gap-4 transition-all ${
                        done ? "opacity-70 border-[rgba(0,0,0,0.06)]" :
                        isCurrent ? "border-[rgba(59,130,246,0.25)]" :
                        "border-[rgba(0,0,0,0.06)]"
                      }`}>
                      <button
                        onClick={() => toggleStep(step.id)}
                        aria-label={done ? `Mark "${step.title}" as not done` : `Mark "${step.title}" as done`}
                        className="shrink-0">
                        {done
                          ? <CheckCircle size={20} className="text-green-700" />
                          : <Circle size={20} className={isCurrent ? "text-brand-accent" : "text-[#6B7280]"} />
                        }
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={done ? "text-green-700" : isCurrent ? "text-brand-accent" : "text-[#6B7280]"}>{step.icon}</span>
                          <p className={`text-sm font-semibold ${done ? "line-through text-text-muted" : "text-[#111827]"}`}>{step.title}</p>
                          {isCurrent && <span className="text-[8px] bg-[rgba(59,130,246,0.08)] text-brand-accent px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">Next</span>}
                        </div>
                        <p className="text-[10px] text-[#6B7280] mt-0.5">{step.description}</p>
                      </div>
                      <Link href={step.link} className={`text-[9px] py-1 px-2.5 flex items-center gap-1 shrink-0 rounded-lg font-medium transition-all ${
                        isCurrent ? "bg-brand-accent text-white hover:bg-brand-accent/80" : "bg-[rgba(0,0,0,0.04)] text-[#374151] hover:bg-[rgba(0,0,0,0.06)] border border-[rgba(0,0,0,0.08)]"
                      }`}>
                        {step.linkLabel} <ArrowRight size={9} />
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            )}{/* Quick tip */}{!loading && completed.size < STEPS.length && (
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className="bg-[rgba(59,130,246,0.08)] border border-[rgba(59,130,246,0.25)] rounded-xl p-4"
              >
                <p className="text-[10px] text-[#374151]">
                  <span className="text-brand-accent font-semibold">Tip:</span> Steps are auto-detected from your actual data. You can also manually check them off by clicking the circle.
                </p>
              </motion.div>
            )}</MotionPage>
  );
}
