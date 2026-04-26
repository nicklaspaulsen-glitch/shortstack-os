"use client";

/**
 * AI Workflow Hero — prominent natural-language workflow generator that
 * sits at the top of /dashboard/workflows. The user describes a goal in
 * plain English ("notify me on Telegram when a new lead replies and stage
 * the deal as 'hot' in CRM"), Haiku breaks it into trigger + steps + AI
 * actions, the user previews and saves.
 *
 * Backed by /api/workflows/design (existing). This component is just a
 * better-feeling UI on top of that route — bigger surface, suggested
 * prompts, recent generations, live preview.
 *
 * Designed to look like the OpenAI Playground / Claude.ai composer —
 * single big input is the entry point, everything else is supporting.
 */

import { useState } from "react";
import { Sparkles, Loader, ArrowRight, Lightbulb } from "lucide-react";
import toast from "react-hot-toast";

interface Workflow {
  name: string;
  description: string;
  trigger: string;
  steps: Array<{ id: string; name: string; type: string; config: Record<string, unknown> }>;
}

interface Client {
  id: string;
  business_name: string;
}

const PROMPT_SUGGESTIONS: Array<{ label: string; prompt: string }> = [
  {
    label: "Lead → Telegram + CRM",
    prompt: "When a new lead is captured from any source, send me a Telegram message with their details and add them to the CRM with a 'new' tag.",
  },
  {
    label: "Booked call → confirmation",
    prompt: "When a calendar event is booked, send the client a confirmation email immediately and a SMS reminder 24 hours before.",
  },
  {
    label: "Stripe paid → onboarding",
    prompt: "When a Stripe invoice is paid, kick off the new-client onboarding: send welcome email, create portal account, add to CRM, schedule kickoff call.",
  },
  {
    label: "Contact stale → re-engage",
    prompt: "When a CRM contact has no activity for 30 days, send a personalized re-engagement email and notify the assigned sales rep.",
  },
  {
    label: "Form submit → AI qualify",
    prompt: "When a website form is submitted, use AI to qualify the lead by asking 3 questions, then route hot leads to me on Telegram and cold ones to the nurture sequence.",
  },
  {
    label: "Review request after job",
    prompt: "When a calendar event is marked completed, wait 24 hours then send a review-request email and SMS to the client with a Google review link.",
  },
];

export default function AiWorkflowHero({
  clients,
  onPreview,
}: {
  clients: Client[];
  onPreview: (workflow: Workflow) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  const [generating, setGenerating] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);

  const generate = async (text?: string) => {
    const goal = (text || prompt).trim();
    if (!goal) {
      toast.error("Describe what you want");
      return;
    }
    setGenerating(true);
    try {
      const clientName = clients.find((c) => c.id === selectedClient)?.business_name;
      const res = await fetch("/api/workflows/design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: goal,
          client_id: selectedClient || null,
          client_name: clientName,
        }),
      });
      const data = await res.json();
      if (data.success && data.workflow) {
        toast.success("Workflow designed", { icon: "✨" });
        onPreview(data.workflow);
        setRecent((prev) => [goal, ...prev.filter((p) => p !== goal)].slice(0, 4));
      } else {
        toast.error(data.error || "Failed to design");
      }
    } catch (err) {
      toast.error(`AI design failed: ${(err as Error).message}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <section
      className="relative rounded-2xl p-5 md:p-6 overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, rgba(200,168,85,0.06), rgba(200,168,85,0.02))",
        border: "1px solid rgba(200,168,85,0.2)",
      }}
    >
      {/* Ambient gold glow */}
      <div
        className="absolute -top-20 -right-20 w-72 h-72 rounded-full pointer-events-none blur-3xl opacity-40"
        style={{
          background:
            "radial-gradient(circle, rgba(200,168,85,0.18) 0%, transparent 70%)",
        }}
      />

      <div className="relative">
        <div className="flex items-center gap-2.5 mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background:
                "linear-gradient(135deg, rgba(200,168,85,0.18), rgba(200,168,85,0.04))",
              border: "1px solid rgba(200,168,85,0.3)",
            }}
          >
            <Sparkles size={16} style={{ color: "#c8a855" }} />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">
              Describe a workflow. AI builds it.
            </h2>
            <p className="text-[12px] text-muted">
              Plain English in. Trigger + steps + actions out. Edit before saving.
            </p>
          </div>
        </div>

        <div className="mb-3">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={generating}
            rows={3}
            placeholder="e.g. When a new lead replies to outreach, send me a Telegram alert and tag the deal as 'hot' in CRM…"
            className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:border-gold/40 resize-none disabled:opacity-60"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") generate();
            }}
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center mb-4">
          <select
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            disabled={generating}
            className="flex-1 sm:flex-none sm:w-[240px] bg-card border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-gold/40 disabled:opacity-60"
          >
            <option value="">All clients (template)</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                For: {c.business_name}
              </option>
            ))}
          </select>

          <button
            onClick={() => generate()}
            disabled={generating || !prompt.trim()}
            className="flex-1 sm:flex-none px-5 py-2 rounded-lg text-sm font-bold transition disabled:opacity-50 flex items-center justify-center gap-2"
            style={{
              background: "linear-gradient(135deg, #c8a855, #b89840)",
              color: "#0b0d12",
            }}
          >
            {generating ? (
              <>
                <Loader size={14} className="animate-spin" />
                Designing…
              </>
            ) : (
              <>
                <Sparkles size={14} />
                Generate workflow
                <ArrowRight size={14} />
              </>
            )}
          </button>
          <span className="text-[10px] text-muted/70 hidden sm:block">⌘ + Enter</span>
        </div>

        {/* Suggestions */}
        {recent.length === 0 && !generating && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Lightbulb size={11} className="text-amber-300" />
              <p className="text-[10.5px] uppercase tracking-wider text-muted font-semibold">
                Try one of these
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PROMPT_SUGGESTIONS.map((s) => (
                <button
                  key={s.label}
                  onClick={() => {
                    setPrompt(s.prompt);
                  }}
                  className="text-[11px] font-medium px-3 py-1.5 rounded-md transition"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    color: "rgba(255,255,255,0.7)",
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Recent prompts */}
        {recent.length > 0 && (
          <div>
            <p className="text-[10.5px] uppercase tracking-wider text-muted font-semibold mb-2">
              Recent
            </p>
            <div className="flex flex-wrap gap-1.5">
              {recent.map((r, i) => (
                <button
                  key={i}
                  onClick={() => generate(r)}
                  className="text-[11px] font-medium px-3 py-1.5 rounded-md transition truncate max-w-[300px]"
                  style={{
                    background: "rgba(200,168,85,0.06)",
                    border: "1px solid rgba(200,168,85,0.2)",
                    color: "#e2c878",
                  }}
                  title={r}
                >
                  {r.length > 60 ? r.slice(0, 60) + "…" : r}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
