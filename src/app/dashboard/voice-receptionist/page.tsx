"use client";

/**
 * Voice Receptionist — 24/7 AI phone agent that answers, qualifies, and books.
 *
 * Production-wired (Apr 27): the full pipeline is live —
 *   Twilio inbound → /api/twilio/voice-webhook (validates X-Twilio-Signature,
 *     resolves the owning client, upserts voice_calls row, returns TwiML
 *     <Connect><Stream> to ElevenLabs ConvAI when client.eleven_agent_id is set)
 *   → ElevenLabs ConvAI handles the conversation
 *   → /api/twilio/voice-status-callback updates duration + completed status
 *   → /api/webhooks/elevenlabs receives conversation_ended (HMAC-SHA256
 *     verified), updates voice_calls outcome + transcript, logs to trinity_log.
 *
 * UI backs onto:
 *   - /api/usage/current               → plan-tier call_minutes quota bar
 *   - /api/voice-calls                 → authoritative call log (Twilio + ElevenLabs)
 *   - /api/eleven-agents               → list/create ElevenLabs ConvAI agents
 *   - /api/eleven-agents/voices        → pick a voice for the agent
 *   - /api/eleven-agents/calls         → ElevenLabs-side conversation list (fallback)
 *
 * Sections:
 *   1. Overview + stat cards (calls handled / booked / avg duration)
 *   2. Agent setup card — voice pick, greeting, hours, transfer rules
 *   3. Call log table — live from voice_calls; falls back to ElevenLabs API; demo data last
 *   4. Calendar integration panel — link to /dashboard/calendar
 *   5. Quota indicator — call_minutes used/limit this month
 *
 * Demo-data banner only shows when the user hasn't set up ElevenLabs OR
 * hasn't received a call yet. Once a real call lands in voice_calls the
 * banner self-dismisses.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  PhoneCall,
  Phone,
  Mic,
  Calendar as CalendarIcon,
  Clock,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Upload,
  Play,
  Pause,
  ExternalLink,
  FileText,
  UserCheck,
  Ban,
  ArrowRight,
  RefreshCw,
  Save,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/lib/auth-context";
import PageHero from "@/components/ui/page-hero";
import StatCard from "@/components/ui/stat-card";
import EmptyState from "@/components/ui/empty-state";

// ───────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────

type CallOutcome =
  | "booked"
  | "qualified"
  | "unqualified"
  | "spam"
  | "missed"
  | "dropped"
  | "pending"
  | "other";

interface CallRow {
  id: string;
  caller: string;
  startedAt: string;
  durationSec: number;
  outcome: CallOutcome;
  transcriptPreview: string;
  crmLink?: string | null;
}

// Server row from /api/voice-calls
interface VoiceCallRow {
  id: string;
  twilio_call_sid: string | null;
  from_number: string | null;
  to_number: string | null;
  direction: string | null;
  duration_seconds: number | null;
  status: string | null;
  outcome: string | null;
  transcript: string | null;
  recording_url: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string | null;
  client_id: string | null;
}

interface VoiceCallsListResponse {
  ok: boolean;
  calls: VoiceCallRow[];
  total: number;
  stats: {
    handled: number;
    booked: number;
    qualified: number;
    avg_duration_seconds: number;
  };
}

interface ElevenVoice {
  voice_id: string;
  name: string;
  category?: string;
}

interface ElevenAgent {
  agent_id?: string;
  id?: string;
  name?: string;
}

interface ElevenConversation {
  conversation_id?: string;
  agent_id?: string;
  start_time_unix_secs?: number;
  call_duration_secs?: number;
  status?: string;
  transcript_summary?: string;
}

interface PlanUsage {
  plan_tier: string;
  usage: Record<string, number>;
  limits: Record<string, number | "unlimited">;
  remaining: Record<string, number | "unlimited">;
}

interface AgentConfig {
  agentName: string;
  voiceId: string;
  greeting: string;
  hoursStart: string;
  hoursEnd: string;
  transferRule: "always" | "qualified_only" | "never";
  transferNumber: string;
}

const DEFAULT_CONFIG: AgentConfig = {
  agentName: "Front-desk AI",
  voiceId: "",
  greeting:
    "Hi, thanks for calling. I'm the AI receptionist — I can book a call, answer questions, or get a message to the team. How can I help?",
  hoursStart: "00:00",
  hoursEnd: "23:59",
  transferRule: "qualified_only",
  transferNumber: "",
};

const CONFIG_STORAGE_KEY = "voice-receptionist:config:v1";
const DEMO_CALLS_STORAGE_KEY = "voice-receptionist:demo-calls:v1";

// Honest demo data — labelled clearly as demo in the UI so it can't be
// mistaken for real customer calls.
const DEMO_CALLS: CallRow[] = [
  {
    id: "demo-1",
    caller: "+1 (415) 555-0148",
    startedAt: new Date(Date.now() - 1000 * 60 * 22).toISOString(),
    durationSec: 184,
    outcome: "booked",
    transcriptPreview:
      "Caller wanted a demo for their 12-person agency. Walked through pricing, booked Tuesday 2pm…",
    crmLink: null,
  },
  {
    id: "demo-2",
    caller: "+1 (212) 555-0193",
    startedAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    durationSec: 62,
    outcome: "qualified",
    transcriptPreview:
      "Real estate broker in NYC, ~40 listings. Asked for callback from sales with pricing details.",
    crmLink: null,
  },
  {
    id: "demo-3",
    caller: "+1 (800) 555-0121",
    startedAt: new Date(Date.now() - 1000 * 60 * 60 * 7).toISOString(),
    durationSec: 11,
    outcome: "spam",
    transcriptPreview: "Robocall offering solar panels. Auto-screened and dropped.",
    crmLink: null,
  },
  {
    id: "demo-4",
    caller: "+1 (646) 555-0102",
    startedAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
    durationSec: 241,
    outcome: "booked",
    transcriptPreview:
      "Existing client wanted to reschedule Thursday onboarding. Moved to Friday 10am and confirmed.",
    crmLink: null,
  },
];

// ───────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────

function fmtDuration(sec: number): string {
  if (!sec || sec < 1) return "0s";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  if (m === 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function fmtDurationAvg(sec: number): string {
  if (!sec || sec < 1) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function outcomeMeta(outcome: CallOutcome): {
  label: string;
  className: string;
  icon: typeof CheckCircle2;
} {
  switch (outcome) {
    case "booked":
      return {
        label: "Booked",
        className: "bg-emerald-500/15 text-emerald-300",
        icon: CalendarIcon,
      };
    case "qualified":
      return {
        label: "Qualified",
        className: "bg-sky-500/15 text-sky-300",
        icon: UserCheck,
      };
    case "unqualified":
      return {
        label: "Unqualified",
        className: "bg-slate-500/15 text-slate-300",
        icon: PhoneCall,
      };
    case "spam":
      return {
        label: "Spam",
        className: "bg-rose-500/15 text-rose-300",
        icon: Ban,
      };
    case "missed":
      return {
        label: "Missed",
        className: "bg-amber-500/15 text-amber-300",
        icon: AlertCircle,
      };
    case "dropped":
      return {
        label: "Dropped",
        className: "bg-amber-500/15 text-amber-300",
        icon: AlertCircle,
      };
    case "pending":
      return {
        label: "Pending",
        className: "bg-muted/20 text-muted",
        icon: Clock,
      };
    default:
      return {
        label: "Other",
        className: "bg-muted/20 text-muted",
        icon: PhoneCall,
      };
  }
}

// Real voice_calls row → UI CallRow
function voiceCallToCallRow(v: VoiceCallRow): CallRow {
  const outcomeRaw = (v.outcome || "pending") as string;
  const valid: CallOutcome[] = [
    "booked",
    "qualified",
    "unqualified",
    "spam",
    "missed",
    "dropped",
    "pending",
    "other",
  ];
  const outcome = (valid as string[]).includes(outcomeRaw)
    ? (outcomeRaw as CallOutcome)
    : "other";
  const transcript = (v.transcript || "").trim();
  return {
    id: v.id,
    caller: v.from_number || "Unknown caller",
    startedAt: v.started_at || v.created_at || new Date().toISOString(),
    durationSec: v.duration_seconds || 0,
    outcome,
    transcriptPreview:
      transcript.length > 0
        ? transcript.slice(0, 280) + (transcript.length > 280 ? "…" : "")
        : v.recording_url
          ? "Recording available — transcript still processing."
          : v.status === "completed"
            ? "No transcript captured for this call."
            : "Call in progress…",
    crmLink: v.client_id ? `/dashboard/clients/${v.client_id}` : null,
  };
}

/**
 * Normalise an ElevenLabs conversation object to the UI's CallRow shape.
 * The ElevenLabs schema here is best-effort — the exposed /convai/conversations
 * response shape isn't strongly documented, so we fall back gracefully.
 */
function convoToCallRow(c: ElevenConversation, idx: number): CallRow {
  const startIso =
    c.start_time_unix_secs && c.start_time_unix_secs > 0
      ? new Date(c.start_time_unix_secs * 1000).toISOString()
      : new Date().toISOString();

  // ElevenLabs ConvAI doesn't classify outcomes natively yet — default to
  // "other" until a proper classifier ships. Very short calls look like spam.
  let outcome: CallOutcome = "other";
  if (c.call_duration_secs && c.call_duration_secs < 15) outcome = "spam";
  if (c.status === "in-progress") outcome = "other";

  return {
    id: c.conversation_id || `live-${idx}`,
    caller: "Unknown caller",
    startedAt: startIso,
    durationSec: c.call_duration_secs || 0,
    outcome,
    transcriptPreview:
      c.transcript_summary || "Transcript summary unavailable — open in ElevenLabs.",
    crmLink: null,
  };
}

// ───────────────────────────────────────────────────────────────────
// Page
// ───────────────────────────────────────────────────────────────────

export default function VoiceReceptionistPage() {
  useAuth();

  // ── State ────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [planUsage, setPlanUsage] = useState<PlanUsage | null>(null);
  const [voices, setVoices] = useState<ElevenVoice[]>([]);
  const [agents, setAgents] = useState<ElevenAgent[]>([]);
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [liveBackend, setLiveBackend] = useState(false);
  const [usingRealCalls, setUsingRealCalls] = useState(false);
  const [serverStats, setServerStats] = useState<
    VoiceCallsListResponse["stats"] | null
  >(null);
  const [config, setConfig] = useState<AgentConfig>(DEFAULT_CONFIG);
  const [savingConfig, setSavingConfig] = useState(false);
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [backendNote, setBackendNote] = useState<string | null>(null);

  // ── Load config from localStorage on mount ───────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<AgentConfig>;
        setConfig((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      /* ignore — fall back to defaults */
    }
  }, []);

  // ── Load everything from the server ──────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    const errors: string[] = [];

    // 1. Plan usage (authoritative, always available once authed)
    try {
      const res = await fetch("/api/usage/current", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as PlanUsage;
        setPlanUsage(data);
      } else {
        errors.push("usage");
      }
    } catch {
      errors.push("usage");
    }

    // 2. Voices — requires ELEVENLABS_API_KEY on the server
    let backendLive = false;
    try {
      const res = await fetch("/api/eleven-agents/voices", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.voices) && data.voices.length > 0) {
          setVoices(data.voices);
          backendLive = true;
        } else if (data.message) {
          setBackendNote(data.message);
        }
      }
    } catch {
      /* no-op */
    }

    // 3. Agents
    try {
      const res = await fetch("/api/eleven-agents", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.agents)) setAgents(data.agents);
      }
    } catch {
      /* no-op */
    }

    // 4. Call log — prefer the authoritative voice_calls table (real Twilio
    //    events + Haiku-classified outcomes). Fall back to ElevenLabs
    //    conversations list, then to demo data.
    let gotRealRows = false;
    try {
      const res = await fetch("/api/voice-calls?limit=50", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as VoiceCallsListResponse;
        if (Array.isArray(data.calls) && data.calls.length > 0) {
          setCalls(data.calls.map(voiceCallToCallRow));
          setServerStats(data.stats || null);
          backendLive = true;
          gotRealRows = true;
        } else if (data.stats) {
          setServerStats(data.stats);
        }
      }
    } catch {
      /* fall through */
    }
    setUsingRealCalls(gotRealRows);

    if (!gotRealRows) {
      // No voice_calls rows yet — try the ElevenLabs fallback (matches
      // previous behaviour), then demo data.
      let gotFromEleven = false;
      try {
        const res = await fetch("/api/eleven-agents/calls", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          const convos = Array.isArray(data.conversations)
            ? (data.conversations as ElevenConversation[])
            : [];
          if (convos.length > 0) {
            setCalls(convos.map(convoToCallRow));
            backendLive = true;
            gotFromEleven = true;
          }
        }
      } catch {
        /* fall through to demo */
      }
      if (!gotFromEleven) loadDemoCalls();
    }

    setLiveBackend(backendLive);
    setLoading(false);
    if (errors.length > 0) {
      console.warn("[voice-receptionist] load errors:", errors);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  function loadDemoCalls() {
    try {
      const raw = localStorage.getItem(DEMO_CALLS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CallRow[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCalls(parsed);
          return;
        }
      }
    } catch {
      /* ignore */
    }
    setCalls(DEMO_CALLS);
    try {
      localStorage.setItem(DEMO_CALLS_STORAGE_KEY, JSON.stringify(DEMO_CALLS));
    } catch {
      /* ignore */
    }
  }

  // ── Save config ──────────────────────────────────────────────────
  function saveConfig() {
    setSavingConfig(true);
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
      toast.success("Receptionist settings saved");
    } catch {
      toast.error("Could not save settings");
    } finally {
      setTimeout(() => setSavingConfig(false), 400);
    }
  }

  // ── Create agent (uses existing /api/eleven-agents POST) ─────────
  async function createAgent() {
    if (!config.agentName.trim()) {
      toast.error("Give your receptionist a name first");
      return;
    }
    setCreatingAgent(true);
    const tid = toast.loading("Creating agent on ElevenLabs…");
    try {
      const res = await fetch("/api/eleven-agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: config.agentName,
          firstMessage: config.greeting,
          systemPrompt: buildSystemPrompt(config),
          voiceId: config.voiceId || undefined,
          maxDuration: 600,
        }),
      });
      const data = await res.json();
      toast.dismiss(tid);
      if (!res.ok || data.error) {
        toast.error(data.error || "Agent creation failed");
        return;
      }
      toast.success("Agent created");
      loadAll();
    } catch (err) {
      toast.dismiss(tid);
      toast.error(err instanceof Error ? err.message : "Agent creation failed");
    } finally {
      setCreatingAgent(false);
    }
  }

  // ── Derived stats ────────────────────────────────────────────────
  // Prefer authoritative server stats (over the entire voice_calls history,
  // not just the current page). Fall back to computing from state for demo /
  // ElevenLabs-only modes.
  const stats = useMemo(() => {
    if (usingRealCalls && serverStats) {
      return {
        handled: serverStats.handled,
        booked: serverStats.booked,
        avgDuration: serverStats.avg_duration_seconds,
      };
    }
    if (calls.length === 0) {
      return { handled: 0, booked: 0, avgDuration: 0 };
    }
    const handled = calls.length;
    const booked = calls.filter((c) => c.outcome === "booked").length;
    const totalDuration = calls.reduce((sum, c) => sum + c.durationSec, 0);
    const avgDuration =
      totalDuration > 0 ? Math.round(totalDuration / calls.length) : 0;
    return { handled, booked, avgDuration };
  }, [calls, usingRealCalls, serverStats]);

  // ── Call-minutes quota pulled from /api/usage/current ────────────
  const callQuota = useMemo(() => {
    if (!planUsage) return null;
    const used = planUsage.usage["call_minutes"] || 0;
    const limit = planUsage.limits["call_minutes"];
    const isUnlimited = limit === "unlimited";
    const limitNum = typeof limit === "number" ? limit : 0;
    const pct =
      isUnlimited || limitNum === 0
        ? 0
        : Math.min(100, (used / limitNum) * 100);
    return { used, limit, isUnlimited, limitNum, pct };
  }, [planUsage]);

  const hasAgent = agents.length > 0;

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageHero
        title="AI Voice Receptionist"
        subtitle="Your 24/7 AI receptionist — never miss a call again. Answers every ring, books qualified leads directly to your calendar, screens spam."
        icon={<PhoneCall size={20} />}
        gradient="purple"
        eyebrow="Beta"
      />

      <div className="mx-auto max-w-6xl space-y-6 px-6 pb-10 pt-6">
        {/* Beta honesty banner — shown until the first real call lands in
            voice_calls. Agent setup + Twilio webhook + Haiku classifier are
            all live; the banner just explains why the log is still empty on
            first run. */}
        {!usingRealCalls && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <AlertCircle size={18} className="mt-0.5 shrink-0 text-amber-400" />
            <div className="text-[12px] leading-relaxed">
              <p className="font-semibold text-amber-300">
                {liveBackend
                  ? "No real calls yet — showing sample data"
                  : "Connect ElevenLabs + a Twilio number to start tracking real calls"}
              </p>
              <p className="mt-1 text-muted">
                The pipeline is fully wired — Twilio voice-webhook,
                ElevenLabs ConvAI bridge, status callback, and the
                conversation-ended webhook all log straight into your{" "}
                <code className="rounded bg-black/40 px-1 py-0.5 text-[10.5px]">
                  voice_calls
                </code>{" "}
                table. Once your receptionist picks up its first inbound call,
                it&apos;ll replace the sample rows below with the
                AI-classified outcome (booked / qualified / unqualified /
                spam), caller number, duration, and transcript.
                {backendNote && (
                  <span className="mt-1 block text-[11px] text-muted/80">
                    ({backendNote})
                  </span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* ── 1. Overview + stat cards ──────────────────────────────── */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">This month</h2>
              <p className="text-[11px] text-muted">
                Activity across every number pointed at your receptionist agent.
              </p>
            </div>
            <button
              onClick={loadAll}
              className="inline-flex items-center gap-1.5 rounded-lg bg-surface-light/80 px-3 py-2 text-[11px] font-medium text-muted hover:bg-surface-light hover:text-foreground"
            >
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              label="Calls handled"
              value={stats.handled}
              icon={<PhoneCall size={14} />}
            />
            <StatCard
              label="Booked to calendar"
              value={stats.booked}
              icon={<CalendarIcon size={14} />}
            />
            <StatCard
              label="Avg call duration"
              value={fmtDurationAvg(stats.avgDuration)}
              icon={<Clock size={14} />}
            />
          </div>
        </section>

        {/* ── 2. Agent setup card ───────────────────────────────────── */}
        <section className="card !p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/15 text-purple-300">
                <Mic size={14} />
              </div>
              <div>
                <h2 className="text-sm font-semibold">Agent setup</h2>
                <p className="text-[10px] text-muted">
                  Voice, greeting, hours, transfer rules. Powers every call the agent takes.
                </p>
              </div>
            </div>
            {hasAgent && (
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                {agents.length} agent{agents.length === 1 ? "" : "s"} live
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {/* Left column: identity + voice */}
            <div className="space-y-4">
              <Field label="Receptionist name">
                <input
                  type="text"
                  value={config.agentName}
                  onChange={(e) =>
                    setConfig({ ...config, agentName: e.target.value })
                  }
                  placeholder="Front-desk AI"
                  className="w-full rounded-lg border border-border/50 bg-surface-light/40 px-3 py-2 text-[13px] placeholder:text-muted/60"
                />
              </Field>

              <Field
                label="Voice"
                hint={
                  voices.length === 0
                    ? "Voice list loads from ElevenLabs once the API key is set."
                    : undefined
                }
              >
                <select
                  value={config.voiceId}
                  onChange={(e) =>
                    setConfig({ ...config, voiceId: e.target.value })
                  }
                  disabled={voices.length === 0}
                  className="w-full rounded-lg border border-border/50 bg-surface-light/40 px-3 py-2 text-[13px] disabled:opacity-50"
                >
                  <option value="">Default (Rachel)</option>
                  {voices.map((v) => (
                    <option key={v.voice_id} value={v.voice_id}>
                      {v.name}
                      {v.category ? ` · ${v.category}` : ""}
                    </option>
                  ))}
                </select>
              </Field>

              {/* Voice-clone upload — honest about not being wired */}
              <div className="rounded-lg border border-dashed border-border/50 bg-surface-light/20 p-4">
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-[12px] font-semibold">Upload voice sample</p>
                  <span className="rounded-full bg-muted/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted">
                    Coming soon
                  </span>
                </div>
                <p className="text-[11px] text-muted">
                  Drop a 30-second recording to clone your best salesperson into ElevenLabs.
                  Shipping next — for now, pick from the stock voice list above.
                </p>
                <button
                  disabled
                  className="mt-3 inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg bg-surface-light/60 px-3 py-1.5 text-[11px] font-medium text-muted opacity-60"
                >
                  <Upload size={11} /> Upload sample (.mp3 / .wav)
                </button>
              </div>
            </div>

            {/* Right column: greeting + hours + transfer */}
            <div className="space-y-4">
              <Field label="Greeting script">
                <textarea
                  value={config.greeting}
                  onChange={(e) =>
                    setConfig({ ...config, greeting: e.target.value })
                  }
                  rows={4}
                  placeholder="Hi, thanks for calling…"
                  className="w-full resize-none rounded-lg border border-border/50 bg-surface-light/40 px-3 py-2 text-[13px] leading-relaxed placeholder:text-muted/60"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Hours start">
                  <input
                    type="time"
                    value={config.hoursStart}
                    onChange={(e) =>
                      setConfig({ ...config, hoursStart: e.target.value })
                    }
                    className="w-full rounded-lg border border-border/50 bg-surface-light/40 px-3 py-2 text-[13px]"
                  />
                </Field>
                <Field label="Hours end">
                  <input
                    type="time"
                    value={config.hoursEnd}
                    onChange={(e) =>
                      setConfig({ ...config, hoursEnd: e.target.value })
                    }
                    className="w-full rounded-lg border border-border/50 bg-surface-light/40 px-3 py-2 text-[13px]"
                  />
                </Field>
              </div>

              <Field
                label="Transfer to human"
                hint="When the agent should hand off to a real phone number."
              >
                <select
                  value={config.transferRule}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      transferRule: e.target.value as AgentConfig["transferRule"],
                    })
                  }
                  className="w-full rounded-lg border border-border/50 bg-surface-light/40 px-3 py-2 text-[13px]"
                >
                  <option value="qualified_only">
                    Only after the lead is qualified
                  </option>
                  <option value="always">Always, after the greeting</option>
                  <option value="never">Never — AI handles the whole call</option>
                </select>
              </Field>

              {config.transferRule !== "never" && (
                <Field label="Transfer number">
                  <input
                    type="tel"
                    value={config.transferNumber}
                    onChange={(e) =>
                      setConfig({ ...config, transferNumber: e.target.value })
                    }
                    placeholder="+1 415 555 0100"
                    className="w-full rounded-lg border border-border/50 bg-surface-light/40 px-3 py-2 text-[13px] font-mono placeholder:text-muted/60"
                  />
                </Field>
              )}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-border/30 pt-4">
            <button
              onClick={saveConfig}
              disabled={savingConfig}
              className="inline-flex items-center gap-1.5 rounded-lg bg-surface-light/80 px-3 py-2 text-[12px] font-medium text-foreground hover:bg-surface-light disabled:opacity-50"
            >
              {savingConfig ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Save size={12} />
              )}
              Save settings
            </button>
            <button
              onClick={createAgent}
              disabled={creatingAgent}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-4 py-2 text-[12px] font-semibold text-black transition hover:bg-gold/90 disabled:opacity-50"
            >
              {creatingAgent ? (
                <>
                  <Loader2 size={13} className="animate-spin" /> Creating…
                </>
              ) : (
                <>
                  <Sparkles size={13} /> {hasAgent ? "Create another agent" : "Create agent on ElevenLabs"}
                </>
              )}
            </button>
          </div>
        </section>

        {/* ── 3. Call log table ─────────────────────────────────────── */}
        <section className="card !p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/15 text-sky-300">
                <FileText size={14} />
              </div>
              <div>
                <h2 className="text-sm font-semibold">Call log</h2>
                <p className="text-[10px] text-muted">
                  Every call the agent handled, newest first.
                </p>
              </div>
            </div>
            {!liveBackend && calls.length > 0 && (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                Demo data
              </span>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
              <Loader2 size={14} className="animate-spin" /> Loading calls…
            </div>
          ) : calls.length === 0 ? (
            <EmptyState
              icon={<PhoneCall size={28} />}
              title="No calls yet"
              description="Once your receptionist picks up its first call, it'll show up here — caller, outcome, transcript, CRM link."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12px]">
                <thead className="border-b border-border/40 text-[10px] uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-2 py-2 font-semibold">Caller</th>
                    <th className="px-2 py-2 font-semibold">When</th>
                    <th className="px-2 py-2 font-semibold">Duration</th>
                    <th className="px-2 py-2 font-semibold">Outcome</th>
                    <th className="px-2 py-2 font-semibold">Transcript</th>
                    <th className="px-2 py-2 font-semibold text-right">CRM</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((c) => {
                    const om = outcomeMeta(c.outcome);
                    const OutIcon = om.icon;
                    return (
                      <tr
                        key={c.id}
                        className="border-b border-border/20 transition hover:bg-surface-light/20"
                      >
                        <td className="px-2 py-3 font-mono text-[11.5px]">
                          {c.caller}
                        </td>
                        <td className="px-2 py-3 text-muted">
                          {fmtRelative(c.startedAt)}
                        </td>
                        <td className="px-2 py-3 text-muted">
                          {fmtDuration(c.durationSec)}
                        </td>
                        <td className="px-2 py-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${om.className}`}
                          >
                            <OutIcon size={10} /> {om.label}
                          </span>
                        </td>
                        <td className="px-2 py-3 max-w-[320px] truncate text-muted">
                          {c.transcriptPreview}
                        </td>
                        <td className="px-2 py-3 text-right">
                          {c.crmLink ? (
                            <Link
                              href={c.crmLink}
                              className="inline-flex items-center gap-1 text-[11px] text-gold hover:underline"
                            >
                              Open <ExternalLink size={10} />
                            </Link>
                          ) : (
                            <span className="text-[10px] text-muted/70">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── 4. Calendar integration + 5. Quota ───────────────────── */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <CalendarIntegrationCard />
          <QuotaCard quota={callQuota} planTier={planUsage?.plan_tier} />
        </div>

        {/* Helper footer ──────────────────────────────────────────── */}
        <div className="mt-2 rounded-xl border border-border/40 bg-background/40 p-5 text-[12px] text-muted">
          <p className="mb-2 font-semibold text-foreground">How it works</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>
              Every incoming call to your provisioned Twilio number hits the ElevenLabs
              ConvAI agent you configured above.
            </li>
            <li>
              The agent uses your greeting + system prompt to qualify, answer, and (if
              allowed) book directly into your connected calendar.
            </li>
            <li>
              Call minutes count against your plan tier — see the quota panel for your
              current usage.
            </li>
            <li>
              Provision phone numbers under{" "}
              <Link
                href="/dashboard/phone-email"
                className="text-gold underline"
              >
                Phone / Email
              </Link>
              . Browse every agent under{" "}
              <Link
                href="/dashboard/eleven-agents"
                className="text-gold underline"
              >
                ElevenAgents
              </Link>
              .
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────
// Subcomponents
// ───────────────────────────────────────────────────────────────────

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted">
        {label}
      </span>
      {children}
      {hint && <p className="mt-1 text-[10.5px] text-muted/80">{hint}</p>}
    </label>
  );
}

function CalendarIntegrationCard() {
  // Lightweight probe: if /api/calendar/status exists and returns ok, show
  // the connected state. Otherwise, fall back to "not connected" + CTA.
  const [state, setState] = useState<"loading" | "connected" | "disconnected">(
    "loading",
  );
  const [provider, setProvider] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const res = await fetch("/api/calendar/status", { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) setState("disconnected");
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        if (data.connected) {
          setState("connected");
          setProvider(data.provider || "Google Calendar");
        } else {
          setState("disconnected");
        }
      } catch {
        if (!cancelled) setState("disconnected");
      }
    }
    check();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="card !p-5">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300">
          <CalendarIcon size={14} />
        </div>
        <div>
          <h2 className="text-sm font-semibold">Calendar for booking</h2>
          <p className="text-[10px] text-muted">
            Where the agent drops qualified bookings.
          </p>
        </div>
      </div>

      {state === "loading" ? (
        <div className="flex items-center gap-2 text-[12px] text-muted">
          <Loader2 size={12} className="animate-spin" /> Checking connection…
        </div>
      ) : state === "connected" ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-emerald-300" />
            <div>
              <p className="text-[12.5px] font-semibold text-foreground">
                Connected
              </p>
              <p className="text-[11px] text-muted">
                {provider || "Google Calendar"} · bookings land directly on your
                calendar.
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/calendar"
            className="inline-flex items-center gap-1 rounded-lg bg-surface-light/80 px-3 py-1.5 text-[11px] font-medium text-muted hover:bg-surface-light hover:text-foreground"
          >
            Manage <ArrowRight size={11} />
          </Link>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border/50 bg-surface-light/20 p-4">
          <div className="flex items-start gap-2">
            <AlertCircle
              size={15}
              className="mt-0.5 shrink-0 text-amber-400"
            />
            <div>
              <p className="text-[12.5px] font-semibold text-foreground">
                No calendar connected
              </p>
              <p className="text-[11px] text-muted">
                Until you connect a calendar, the agent can qualify leads but
                can&apos;t book confirmed time slots.
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/calendar"
            className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-3 py-2 text-[11.5px] font-semibold text-black hover:bg-gold/90"
          >
            <CalendarIcon size={12} /> Connect calendar
          </Link>
        </div>
      )}
    </section>
  );
}

function QuotaCard({
  quota,
  planTier,
}: {
  quota: {
    used: number;
    limit: number | "unlimited";
    isUnlimited: boolean;
    limitNum: number;
    pct: number;
  } | null;
  planTier?: string;
}) {
  return (
    <section className="card !p-5">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15 text-amber-300">
          <Phone size={14} />
        </div>
        <div>
          <h2 className="text-sm font-semibold">Call minutes this month</h2>
          <p className="text-[10px] text-muted">
            Counted against your plan tier. Resets on the 1st.
          </p>
        </div>
      </div>

      {!quota ? (
        <p className="text-[11px] text-muted">Usage data unavailable.</p>
      ) : (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-muted">
              Plan:{" "}
              <span className="font-semibold text-gold">
                {planTier || "—"}
              </span>
            </span>
            <span className="font-mono text-[13px] text-foreground">
              {quota.used.toLocaleString()}
              {quota.isUnlimited
                ? " · Unlimited"
                : ` / ${quota.limitNum.toLocaleString()}`}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-light/50">
            <div
              className={`h-full transition-all ${
                quota.isUnlimited
                  ? "bg-gold"
                  : quota.pct >= 100
                    ? "bg-rose-500"
                    : quota.pct >= 80
                      ? "bg-amber-400"
                      : "bg-gold"
              }`}
              style={{
                width: quota.isUnlimited
                  ? "6%"
                  : `${Math.max(2, quota.pct)}%`,
              }}
            />
          </div>
          {!quota.isUnlimited && quota.pct >= 100 && (
            <p className="text-[11px] text-rose-300">
              Limit reached —{" "}
              <Link
                href="/dashboard/pricing"
                className="underline hover:text-rose-200"
              >
                upgrade your plan
              </Link>{" "}
              to keep answering calls.
            </p>
          )}
          {!quota.isUnlimited && quota.pct >= 80 && quota.pct < 100 && (
            <p className="text-[11px] text-amber-300">
              {Math.max(0, quota.limitNum - quota.used).toLocaleString()} minutes
              left this month.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

// ───────────────────────────────────────────────────────────────────
// System-prompt builder for agent creation
// ───────────────────────────────────────────────────────────────────

function buildSystemPrompt(c: AgentConfig): string {
  const hours =
    c.hoursStart === "00:00" && c.hoursEnd === "23:59"
      ? "You are available 24/7."
      : `Business hours are ${c.hoursStart}–${c.hoursEnd} local time.`;
  const transfer =
    c.transferRule === "never"
      ? "Never transfer to a human — handle every call yourself."
      : c.transferRule === "always"
        ? `After the greeting, offer to transfer the caller to a human at ${c.transferNumber || "[number not set]"}.`
        : `If the caller is qualified (real business, specific need, not a robocall), offer to transfer to a human at ${c.transferNumber || "[number not set]"}. Otherwise book them on the calendar instead.`;
  return [
    `You are ${c.agentName}, a professional AI voice receptionist.`,
    hours,
    "Qualify every caller: who they are, what business they run, what they need.",
    "If they want to book a meeting, use the booking tool to schedule it directly.",
    transfer,
    "Keep responses short and natural — under 25 words. Never say you're an AI unless asked directly.",
  ].join(" ");
}

// Silence unused-import lint — buttons referenced conditionally above.
void Play;
void Pause;
