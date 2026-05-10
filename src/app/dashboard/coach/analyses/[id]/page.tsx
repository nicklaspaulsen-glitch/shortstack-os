"use client";

/**
 * AI Sales Coach — analysis detail page.
 *
 * Side-by-side layout:
 *   Left  → transcript with timestamp markers (clickable, scrolls to anchor)
 *   Right → metrics card + insights panel + next-actions checklist
 *
 * Actions:
 *   - Click an insight with a `timestamp_secs` to highlight that segment.
 *   - Toggle action items as done (local-only — persistence is a later iteration).
 *   - "Email this analysis" sends a digest to the rep via `/api/coach/email`.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  Mail,
  Sparkles,
} from "lucide-react";
import PageHero from "@/components/ui/page-hero";

interface CoachInsight {
  category: string;
  text: string;
  timestamp_secs?: number | null;
  severity?: number | null;
}

interface CoachNextAction {
  text: string;
  due?: string | null;
}

interface CoachMetrics {
  talk_ratio?: number;
  words_per_minute?: number;
  filler_words_count?: number;
  longest_monologue_secs?: number;
  rep_word_count?: number;
  prospect_word_count?: number;
  rep_turn_count?: number;
  prospect_turn_count?: number;
  duration_seconds?: number;
}

interface AnalysisRow {
  id: string;
  source_type: "voice_call" | "meeting" | "email_thread";
  source_id: string;
  rep_id: string | null;
  metrics: CoachMetrics;
  insights: CoachInsight[];
  next_actions: CoachNextAction[];
  overall_score: number | null;
  cost_usd: number | null;
  created_at: string;
}

interface VoiceCallSource {
  id: string;
  transcript: string | null;
  duration_seconds: number | null;
  from_number: string | null;
  to_number: string | null;
  started_at: string | null;
  recording_url: string | null;
  outcome: string | null;
}

interface MeetingSource {
  id: string;
  title: string | null;
  transcript_raw: string | null;
  transcript_speaker_labeled: Array<{
    start: number;
    end: number;
    speaker?: string;
    text: string;
  }> | null;
  summary: string | null;
  scheduled_at: string | null;
  duration_seconds: number | null;
}

interface EmailSource {
  lead: { id: string; business_name: string | null };
  messages: Array<{
    id: string;
    message_text: string | null;
    reply_text: string | null;
    sent_at: string | null;
    replied_at: string | null;
    recipient_handle: string | null;
    created_at: string;
  }>;
}

interface DetailResponse {
  ok: boolean;
  analysis: AnalysisRow;
  source: VoiceCallSource | MeetingSource | EmailSource | null;
}

function formatTimestamp(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.round(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

const CATEGORY_COLORS: Record<string, string> = {
  objection: "border-[rgba(37,99,235,0.25)] bg-[rgba(37,99,235,0.08)] text-[#374151]",
  missed_question: "border-[rgba(37,99,235,0.25)] bg-[rgba(37,99,235,0.08)] text-[#374151]",
  positive_moment: "border-[rgba(37,99,235,0.25)] bg-[rgba(37,99,235,0.08)] text-[#374151]",
  risk: "border-[rgba(37,99,235,0.25)] bg-[rgba(37,99,235,0.08)] text-[#374151]",
  tone: "border-[rgba(37,99,235,0.25)] bg-[rgba(37,99,235,0.08)] text-[#374151]",
};

function isMeetingSource(s: unknown): s is MeetingSource {
  return !!s && typeof s === "object" && "transcript_speaker_labeled" in s;
}
function isVoiceSource(s: unknown): s is VoiceCallSource {
  return !!s && typeof s === "object" && "from_number" in s;
}
function isEmailSource(s: unknown): s is EmailSource {
  return !!s && typeof s === "object" && "messages" in s;
}

export default function CoachAnalysisDetail() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTimestamp, setActiveTimestamp] = useState<number | null>(null);
  const [doneSet, setDoneSet] = useState<Set<number>>(new Set());

  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/coach/analyses/${id}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed: ${res.status}`);
        const json = (await res.json()) as DetailResponse;
        if (alive) setData(json);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const segments = useMemo(() => {
    const src = data?.source;
    if (!src) return [];
    if (isMeetingSource(src) && Array.isArray(src.transcript_speaker_labeled)) {
      return src.transcript_speaker_labeled.map((s) => ({
        start: s.start,
        end: s.end,
        speaker: s.speaker || "Speaker",
        text: s.text,
      }));
    }
    if (isVoiceSource(src) && src.transcript) {
      // Plain-text transcript — split by line for rendering.
      return src.transcript
        .split(/\n+/)
        .filter((line) => line.trim())
        .map((line, idx) => ({ start: idx, end: idx, speaker: "", text: line }));
    }
    return [];
  }, [data]);

  const handleTimestampClick = (secs: number | null) => {
    if (secs === null) return;
    setActiveTimestamp(secs);
    const node = transcriptRef.current?.querySelector(
      `[data-ts="${Math.round(secs)}"]`,
    );
    node?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const toggleDone = (idx: number) => {
    setDoneSet((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[#6B7280] text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading analysis…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error || "Analysis not found."}
      </div>
    );
  }

  const { analysis, source } = data;
  const metrics = analysis.metrics || {};
  const talkRatioPct = Math.round(((metrics.talk_ratio ?? 0) as number) * 100);

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/coach"
        className="inline-flex items-center gap-1 text-sm text-[#6B7280] hover:text-[#111827]"
      >
        <ArrowLeft className="h-4 w-4" /> Back to coach
      </Link>

      <PageHero
        title={`Score ${analysis.overall_score ?? "—"}/100`}
        subtitle={
          analysis.source_type === "voice_call"
            ? "Voice call analysis"
            : analysis.source_type === "meeting"
              ? "Meeting analysis"
              : "Email-thread analysis"
        }
        gradient="gold"
        icon={<Sparkles className="h-6 w-6" />}
        eyebrow="AI Sales Coach"
        actions={
          <button
            type="button"
            onClick={() => window.alert("Email digest not yet wired to send — coming next.")}
            className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10"
          >
            <Mail className="h-3.5 w-3.5" />
            Email this analysis
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6">
        {/* Transcript */}
        <div
          ref={transcriptRef}
          className="rounded-xl border border-[rgba(0,0,0,0.06)] bg-[rgba(0,0,0,0.04)] p-4 max-h-[70vh] overflow-y-auto"
        >
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#6B7280]">
            Transcript
          </h2>

          {analysis.source_type === "email_thread" && isEmailSource(source) ? (
            <div className="space-y-4">
              {source.messages.length === 0 ? (
                <p className="text-sm text-[#9CA3AF]">No messages on this thread.</p>
              ) : (
                source.messages.map((m) => (
                  <div
                    key={m.id}
                    className="rounded-lg border border-[rgba(0,0,0,0.06)] bg-[rgba(0,0,0,0.04)] p-3"
                  >
                    {m.message_text && (
                      <div className="mb-2">
                        <div className="mb-1 text-[10px] uppercase tracking-wider text-[#2563EB]">
                          Rep • {m.sent_at ? new Date(m.sent_at).toLocaleString() : ""}
                        </div>
                        <p className="whitespace-pre-wrap text-sm text-[#374151]">{m.message_text}</p>
                      </div>
                    )}
                    {m.reply_text && (
                      <div>
                        <div className="mb-1 text-[10px] uppercase tracking-wider text-[#6B7280]">
                          Prospect • {m.replied_at ? new Date(m.replied_at).toLocaleString() : ""}
                        </div>
                        <p className="whitespace-pre-wrap text-sm text-[#374151]">{m.reply_text}</p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          ) : segments.length === 0 ? (
            <p className="text-sm text-[#9CA3AF]">No transcript content available.</p>
          ) : (
            <div className="space-y-2">
              {segments.map((seg, idx) => {
                const ts = Math.round(seg.start);
                const isActive = activeTimestamp !== null && Math.abs(ts - activeTimestamp) < 3;
                return (
                  <div
                    key={idx}
                    data-ts={ts}
                    className={`rounded-md px-3 py-2 transition-colors ${
                      isActive
                        ? "bg-[rgba(37,99,235,0.08)] border border-[rgba(37,99,235,0.25)]"
                        : "border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[#9CA3AF]">
                      <Clock className="h-3 w-3" />
                      <span className="font-mono">{formatTimestamp(seg.start)}</span>
                      {seg.speaker && <span className="text-[#6B7280]">{seg.speaker}</span>}
                    </div>
                    <p className="mt-1 text-sm text-[#374151]">{seg.text}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="rounded-xl border border-[rgba(0,0,0,0.06)] bg-[rgba(0,0,0,0.04)] p-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#6B7280]">
              Metrics
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Metric label="Talk ratio" value={`${talkRatioPct}%`} />
              <Metric label="Words / min" value={metrics.words_per_minute ?? 0} />
              <Metric label="Filler words" value={metrics.filler_words_count ?? 0} />
              <Metric
                label="Longest monologue"
                value={`${metrics.longest_monologue_secs ?? 0}s`}
              />
              <Metric label="Rep words" value={metrics.rep_word_count ?? 0} />
              <Metric label="Prospect words" value={metrics.prospect_word_count ?? 0} />
            </div>
          </div>

          <div className="rounded-xl border border-[rgba(0,0,0,0.06)] bg-[rgba(0,0,0,0.04)] p-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#6B7280]">
              Insights ({analysis.insights.length})
            </h3>
            {analysis.insights.length === 0 ? (
              <p className="text-sm text-[#9CA3AF]">No qualitative findings.</p>
            ) : (
              <div className="space-y-2">
                {analysis.insights.map((insight, idx) => {
                  const tone = CATEGORY_COLORS[insight.category] ?? CATEGORY_COLORS.tone;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleTimestampClick(insight.timestamp_secs ?? null)}
                      disabled={insight.timestamp_secs == null}
                      className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-opacity ${tone} ${
                        insight.timestamp_secs == null
                          ? "cursor-default opacity-90"
                          : "hover:opacity-100 opacity-95"
                      }`}
                    >
                      <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-wider opacity-70">
                        {insight.category.replace("_", " ")}
                        {insight.timestamp_secs != null && (
                          <span className="font-mono">
                            {formatTimestamp(insight.timestamp_secs)}
                          </span>
                        )}
                        {insight.severity && (
                          <span className="ml-auto rounded-full border border-[rgba(0,0,0,0.10)] px-1.5 py-0.5 text-[9px] font-semibold">
                            sev {insight.severity}
                          </span>
                        )}
                      </div>
                      <p className="leading-snug">{insight.text}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-[rgba(0,0,0,0.06)] bg-[rgba(0,0,0,0.04)] p-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#6B7280]">
              Next actions ({analysis.next_actions.length})
            </h3>
            {analysis.next_actions.length === 0 ? (
              <p className="text-sm text-[#9CA3AF]">No follow-ups suggested.</p>
            ) : (
              <ul className="space-y-2">
                {analysis.next_actions.map((action, idx) => {
                  const done = doneSet.has(idx);
                  return (
                    <li key={idx}>
                      <button
                        type="button"
                        onClick={() => toggleDone(idx)}
                        className={`flex w-full items-start gap-2 rounded-md border border-[rgba(0,0,0,0.06)] bg-[rgba(0,0,0,0.04)] px-3 py-2 text-left text-sm transition-colors hover:bg-[rgba(0,0,0,0.06)] ${
                          done ? "opacity-50 line-through" : ""
                        }`}
                      >
                        {done ? (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]" />
                        ) : (
                          <Circle className="mt-0.5 h-4 w-4 shrink-0 text-[#9CA3AF]" />
                        )}
                        <div>
                          <span className="text-[#374151]">{action.text}</span>
                          {action.due && (
                            <span className="ml-2 text-xs text-[#6B7280]">due {action.due}</span>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-[rgba(0,0,0,0.06)] bg-[rgba(0,0,0,0.04)] px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-[#9CA3AF]">{label}</div>
      <div className="mt-1 text-base font-semibold text-[#111827]">{value}</div>
    </div>
  );
}
