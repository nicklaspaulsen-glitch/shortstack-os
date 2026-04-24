"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Mic, Plus, Clock, CheckCircle2, AlertTriangle, Upload, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import PageHero from "@/components/ui/page-hero";
import { EmptyState } from "@/components/ui/empty-state-illustration";

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
    scheduled: { color: "bg-white/5 text-muted", icon: Clock, label: "Scheduled" },
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

  return (
    <div className="fade-in space-y-5">
      <PageHero
        icon={<Mic size={22} />}
        title="Meetings"
        subtitle={`${meetings.length} recorded — transcripts, action items, and decisions on every call.`}
        gradient="green"
        actions={
          <Link
            href="/dashboard/meetings/new"
            className="text-xs flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/15 border border-white/20 text-white font-medium hover:bg-white/25 transition-all"
          >
            <Upload size={12} /> Upload audio
          </Link>
        }
      />

      {/* Quick-create */}
      <div className="card p-4 flex gap-3 items-center">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && quickCreate()}
          placeholder="Quick add — e.g., 'Client strategy call, Acme Co'"
          className="input flex-1 text-xs"
        />
        <button
          onClick={quickCreate}
          disabled={creating || !newTitle.trim()}
          className="btn-primary text-xs flex items-center gap-1.5 px-4 disabled:opacity-50"
        >
          {creating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} New
        </button>
      </div>

      {loading ? (
        <p className="text-[11px] text-muted flex items-center gap-1.5">
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
          {meetings.map((m) => (
            <Link
              key={m.id}
              href={`/dashboard/meetings/${m.id}`}
              className="flex items-center justify-between p-4 rounded-xl bg-surface-light border border-border hover:border-gold/20 transition-all"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center flex-shrink-0">
                  <Mic size={16} className="text-gold" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{m.title}</p>
                  <p className="text-[10px] text-muted truncate">
                    {new Date(m.created_at).toLocaleString()} · {formatDuration(m.duration_seconds)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {statusBadge(m.status)}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
