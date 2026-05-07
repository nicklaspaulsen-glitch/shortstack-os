"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Mic,
  Play,
  Pause,
  Loader2,
  AlertTriangle,
  Trash2,
  ArrowLeft,
  Phone,
  Voicemail,
  MessageCircle,
  Send,
  CheckCircle2,
  RefreshCw,
  Clock,
} from "lucide-react";
import Link from "next/link";
import PageHero from "@/components/ui/page-hero";

const R2_BASE = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "";

interface VoiceClone {
  id: string;
  label: string;
  description: string | null;
  provider: string;
  status: "training" | "ready" | "failed";
  language: string;
  consent_kind: string;
  consent_evidence: Record<string, unknown> | null;
  is_default_for_user: boolean;
  is_default_for_voicemail: boolean;
  is_default_for_dialer: boolean;
  is_default_for_sms: boolean;
  is_default_for_dm: boolean;
  failed_reason: string | null;
  ready_at: string | null;
  created_at: string;
  owner_subject_kind: string;
}

interface SampleRow {
  id: string;
  r2_key: string;
  mime_type: string;
  duration_seconds: number | null;
  uploaded_at: string;
}

interface RenderRow {
  id: string;
  text_preview: string;
  r2_key: string;
  duration_seconds: number | null;
  rendered_at: string;
  use_count: number;
  context: string | null;
}

const SURFACE_FLAGS: Array<{
  key: keyof VoiceClone;
  label: string;
  icon: React.ReactNode;
}> = [
  {
    key: "is_default_for_user",
    label: "Default",
    icon: <CheckCircle2 size={12} />,
  },
  {
    key: "is_default_for_dialer",
    label: "Dialer",
    icon: <Phone size={12} />,
  },
  {
    key: "is_default_for_voicemail",
    label: "Voicemail",
    icon: <Voicemail size={12} />,
  },
  {
    key: "is_default_for_sms",
    label: "SMS",
    icon: <MessageCircle size={12} />,
  },
  { key: "is_default_for_dm", label: "DM", icon: <Send size={12} /> },
];

export default function VoiceCloneDetailPage() {
  const params = useParams();
  const router = useRouter();
  const cloneId = (params?.id as string | undefined) ?? null;

  const [clone, setClone] = useState<VoiceClone | null>(null);
  const [samples, setSamples] = useState<SampleRow[]>([]);
  const [renders, setRenders] = useState<RenderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testText, setTestText] = useState(
    "Hi, this is a quick voice test using my new clone.",
  );
  const [testUrl, setTestUrl] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [polling, setPolling] = useState(false);
  const [playingSampleId, setPlayingSampleId] = useState<string | null>(null);
  const [playingRenderId, setPlayingRenderId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!cloneId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/voice/clones/${cloneId}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Load failed (${res.status})`);
      }
      setClone(data.clone);
      setSamples(data.samples || []);
      setRenders(data.renders || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [cloneId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onTest = useCallback(async () => {
    if (!cloneId) return;
    setTesting(true);
    setError(null);
    try {
      const res = await fetch(`/api/voice/clones/${cloneId}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: testText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Test failed (${res.status})`);
      setTestUrl(data.r2_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test failed");
    } finally {
      setTesting(false);
    }
  }, [cloneId, testText]);

  const onPoll = useCallback(async () => {
    if (!cloneId) return;
    setPolling(true);
    try {
      const res = await fetch(`/api/voice/clones/${cloneId}/poll-status`, {
        method: "POST",
      });
      if (res.ok) {
        await refresh();
      }
    } finally {
      setPolling(false);
    }
  }, [cloneId, refresh]);

  const onToggleDefault = useCallback(
    async (key: keyof VoiceClone) => {
      if (!clone || !cloneId) return;
      const next = !(clone[key] as boolean);
      try {
        const res = await fetch(`/api/voice/clones/${cloneId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [key]: next }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || `Update failed (${res.status})`);
        }
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Update failed");
      }
    },
    [clone, cloneId, refresh],
  );

  const onDelete = useCallback(async () => {
    if (!cloneId || !clone) return;
    if (!window.confirm(`Delete clone "${clone.label}"? This cannot be undone.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/voice/clones/${cloneId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Delete failed (${res.status})`);
      }
      router.push("/dashboard/voice-studio");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }, [cloneId, clone, router]);

  return (
    <div className="min-h-screen pb-12">
      <PageHero
        title={clone?.label || "Voice clone"}
        subtitle={
          clone?.description ||
          "Manage this clone's defaults, listen to renders, and review samples."
        }
        gradient="sunset"
        icon={<Mic size={28} />}
        actions={
          <Link
            href="/dashboard/voice-studio"
            className="flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10"
          >
            <ArrowLeft size={12} /> Back to studio
          </Link>
        }
      />

      <div className="mx-auto mt-6 max-w-5xl space-y-6 px-4 sm:px-6">
        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-rose-500/30 bg-rose-950/40 p-4 text-sm text-rose-200">
            <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" />
            <div>{error}</div>
          </div>
        )}

        {loading || !clone ? (
          <div className="flex justify-center py-12 text-white/60">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : (
          <>
            {/* Status + actions */}
            <section className="rounded-xl border border-white/10 bg-white/5 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-wider text-white/50">
                    Status
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                        clone.status === "ready"
                          ? "bg-emerald-500/15 text-emerald-200"
                          : clone.status === "training"
                            ? "bg-amber-500/15 text-amber-200"
                            : "bg-rose-500/15 text-rose-200"
                      }`}
                    >
                      {clone.status === "training" && (
                        <Loader2 size={10} className="animate-spin" />
                      )}
                      {clone.status}
                    </span>
                    <span className="rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/60">
                      {clone.provider}
                    </span>
                  </div>
                  {clone.failed_reason && (
                    <p className="mt-2 text-xs text-rose-300">
                      {clone.failed_reason}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {clone.status === "training" && (
                    <button
                      type="button"
                      onClick={onPoll}
                      disabled={polling}
                      className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10"
                    >
                      {polling ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <RefreshCw size={12} />
                      )}
                      Refresh status
                    </button>
                  )}
                  {clone.owner_subject_kind !== "preset" && (
                    <button
                      type="button"
                      onClick={onDelete}
                      className="flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-200 hover:bg-rose-500/20"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* Defaults */}
            {clone.status === "ready" &&
              clone.owner_subject_kind !== "preset" && (
                <section className="rounded-xl border border-white/10 bg-white/5 p-6">
                  <h3 className="text-sm font-semibold text-white">
                    Default for surfaces
                  </h3>
                  <p className="mt-1 text-xs text-white/60">
                    When a surface is on, this clone is auto-selected for that
                    delivery channel.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {SURFACE_FLAGS.map((f) => {
                      const active = clone[f.key] as boolean;
                      return (
                        <button
                          key={String(f.key)}
                          type="button"
                          onClick={() => onToggleDefault(f.key)}
                          className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                            active
                              ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-200"
                              : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10"
                          }`}
                        >
                          {active && <CheckCircle2 size={12} />}
                          {f.icon}
                          {f.label}
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

            {/* Test playback */}
            {clone.status === "ready" && (
              <section className="rounded-xl border border-white/10 bg-white/5 p-6">
                <h3 className="text-sm font-semibold text-white">
                  Test playback
                </h3>
                <textarea
                  value={testText}
                  onChange={(e) => setTestText(e.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#FF2D2D]/60 focus:outline-none"
                  placeholder="Test text..."
                />
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onTest}
                    disabled={testing || testText.trim().length === 0}
                    className="flex items-center gap-1.5 rounded-lg bg-[#FF2D2D] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#FF6B6B] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/50"
                  >
                    {testing ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Play size={12} />
                    )}
                    Render
                  </button>
                </div>
                {testUrl && (
                  <div className="mt-3 rounded-lg border border-white/10 bg-black/30 p-3">
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <audio src={testUrl} controls className="w-full" />
                  </div>
                )}
              </section>
            )}

            {/* Consent */}
            <section className="rounded-xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-sm font-semibold text-white">Consent</h3>
              <div className="mt-2 text-xs text-white/70">
                Kind: <span className="font-mono">{clone.consent_kind}</span>
              </div>
              {clone.consent_evidence &&
                Object.keys(clone.consent_evidence).length > 0 && (
                  <pre className="mt-2 max-h-64 overflow-auto rounded-lg border border-white/10 bg-black/30 p-3 text-[11px] text-white/70">
                    {JSON.stringify(clone.consent_evidence, null, 2)}
                  </pre>
                )}
            </section>

            {/* Samples */}
            <section className="rounded-xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-sm font-semibold text-white">
                Samples ({samples.length})
              </h3>
              {samples.length === 0 ? (
                <p className="mt-2 text-xs text-white/60">
                  No samples on this clone (presets don&apos;t have stored
                  samples).
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {samples.map((s) => {
                    const audioUrl = s.r2_key ? `${R2_BASE}/${s.r2_key}` : null;
                    const isPlaying = playingSampleId === s.id;
                    return (
                      <li
                        key={s.id}
                        className="rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-xs"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            {audioUrl ? (
                              <button
                                type="button"
                                onClick={() => setPlayingSampleId(isPlaying ? null : s.id)}
                                className="flex-shrink-0 w-6 h-6 rounded-full bg-[#FF2D2D]/20 hover:bg-[#FF2D2D]/40 flex items-center justify-center transition-colors"
                                aria-label={isPlaying ? "Pause" : "Play"}
                              >
                                {isPlaying ? <Pause size={10} className="text-[#FF6B6B]" /> : <Play size={10} className="text-[#FF2D2D]" />}
                              </button>
                            ) : (
                              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white/5 flex items-center justify-center">
                                <Mic size={10} className="text-white/40" />
                              </div>
                            )}
                            <span className="truncate font-mono text-white/50 text-[10px]">{s.r2_key}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 text-white/40">
                            {s.duration_seconds != null && (
                              <span className="flex items-center gap-1">
                                <Clock size={9} />
                                {s.duration_seconds.toFixed(1)}s
                              </span>
                            )}
                            <span>
                              {new Date(s.uploaded_at).toLocaleString(undefined, {
                                dateStyle: "short",
                                timeStyle: "short",
                              })}
                            </span>
                          </div>
                        </div>
                        {isPlaying && audioUrl && (
                          <div className="mt-2">
                            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                            <audio
                              key={s.id}
                              src={audioUrl}
                              controls
                              autoPlay
                              className="w-full h-8"
                              onEnded={() => setPlayingSampleId(null)}
                            />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Render history */}
            <section className="rounded-xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-sm font-semibold text-white">
                Recent renders ({renders.length})
              </h3>
              {renders.length === 0 ? (
                <p className="mt-2 text-xs text-white/60">
                  No renders yet — try the test playback above.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {renders.map((r) => {
                    const audioUrl = r.r2_key ? `${R2_BASE}/${r.r2_key}` : null;
                    const isPlaying = playingRenderId === r.id;
                    return (
                      <li
                        key={r.id}
                        className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs"
                      >
                        <div className="flex items-start gap-3">
                          {audioUrl ? (
                            <button
                              type="button"
                              onClick={() => setPlayingRenderId(isPlaying ? null : r.id)}
                              className="flex-shrink-0 mt-0.5 w-6 h-6 rounded-full bg-[#FF2D2D]/20 hover:bg-[#FF2D2D]/40 flex items-center justify-center transition-colors"
                              aria-label={isPlaying ? "Pause" : "Play"}
                            >
                              {isPlaying ? <Pause size={10} className="text-[#FF6B6B]" /> : <Play size={10} className="text-[#FF2D2D]" />}
                            </button>
                          ) : (
                            <div className="flex-shrink-0 mt-0.5 w-6 h-6 rounded-full bg-white/5 flex items-center justify-center">
                              <Play size={10} className="text-white/30" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-white/90 leading-snug">{r.text_preview}</p>
                            <p className="mt-1 text-[10px] text-white/40">
                              {new Date(r.rendered_at).toLocaleString(undefined, {
                                dateStyle: "short",
                                timeStyle: "short",
                              })}
                              {" · used "}{r.use_count}×
                              {r.duration_seconds != null && ` · ${r.duration_seconds.toFixed(1)}s`}
                              {r.context && ` · ${r.context}`}
                            </p>
                          </div>
                        </div>
                        {isPlaying && audioUrl && (
                          <div className="mt-2 pl-9">
                            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                            <audio
                              key={r.id}
                              src={audioUrl}
                              controls
                              autoPlay
                              className="w-full h-8"
                              onEnded={() => setPlayingRenderId(null)}
                            />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
