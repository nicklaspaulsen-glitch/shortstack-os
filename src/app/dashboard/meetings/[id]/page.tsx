"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Mic,
  Loader2,
  Wand2,
  Play,
  AlertTriangle,
  Sparkles,
  Lightbulb,
  Clock,
  Trash2,
} from "lucide-react";
import toast from "react-hot-toast";
import TranscriptViewer, { TranscriptSegment } from "@/components/meetings/transcript-viewer";
import ActionItems, { ActionItem } from "@/components/meetings/action-items";

interface MeetingDetail {
  id: string;
  title: string;
  status: "scheduled" | "recording" | "processing" | "ready" | "failed";
  audio_url: string | null;
  duration_seconds: number | null;
  scheduled_at: string | null;
  created_at: string;
  transcript_raw: string | null;
  transcript_speaker_labeled: TranscriptSegment[] | null;
  summary: string | null;
  action_items: ActionItem[] | null;
  decisions: Array<{ text: string; context?: string }> | null;
  key_moments: Array<{ ts: number; label: string }> | null;
}

function formatTs(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, "0")}`;
}

export default function MeetingDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [meeting, setMeeting] = useState<MeetingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [transcribing, setTranscribing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const loadMeeting = async () => {
    const res = await fetch(`/api/meetings/${id}`);
    if (!res.ok) {
      if (res.status === 404) {
        toast.error("Meeting not found");
        router.push("/dashboard/meetings");
        return;
      }
      throw new Error("Load failed");
    }
    const { meeting } = await res.json();
    setMeeting(meeting);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadMeeting();
      } catch (err) {
        console.error("[meeting] load error:", err);
        if (!cancelled) toast.error("Couldn't load meeting");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const segments = Array.isArray(meeting?.transcript_speaker_labeled)
    ? meeting!.transcript_speaker_labeled!
    : [];

  function seekTo(ts: number) {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = ts;
    el.play().catch(() => {});
  }

  async function runTranscribe() {
    setTranscribing(true);
    try {
      const res = await fetch(`/api/meetings/${id}/transcribe`, { method: "POST" });
      if (res.status === 501) {
        const err = await res.json();
        toast(err.error, { icon: "⚙️", duration: 6000 });
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Transcribe failed");
      }
      toast.success("Transcription complete");
      await loadMeeting();
    } catch (err) {
      console.error("[transcribe] error:", err);
      toast.error(err instanceof Error ? err.message : "Transcribe failed");
    } finally {
      setTranscribing(false);
    }
  }

  async function runAnalyze() {
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/meetings/${id}/analyze`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Analyze failed");
      }
      toast.success("Analysis complete");
      await loadMeeting();
    } catch (err) {
      console.error("[analyze] error:", err);
      toast.error(err instanceof Error ? err.message : "Analyze failed");
    } finally {
      setAnalyzing(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this meeting? This can't be undone.")) return;
    const res = await fetch(`/api/meetings/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Delete failed");
      return;
    }
    toast.success("Meeting deleted");
    router.push("/dashboard/meetings");
  }

  if (loading) {
    return (
      <div className="p-6 text-[11px] text-muted flex items-center gap-2">
        <Loader2 size={12} className="animate-spin" /> Loading...
      </div>
    );
  }
  if (!meeting) return null;

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/dashboard/meetings"
            className="text-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-lg font-bold truncate">{meeting.title}</h1>
            <p className="text-[10px] text-muted">
              {new Date(meeting.created_at).toLocaleString()}
              {meeting.duration_seconds ? ` · ${formatTs(meeting.duration_seconds)}` : ""}
            </p>
          </div>
        </div>
        <button
          onClick={remove}
          className="text-[10px] text-muted hover:text-red-400 flex items-center gap-1"
        >
          <Trash2 size={10} /> Delete
        </button>
      </div>

      {/* Audio + controls */}
      <div className="card p-4 space-y-3">
        {meeting.audio_url ? (
          <audio
            ref={audioRef}
            src={meeting.audio_url}
            controls
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            className="w-full"
          />
        ) : (
          <div className="text-[11px] text-muted">
            No audio uploaded yet.{" "}
            <Link href="/dashboard/meetings/new" className="text-gold underline">
              Upload a recording
            </Link>{" "}
            to enable transcription.
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={runTranscribe}
            disabled={transcribing || !meeting.audio_url}
            className="btn-secondary text-xs flex items-center gap-1.5 disabled:opacity-40"
          >
            {transcribing ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Mic size={12} />
            )}
            {meeting.transcript_raw ? "Re-transcribe" : "Transcribe"}
          </button>
          <button
            onClick={runAnalyze}
            disabled={analyzing || !meeting.transcript_raw}
            className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-40"
          >
            {analyzing ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Wand2 size={12} />
            )}
            {meeting.summary ? "Re-analyze" : "Analyze with Claude"}
          </button>
          {meeting.status === "failed" && (
            <span className="text-[10px] px-2 py-1 rounded bg-red-400/10 text-red-400 flex items-center gap-1">
              <AlertTriangle size={10} /> Last run failed
            </span>
          )}
        </div>
      </div>

      {/* Split view: transcript left, summary/actions right */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Transcript */}
        <div className="lg:col-span-3 card p-4 space-y-2 max-h-[70vh] overflow-y-auto">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
            <Mic size={11} /> Transcript
          </h3>
          <TranscriptViewer
            segments={segments}
            fallbackRaw={meeting.transcript_raw || undefined}
            currentTime={currentTime}
            onSeek={seekTo}
          />
        </div>

        {/* Right dock */}
        <div className="lg:col-span-2 space-y-4">
          {/* Summary */}
          <div className="card p-4 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <Sparkles size={11} /> Summary
            </h3>
            {meeting.summary ? (
              <p className="text-[11px] leading-relaxed whitespace-pre-wrap">{meeting.summary}</p>
            ) : (
              <p className="text-[11px] text-muted">Run analysis to generate a summary.</p>
            )}
          </div>

          {/* Action items */}
          <div className="card p-4 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
              Action items
            </h3>
            <ActionItems meetingId={id} initial={meeting.action_items || []} />
          </div>

          {/* Decisions */}
          {meeting.decisions && meeting.decisions.length > 0 && (
            <div className="card border-gold/30 bg-gold/5 p-4 space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gold flex items-center gap-1.5">
                <Lightbulb size={11} /> Decisions
              </h3>
              <ul className="space-y-2">
                {meeting.decisions.map((d, i) => (
                  <li key={i} className="text-[11px]">
                    <p className="font-medium">{d.text}</p>
                    {d.context && <p className="text-[10px] text-muted mt-0.5">{d.context}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Key moments */}
          {meeting.key_moments && meeting.key_moments.length > 0 && (
            <div className="card p-4 space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
                <Clock size={11} /> Key moments
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {meeting.key_moments.map((k, i) => (
                  <button
                    key={i}
                    onClick={() => seekTo(k.ts)}
                    className="text-[10px] px-2 py-1 rounded-md bg-white/[0.05] hover:bg-gold/10 hover:text-gold transition-all flex items-center gap-1"
                  >
                    <Play size={8} /> {formatTs(k.ts)} · {k.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
