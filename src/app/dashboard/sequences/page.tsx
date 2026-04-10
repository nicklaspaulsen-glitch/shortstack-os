"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Mail, Plus, Clock, Sparkles, Play, Pause,
  Trash2, ArrowDown, Loader
} from "lucide-react";
import toast from "react-hot-toast";

interface SequenceStep {
  id: string;
  type: "email" | "sms" | "wait";
  subject?: string;
  body: string;
  delay_days: number;
}

interface Sequence {
  id: string;
  name: string;
  steps: SequenceStep[];
  active: boolean;
}

const TEMPLATES = [
  {
    name: "Cold Outreach (5 touches)",
    steps: [
      { id: "1", type: "email" as const, subject: "Quick question about {business_name}", body: "Hey {name},\n\nI came across {business_name} and noticed you're doing great work in {industry}. I help businesses like yours get 2-3x more clients through digital marketing.\n\nWould you be open to a quick 15-minute call this week?\n\nBest,\nNicklas", delay_days: 0 },
      { id: "2", type: "wait" as const, body: "", delay_days: 3 },
      { id: "3", type: "email" as const, subject: "Following up — {business_name}", body: "Hey {name},\n\nJust bumping this to the top of your inbox. I recently helped a {industry} business go from 10 to 50+ new clients per month.\n\nHappy to share how — takes 15 minutes.\n\nBest,\nNicklas", delay_days: 0 },
      { id: "4", type: "wait" as const, body: "", delay_days: 4 },
      { id: "5", type: "sms" as const, body: "Hey {name}! I sent you a couple emails about helping {business_name} get more clients. Any interest in a quick chat?", delay_days: 0 },
      { id: "6", type: "wait" as const, body: "", delay_days: 5 },
      { id: "7", type: "email" as const, subject: "Last try — free audit for {business_name}", body: "Hey {name},\n\nI know you're busy so I'll keep this short. I put together a free marketing audit for {business_name} — no strings attached.\n\nWant me to send it over?\n\nBest,\nNicklas", delay_days: 0 },
    ],
  },
  {
    name: "Post-Call Follow Up",
    steps: [
      { id: "1", type: "email" as const, subject: "Great talking with you!", body: "Hey {name},\n\nReally enjoyed our call today! As discussed, here's what we'd do for {business_name}:\n\n1. [Recap point 1]\n2. [Recap point 2]\n3. [Recap point 3]\n\nI'll send over the proposal by end of day.\n\nBest,\nNicklas", delay_days: 0 },
      { id: "2", type: "wait" as const, body: "", delay_days: 2 },
      { id: "3", type: "email" as const, subject: "Proposal ready — {business_name}", body: "Hey {name},\n\nHere's the proposal we discussed. Let me know if you have any questions!\n\n[Link to proposal]\n\nBest,\nNicklas", delay_days: 0 },
      { id: "4", type: "wait" as const, body: "", delay_days: 3 },
      { id: "5", type: "sms" as const, body: "Hey {name}! Did you get a chance to look at the proposal? Happy to jump on a quick call if you have questions.", delay_days: 0 },
    ],
  },
  {
    name: "Client Onboarding",
    steps: [
      { id: "1", type: "email" as const, subject: "Welcome to ShortStack! 🎉", body: "Hey {name},\n\nWelcome aboard! We're thrilled to have {business_name} as a client.\n\nHere's what happens next:\n1. You'll receive access to your client portal\n2. We'll schedule your onboarding call\n3. We'll start your first content batch\n\nBest,\nThe ShortStack Team", delay_days: 0 },
      { id: "2", type: "wait" as const, body: "", delay_days: 1 },
      { id: "3", type: "email" as const, subject: "Your onboarding checklist", body: "Hey {name},\n\nTo get started quickly, we need a few things from you:\n\n☐ Brand assets (logo, fonts, colors)\n☐ Social media login access\n☐ Website access\n☐ Ad account access\n\nYou can upload everything in your portal.\n\nBest,\nThe ShortStack Team", delay_days: 0 },
      { id: "4", type: "wait" as const, body: "", delay_days: 3 },
      { id: "5", type: "sms" as const, body: "Hey {name}! Just checking in — did you get a chance to upload your brand assets to the portal? We're ready to start creating!", delay_days: 0 },
    ],
  },
];

export default function SequencesPage() {
  useAuth();
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [activeSequence, setActiveSequence] = useState<Sequence | null>(null);
  const [generating, setGenerating] = useState(false);

  function createFromTemplate(template: typeof TEMPLATES[0]) {
    const seq: Sequence = {
      id: `seq_${Date.now()}`,
      name: template.name,
      steps: template.steps,
      active: false,
    };
    setSequences(prev => [...prev, seq]);
    setActiveSequence(seq);
    toast.success(`${template.name} created!`);
  }

  function addStep(type: "email" | "sms" | "wait") {
    if (!activeSequence) return;
    const step: SequenceStep = {
      id: `s_${Date.now()}`,
      type,
      subject: type === "email" ? "Subject" : undefined,
      body: type === "wait" ? "" : "Message here...",
      delay_days: type === "wait" ? 2 : 0,
    };
    const updated = { ...activeSequence, steps: [...activeSequence.steps, step] };
    setActiveSequence(updated);
    setSequences(prev => prev.map(s => s.id === updated.id ? updated : s));
  }

  function removeStep(stepId: string) {
    if (!activeSequence) return;
    const updated = { ...activeSequence, steps: activeSequence.steps.filter(s => s.id !== stepId) };
    setActiveSequence(updated);
    setSequences(prev => prev.map(s => s.id === updated.id ? updated : s));
  }

  async function generateWithAI() {
    if (!activeSequence) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/agents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `Write a 5-step email drip sequence for "${activeSequence.name}". For each step, provide: subject line and email body. Use {name}, {business_name}, {industry} as variables. Keep emails under 100 words each. Make them conversational and personal. No markdown.`,
          agent_name: "Content Agent",
        }),
      });
      const data = await res.json();
      if (data.result) {
        toast.success("AI generated sequence content!");
      }
    } catch { toast.error("Failed"); }
    setGenerating(false);
  }

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header mb-0 flex items-center gap-2">
            <Mail size={18} className="text-gold" /> Email Sequences
          </h1>
          <p className="text-xs text-muted mt-0.5">Drip campaigns that nurture leads on autopilot</p>
        </div>
      </div>

      {!activeSequence ? (
        <div className="space-y-4">
          {/* Templates */}
          <div className="card">
            <h2 className="section-header">Start from a template</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {TEMPLATES.map((t, i) => (
                <button key={i} onClick={() => createFromTemplate(t)}
                  className="text-left p-4 rounded-xl transition-all hover:border-gold/15"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <p className="text-sm font-bold mb-1">{t.name}</p>
                  <p className="text-[10px] text-muted">{t.steps.length} steps · {t.steps.filter(s => s.type === "email").length} emails, {t.steps.filter(s => s.type === "sms").length} SMS</p>
                  <div className="flex gap-1 mt-2">
                    {t.steps.map((s, j) => (
                      <div key={j} className={`w-2 h-2 rounded-full ${
                        s.type === "email" ? "bg-blue-400" : s.type === "sms" ? "bg-green-400" : "bg-gray-500"
                      }`} />
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Existing sequences */}
          {sequences.length > 0 && (
            <div className="card">
              <h2 className="section-header">Your Sequences</h2>
              <div className="space-y-2">
                {sequences.map(seq => (
                  <div key={seq.id} className="flex items-center justify-between p-3 rounded-lg"
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${seq.active ? "bg-success animate-pulse" : "bg-muted"}`} />
                      <div>
                        <p className="text-xs font-semibold">{seq.name}</p>
                        <p className="text-[10px] text-muted">{seq.steps.length} steps · {seq.active ? "Active" : "Draft"}</p>
                      </div>
                    </div>
                    <button onClick={() => setActiveSequence(seq)} className="btn-secondary text-[9px] py-1 px-2">Edit</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <button onClick={() => setActiveSequence(null)} className="btn-ghost text-xs">Back</button>
            <div className="flex gap-2">
              <button onClick={generateWithAI} disabled={generating} className="btn-secondary text-xs flex items-center gap-1.5">
                {generating ? <Loader size={12} className="animate-spin" /> : <Sparkles size={12} />}
                AI Rewrite
              </button>
              <button onClick={() => {
                const updated = { ...activeSequence, active: !activeSequence.active };
                setActiveSequence(updated);
                setSequences(prev => prev.map(s => s.id === updated.id ? updated : s));
                toast.success(updated.active ? "Sequence activated!" : "Sequence paused");
              }} className={`text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium ${
                activeSequence.active ? "bg-danger/10 text-danger border border-danger/20" : "btn-primary"
              }`}>
                {activeSequence.active ? <><Pause size={12} /> Pause</> : <><Play size={12} /> Activate</>}
              </button>
            </div>
          </div>

          {/* Sequence steps */}
          <div className="space-y-2">
            {activeSequence.steps.map((step, i) => (
              <div key={step.id}>
                <div className="p-4 rounded-xl" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${
                  step.type === "email" ? "rgba(59,130,246,0.1)" : step.type === "sms" ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.04)"
                }` }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        step.type === "email" ? "bg-blue-500/10 text-blue-400" :
                        step.type === "sms" ? "bg-emerald-500/10 text-emerald-400" :
                        "bg-gray-500/10 text-gray-400"
                      }`}>
                        {step.type === "wait" ? `Wait ${step.delay_days} days` : step.type}
                      </span>
                      <span className="text-[9px] text-muted">Step {i + 1}</span>
                    </div>
                    <button onClick={() => removeStep(step.id)} className="text-muted hover:text-danger p-1"><Trash2 size={12} /></button>
                  </div>

                  {step.type === "wait" ? (
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-muted" />
                      <input type="number" min={1} max={30} value={step.delay_days}
                        onChange={e => {
                          const steps = [...activeSequence.steps];
                          steps[i] = { ...steps[i], delay_days: parseInt(e.target.value) || 1 };
                          const updated = { ...activeSequence, steps };
                          setActiveSequence(updated);
                          setSequences(prev => prev.map(s => s.id === updated.id ? updated : s));
                        }}
                        className="input w-16 text-xs text-center" />
                      <span className="text-xs text-muted">days</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {step.type === "email" && (
                        <input value={step.subject || ""} onChange={e => {
                          const steps = [...activeSequence.steps];
                          steps[i] = { ...steps[i], subject: e.target.value };
                          const updated = { ...activeSequence, steps };
                          setActiveSequence(updated);
                          setSequences(prev => prev.map(s => s.id === updated.id ? updated : s));
                        }} className="input w-full text-xs" placeholder="Subject line..." />
                      )}
                      <textarea value={step.body} onChange={e => {
                        const steps = [...activeSequence.steps];
                        steps[i] = { ...steps[i], body: e.target.value };
                        const updated = { ...activeSequence, steps };
                        setActiveSequence(updated);
                        setSequences(prev => prev.map(s => s.id === updated.id ? updated : s));
                      }} className="input w-full text-xs h-24 resize-none" placeholder="Message body..." />
                    </div>
                  )}
                </div>

                {i < activeSequence.steps.length - 1 && (
                  <div className="flex justify-center py-1">
                    <ArrowDown size={14} className="text-muted/30" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add step */}
          <div className="flex gap-2 justify-center pt-2">
            <button onClick={() => addStep("email")} className="btn-secondary text-[10px] flex items-center gap-1">
              <Plus size={10} /> Email
            </button>
            <button onClick={() => addStep("sms")} className="btn-secondary text-[10px] flex items-center gap-1">
              <Plus size={10} /> SMS
            </button>
            <button onClick={() => addStep("wait")} className="btn-secondary text-[10px] flex items-center gap-1">
              <Plus size={10} /> Wait
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
