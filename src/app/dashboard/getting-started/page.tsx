"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import {
  Rocket, CheckCircle, Circle, ArrowRight,
  Users, Zap, Bot, Globe, CreditCard, Settings,
  MessageSquare, Mail
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
  { id: "profile", title: "Complete Your Profile", description: "Add your name, photo, and timezone", icon: <Settings size={16} />, link: "/dashboard/profile", linkLabel: "Edit Profile" },
  { id: "client", title: "Add Your First Client", description: "Onboard a client with the step-by-step wizard", icon: <Users size={16} />, link: "/dashboard/onboard", linkLabel: "Onboard Client" },
  { id: "leads", title: "Scrape Some Leads", description: "Use the Lead Finder to find potential clients", icon: <Zap size={16} />, link: "/dashboard/scraper", linkLabel: "Find Leads" },
  { id: "outreach", title: "Set Up Outreach", description: "Configure your cold email and SMS templates", icon: <Mail size={16} />, link: "/dashboard/sms-templates", linkLabel: "SMS Templates" },
  { id: "agents", title: "Configure Your Agents", description: "Set lead count, platforms, and schedules", icon: <Bot size={16} />, link: "/dashboard/agent-controls", linkLabel: "Agent Controls" },
  { id: "social", title: "Connect Social Accounts", description: "Link Instagram, Facebook, Google, etc", icon: <Globe size={16} />, link: "/dashboard/integrations", linkLabel: "Connect Accounts" },
  { id: "stripe", title: "Set Up Payments", description: "Configure Stripe for client billing", icon: <CreditCard size={16} />, link: "/dashboard/settings", linkLabel: "Settings" },
  { id: "telegram", title: "Connect Telegram Bot", description: "Get notifications and control agents remotely", icon: <MessageSquare size={16} />, link: "/dashboard/settings", linkLabel: "Settings" },
];

export default function GettingStartedPage() {
  useAuth();
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  useEffect(() => {
    const saved = localStorage.getItem("ss_onboarding_completed");
    if (saved) setCompleted(new Set(JSON.parse(saved)));
  }, []);

  function toggleStep(id: string) {
    setCompleted(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold">{completed.size}/{STEPS.length} completed</span>
          <span className="text-xs text-gold font-mono">{progress}%</span>
        </div>
        <div className="w-full h-2 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }}>
          <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: "linear-gradient(90deg, #c8a855, #10b981)" }} />
        </div>
        {progress === 100 && (
          <p className="text-xs text-success mt-2 flex items-center gap-1"><CheckCircle size={12} /> All done! Your agency is fully set up.</p>
        )}
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {STEPS.map((step) => {
          const done = completed.has(step.id);
          return (
            <div key={step.id} className={`p-4 rounded-xl flex items-center gap-4 transition-all ${done ? "opacity-60" : ""}`}
              style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${done ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.04)"}` }}>
              <button onClick={() => toggleStep(step.id)} className="shrink-0">
                {done
                  ? <CheckCircle size={20} className="text-success" />
                  : <Circle size={20} className="text-gray-600" />
                }
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-gold">{step.icon}</span>
                  <p className={`text-sm font-semibold ${done ? "line-through text-gray-500" : "text-white"}`}>{step.title}</p>
                </div>
                <p className="text-[10px] text-muted mt-0.5">{step.description}</p>
              </div>
              <Link href={step.link} className="btn-secondary text-[9px] py-1 px-2.5 flex items-center gap-1 shrink-0">
                {step.linkLabel} <ArrowRight size={9} />
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
