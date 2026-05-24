"use client";

import { CheckCircle, CircleNotch, Clock, EnvelopeSimple, Eye, PaperPlaneTilt, Play, Sparkle, TrendUp, Warning, X } from "@phosphor-icons/react";

import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import AITopicSuggest from "@/components/ui/ai-topic-suggest";
import { PrismPanel, PRISM_RAINBOW_GRADIENT } from "@/components/prism";
import { MotionPage } from "@/components/motion/motion-page";

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
  pending: "bg-white/8 text-text-muted border-white/15",
  researching: "bg-[rgba(212,255,0,0.08)] text-brand-accent border-[rgba(212,255,0,0.25)]",
  generating: "bg-[rgba(212,255,0,0.08)] text-brand-accent border-[rgba(212,255,0,0.25)]",
  sending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  completed: "bg-green-500/15 text-green-400 border-green-500/30",
  failed: "bg-red-500/15 text-red-400 border-red-500/30",
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
        throw new Error(json.error ?? "PaperPlaneTilt failed");
      }
      await loadJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "PaperPlaneTilt failed");
    }
  }

  /* --------- TEMPLATE SEED QUALITY SCORER --------- */
  type SeedSignal = { id: string; label: string; tip: string; pass: boolean };

  const seedQualitySignals = useMemo((): SeedSignal[] => {
    const raw = templateSeed.trim();
    if (!raw) return [];
    const hasToken = /\{\{[^}]+\}\}/.test(raw);
    const hasValueProp = /\b(help|improve|grow|save|increase|results?|clients?|customers?|close|book|schedule|turn|without|faster|easier)\b/i.test(raw);
    const ctaRe = /\b(worth|quick chat|call|book|schedule|reply|interested|open to|thoughts?|connect|let me know|free|available)\b/i;
    const hasCta = ctaRe.test(raw);
    const wordCount = raw.split(/\s+/).filter(Boolean).length;
    const isConcise = wordCount >= 10 && wordCount <= 80;
    const spamRe = /\b(FREE|WINNER|PRIZE|ACT NOW|LIMITED TIME|GUARANTEED|URGENT|CLICK HERE|BEST PRICE|LOWEST RATE)\b/;
    const noSpam = !spamRe.test(raw);
    return [
      { id: "token",  label: "Tokens",      tip: "Include {{first_name}} or {{personal_hook}} — personalisation doubles reply rates",  pass: hasToken },
      { id: "value",  label: "Value first", tip: "Lead with what you help with ('we help X achieve Y') before any ask",                pass: hasValueProp },
      { id: "cta",    label: "Soft CTA",    tip: "End with a low-friction ask ('worth a quick chat?', 'open to connecting?')",          pass: hasCta },
      { id: "length", label: "Concise",     tip: "Keep the seed 10–80 words — short templates generate more natural-sounding copy",     pass: isConcise },
      { id: "nospam", label: "No spam",     tip: "Avoid ALL-CAPS phrases like 'LIMITED TIME' — spam filters catch them in generated mail", pass: noSpam },
    ];
  }, [templateSeed]);

  const seedQualityScore = useMemo(() => {
    if (!seedQualitySignals.length) return 0;
    const passing = seedQualitySignals.filter((s) => s.pass).length;
    return Math.round((passing / seedQualitySignals.length) * 100);
  }, [seedQualitySignals]);

  return (
    <MotionPage className="space-y-5">{/* -- AI Cold Email command strip -- */}
    <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-[0.2em] text-text-muted font-editorial italic mb-1">Cold Email</p>
        <h1 className="text-2xl font-display font-bold text-text-primary">AI Cold Email</h1>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <button
                    onClick={() => setShowCreate((v) => !v)}
                    className="text-[11px] px-3 py-1.5 rounded-lg bg-white/10 text-text-primary border border-white/20 hover:bg-white/15 transition-all flex items-center gap-1.5"
                  >
                    <Sparkle size={11} />
                    New Campaign
                  </button>
                </motion.div>
      </div>
    </div>{error && (
              <PrismPanel padding="px-3 py-3" className="border-red-500/30 bg-red-500/5 text-[11px] text-red-400 flex items-center gap-2">
                <Warning size={13} />
                <span>{error}</span>
              </PrismPanel>
            )}{showCreate && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22 }}
                className="glass rounded-xl p-4 space-y-3"
                style={{ borderColor: "rgba(212,255,0,0.12)" }}
              >
                <div className="flex items-center gap-2">
                  <Sparkle size={13} className="text-brand-accent" />
                  <h2 className="text-xs font-semibold text-brand-accent">New Campaign</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] text-text-muted uppercase tracking-wider block mb-1">
                      Campaign Name
                    </label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Q2 dental outreach"
                      className="glass rounded-lg w-full text-xs py-1.5 px-2 bg-transparent border border-border-subtle text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-accent"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-text-muted uppercase tracking-wider block mb-1">
                      Lead status filter
                    </label>
                    <input
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      placeholder="new"
                      className="glass rounded-lg w-full text-xs py-1.5 px-2 bg-transparent border border-border-subtle text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-accent"
                    />
                    <p className="text-[9px] text-text-muted mt-0.5">
                      We pull all leads with this status that have an email.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] text-text-muted uppercase tracking-wider block mb-1">
                    Template seed
                  </label>
                  <textarea
                    value={templateSeed}
                    onChange={(e) => setTemplateSeed(e.target.value)}
                    rows={4}
                    className="glass rounded-lg w-full text-xs py-2 px-2 bg-transparent border border-border-subtle text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-accent font-mono"
                  />
                  <p className="text-[9px] text-text-muted mt-0.5">
                    Tokens: <code>{"{{first_name}}"}</code>, <code>{"{{business_name}}"}</code>,{" "}
                    <code>{"{{industry}}"}</code>, <code>{"{{location}}"}</code>,{" "}
                    <code>{"{{personal_hook}}"}</code> (LLM-generated).
                  </p>
                  {/* AI auto-suggest cold-email angles tailored to user's niche +
                      recent campaigns. Click a pill to use as the template seed. */}
                  <AITopicSuggest
                    surface="cold_email"
                    onSelect={picked => setTemplateSeed(picked)}
                    max={5}
                  />
                </div>

                {/* Template Seed Quality Scorer */}
                {seedQualitySignals.length > 0 && (
                  <div
                    className="rounded-lg p-2.5"
                    style={{ background: "rgba(19,24,39,0.60)", border: "1px solid rgba(212,255,0,0.12)" }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <TrendUp size={11} className="text-brand-accent" />
                        <span className="text-[11px] font-semibold text-text-primary">Seed Quality</span>
                      </div>
                      <div
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tabular-nums"
                        style={{
                          background:
                            seedQualityScore >= 80
                              ? "rgba(34,197,94,0.12)"
                              : seedQualityScore >= 50
                              ? "rgba(245,158,11,0.12)"
                              : "rgba(239,68,68,0.12)",
                          color:
                            seedQualityScore >= 80
                              ? "#4ade80"
                              : seedQualityScore >= 50
                              ? "#fbbf24"
                              : "#f87171",
                        }}
                      >
                        {seedQualityScore}
                        <span className="font-normal opacity-60 ml-0.5">/ 100</span>
                      </div>
                    </div>
                    <div
                      className="w-full rounded-full overflow-hidden mb-2"
                      style={{ height: "1.5px", background: "rgba(212, 255, 0,0.10)" }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${seedQualityScore}%`,
                          background:
                            seedQualityScore >= 80
                              ? "linear-gradient(90deg,#22c55e,#4ade80)"
                              : seedQualityScore >= 50
                              ? "linear-gradient(90deg,#f59e0b,#fbbf24)"
                              : "linear-gradient(90deg,#ef4444,#f87171)",
                        }}
                      />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {seedQualitySignals.map((sig) => (
                        <div
                          key={sig.id}
                          title={sig.tip}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium cursor-default border ${
                            sig.pass
                              ? "bg-[rgba(34,197,94,0.10)] border-[rgba(34,197,94,0.25)] text-green-400"
                              : "bg-elevated border-border-subtle/30 text-text-muted"
                          }`}
                        >
                          <span className="text-[8px]">{sig.pass ? "✓" : "–"}</span>
                          {sig.label}
                        </div>
                      ))}
                    </div>
                    {(() => {
                      const firstFail = seedQualitySignals.find((s) => !s.pass);
                      return firstFail ? (
                        <p className="mt-2 text-[10px] text-text-muted leading-relaxed">
                          <span className="font-medium text-text-secondary">Tip: </span>
                          {firstFail.tip}
                        </p>
                      ) : (
                        <p className="mt-2 text-[10px] text-green-400">
                          Strong seed — the AI has everything it needs to write high-converting emails.
                        </p>
                      );
                    })()}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] text-text-muted uppercase tracking-wider block mb-1">
                      Research depth
                    </label>
                    <div className="flex gap-1.5">
                      {(["shallow", "medium", "deep"] as const).map((d) => (
                        <button
                          key={d}
                          onClick={() => setDepth(d)}
                          className={`flex-1 text-[10px] px-2 py-1.5 rounded border transition-all ${
                            depth === d
                              ? "border-[rgba(212,255,0,0.25)] bg-[rgba(212,255,0,0.10)] text-brand-accent"
                              : "border-border-subtle text-text-muted hover:text-text-primary"
                          }`}
                        >
                          <div className="font-medium">{DEPTH_COPY[d].label}</div>
                          <div className="text-[9px] opacity-70">{DEPTH_COPY[d].cost}</div>
                        </button>
                      ))}
                    </div>
                    <p className="text-[9px] text-text-muted mt-0.5">{DEPTH_COPY[depth].desc}</p>
                  </div>
                  <div>
                    <label className="text-[9px] text-text-muted uppercase tracking-wider block mb-1">
                      Throttle (per hour)
                    </label>
                    <input
                      type="number"
                      value={throttle}
                      onChange={(e) => setThrottle(parseInt(e.target.value || "100") || 100)}
                      min={1}
                      max={5000}
                      className="glass rounded-lg w-full text-xs py-1.5 px-2 bg-transparent border border-border-subtle text-text-primary focus:outline-none focus:border-brand-accent"
                    />
                    <p className="text-[9px] text-text-muted mt-0.5">
                      Recommended: 100/hr to protect domain reputation.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => setShowCreate(false)}
                    className="text-[10px] px-3 py-1.5 rounded-lg border border-border-subtle text-text-muted hover:text-text-primary"
                  >
                    Cancel
                  </button>
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <button
                      onClick={handleCreate}
                      disabled={creating || !name.trim() || !templateSeed.trim()}
                      className="text-[10px] px-4 py-1.5 rounded-full bg-brand-accent text-[#020711] font-medium hover:bg-brand-accent/80 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      {creating ? "Building�" : "Create Campaign"}
                    </button>
                  </motion.div>
                </div>
              </motion.div>
            )}<PrismPanel rainbow padding="p-0" className="overflow-hidden space-y-0">
              {loading ? (
                <div className="p-8 text-center text-[11px] text-text-muted">Loading�</div>
              ) : jobs.length === 0 ? (
                <div className="p-10 text-center">
                  <EnvelopeSimple size={22} className="mx-auto mb-2 text-text-muted opacity-40" />
                  <p className="text-[11px] text-text-muted">
                    No campaigns yet. Create one to start cold-email at scale.
                  </p>
                </div>
              ) : (
                jobs.map((j, index) => {
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
                    <motion.div
                      key={j.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.18, delay: index * 0.04 }}
                      whileHover={{ backgroundColor: "rgba(255,255,255,0.06)" }}
                      className="relative p-4 space-y-3 border-b border-white/5 last:border-0"
                    >
                      {/* Rainbow top bar (first item only decorative, per-card via absolute) */}
                      <div
                        className="absolute top-0 left-0 right-0 h-[2px]"
                        style={{ background: PRISM_RAINBOW_GRADIENT, opacity: 0.5 }}
                      />

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
                          <div className="flex items-center gap-3 text-[10px] text-text-muted">
                            <span>{j.recipients_count.toLocaleString()} recipients</span>
                            <span>�</span>
                            <span>{DEPTH_COPY[j.research_depth].label} research</span>
                            <span>�</span>
                            <span>{j.throttle_per_hour}/hr</span>
                            <span>�</span>
                            <span>${Number(j.cost_usd).toFixed(4)} spent</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {j.status === "pending" && (
                            <>
                              <button
                                onClick={() => handlePreview(j.id)}
                                disabled={previewing === j.id}
                                className="text-[9px] px-2 py-1 rounded border border-[rgba(212,255,0,0.25)] text-brand-accent hover:bg-[rgba(212,255,0,0.08)] transition-all flex items-center gap-1 disabled:opacity-40"
                              >
                                {previewing === j.id ? (
                                  <CircleNotch size={9} className="animate-spin" />
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
                              className="text-[9px] px-2 py-1 rounded border border-[rgba(212,255,0,0.25)] text-brand-accent hover:bg-[rgba(212,255,0,0.08)] transition-all flex items-center gap-1"
                            >
                              <PaperPlaneTilt size={9} />
                              PaperPlaneTilt
                            </button>
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-[9px] text-text-muted mb-1">
                          <span>
                            Generated {j.generated_count} / {j.recipients_count}
                          </span>
                          <span>
                            Sent {j.sent_count} � Failed {j.failed_count}
                          </span>
                        </div>
                        <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                          <div
                            className="h-full transition-all"
                            style={{
                              width: `${Math.min(100, progress)}%`,
                              background: PRISM_RAINBOW_GRADIENT,
                            }}
                          />
                        </div>
                      </div>

                      {jobSamples.length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-white/5">
                          <p className="text-[9px] text-text-muted uppercase tracking-wider">
                            Preview samples
                          </p>
                          {jobSamples.map((s) => (
                            <div key={s.personalization_id} className="glass rounded-xl p-3 space-y-1.5">
                              {s.error ? (
                                <div className="text-[10px] text-red-400 flex items-center gap-1.5">
                                  <Warning size={10} />
                                  {s.error}
                                </div>
                              ) : (
                                <>
                                  <div className="text-[10px] text-text-muted">
                                    <span className="text-brand-accent">Subject:</span> {s.subject}
                                  </div>
                                  <pre className="text-[10px] text-text-primary whitespace-pre-wrap font-sans leading-relaxed">
                                    {s.body}
                                  </pre>
                                  <div className="text-[9px] text-text-muted flex items-center gap-2">
                                    <span>${Number(s.cost_usd).toFixed(5)}</span>
                                    <span>�</span>
                                    <CheckCircle size={9} className="text-green-400" />
                                    <span>generated</span>
                                  </div>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-3 text-[9px] text-text-muted pt-1">
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
                    </motion.div>
                  );
                })
              )}
            </PrismPanel></MotionPage>
  );
}



