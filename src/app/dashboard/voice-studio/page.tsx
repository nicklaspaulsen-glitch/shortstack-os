"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Mic,
  Upload,
  Play,
  Pause,
  Loader2,
  AlertTriangle,
  Trash2,
  Phone,
  Voicemail,
  MessageCircle,
  Send,
  Sparkles,
  CheckCircle2,
  Library,
  Headphones,
  RefreshCw,
  Search,
  Star,
  Zap,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { MotionPage } from "@/components/motion/motion-page";
import toast from "react-hot-toast";

// -- Types ----------------------------------------------------------
interface VoiceClone {
  id: string;
  agency_owner_id: string;
  owner_subject_kind: "user" | "team_member" | "client" | "preset";
  label: string;
  description: string | null;
  provider: string;
  status: "training" | "ready" | "failed";
  language: string;
  is_default_for_user: boolean;
  is_default_for_voicemail: boolean;
  is_default_for_dialer: boolean;
  is_default_for_sms: boolean;
  is_default_for_dm: boolean;
  failed_reason: string | null;
  consent_evidence: Record<string, unknown> | null;
}

interface VoiceRenderRow {
  id: string;
  text_preview: string;
  r2_key: string;
  duration_seconds: number | null;
  rendered_at: string;
  use_count: number;
  context: string | null;
  clone_id?: string;
}

type Tab = "my_voices" | "presets" | "renders";

const TAB_LABELS: Record<Tab, string> = {
  my_voices: "My Voices",
  presets: "Presets",
  renders: "Renders",
};

const TAB_ORDER: ReadonlyArray<Tab> = ["my_voices", "presets", "renders"];

const SURFACE_FLAGS: Array<{
  key: keyof VoiceClone;
  label: string;
  icon: React.ReactNode;
}> = [
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

const TEST_PROMPT_DEFAULT =
  "Hi there — this is a quick test of my new voice clone. How does it sound?";

const SAMPLE_PHRASES = [
  "Hi there — this is a quick test of my new voice clone. How does it sound?",
  "Thanks for calling! I'm not available right now, but leave a message and I'll get back to you.",
  "Hey, just following up on our conversation from earlier this week. Give me a call when you get a chance.",
  "This is a quick voice note — I wanted to share some exciting news with you today.",
  "Good morning! Just checking in to see if you had any questions after our last meeting.",
  "Hey, it's great to hear from you. Let's connect soon and talk through the details.",
] as const;

export default function VoiceStudioPage() {
  const [tab, setTab] = useState<Tab>("my_voices");
  const [mine, setMine] = useState<VoiceClone[]>([]);
  const [presets, setPresets] = useState<VoiceClone[]>([]);
  const [renders, setRenders] = useState<VoiceRenderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/voice/clones");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Failed to load (${res.status})`);
      }
      setMine(data.mine || []);
      setPresets(data.presets || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Renders pulled lazily on tab switch.
  // Previously used a serial `for—await` loop (N+1 fetches). Now fires all
  // clone-detail requests in parallel with Promise.all — same result, far
  // faster when the user has multiple voice clones.
  const loadRenders = useCallback(async () => {
    try {
      const results = await Promise.all(
        mine.map(async (clone) => {
          const res = await fetch(`/api/voice/clones/${clone.id}`);
          if (!res.ok) return [] as VoiceRenderRow[];
          const data: { renders?: VoiceRenderRow[] } = await res.json();
          return (data.renders || []).map((r) => ({ ...r, clone_id: clone.id }));
        })
      );
      const all = results.flat().sort((a, b) =>
        b.rendered_at.localeCompare(a.rendered_at)
      );
      setRenders(all);
    } catch {
      // best-effort, leave whatever we had
    }
  }, [mine]);

  useEffect(() => {
    if (tab === "renders") loadRenders();
  }, [tab, loadRenders]);

  const stats = useMemo(() => {
    return {
      mineCount: mine.filter((c) => c.status === "ready").length,
      presetCount: presets.length,
      rendersThisMonth: renders.filter((r) => {
        const dt = new Date(r.rendered_at);
        const now = new Date();
        return (
          dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear()
        );
      }).length,
    };
  }, [mine, presets, renders]);

  return (
    <MotionPage className="min-h-screen pb-12">
      {/* Voice Studio header — editorial style + frequency visualizer accent */}
      <div className="relative overflow-hidden">
        <div className="flex items-center justify-between gap-4 relative z-10">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.2em] text-text-muted font-editorial italic mb-1 truncate">Audio Identity</p>
            <h1 className="text-2xl font-display font-bold text-text-primary truncate">Voice Studio</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {stats.mineCount > 0 && (
              <motion.span
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                className="hidden sm:flex items-center gap-1 text-[9px] font-semibold px-2 py-1 rounded-full bg-white/[0.05] border border-border-subtle text-brand-accent"
              >
                <span className="w-1 h-1 rounded-full bg-brand-accent animate-pulse" />
                {stats.mineCount} voice{stats.mineCount !== 1 ? "s" : ""}
              </motion.span>
            )}
            {stats.presetCount > 0 && (
              <span className="hidden md:flex items-center gap-1 text-[9px] text-text-secondary px-2 py-1 rounded-md bg-white/[0.02] border border-border-subtle">
                {stats.presetCount} presets
              </span>
            )}
            {/* Usage this month — driven by renders loaded lazily on the renders tab */}
            <span className="hidden lg:flex items-center gap-1 text-[9px] text-text-secondary px-2 py-1 rounded-md bg-white/[0.02] border border-border-subtle">
              {stats.rendersThisMonth > 0 ? `${stats.rendersThisMonth} renders this month` : "No renders yet"}
            </span>
            <button
              type="button"
              onClick={refresh}
              className="flex items-center gap-1.5 rounded-lg border border-border-subtle bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-medium text-text-secondary hover:text-text-primary hover:bg-white/[0.06] transition-colors duration-150"
            >
              <RefreshCw size={11} /> Refresh
            </button>
          </div>
        </div>
        {/* Frequency visualizer strip — EQ meter aesthetic, decorative only */}
        <div className="flex items-end gap-[1.5px] h-5 px-1 pointer-events-none overflow-hidden" aria-hidden="true">
          {Array.from({ length: 60 }, (_, i) => (
            <div
              key={i}
              style={{
                flex: "0 0 auto",
                width: 2.5,
                height: `${4 + ((i * 7 + i % 11) % 13)}px`,
                background: "#D4FF00",
                borderRadius: "1px 1px 0 0",
                opacity: 0.05 + (i % 6) * 0.012,
                animation: `waveBar ${1.5 + (i % 7) * 0.2}s ease-in-out infinite`,
                animationDelay: `${(i * 0.024).toFixed(3)}s`,
              }}
            />
          ))}
        </div>
      </div>
      <div className="mx-auto mt-4 max-w-7xl px-4 sm:px-6">
              {/* -- Tab bar -- */}
              <nav className="tab-pill-strip" aria-label="Voice Studio tabs">
                {TAB_ORDER.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={`tab-pill${tab === t ? " active" : ""}`}
                    aria-current={tab === t ? "page" : undefined}
                  >
                    {TAB_LABELS[t]}
                  </button>
                ))}
              </nav>

              {error && (
                <div className="mt-6 flex items-start gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-400">
                  <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-rose-400" />
                  <div>{error}</div>
                </div>
              )}

              <div className="mt-6">
                {loading && (
                  <div className="flex items-center justify-center py-12 text-text-secondary">
                    <Loader2 size={20} className="animate-spin" />
                  </div>
                )}
                {!loading && tab === "my_voices" && (
                  <MyVoicesTab clones={mine} onChange={refresh} />
                )}
                {tab === "presets" && <PresetsTab presets={presets} loading={loading} onRefresh={refresh} />}
                {!loading && tab === "renders" && <RendersTab renders={renders} />}
              </div>
            </div></MotionPage>
  );
}

// -- My Voices -----------------------------------------------------
function MyVoicesTab({
  clones,
  onChange,
}: {
  clones: VoiceClone[];
  onChange: () => void;
}) {
  return (
    <div className="space-y-6">
      <UploadCard onCreated={onChange} />
      {clones.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border-subtle bg-white/[0.02] p-12 text-center">
          <Mic size={32} className="text-text-secondary" />
          <h3 className="mt-4 text-base font-medium text-text-primary">
            No clones yet
          </h3>
          <p className="mt-1 max-w-sm text-sm text-text-secondary">
            Upload a 30-second clean recording above and we&apos;ll train a clone you
            can drop into cold calls, voicemails, SMS, and DMs.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {clones.map((c, index) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.05 }}
              whileHover={{ scale: 1.01 }}
            >
              <CloneRow clone={c} onChange={onChange} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function UploadCard({ onCreated }: { onCreated: () => void }) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [consentKind, setConsentKind] = useState<
    "self" | "client_signed" | "team_member_signed"
  >("self");
  const [signedBy, setSignedBy] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);

  const handleFiles = useCallback((list: FileList | null) => {
    if (!list) return;
    const next: File[] = [];
    for (const f of Array.from(list)) {
      if (!f.type.startsWith("audio/")) continue;
      next.push(f);
    }
    if (next.length === 0) {
      setSubmitMsg("Only audio files are accepted (mp3, wav, m4a, ogg).");
      return;
    }
    setFiles(next.slice(0, 10));
    setSubmitMsg(null);
  }, []);

  const onSubmit = useCallback(async () => {
    if (files.length === 0) {
      setSubmitMsg("Pick at least one audio sample.");
      return;
    }
    if (!label.trim()) {
      setSubmitMsg("Add a label so you can find this clone later.");
      return;
    }
    if (consentKind !== "self" && !signedBy.trim()) {
      setSubmitMsg(
        "Signed consent requires the signer's name to comply with voice-cloning consent rules.",
      );
      return;
    }

    setSubmitting(true);
    setSubmitMsg(null);

    const form = new FormData();
    form.append("label", label.trim());
    if (description.trim()) form.append("description", description.trim());
    form.append("consent_kind", consentKind);
    if (consentKind !== "self") {
      const evidence = {
        signed_by: signedBy.trim(),
        signed_at: new Date().toISOString(),
        ip: "captured-server-side",
      };
      form.append("consent_evidence", JSON.stringify(evidence));
    }
    for (const f of files) {
      form.append("samples", f, f.name);
    }

    try {
      const res = await fetch("/api/voice/clones", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Upload failed (${res.status})`);
      }
      toast.success(
        data.status === "ready"
          ? "Clone trained — try it from the row below."
          : "Training started — we'll mark it ready when the worker finishes.",
      );
      setFiles([]);
      setLabel("");
      setDescription("");
      setSignedBy("");
      setSubmitMsg(null);
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSubmitting(false);
    }
  }, [files, label, description, consentKind, signedBy, onCreated]);

  return (
    <div className="glass relative rounded-xl overflow-hidden p-6">
      <div className="flex items-start gap-4">
        <div className="rounded-lg border border-border-subtle bg-white/[0.04] p-2.5">
          <Upload size={20} className="text-brand-accent" />
        </div>
        <div className="flex-1 space-y-4">
          <div>
            <h3 className="text-base font-semibold text-text-primary">Train a new clone</h3>
            <p className="mt-1 text-sm text-text-secondary">
              Drop a clean 30 to 90 second sample. Free path uses your RunPod
              endpoint. ElevenLabs is the paid fallback when RunPod isn&apos;t
              configured.
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="audio/*"
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
          />
          {/* -- Upload drop zone -- */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/[0.10] px-4 py-6 text-sm text-brand-accent hover:border-white/[0.18] transition-colors"
            style={{ background: "rgba(255,255,255,0.03)" }}
          >
            <Upload size={16} />
            {files.length === 0
              ? "Choose audio samples (mp3, wav, m4a, ogg)"
              : `${files.length} sample${files.length === 1 ? "" : "s"} selected — click to replace`}
          </button>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label (e.g. 'My voice — natural')"
              className="rounded-lg border border-border-subtle bg-white/[0.06] px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-accent/40 focus:outline-none"
            />
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              className="rounded-lg border border-border-subtle bg-white/[0.06] px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-accent/40 focus:outline-none"
            />
          </div>

          <div className="rounded-lg border border-border-subtle bg-white/[0.02] p-3">
            <div className="text-xs uppercase tracking-wider text-text-secondary">
              Consent
            </div>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(
                [
                  { key: "self" as const, label: "Mine" },
                  { key: "client_signed" as const, label: "Client signed" },
                  {
                    key: "team_member_signed" as const,
                    label: "Team member signed",
                  },
                ]
              ).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setConsentKind(opt.key)}
                  className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                    consentKind === opt.key
                      ? "border-white/[0.15] bg-white/[0.06] text-brand-accent"
                      : "border-border-subtle bg-white/[0.02] text-text-secondary hover:bg-white/[0.05]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {consentKind !== "self" && (
              <input
                type="text"
                value={signedBy}
                onChange={(e) => setSignedBy(e.target.value)}
                placeholder="Signed by (legal name)"
                className="mt-2 w-full rounded-lg border border-border-subtle bg-white/[0.06] px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-accent/40 focus:outline-none"
              />
            )}
          </div>

          <div className="flex items-center justify-between gap-4">
            {submitMsg && (
              <div className="text-sm text-brand-accent/80">{submitMsg}</div>
            )}
            <button
              type="button"
              onClick={onSubmit}
              disabled={submitting}
              className="btn-pill ml-auto flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Sparkles size={14} />
              )}
              {submitting ? "Training..." : "Train clone"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Decorative static waveform bars — sits in right portion of audio track cards
function VoiceWaveformBg({ color = "#D4FF00", opacity = 0.07 }: { color?: string; opacity?: number }) {
  const bars = [3, 7, 11, 5, 15, 9, 13, 6, 17, 10, 8, 14, 4, 12, 7, 16, 5, 11, 8, 13, 6, 10, 15, 7, 12];
  return (
    <div
      className="absolute inset-y-0 right-0 flex items-center gap-[2.5px] pr-5 pointer-events-none overflow-hidden"
      aria-hidden="true"
      style={{ opacity }}
    >
      {bars.map((h, i) => (
        <div
          key={i}
          style={{
            width: 3,
            height: `${Math.round((h / 18) * 100)}%`,
            maxHeight: 36,
            minHeight: 4,
            background: color,
            borderRadius: 2,
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  );
}

function CloneRow({
  clone,
  onChange,
}: {
  clone: VoiceClone;
  onChange: () => void;
}) {
  const [testing, setTesting] = useState(false);
  const [testUrl, setTestUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onTest = useCallback(async () => {
    setTesting(true);
    setError(null);
    try {
      const res = await fetch(`/api/voice/clones/${clone.id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: TEST_PROMPT_DEFAULT }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Test failed (${res.status})`);
      }
      setTestUrl(data.r2_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test failed");
    } finally {
      setTesting(false);
    }
  }, [clone.id]);

  const onToggleDefault = useCallback(
    async (key: keyof VoiceClone) => {
      try {
        const next = !(clone[key] as boolean);
        const res = await fetch(`/api/voice/clones/${clone.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [key]: next }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || `Update failed (${res.status})`);
        }
        onChange();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Update failed");
      }
    },
    [clone, onChange],
  );

  const onDelete = useCallback(async () => {
    if (!window.confirm(`Delete clone "${clone.label}"? This cannot be undone.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/voice/clones/${clone.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Delete failed (${res.status})`);
      }
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }, [clone.id, clone.label, onChange]);

  // Status drives the left accent + waveform tint
  const statusColors = {
    training: "#D4FF00",
    ready: "#10B981",
    failed: "#F43F5E",
  } as const;
  const accentColor = statusColors[clone.status];

  return (
    <div
      className="relative overflow-hidden rounded-xl bg-[rgba(13,17,32,0.85)] border border-border-subtle transition-all duration-220 hover:border-[rgba(212,255,0,0.22)] hover:shadow-[0_4px_24px_rgba(0,0,0,0.18)]"
    >
      {/* Decorative waveform in right half */}
      <VoiceWaveformBg color={accentColor} opacity={clone.status === "ready" ? 0.07 : 0.04} />

      <div className="relative z-10 p-4">
        {/* Top row: name + meta + delete */}
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/dashboard/voice-studio/${clone.id}`}
                className="font-display text-base font-bold text-text-primary hover:text-brand-accent transition-colors"
              >
                {clone.label}
              </Link>
              <StatusChip status={clone.status} />
              <span className="text-[10px] text-text-muted uppercase tracking-wide">{clone.provider}</span>
              <span className="text-[10px] text-text-muted uppercase tracking-wide">{clone.language}</span>
            </div>
            {clone.description && (
              <p className="mt-0.5 text-xs text-text-secondary line-clamp-1">{clone.description}</p>
            )}
            {clone.failed_reason && (
              <p className="mt-1 text-xs text-rose-400">{clone.failed_reason}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete ${clone.label}`}
            className="flex-shrink-0 rounded-lg p-1.5 text-text-muted hover:text-rose-400 hover:bg-rose-500/10 transition-colors duration-150"
          >
            <Trash2 size={13} />
          </button>
        </div>

        {/* Audio section */}
        <div className="mt-3">
          {clone.status === "training" && (
            <div className="flex items-center gap-2 py-2 px-3 rounded-lg border border-[rgba(212,255,0,0.12)] bg-[rgba(212,255,0,0.04)]">
              <Loader2 size={12} className="animate-spin text-brand-accent flex-shrink-0" />
              <span className="text-xs text-text-secondary">Training your voice clone...</span>
            </div>
          )}
          {clone.status === "failed" && (
            <div className="flex items-center gap-2 py-2 px-3 rounded-lg border border-rose-500/20 bg-rose-500/[0.05]">
              <AlertTriangle size={12} className="text-rose-400 flex-shrink-0" />
              <span className="text-xs text-rose-400">Clone training failed</span>
            </div>
          )}
          {clone.status === "ready" && (
            testUrl ? (
              <div className="rounded-lg border border-[rgba(212,255,0,0.12)] bg-[rgba(212,255,0,0.04)] py-2 px-1">
                <AudioPlayer src={testUrl} />
              </div>
            ) : (
              <button
                type="button"
                onClick={onTest}
                disabled={testing}
                className="w-full group flex items-center gap-3 py-2.5 px-3 rounded-lg border border-dashed border-border-subtle hover:border-[rgba(212,255,0,0.25)] hover:bg-[rgba(212,255,0,0.03)] transition-colors duration-150 disabled:opacity-40 cursor-pointer"
              >
                <div className="flex items-end gap-[2px] h-5 flex-shrink-0" aria-hidden="true">
                  {[5, 9, 6, 13, 7, 11, 4, 10].map((h, i) => (
                    <div
                      key={i}
                      style={{
                        width: 2,
                        height: h,
                        background: "#D4FF00",
                        borderRadius: 1,
                        transformOrigin: "bottom",
                        animation: `waveBar ${0.6 + (i % 4) * 0.12}s ease-in-out infinite`,
                        animationDelay: `${i * 0.07}s`,
                      }}
                    />
                  ))}
                </div>
                <span className="text-xs text-text-muted group-hover:text-text-secondary transition-colors flex items-center gap-1.5">
                  {testing ? (
                    <><Loader2 size={11} className="animate-spin" /> Generating preview...</>
                  ) : (
                    <><Play size={11} /> Preview voice</>
                  )}
                </span>
              </button>
            )
          )}
        </div>

        {/* Surface flags — compact icon-only toggle row */}
        {clone.status === "ready" && (
          <div className="mt-3 flex items-center gap-1.5">
            <span className="text-[9px] uppercase tracking-wider text-text-muted mr-0.5">Deploy:</span>
            {SURFACE_FLAGS.map((f) => {
              const active = clone[f.key] as boolean;
              return (
                <button
                  key={String(f.key)}
                  type="button"
                  onClick={() => onToggleDefault(f.key)}
                  title={f.label}
                  className={`flex items-center justify-center w-7 h-7 rounded-md border transition-all duration-150 cursor-pointer ${
                    active
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                      : "border-border-subtle bg-white/[0.02] text-text-muted hover:bg-white/[0.05] hover:text-text-secondary"
                  }`}
                >
                  {f.icon}
                </button>
              );
            })}
          </div>
        )}

        {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: VoiceClone["status"] }) {
  const map = {
    training: { cls: "bg-[rgba(212,255,0,0.10)] text-brand-accent", label: "Training" },
    ready: { cls: "bg-emerald-500/15 text-emerald-400", label: "Ready" },
    failed: { cls: "bg-rose-500/15 text-rose-400", label: "Failed" },
  };
  const meta = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.cls}`}
    >
      {status === "training" && (
        <Loader2 size={10} className="animate-spin" />
      )}
      {meta.label}
    </span>
  );
}

// -- Custom Audio Player ---------------------------------------------
function AudioPlayer({ src, autoPlay = false }: { src: string; autoPlay?: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => { setPlaying(false); setProgress(0); };
    const onTime = () => { if (a.duration) setProgress(a.currentTime / a.duration); };
    const onMeta = () => setDuration(a.duration);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnded);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    if (autoPlay) a.play().catch(() => {});
    return () => {
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
    };
  }, [autoPlay]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) { a.play().catch(() => {}); } else { a.pause(); }
  };

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    return `${m}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-2.5 px-0.5">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause" : "Play"}
        className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-brand-accent text-[#020711] hover:bg-brand-accent/80 transition-colors cursor-pointer"
      >
        {playing ? <Pause size={9} /> : <Play size={9} />}
      </button>
      <div
        role="slider"
        aria-label="Playback position"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        tabIndex={0}
        className="flex-1 relative h-[3px] rounded-full bg-[rgba(212,255,0,0.10)] overflow-hidden cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-accent/50"
        onClick={(e) => {
          const a = audioRef.current;
          if (!a || !a.duration) return;
          const rect = e.currentTarget.getBoundingClientRect();
          a.currentTime = ((e.clientX - rect.left) / rect.width) * a.duration;
        }}
        onKeyDown={(e) => {
          const a = audioRef.current;
          if (!a) return;
          if (e.key === "ArrowRight") a.currentTime = Math.min(a.duration || 0, a.currentTime + 5);
          if (e.key === "ArrowLeft") a.currentTime = Math.max(0, a.currentTime - 5);
        }}
      >
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-brand-accent"
          style={{ width: `${progress * 100}%`, transition: "width 100ms linear" }}
        />
      </div>
      <span className="flex-shrink-0 text-[9px] tabular-nums text-text-secondary">
        {duration > 0 ? (playing ? fmt(progress * duration) : fmt(duration)) : "--:--"}
      </span>
    </div>
  );
}

// -- Presets -----------------------------------------------------
function inferGender(preset: VoiceClone): "female" | "male" | "neutral" {
  const eg = ((preset.consent_evidence?.gender as string) || "").toLowerCase();
  if (eg === "female" || eg === "f") return "female";
  if (eg === "male" || eg === "m") return "male";
  const text = `${preset.label} ${preset.description ?? ""}`.toLowerCase();
  if (/\b(female|woman|girl|her|she)\b/.test(text)) return "female";
  if (/\b(male|man|boy|his|he)\b/.test(text)) return "male";
  return "neutral";
}

// These must match the `category` field values defined in
// src/lib/voice/preset-library.ts — the filter reads
// `consent_evidence.category` from each seeded preset row.
const PRESET_CATEGORIES = ["all", "warm", "authoritative", "youthful", "narrator", "casual", "british"] as const;
type PresetCategory = (typeof PRESET_CATEGORIES)[number];

// Use-case tags displayed on cards + use for filter chips.
const USE_CASE_TAGS: Record<string, string[]> = {
  warm:          ["Cold calls", "Voicemails"],
  authoritative: ["Sales pitches", "Boardroom"],
  youthful:      ["Social media", "Ads"],
  narrator:      ["Video narration", "Training"],
  casual:        ["DMs", "Podcasts"],
  british:       ["Premium content", "Corporate"],
};

function presetUseCases(category: string): string[] {
  return USE_CASE_TAGS[category] ?? [];
}

function PresetsTab({ presets, loading, onRefresh }: { presets: VoiceClone[]; loading?: boolean; onRefresh?: () => void }) {
  const [categoryFilter, setCategoryFilter] = useState<PresetCategory>("all");
  const [langFilter, setLangFilter] = useState<string>("all");
  const [genderFilter, setGenderFilter] = useState<"all" | "female" | "male">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [previewOnly, setPreviewOnly] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set<string>();
    try {
      const raw = localStorage.getItem("ss-voice-favorites");
      return raw ? new Set<string>(JSON.parse(raw) as string[]) : new Set<string>();
    } catch { return new Set<string>(); }
  });

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem("ss-voice-favorites", JSON.stringify(Array.from(next))); } catch { /* noop */ }
      return next;
    });
  }, []);

  const resetFilters = useCallback(() => {
    setCategoryFilter("all");
    setLangFilter("all");
    setGenderFilter("all");
    setSearchQuery("");
    setPreviewOnly(false);
    setFavoritesOnly(false);
  }, []);

  // ── Batch pre-warm ────────────────────────────────────────────────────────
  // Iterates through all presets that lack a cached preview URL and generates
  // one via the test endpoint. Sequential (not parallel) to respect ElevenLabs
  // rate limits. Non-fatal: a failed preset is skipped, generation continues.
  const autoPreWarmFiredRef = useRef(false);
  const [preWarmActive, setPreWarmActive] = useState(false);
  const [preWarmDone, setPreWarmDone] = useState(0);
  const [preWarmTotal, setPreWarmTotal] = useState(0);

  // Persist preview audio URLs and custom test texts across tab switches.
  // Seeded from consent_evidence.preview_url so presets with stored ElevenLabs
  // preview URLs play instantly without requiring a live TTS API call.
  const [previewCache, setPreviewCache] = useState<Record<string, string>>({});
  const [textCache, setTextCache] = useState<Record<string, string>>({});

  // Seed previewCache from stored preview_url whenever the preset list loads or
  // refreshes. Never overwrites URLs that were already generated in this session.
  useEffect(() => {
    if (presets.length === 0) return;
    setPreviewCache((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const p of presets) {
        if (next[p.id]) continue; // already populated — keep the existing URL
        const stored = p.consent_evidence?.preview_url;
        if (typeof stored === "string" && stored) {
          next[p.id] = stored;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [presets]);

  // Number of presets that still need a preview URL generated.
  const preWarmGapCount = useMemo(
    () => presets.filter((p) => !previewCache[p.id]).length,
    [presets, previewCache],
  );

  // Sequentially generate preview audio for all gapped presets.
  const preWarmAll = useCallback(async () => {
    const gaps = presets.filter((p) => !previewCache[p.id]);
    if (gaps.length === 0 || preWarmActive) return;
    setPreWarmActive(true);
    setPreWarmDone(0);
    setPreWarmTotal(gaps.length);
    for (const p of gaps) {
      try {
        const res = await fetch(`/api/voice/clones/${p.id}/test`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: TEST_PROMPT_DEFAULT }),
        });
        if (res.ok) {
          const data = (await res.json()) as { r2_url?: string };
          const url = data.r2_url;
          if (typeof url === "string" && url) {
            // Functional update so we don't close over a stale cache snapshot.
            setPreviewCache((prev) => ({ ...prev, [p.id]: url }));
          }
        }
      } catch (err) {
        console.error("[voice-studio/pre-warm] failed for preset", p.id, err);
      }
      setPreWarmDone((n) => n + 1);
    }
    setPreWarmActive(false);
  }, [presets, previewCache, preWarmActive]);

  // Auto-trigger pre-warm once after presets load if there are gaps.
  // The 1 500ms delay lets the initial paint finish before API calls begin.
  // `autoPreWarmFiredRef` prevents re-triggering on subsequent re-renders.
  useEffect(() => {
    if (autoPreWarmFiredRef.current) return;
    if (presets.length === 0 || preWarmGapCount === 0) return;
    autoPreWarmFiredRef.current = true;
    const timer = setTimeout(() => { void preWarmAll(); }, 1500);
    return () => clearTimeout(timer);
  }, [presets.length, preWarmGapCount, preWarmAll]);

  const languages = useMemo(() => {
    const langs = new Set(presets.map((p) => p.language || "en").filter(Boolean));
    return ["all", ...Array.from(langs).sort()];
  }, [presets]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return presets
      .filter((p) => {
        const cat = (p.consent_evidence?.category as string) || "preset";
        if (categoryFilter !== "all" && cat !== categoryFilter) return false;
        if (langFilter !== "all" && (p.language || "en") !== langFilter) return false;
        if (genderFilter !== "all" && inferGender(p) !== genderFilter) return false;
        if (previewOnly && !p.consent_evidence?.preview_url) return false;
        if (favoritesOnly && !favorites.has(p.id)) return false;
        if (q && !`${p.label} ${p.description ?? ""}`.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => {
        // Starred presets float to the top; otherwise preserve original order.
        const aFav = favorites.has(a.id) ? 0 : 1;
        const bFav = favorites.has(b.id) ? 0 : 1;
        return aFav - bFav;
      });
  }, [presets, categoryFilter, langFilter, genderFilter, searchQuery, previewOnly, favoritesOnly, favorites]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-44 animate-pulse rounded-xl border border-border-subtle bg-white/[0.04]" />
        ))}
      </div>
    );
  }

  if (presets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border-subtle bg-white/[0.02] p-12 text-center">
        <Library size={28} className="text-text-secondary" />
        <h3 className="mt-3 text-base font-medium text-text-primary">No presets yet</h3>
        <p className="mt-1 max-w-sm text-sm text-text-secondary">
          Preset voices are seeded automatically on first dashboard load. Hit the button below if none appeared.
        </p>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="btn-pill mt-4 flex items-center gap-2"
          >
            <RefreshCw size={14} />
            Seed preset library
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="glass space-y-2.5 rounded-xl p-3">
        {/* Search row - count badge here so it does not compete with lang select */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search presets..."
              className="rounded-lg w-full border border-border-subtle bg-white/[0.03] py-1.5 pl-8 pr-3 text-xs text-text-primary placeholder-[#A1A1AA] focus:outline-none focus:border-brand-accent/40 focus:ring-1 focus:ring-brand-accent/30"
            />
          </div>
          <span className="flex-shrink-0 rounded-full border border-border-subtle bg-white/[0.03] px-2.5 py-1 text-[10px] font-medium text-text-secondary tabular-nums">
            {filtered.length}/{presets.length}
          </span>
          <button
            type="button"
            onClick={() => setPreviewOnly((v) => !v)}
            title="Show only presets with instant audio preview"
            className={[
              "flex-shrink-0 flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors duration-150 cursor-pointer",
              previewOnly
                ? "border border-white/[0.15] bg-white/[0.06] text-brand-accent"
                : "border border-border-subtle bg-white/[0.02] text-text-secondary hover:text-text-primary hover:bg-white/[0.05]",
            ].join(" ")}
          >
            <Play size={9} />
            Instant
          </button>
          <button
            type="button"
            onClick={() => setFavoritesOnly((v) => !v)}
            title="Show only starred presets"
            className={[
              "flex-shrink-0 flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors duration-150 cursor-pointer",
              favoritesOnly
                ? "border border-white/[0.15] bg-white/[0.06] text-yellow-400"
                : "border border-border-subtle bg-white/[0.02] text-text-secondary hover:text-text-primary hover:bg-white/[0.05]",
            ].join(" ")}
          >
            <Star size={9} fill={favoritesOnly ? "currentColor" : "none"} />
            Starred{favorites.size > 0 && <span className="tabular-nums">({favorites.size})</span>}
          </button>
          {/* Pre-warm: generate preview audio for all presets missing a cached URL */}
          {preWarmGapCount > 0 && (
            <button
              type="button"
              onClick={preWarmAll}
              disabled={preWarmActive}
              title={
                preWarmActive
                  ? `Generating previews… ${preWarmDone}/${preWarmTotal}`
                  : `Pre-generate audio for ${preWarmGapCount} preset${preWarmGapCount !== 1 ? "s" : ""} without instant preview`
              }
              className={[
                "flex-shrink-0 flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors duration-150",
                preWarmActive
                  ? "border border-brand-accent/30 bg-brand-accent/10 text-brand-accent cursor-wait"
                  : "border border-border-subtle bg-white/[0.02] text-text-secondary hover:text-brand-accent hover:bg-white/[0.05] cursor-pointer",
              ].join(" ")}
            >
              {preWarmActive ? (
                <>
                  <Loader2 size={9} className="animate-spin" />
                  <span className="tabular-nums">{preWarmDone}/{preWarmTotal}</span>
                </>
              ) : (
                <>
                  <Zap size={9} />
                  <span className="tabular-nums">{preWarmGapCount}</span>
                </>
              )}
            </button>
          )}
        </div>
        {/* Gender row */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-14 flex-shrink-0 text-[10px] uppercase tracking-wider text-text-secondary">Gender</span>
          {(["all", "female", "male"] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGenderFilter(g)}
              className={[
                "rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150 cursor-pointer",
                genderFilter === g
                  ? "border border-white/[0.15] bg-white/[0.06] text-brand-accent"
                  : "border border-border-subtle bg-white/[0.02] text-text-secondary hover:text-text-primary hover:bg-white/[0.05]",
              ].join(" ")}
            >
              {g === "all" ? "All" : g.charAt(0).toUpperCase() + g.slice(1)}
            </button>
          ))}
        </div>
        {/* Category + language row */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-1 flex-wrap gap-1.5">
            {PRESET_CATEGORIES.map((c) => {
              const isActive = categoryFilter === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategoryFilter(c)}
                  className="relative rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/60"
                  style={{ color: isActive ? "#D4FF00" : "#52525B" }}
                >
                  {isActive && (
                    <motion.span
                      layoutId="voice-category-pill"
                      className="absolute inset-0 rounded-full border border-white/[0.15] bg-white/[0.06]"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className="relative">
                    {c === "all" ? "All" : c.charAt(0).toUpperCase() + c.slice(1)}
                  </span>
                </button>
              );
            })}
          </div>
          {languages.length > 1 && (
            <select
              value={langFilter}
              onChange={(e) => setLangFilter(e.target.value)}
              className="flex-shrink-0 rounded-lg border border-border-subtle bg-white/[0.03] px-2 py-1 text-xs text-text-secondary focus:outline-none focus:ring-1 focus:ring-brand-accent/50 cursor-pointer"
            >
              {languages.map((l) => (
                <option key={l} value={l} className="bg-white">
                  {l === "all" ? "All langs" : l.toUpperCase()}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border-subtle bg-white/[0.02] p-8 text-center">
          <p className="text-sm text-text-secondary">No presets match the current filters.</p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-3 text-xs text-brand-accent hover:text-brand-accent/80 transition-colors cursor-pointer underline-offset-2 hover:underline"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p, index) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.05 }}
              className={index === 0 && filtered.length >= 3 ? "sm:col-span-2 lg:col-span-1 lg:row-span-1" : ""}
            >
              <PresetCard
                preset={p}
                cachedUrl={previewCache[p.id] ?? null}
                cachedText={textCache[p.id] ?? TEST_PROMPT_DEFAULT}
                onUrlCached={(url) => setPreviewCache((prev) => ({ ...prev, [p.id]: url }))}
                onTextChanged={(text) => setTextCache((prev) => ({ ...prev, [p.id]: text }))}
                onSaved={onRefresh}
                featured={index === 0 && filtered.length >= 3}
                favorited={favorites.has(p.id)}
                onToggleFavorite={() => toggleFavorite(p.id)}
              />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

interface PresetCardProps {
  preset: VoiceClone;
  /** Previously generated audio URL — survives tab switches. */
  cachedUrl: string | null;
  /** Previously typed test phrase — survives tab switches. */
  cachedText: string;
  onUrlCached: (url: string) => void;
  onTextChanged: (text: string) => void;
  /** Called after the preset is saved to My Voices so the parent can refresh. */
  onSaved?: () => void;
  /** First card in a filtered set — gets a "Featured" badge and shadow uplift. */
  featured?: boolean;
  /** Whether this preset is starred by the user. */
  favorited?: boolean;
  /** Called when the star button is toggled. */
  onToggleFavorite?: () => void;
}

function PresetCard({ preset, cachedUrl, cachedText, onUrlCached, onTextChanged, onSaved, featured, favorited, onToggleFavorite }: PresetCardProps) {
  const [testing, setTesting] = useState(false);
  const [testUrl, setTestUrl] = useState<string | null>(cachedUrl);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [testText, setTestText] = useState(cachedText);
  const [isHovering, setIsHovering] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // Voice-settings overrides (ElevenLabs/preset only) — shown in edit mode.
  const [stability, setStability] = useState(0.70);
  const [similarityBoost, setSimilarityBoost] = useState(0.80);
  const [styleExag, setStyleExag] = useState(0.0);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Keep previous audio URL while re-generating so the player doesn't vanish.
  const prevUrlRef = useRef<string | null>(cachedUrl);

  // Sync testUrl when the parent seeds a stored preview URL into previewCache.
  // previewCache is populated in a second render cycle (useEffect in PresetsTab)
  // after presets load, but useState(cachedUrl) only evaluates once — so without
  // this sync, testUrl would stay null for presets that have a stored audio URL.
  useEffect(() => {
    setTestUrl((prev) => prev ?? cachedUrl);
    if (cachedUrl && !prevUrlRef.current) prevUrlRef.current = cachedUrl;
  }, [cachedUrl]);

  // Auto-focus the textarea when entering edit mode.
  useEffect(() => {
    if (editMode && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [editMode]);

  type TtsSignal = { id: string; label: string; tip: string; pass: boolean };

  const ttsQualitySignals = useMemo((): TtsSignal[] => {
    const text = testText.trim();
    if (!text) return [];

    // Complete: ends with sentence-ending punctuation
    const isComplete = /[.!?]$/.test(text);

    // Length: substantive but not a marathon take
    const charLen = text.length;
    const goodLength = charLen >= 10 && charLen <= 250;

    // No glitch chars: symbols TTS engines mangle (& % @ # standalone slash)
    // Using [A-Z] range checks — no /u flag needed, safe at ES3 target
    const glitchRe = /[&@#]|\bvs\.?\s|\bw\/\b|\/[a-z]/i;
    const noGlitchChars = !glitchRe.test(text);

    // No shout-caps: all-uppercase words ≥ 4 letters get spelled out by TTS
    const shoutRe = /\b[A-Z]{4,}\b/;
    const noShoutCaps = !shoutRe.test(text);

    // Natural flow: has at least one pause marker OR sentence is ≤ 12 words
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const hasPause = /[,;:\-–—]/.test(text) || wordCount <= 12;

    return [
      { id: "complete",  label: "Complete",   tip: "End with . ! or ? so TTS delivers a clean, confident stop",             pass: isComplete },
      { id: "length",    label: "Length",     tip: "10–250 chars — short enough for a clean take, long enough to judge",     pass: goodLength },
      { id: "clean",     label: "Clean",      tip: "Remove & @ # and slashes — TTS reads symbols awkwardly or skips them",   pass: noGlitchChars },
      { id: "nocaps",    label: "No Shout",   tip: "Avoid ALL-CAPS words ≥ 4 letters — TTS spells each letter individually", pass: noShoutCaps },
      { id: "flow",      label: "Flow",       tip: "Add a comma or dash for a natural breathing pause in longer phrases",    pass: hasPause },
    ];
  }, [testText]);

  const ttsQualityScore = useMemo(() => {
    if (ttsQualitySignals.length === 0) return 0;
    const passing = ttsQualitySignals.filter((s) => s.pass).length;
    return Math.round((passing / ttsQualitySignals.length) * 100);
  }, [ttsQualitySignals]);

  const onTest = useCallback(async () => {
    setTesting(true);
    setError(null);
    // Don't wipe testUrl here — keep the old audio until the new one arrives.
    const isElevenProvider = preset.provider === "preset" || preset.provider === "elevenlabs";
    try {
      const res = await fetch(`/api/voice/clones/${preset.id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: testText.trim() || TEST_PROMPT_DEFAULT,
          // Only forward voice settings for ElevenLabs-backed voices.
          ...(isElevenProvider && {
            stability,
            similarityBoost,
            style: styleExag,
          }),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Test failed (${res.status})`);
      prevUrlRef.current = data.r2_url;
      setTestUrl(data.r2_url);
      onUrlCached(data.r2_url);
    } catch (err) {
      console.error("[voice-studio/preset-test] failed:", err);
      setError(err instanceof Error ? err.message : "Test failed");
    } finally {
      setTesting(false);
    }
  }, [preset.id, testText, onUrlCached]);

  const onSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/voice/presets/${preset.id}/use`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setSaved(true);
      onSaved?.();
    } catch (err) {
      console.error("[voice-studio/preset-save] failed:", err);
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [preset.id, onSaved]);

  const category = (preset.consent_evidence?.category as string) || "preset";
  const gender = (preset.consent_evidence?.gender as string) || null;
  const lang = preset.language?.toUpperCase() || "EN";

  return (
    <div
      className={`glass group flex flex-col rounded-xl cursor-pointer overflow-hidden transition-all duration-200 min-h-[220px] hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] spotlight-card`}
      style={{ border: featured ? "1px solid rgba(212,255,0,0.35)" : "1px solid rgba(212,255,0,0.10)"}}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
        e.currentTarget.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
      }}
      onMouseEnter={() => {
        setIsHovering(true);
        if (testUrl || testing) return;
        hoverTimerRef.current = setTimeout(() => { onTest(); }, 700);
      }}
      onMouseLeave={() => {
        setIsHovering(false);
        if (hoverTimerRef.current) { clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null; }
      }}
    >
      <div className="p-5 flex flex-col flex-1">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-border-subtle bg-white/[0.04] text-brand-accent">
            <Mic size={16} />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {onToggleFavorite && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
                title={favorited ? "Remove from favorites" : "Add to favorites"}
                className={[
                  "flex items-center justify-center w-5 h-5 transition-colors duration-150 cursor-pointer",
                  favorited ? "text-yellow-400" : "text-text-muted hover:text-yellow-400",
                ].join(" ")}
              >
                <Star size={12} fill={favorited ? "currentColor" : "none"} />
              </button>
            )}
            {featured && (
              <span className="text-[10px] font-semibold bg-[rgba(212,255,0,0.10)] text-brand-accent px-2 py-0.5 rounded-full uppercase tracking-wide">
                Featured
              </span>
            )}
            <span className="rounded-full border border-border-subtle bg-white/[0.04] px-2 py-0.5 text-[10px] uppercase tracking-wider text-text-secondary">
              {lang}
            </span>
            {gender && (
              <span className="rounded-full border border-border-subtle bg-white/[0.04] px-2 py-0.5 text-[10px] uppercase tracking-wider text-text-secondary">
                {gender === "female" ? "F" : "M"}
              </span>
            )}
            <span className="rounded-full border border-border-subtle bg-white/[0.04] px-2 py-0.5 text-[10px] uppercase tracking-wider text-brand-accent">
              {category}
            </span>
          </div>
        </div>

        {/* Info */}
        <h3 className="mt-3 text-sm font-semibold text-text-primary">{preset.label}</h3>
        {preset.description && (
          <p className="mt-1 text-xs text-text-secondary leading-relaxed">{preset.description}</p>
        )}
        {(() => {
          const tags = presetUseCases(category);
          if (tags.length === 0) return null;
          return (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded px-1.5 py-0.5 text-[9px] font-medium border border-border-subtle bg-white/[0.03] text-text-muted"
                >
                  {tag}
                </span>
              ))}
            </div>
          );
        })()}
        {!testUrl && !editMode && (
          <button
            type="button"
            onClick={() => { if (!testing) onTest(); }}
            disabled={testing}
            aria-label={testing ? "Generating preview..." : "Click to preview this voice"}
            className="mt-3 w-full flex flex-col items-center gap-1.5 py-3 rounded-lg border border-dashed border-border-subtle bg-white/[0.02] hover:border-[rgba(212,255,0,0.25)] hover:bg-[rgba(212,255,0,0.03)] transition-colors duration-200 cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-accent/40 group/play"
          >
            {/* waveform bars - animate when hovering or generating */}
            <div className="flex items-end justify-center gap-[2px] h-6 opacity-40 group-hover/play:opacity-80 transition-opacity duration-200" aria-hidden="true">
              {[5, 9, 6, 13, 7, 11, 4, 14, 8, 10, 5, 12, 7, 9, 4].map((h, i) => (
                <div
                  key={i}
                  style={{
                    width: 2.5,
                    height: h,
                    background: "#D4FF00",
                    borderRadius: 2,
                    transformOrigin: "bottom",
                    animation: isHovering || testing
                      ? `waveBar ${0.55 + (i % 5) * 0.07}s ease-in-out infinite`
                      : `waveBar ${2.4 + (i % 5) * 0.28}s ease-in-out infinite`,
                    animationDelay: `${(i * (isHovering || testing ? 0.045 : 0.11)).toFixed(3)}s`,
                  }}
                />
              ))}
            </div>
            <span className="text-[10px] text-text-secondary group-hover/play:text-brand-accent transition-colors duration-200 flex items-center gap-1">
              {testing
                ? <><Loader2 size={10} className="animate-spin" />{" "}Generating...</>
                : <><Play size={10} />{" "}Click to preview</>}
            </span>
          </button>
        )}

        {/* Edit test text */}
        {editMode ? (
          <div className="mt-3 space-y-1.5">
            <textarea
              ref={textareaRef}
              value={testText}
              onChange={(e) => { setTestText(e.target.value); onTextChanged(e.target.value); }}
              rows={3}
              maxLength={300}
              placeholder="Type what you want the voice to say…"
              className="w-full rounded-lg border border-border-subtle bg-white/[0.06] px-3 py-2 text-xs text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-brand-accent/50 resize-none"
            />
            {/* Voice-settings sliders — ElevenLabs/preset only */}
            {(preset.provider === "preset" || preset.provider === "elevenlabs") && (
              <div className="space-y-1.5 pt-1 pb-0.5">
                {(
                  [
                    { label: "Clarity", hint: "stability", val: stability, set: setStability, min: 0, max: 1, step: 0.05 },
                    { label: "Match", hint: "similarity", val: similarityBoost, set: setSimilarityBoost, min: 0, max: 1, step: 0.05 },
                    { label: "Style", hint: "exaggeration", val: styleExag, set: setStyleExag, min: 0, max: 0.5, step: 0.05 },
                  ] as Array<{ label: string; hint: string; val: number; set: (v: number) => void; min: number; max: number; step: number }>
                ).map(({ label, hint, val, set, min, max, step }) => (
                  <div key={hint} className="flex items-center gap-2">
                    <span className="w-11 shrink-0 text-[9px] font-medium text-text-secondary">{label}</span>
                    <input
                      type="range"
                      min={min}
                      max={max}
                      step={step}
                      value={val}
                      onChange={(e) => set(parseFloat(e.target.value))}
                      className="flex-1 h-1 cursor-pointer accent-[#D4FF00]"
                    />
                    <span className="w-6 shrink-0 text-right text-[9px] tabular-nums text-text-muted">
                      {val.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {/* TTS Readability panel — visible while editing */}
            {ttsQualitySignals.length > 0 && (
              <div className="rounded-lg p-2"
                style={{ background: "rgba(19,24,39,0.55)", border: "1px solid rgba(212,255,0,0.08)" }}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1">
                    <TrendingUp size={8} style={{ color: ttsQualityScore >= 80 ? "#4ade80" : ttsQualityScore >= 50 ? "#fbbf24" : "#f87171" }} />
                    <span className="text-[8px] font-semibold tracking-wide text-text-muted">TTS READY</span>
                  </div>
                  <span className="text-[9px] font-bold tabular-nums"
                    style={{ color: ttsQualityScore >= 80 ? "#4ade80" : ttsQualityScore >= 50 ? "#fbbf24" : "#f87171" }}>
                    {ttsQualityScore}%
                  </span>
                </div>
                <div className="h-[1px] rounded-full mb-1.5 overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${ttsQualityScore}%`,
                      background: ttsQualityScore >= 80
                        ? "linear-gradient(90deg,#16a34a,#4ade80)"
                        : ttsQualityScore >= 50
                          ? "linear-gradient(90deg,#d97706,#fbbf24)"
                          : "linear-gradient(90deg,#dc2626,#f87171)",
                    }} />
                </div>
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {ttsQualitySignals.map((s) => (
                    <span key={s.id} title={s.tip}
                      className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-medium cursor-default select-none"
                      style={{
                        background: s.pass ? "rgba(74,222,128,0.10)" : "rgba(255,255,255,0.04)",
                        color: s.pass ? "#4ade80" : "#52525B",
                        border: `1px solid ${s.pass ? "rgba(74,222,128,0.22)" : "rgba(255,255,255,0.07)"}`,
                      }}>
                      <span style={{ fontSize: "6px" }}>{s.pass ? "✓" : "–"}</span>
                      {s.label}
                    </span>
                  ))}
                </div>
                <p className="text-[8px] leading-relaxed" style={{ color: "#52525B" }}>
                  {(() => {
                    const first = ttsQualitySignals.find((s) => !s.pass);
                    return first ? first.tip : "Phrase looks TTS-ready — clean and natural.";
                  })()}
                </p>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-text-secondary">{testText.length}/300</span>
                <button
                  type="button"
                  title="Try a different sample phrase"
                  onClick={() => {
                    const others = SAMPLE_PHRASES.filter((p) => p !== testText);
                    const next = others[Math.floor(Math.random() * others.length)];
                    setTestText(next);
                    onTextChanged(next);
                  }}
                  className="text-[10px] text-text-secondary hover:text-brand-accent transition-colors duration-150 cursor-pointer underline-offset-2 hover:underline"
                >
                  Shuffle
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => { setEditMode(false); onTest(); }}
                  className="btn-pill text-[10px] px-2.5 py-1 flex items-center gap-1"
                >
                  <Play size={9} />
                  Hear it
                </button>
                <button
                  type="button"
                  onClick={() => setEditMode(false)}
                  className="rounded-lg border border-border-subtle bg-white/[0.03] px-2.5 py-1 text-[10px] text-text-secondary hover:text-text-primary cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-3">
            <div className="flex items-center justify-between gap-1 mb-0.5">
              <span className="text-[9px] font-medium uppercase tracking-wider text-text-secondary">Sample phrase</span>
              <button
                type="button"
                onClick={() => setEditMode(true)}
                className="flex-shrink-0 rounded border border-border-subtle bg-white/[0.03] px-2 py-0.5 text-[11px] text-text-secondary hover:border-brand-accent/40 hover:text-brand-accent transition-colors duration-150 cursor-pointer"
                aria-label="Edit test phrase"
              >
                Edit
              </button>
            </div>
            <p className="truncate text-[11px] text-text-secondary italic">{testText}</p>
          </div>
        )}

        {/* Audio player - shown above actions; kept visible while re-generating */}
        {(testUrl || (testing && prevUrlRef.current)) && (
          <div className="relative mt-3 rounded-lg border border-[rgba(212,255,0,0.12)] bg-[rgba(212,255,0,0.04)] py-2 px-1">
            <AudioPlayer src={testUrl ?? prevUrlRef.current ?? ""} />
            {testing && (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/[0.06]">
                <Loader2 size={16} className="animate-spin text-brand-accent" />
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={onTest}
            disabled={testing}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border-subtle bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-white/[0.06] transition-colors duration-150 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
          >
            {testing ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Play size={12} />
            )}
            {testing ? "Generating..." : testUrl ? "Re-generate" : "Preview"}
          </button>

          {/* Save to My Voices */}
          <button
            type="button"
            onClick={onSave}
            disabled={saving || saved}
            title={saved ? "Already in My Voices" : "Save to My Voices"}
            className={[
              "flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors duration-150 cursor-pointer disabled:cursor-not-allowed",
              saved
                ? "border-border-subtle bg-white/[0.04] text-brand-accent"
                : "border-border-subtle bg-white/[0.03] text-text-secondary hover:bg-white/[0.06] hover:text-text-primary",
            ].join(" ")}
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : saved ? <CheckCircle2 size={12} /> : <Sparkles size={12} />}
            {saved ? "Saved" : "Use"}
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
      </div>
    </div>
  );
}

// -- Renders -----------------------------------------------------
const R2_BASE = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "";

function RendersTab({ renders }: { renders: VoiceRenderRow[] }) {
  const [playingId, setPlayingId] = useState<string | null>(null);

  if (renders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border-subtle bg-white/[0.02] p-12 text-center">
        <Headphones size={28} className="text-text-secondary" />
        <h3 className="mt-3 text-base font-medium text-text-primary">No renders yet</h3>
        <p className="mt-1 max-w-sm text-sm text-text-secondary">
          Renders show up here once your clones synthesise audio for cold calls,
          voicemails, SMS, or DMs.
        </p>
      </div>
    );
  }
  return (
    <div className="glass rounded-xl overflow-hidden">
      <div className="divide-y divide-white/[0.06]">
        {renders.map((r, index) => {
          const audioUrl = r.r2_key ? `${R2_BASE}/${r.r2_key}` : null;
          const isOpen = playingId === r.id;
          return (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.04 }}
              className="p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1 min-w-[200px]">
                  <p className="text-sm text-text-primary">{r.text_preview}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-text-secondary">
                    <span>
                      {new Date(r.rendered_at).toLocaleString(undefined, {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>
                    {r.duration_seconds !== null && (
                      <span>· {Math.round(r.duration_seconds)}s</span>
                    )}
                    <span>· used {r.use_count}·</span>
                    {r.context && (
                      <span className="rounded-full border border-border-subtle bg-white/[0.04] px-2 py-0.5 uppercase tracking-wider text-text-secondary">
                        {r.context}
                      </span>
                    )}
                  </div>
                </div>
                {audioUrl && (
                  <button
                    type="button"
                    onClick={() => setPlayingId(isOpen ? null : r.id)}
                    className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-border-subtle bg-white/[0.03] px-3 py-1.5 text-xs text-text-secondary hover:bg-white/[0.06] hover:text-text-primary transition-colors duration-150 cursor-pointer"
                    aria-label={isOpen ? "Close audio player" : "Play render"}
                  >
                    {isOpen ? <Pause size={12} /> : <Play size={12} />}
                    {isOpen ? "Close" : "Play"}
                  </button>
                )}
              </div>
              {isOpen && audioUrl && (
                <div className="mt-3 rounded-lg border border-[rgba(212,255,0,0.12)] bg-[rgba(212,255,0,0.04)] py-2 px-1">
                  <AudioPlayer src={audioUrl} autoPlay />
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

