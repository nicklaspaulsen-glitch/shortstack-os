"use client";

import { useEffect, useState } from "react";
import {
  Send,
  MailPlus,
  Sparkles,
  Play,
  Eye,
  AlertTriangle,
  Loader2,
  CheckCircle,
  Clock,
} from "lucide-react";
import PageHero from "@/components/ui/page-hero";

type Depth = "shallow" | "medium" | "deep";

interface JobRow {
  id: string;
  name: string;
  recipients_count: number;
  template_seed: string;
  research_depth: Depth;
  status:
    | "pending"
    | "researching"
    | "generating"
    | "sending"
    | "completed"
    | "failed";
  generated_count: number;
  sent_count: number;
  failed_count: number;
  cost_usd: number;
  throttle_per_hour: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface PreviewSample {
  personalization_id: string;
  lead_id: string | null;
  subject: string;
  opener: string;
  body: string;
  cost_usd: number;
  error?: string;
}

const DEPTH_COPY: Record<Depth, { label: string; desc: string; cost: string }> = {
  shallow: { label: "Shallow", desc: "Use lead fields only.", cost: "Cheapest" },
  medium: {
    label: "Medium",
    desc: "Lead + homepage meta tags.",
    cost: "Balanced",
  },
  deep: {
    label: "Deep",
    desc: "Lead + homepage + about/services pages.",
    cost: "Most expensive",
  },
};

const STATUS_PILLS: Record<JobRow["status"], string> = {
  pending: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  researching: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  generating: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  sending: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  completed: "bg-green-500/15 text-green-300 border-green-500/30",
  failed: "bg-red-500/15 text-red-300 border-red-500/30",
};

export default function ColdEmailPage() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // create form state
  const [name, setName] = useState("");
  const [templateSeed, setTemplateSeed] = useState(
    "Hey {{first_name}}, I noticed {{personal_hook}}. We help {{industry}} teams turn leads into booked calls without burning out their SDRs. Worth a quick chat?",
  );
  const [depth, setDepth] = useState<Depth>("medium");
  const [throttle, setThrottle] = useState(100);
  const [statusFilter, setStatusFilter] = useState("new");
  const [creating, setCreating] = useState(false);

  // preview state
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [samples, setSamples] = useState<Record<string, PreviewSample[]>>({});

  async function loadJobs() {
    setLoading(true);
    try {
      const res = await fetch("/api/cold-email/jobs");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setJobs(json.jobs ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadJobs();
    const id = setInterval(loadJobs, 15_000);
    return () => clearInterval(id);
  }, []);

  async function handleCreate() {
    if (!name.trim() || !templateSeed.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/cold-email/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          template_seed: templateSeed.trim(),
          research_depth: depth,
          throttle_per_hour: throttle,
          status_filter: statusFilter,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Create failed");
      setShowCreate(false);
      setName("");
      await loadJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  async function handleStart(id: string) {
    try {
      const res = await fetch(`/api/cold-email/jobs/${id}/start`, { method: "POST" });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Start failed");
      }
      await loadJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Start failed");
    }
  }

  async function handlePreview(id: string) {
    setPreviewing(id);
    try {
      const res = await fetch(`/api/cold-email/jobs/${id}/preview-sample`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Preview failed");
      setSamples((prev) => ({ ...prev, [id]: json.samples ?? [] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setPreviewing(null);
    }
  }

  async function handleSend(id: string) {
    if (!confirm("Begin sending? Personalizations will be emailed in batches per your throttle setting.")) {
      return;
    }
    try {
      const res = await fetch(`/api/cold-email/jobs/${id}/send`, { method: "POST" });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Send failed");
      }
      await loadJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    }
  }

  return (
    <div className="fade-in space-y-5">
      <PageHero
        icon={<MailPlus size={28} />}
        title="AI Cold Email"
        subtitle="Personalized opening lines at scale. Research, generate, and send 1000s a day."
        gradient="sunset"
        actions={
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="text-[11px] px-3 py-1.5 rounded-lg bg-white/15 text-white border border-white/25 hover:bg-white/25 transition-all flex items-center gap-1.5"
          >
            <Sparkles size={11} />
            New Campaign
          </button>
        }
      />

      {error && (
        <div className="card p-3 border-red-500/30 bg-red-500/5 text-[11px] text-red-400 flex items-center gap-2">
          <AlertTriangle size={13} />
          <span>{error}</span>
        </div>
      )}

      {showCreate && (
        <div className="card p-4 space-y-3 border-gold/20 bg-gold/[0.03]">
          <div className="flex items-center gap-2">
            <Sparkles size={13} className="text-gold" />
            <h2 className="text-xs font-semibold text-gold">New Campaign</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">
                Campaign Name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Q2 dental outreach"
                className="input w-full text-xs py-1.5"
              />
            </div>
            <div>
              <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">
                Lead status filter
              </label>
              <input
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                placeholder="new"
                className="input w-full text-xs py-1.5"
              />
              <p className="text-[9px] text-muted mt-0.5">
                We pull all leads with this status that have an email.
              </p>
            </div>
          </div>

          <div>
            <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">
              Template seed
            </label>
            <textarea
              value={templateSeed}
              onChange={(e) => setTemplateSeed(e.target.value)}
              rows={4}
              className="input w-full text-xs py-2 font-mono"
            />
            <p className="text-[9px] text-muted mt-0.5">
              Tokens: <code>{"{{first_name}}"}</code>, <code>{"{{business_name}}"}</code>,{" "}
              <code>{"{{industry}}"}</code>, <code>{"{{location}}"}</code>,{" "}
              <code>{"{{personal_hook}}"}</code> (LLM-generated).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">
                Research depth
              </label>
              <div className="flex gap-1.5">
                {(["shallow", "medium", "deep"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDepth(d)}
                    className={`flex-1 text-[10px] px-2 py-1.5 rounded border transition-all ${
                      depth === d
                        ? "border-gold/40 bg-gold/15 text-gold"
                        : "border-border text-muted hover:text-foreground"
                    }`}
                  >
                    <div className="font-medium">{DEPTH_COPY[d].label}</div>
                    <div className="text-[9px] opacity-70">{DEPTH_COPY[d].cost}</div>
                  </button>
                ))}
              </div>
              <p className="text-[9px] text-muted mt-0.5">{DEPTH_COPY[depth].desc}</p>
            </div>
            <div>
              <label className="text-[9px] text-muted uppercase tracking-wider block mb-1">
                Throttle (per hour)
              </label>
              <input
                type="number"
                value={throttle}
                onChange={(e) => setThrottle(parseInt(e.target.value || "100") || 100)}
                min={1}
                max={5000}
                className="input w-full text-xs py-1.5"
              />
              <p className="text-[9px] text-muted mt-0.5">
                Recommended: 100/hr to protect domain reputation.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setShowCreate(false)}
              className="text-[10px] px-3 py-1.5 rounded-lg border border-border text-muted hover:text-foreground"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !name.trim() || !templateSeed.trim()}
              className="text-[10px] px-4 py-1.5 rounded-lg bg-gold text-black font-medium hover:bg-gold/80 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {creating ? "Building…" : "Create Campaign"}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          <div className="card p-8 text-center text-[11px] text-muted">Loading…</div>
        ) : jobs.length === 0 ? (
          <div className="card p-10 text-center">
            <MailPlus size={22} className="mx-auto mb-2 text-muted opacity-40" />
            <p className="text-[11px] text-muted">
              No campaigns yet. Create one to start cold-email at scale.
            </p>
          </div>
        ) : (
          jobs.map((j) => {
            const progress =
              j.recipients_count > 0
                ? Math.round(
                    ((j.sent_count + j.failed_count + j.generated_count) /
                      (j.recipients_count * 2)) *
                      100,
                  )
                : 0;
            const jobSamples = samples[j.id] ?? [];
            return (
              <div key={j.id} className="card p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold truncate">{j.name}</span>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${STATUS_PILLS[j.status]}`}
                      >
                        {j.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-muted">
                      <span>{j.recipients_count.toLocaleString()} recipients</span>
                      <span>·</span>
                      <span>{DEPTH_COPY[j.research_depth].label} research</span>
                      <span>·</span>
                      <span>{j.throttle_per_hour}/hr</span>
                      <span>·</span>
                      <span>${Number(j.cost_usd).toFixed(4)} spent</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {j.status === "pending" && (
                      <>
                        <button
                          onClick={() => handlePreview(j.id)}
                          disabled={previewing === j.id}
                          className="text-[9px] px-2 py-1 rounded border border-blue-500/25 text-blue-400 hover:bg-blue-500/10 transition-all flex items-center gap-1 disabled:opacity-40"
                        >
                          {previewing === j.id ? (
                            <Loader2 size={9} className="animate-spin" />
                          ) : (
                            <Eye size={9} />
                          )}
                          Preview
                        </button>
                        <button
                          onClick={() => handleStart(j.id)}
                          className="text-[9px] px-2 py-1 rounded border border-green-500/25 text-green-400 hover:bg-green-500/10 transition-all flex items-center gap-1"
                        >
                          <Play size={9} />
                          Start
                        </button>
                      </>
                    )}
                    {(j.status === "researching" || j.status === "generating") && (
                      <button
                        onClick={() => handleSend(j.id)}
                        className="text-[9px] px-2 py-1 rounded border border-gold/30 text-gold hover:bg-gold/10 transition-all flex items-center gap-1"
                      >
                        <Send size={9} />
                        Send
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[9px] text-muted mb-1">
                    <span>
                      Generated {j.generated_count} / {j.recipients_count}
                    </span>
                    <span>
                      Sent {j.sent_count} · Failed {j.failed_count}
                    </span>
                  </div>
                  <div className="h-1.5 bg-black/40 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-gold to-orange-400 transition-all"
                      style={{ width: `${Math.min(100, progress)}%` }}
                    />
                  </div>
                </div>

                {jobSamples.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-border">
                    <p className="text-[9px] text-muted uppercase tracking-wider">
                      Preview samples
                    </p>
                    {jobSamples.map((s) => (
                      <div key={s.personalization_id} className="bg-black/20 rounded-lg p-3 space-y-1.5">
                        {s.error ? (
                          <div className="text-[10px] text-red-400 flex items-center gap-1.5">
                            <AlertTriangle size={10} />
                            {s.error}
                          </div>
                        ) : (
                          <>
                            <div className="text-[10px] text-muted">
                              <span className="text-gold">Subject:</span> {s.subject}
                            </div>
                            <pre className="text-[10px] text-foreground whitespace-pre-wrap font-sans leading-relaxed">
                              {s.body}
                            </pre>
                            <div className="text-[9px] text-muted flex items-center gap-2">
                              <span>${Number(s.cost_usd).toFixed(5)}</span>
                              <span>·</span>
                              <CheckCircle size={9} className="text-green-400" />
                              <span>generated</span>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-3 text-[9px] text-muted pt-1">
                  <span className="flex items-center gap-1">
                    <Clock size={9} />
                    Created {new Date(j.created_at).toISOString().split("T")[0]}
                  </span>
                  {j.completed_at && (
                    <span className="flex items-center gap-1">
                      <CheckCircle size={9} className="text-green-400" />
                      Completed {new Date(j.completed_at).toISOString().split("T")[0]}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
