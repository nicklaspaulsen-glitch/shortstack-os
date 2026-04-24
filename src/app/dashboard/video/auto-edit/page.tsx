"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Film,
  Upload,
  Wand2,
  Loader2,
  Check,
  AlertCircle,
  Clock,
  Download,
  Link2,
} from "lucide-react";
import toast from "react-hot-toast";

type Preset = "documentary" | "vlog" | "social_short" | "commercial";

interface StyleHints {
  style_preset: Preset;
  cut_filler_words: boolean;
  auto_color_grade: boolean;
  audio_fades: boolean;
  burn_subtitles: boolean;
}

interface Job {
  id: string;
  status:
    | "queued"
    | "downloading"
    | "processing"
    | "uploading"
    | "complete"
    | "failed";
  error?: string | null;
  source_url?: string | null;
  output_url?: string | null;
  style_hints?: StyleHints;
  cost_usd?: number;
  duration_seconds?: number;
  project_id?: string | null;
  created_at?: string;
  completed_at?: string | null;
}

const DEFAULT_HINTS: StyleHints = {
  style_preset: "vlog",
  cut_filler_words: true,
  auto_color_grade: true,
  audio_fades: true,
  burn_subtitles: false,
};

const PRESETS: { id: Preset; label: string; description: string }[] = [
  { id: "documentary", label: "Documentary", description: "Interview-style, slow pacing, warm grade" },
  { id: "vlog", label: "Vlog", description: "Casual cuts, natural color, punchy edits" },
  { id: "social_short", label: "Social Short", description: "Fast cuts, bold captions, 9:16 energy" },
  { id: "commercial", label: "Commercial", description: "Polished, branded, tight pacing" },
];

function StatusPill({ status }: { status: Job["status"] }) {
  const variants: Record<Job["status"], string> = {
    queued: "bg-gray-100 text-gray-700",
    downloading: "bg-blue-100 text-blue-700",
    processing: "bg-amber-100 text-amber-700",
    uploading: "bg-blue-100 text-blue-700",
    complete: "bg-emerald-100 text-emerald-700",
    failed: "bg-red-100 text-red-700",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${variants[status]}`}>
      {status !== "complete" && status !== "failed" && <Loader2 className="h-3 w-3 animate-spin" />}
      {status === "complete" && <Check className="h-3 w-3" />}
      {status === "failed" && <AlertCircle className="h-3 w-3" />}
      {status}
    </span>
  );
}

export default function AutoEditPage() {
  const [sourceUrl, setSourceUrl] = useState("");
  const [hints, setHints] = useState<StyleHints>(DEFAULT_HINTS);
  const [submitting, setSubmitting] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const pollingRef = useRef<Record<string, number>>({});

  const activeJobIds = useMemo(
    () => jobs.filter((j) => j.status !== "complete" && j.status !== "failed").map((j) => j.id),
    [jobs]
  );

  const pollJob = useCallback(async (jobId: string) => {
    try {
      const resp = await fetch(`/api/video/auto-edit/${jobId}`);
      if (!resp.ok) return;
      const data = (await resp.json()) as { ok: boolean; job?: Job };
      if (!data.ok || !data.job) return;
      setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, ...data.job! } : j)));
    } catch {
      // swallow — next poll will retry
    }
  }, []);

  // Start / stop polling per active job.
  useEffect(() => {
    for (const id of activeJobIds) {
      if (pollingRef.current[id]) continue;
      pollingRef.current[id] = window.setInterval(() => pollJob(id), 3000);
    }
    for (const id of Object.keys(pollingRef.current)) {
      if (!activeJobIds.includes(id)) {
        window.clearInterval(pollingRef.current[id]);
        delete pollingRef.current[id];
      }
    }
    return () => {
      // cleanup only on unmount — per-id cleanup above handles churn
    };
  }, [activeJobIds, pollJob]);

  // Tear everything down on unmount.
  useEffect(() => {
    return () => {
      for (const id of Object.keys(pollingRef.current)) {
        window.clearInterval(pollingRef.current[id]);
      }
      pollingRef.current = {};
    };
  }, []);

  const submit = async () => {
    if (!sourceUrl) {
      toast.error("Paste a video URL or upload a file first");
      return;
    }
    setSubmitting(true);
    try {
      const resp = await fetch("/api/video/auto-edit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source_url: sourceUrl, style_hints: hints }),
      });
      const data = (await resp.json()) as { ok: boolean; job_id?: string; error?: string };
      if (!resp.ok || !data.ok) {
        throw new Error(data.error ?? `Request failed (${resp.status})`);
      }
      if (data.job_id) {
        setJobs((prev) => [
          {
            id: data.job_id!,
            status: "queued",
            source_url: sourceUrl,
            style_hints: hints,
            created_at: new Date().toISOString(),
          },
          ...prev,
        ]);
        toast.success("Edit queued");
        setSourceUrl("");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to queue edit");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <header className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
          <Wand2 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">AI Auto-Edit</h1>
          <p className="text-sm text-gray-500">
            Raw footage in, polished video out. Powered by the video-use skill.
          </p>
        </div>
      </header>

      {/* Submit form */}
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 font-medium">
          <Film className="h-4 w-4" /> Source
        </h2>
        <label className="mb-4 flex items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2.5 text-sm">
          <Link2 className="h-4 w-4 text-gray-400" />
          <input
            className="w-full bg-transparent outline-none"
            type="url"
            placeholder="Paste a public video URL (Supabase storage, S3, etc.)"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
          />
        </label>

        <div className="mb-2 flex items-center gap-2 text-xs text-gray-500">
          <Upload className="h-3 w-3" /> Or drop in an asset from your library (coming soon)
        </div>

        <h2 className="mt-6 mb-3 font-medium">Style preset</h2>
        <div className="mb-5 grid grid-cols-2 gap-2 md:grid-cols-4">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setHints({ ...hints, style_preset: p.id })}
              className={`rounded-lg border p-3 text-left text-sm transition ${
                hints.style_preset === p.id
                  ? "border-violet-500 bg-violet-50 ring-1 ring-violet-300"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="font-medium">{p.label}</div>
              <div className="mt-0.5 text-xs text-gray-500">{p.description}</div>
            </button>
          ))}
        </div>

        <h2 className="mb-3 font-medium">Options</h2>
        <div className="space-y-2">
          {[
            ["cut_filler_words", "Cut filler words (um, uh, like)"],
            ["auto_color_grade", "Auto color grade"],
            ["audio_fades", "Audio fades at cut points"],
            ["burn_subtitles", "Burn-in subtitles"],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                checked={Boolean((hints as unknown as Record<string, boolean>)[key])}
                onChange={(e) => setHints({ ...hints, [key]: e.target.checked } as StyleHints)}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>

        <button
          type="button"
          disabled={submitting || !sourceUrl}
          onClick={submit}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          {submitting ? "Queuing…" : "Auto-edit this video"}
        </button>
      </section>

      {/* Jobs list */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-medium">
          <Clock className="h-4 w-4" /> Jobs
        </h2>
        {jobs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 py-10 text-center text-sm text-gray-500">
            No jobs yet. Queue an edit to see progress here.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2">Job</th>
                  <th className="px-4 py-2">Preset</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Output</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {jobs.map((j) => (
                  <tr key={j.id}>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{j.id.slice(0, 8)}…</td>
                    <td className="px-4 py-3">{j.style_hints?.style_preset ?? "—"}</td>
                    <td className="px-4 py-3">
                      <StatusPill status={j.status} />
                      {j.error ? <div className="mt-1 text-xs text-red-600">{j.error}</div> : null}
                    </td>
                    <td className="px-4 py-3">
                      {j.output_url ? (
                        <div className="flex items-center gap-3">
                          <video src={j.output_url} controls className="h-16 w-28 rounded bg-black object-cover" />
                          <a
                            href={j.output_url}
                            download
                            className="inline-flex items-center gap-1 text-xs text-violet-700 hover:underline"
                          >
                            <Download className="h-3 w-3" /> Download
                          </a>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
