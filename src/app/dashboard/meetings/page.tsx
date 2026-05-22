"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Mic,
  Plus,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Loader2,
  Link2,
  Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";
import { EmptyState } from "@/components/ui/empty-state-illustration";
import { PRISM_RAINBOW_GRADIENT } from "@/components/prism";
import { MotionPage } from "@/components/motion/motion-page";

interface MeetingRow {
  id: string;
  title: string;
  client_id: string | null;
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  audio_url: string | null;
  status: "scheduled" | "recording" | "processing" | "ready" | "failed";
  summary: string | null;
  created_at: string;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function statusBadge(status: MeetingRow["status"]) {
  const map = {
    scheduled: { color: "bg-white/4 text-text-muted", icon: Clock, label: "Scheduled" },
    recording: { color: "bg-red-400/10 text-red-400", icon: Mic, label: "Recording" },
    processing: { color: "bg-yellow-400/10 text-yellow-400", icon: Loader2, label: "Processing" },
    ready: { color: "bg-green-400/10 text-green-400", icon: CheckCircle2, label: "Ready" },
    failed: { color: "bg-red-400/10 text-red-400", icon: AlertTriangle, label: "Failed" },
  } as const;
  const entry = map[status];
  const Icon = entry.icon;
  return (
    <span className={`text-[9px] px-2 py-0.5 rounded-full flex items-center gap-1 ${entry.color}`}>
      <Icon size={9} className={status === "processing" ? "animate-spin" : ""} /> {entry.label}
    </span>
  );
}

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<MeetingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [urlMode, setUrlMode] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  const [urlBusy, setUrlBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/meetings");
        if (!res.ok) throw new Error("Load failed");
        const json = await res.json();
        if (!cancelled) setMeetings(json.meetings || []);
      } catch (err) {
        console.error("[meetings] list error:", err);
        if (!cancelled) toast.error("Couldn't load meetings");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function quickCreate() {
    const title = newTitle.trim();
    if (!title) {
      toast.error("Give it a title first");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error("create failed");
      const { meeting } = await res.json();
      setMeetings((cur) => [meeting, ...cur]);
      setNewTitle("");
      toast.success("Meeting created");
    } catch (err) {
      console.error("[meetings] create error:", err);
      toast.error("Couldn't create meeting");
    } finally {
      setCreating(false);
    }
  }

  async function ingestFromUrl() {
    const trimmed = urlValue.trim();
    const title = newTitle.trim();
    if (!trimmed) { toast.error("Paste a Zoom or Loom URL first"); return; }
    if (!title) { toast.error("Add a title for the meeting"); return; }
    setUrlBusy(true);
    try {
      const res = await fetch("/api/meetings/from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, source_url: trimmed }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Could not ingest URL");
      }
      const { meeting } = await res.json();
      setMeetings((cur) => [meeting, ...cur]);
      setUrlValue("");
      setNewTitle("");
      setUrlMode(false);
      toast.success("Recording downloaded — kick off transcription on the detail page.");
    } catch (err) {
      console.error("[meetings] from-url error:", err);
      toast.error(err instanceof Error ? err.message : "Couldn't ingest URL");
    } finally {
      setUrlBusy(false);
    }
  }

  return (
    <MotionPage className="space-y-5">{/* -- Meetings command strip -- */}
    <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-[0.2em] text-text-muted font-editorial italic mb-1">Appointment Tracker</p>
        <h1 className="text-2xl font-display font-bold text-text-primary">Meetings</h1>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link
                  href="/dashboard/meetings/new"
                  className="btn-pill-ghost text-xs flex items-center gap-1.5"
                >
                  <Upload size={12} /> Upload audio
                </Link>
      </div>
    </div>{/* Killer-feature banner */}<motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="glass rounded-xl p-4 border-[rgba(212,255,0,0.25)] bg-gradient-to-r from-[rgba(212,255,0,0.08)] to-transparent"
            >
              <div className="flex items-center gap-2 text-[11px] font-semibold mb-1">
                <Sparkles size={11} className="text-brand-accent" /> AI Notetaker
              </div>
              <p className="text-[10px] text-text-muted leading-relaxed">
                Drop in a recording or paste a Zoom/Loom share URL — Whisper transcribes,
                Claude extracts action items, decisions, and key moments, and you can
                push the summary into the linked contact&apos;s CRM activity feed in one click.
                Replaces Otter ($16/mo) + Fathom ($24/mo).
              </p>
            </motion.div>{/* Quick-create */}<motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06, duration: 0.4 }}
              className="glass rounded-xl p-4 space-y-3"
            >
              <div className="flex gap-3 items-center">
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (urlMode ? ingestFromUrl() : quickCreate())}
                  placeholder="Title — e.g., 'Strategy kickoff, Acme Co'"
                  className="input flex-1 text-xs"
                />
                {urlMode ? (
                  <button
                    onClick={ingestFromUrl}
                    disabled={urlBusy || !newTitle.trim() || !urlValue.trim()}
                    className="btn-primary text-xs flex items-center gap-1.5 px-4 disabled:opacity-50"
                  >
                    {urlBusy ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />}
                    Ingest URL
                  </button>
                ) : (
                  <button
                    onClick={quickCreate}
                    disabled={creating || !newTitle.trim()}
                    className="btn-primary text-xs flex items-center gap-1.5 px-4 disabled:opacity-50"
                  >
                    {creating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} New
                  </button>
                )}
              </div>
              {urlMode && (
                <input
                  value={urlValue}
                  onChange={(e) => setUrlValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && ingestFromUrl()}
                  placeholder="Paste a Zoom share URL or Loom share link..."
                  className="input w-full text-xs"
                />
              )}
              <div className="flex items-center gap-3 text-[10px] text-text-muted">
                <button
                  onClick={() => setUrlMode((v) => !v)}
                  className="hover:text-brand-accent transition-colors flex items-center gap-1"
                >
                  <Link2 size={9} /> {urlMode ? "Switch to manual entry" : "Or ingest from URL"}
                </button>
                <span>·</span>
                <Link
                  href="/dashboard/meetings/new"
                  className="hover:text-brand-accent transition-colors flex items-center gap-1"
                >
                  <Upload size={9} /> Upload audio file
                </Link>
              </div>
            </motion.div>{loading ? (
              <p className="text-[11px] text-text-muted flex items-center gap-1.5">
                <Loader2 size={11} className="animate-spin" /> Loading meetings...
              </p>
            ) : meetings.length === 0 ? (
              <EmptyState
                type="no-invoices"
                title="No meetings yet"
                description="Upload a recording or create a meeting to generate transcripts, action items, and decisions."
                action={
                  <Link href="/dashboard/meetings/new" className="btn-primary text-xs">
                    Upload your first recording
                  </Link>
                }
              />
            ) : (
              <div className="space-y-2">
                {meetings.map((m, i) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.4 }}
                    whileHover={{ y: -4, scale: 1.01 }}
                    className="glass rounded-xl overflow-hidden spotlight-card"
                    onMouseMove={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      e.currentTarget.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
                      e.currentTarget.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
                    }}
                  >
                    <div style={{ height: 3, background: PRISM_RAINBOW_GRADIENT }} />
                    <Link
                      href={`/dashboard/meetings/${m.id}`}
                      className="flex items-center justify-between p-4"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-[rgba(212,255,0,0.08)] flex items-center justify-center flex-shrink-0">
                          <Mic size={16} className="text-brand-accent" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{m.title}</p>
                          <p className="text-[10px] text-text-muted truncate">
                            {new Date(m.created_at).toLocaleString()} · {formatDuration(m.duration_seconds)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {statusBadge(m.status)}
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}</MotionPage>
  );
}
