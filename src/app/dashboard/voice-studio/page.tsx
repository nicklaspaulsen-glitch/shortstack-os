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
} from "lucide-react";
import Link from "next/link";

// ── Types ──────────────────────────────────────────────────────────
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
  const loadRenders = useCallback(async () => {
    try {
      const all: VoiceRenderRow[] = [];
      for (const clone of mine) {
        const res = await fetch(`/api/voice/clones/${clone.id}`);
        if (res.ok) {
          const data = await res.json();
          for (const r of data.renders || []) {
            all.push({ ...r, clone_id: clone.id });
          }
        }
      }
      all.sort((a, b) => b.rendered_at.localeCompare(a.rendered_at));
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
    <div className="min-h-screen pb-12">
      {/* ── Custom hero: OLED dark, no PageHero generic gradient ── */}
      <div className="relative rounded-2xl bg-[#0E0D14] border border-[rgba(255,255,255,0.05)] overflow-hidden">
        {/* Subtle indigo glow top-right */}
        <div
          className="absolute top-0 right-1/3 w-80 h-24 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at center, rgba(99,102,241,0.08) 0%, transparent 70%)" }}
        />
        {/* Lime micro-line bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#6366F1]/12 to-transparent" />

        {/* Top row — eyebrow + title + actions */}
        <div className="relative z-10 px-6 pt-5 pb-4 flex items-start justify-between gap-6 flex-wrap">
          <div>
            <p className="text-[9px] uppercase tracking-[0.24em] text-[#6366F1] font-semibold mb-2">Voice Studio</p>
            <h1
              className="font-display font-bold text-[#F5F4F1] tracking-[-0.04em] leading-none mb-1.5"
              style={{ fontSize: "clamp(26px,3.5vw,40px)" }}
            >
              Voice Studio
            </h1>
            <p className="text-sm text-[#9F9DAA]">Clone your voice, browse presets, and route audio into the dialer, voicemail, SMS, and DMs.</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 pt-1">
            <button
              type="button"
              onClick={refresh}
              className="flex items-center gap-2 rounded-xl border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.05)] px-3 py-1.5 text-xs font-medium text-[#9F9DAA] hover:text-[#F5F4F1] hover:bg-[rgba(255,255,255,0.08)] transition-colors duration-150"
            >
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
        </div>

        {/* Bottom row — 3-cell scorecard strip */}
        <div className="relative z-10 border-t border-[rgba(255,255,255,0.05)] grid grid-cols-3 divide-x divide-[rgba(255,255,255,0.05)]">
          <div className="px-5 py-3.5 flex flex-col gap-1">
            <span className="text-[9px] uppercase tracking-[0.12em] text-[#6F6D7A] font-semibold">Your Clones</span>
            <span className="font-display text-xl font-bold tracking-[-0.03em] text-[#6366F1]" style={{ fontVariantNumeric: "tabular-nums" }}>
              {stats.mineCount}
            </span>
          </div>
          <div className="px-5 py-3.5 flex flex-col gap-1">
            <span className="text-[9px] uppercase tracking-[0.12em] text-[#6F6D7A] font-semibold">Preset Library</span>
            <span className="font-display text-xl font-bold tracking-[-0.03em] text-[#F5F4F1]" style={{ fontVariantNumeric: "tabular-nums" }}>
              {stats.presetCount}
            </span>
          </div>
          <div className="px-5 py-3.5 flex flex-col gap-1">
            <span className="text-[9px] uppercase tracking-[0.12em] text-[#6F6D7A] font-semibold">Renders This Month</span>
            <span className="font-display text-xl font-bold tracking-[-0.03em] text-[#F5F4F1]" style={{ fontVariantNumeric: "tabular-nums" }}>
              {stats.rendersThisMonth}
            </span>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-6 max-w-7xl px-4 sm:px-6">
        <div className="border-b border-white/10">
          <nav className="flex gap-1 overflow-x-auto" aria-label="Voice Studio tabs">
            {TAB_ORDER.map((t) => {
              const isActive = tab === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                    isActive
                      ? "border-[#6366F1] text-[#6366F1]"
                      : "border-transparent text-white/60 hover:text-white"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  {TAB_LABELS[t]}
                </button>
              );
            })}
          </nav>
        </div>

        {error && (
          <div className="mt-6 flex items-start gap-3 rounded-lg border border-rose-500/30 bg-rose-950/40 p-4 text-sm text-rose-200">
            <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" />
            <div>{error}</div>
          </div>
        )}

        <div className="mt-6">
          {loading && (
            <div className="flex items-center justify-center py-12 text-white/60">
              <Loader2 size={20} className="animate-spin" />
            </div>
          )}
          {!loading && tab === "my_voices" && (
            <MyVoicesTab clones={mine} onChange={refresh} />
          )}
          {tab === "presets" && <PresetsTab presets={presets} loading={loading} onRefresh={refresh} />}
          {!loading && tab === "renders" && <RendersTab renders={renders} />}
        </div>
      </div>
    </div>
  );
}

// ── My Voices ─────────────────────────────────────────────────────
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
        <div className="flex flex-col items-center justify-center rounded-xl border border-white/10 bg-white/5 p-12 text-center">
          <Mic size={32} className="text-white/40" />
          <h3 className="mt-4 text-base font-medium text-white">
            No clones yet
          </h3>
          <p className="mt-1 max-w-sm text-sm text-white/60">
            Upload a 30-second clean recording above and we&apos;ll train a clone you
            can drop into cold calls, voicemails, SMS, and DMs.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {clones.map((c) => (
            <CloneRow key={c.id} clone={c} onChange={onChange} />
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
      setSubmitMsg(
        data.status === "ready"
          ? "Clone trained successfully — try it from the row below."
          : "Clone training started — we'll mark it ready when the worker finishes.",
      );
      setFiles([]);
      setLabel("");
      setDescription("");
      setSignedBy("");
      onCreated();
    } catch (err) {
      setSubmitMsg(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSubmitting(false);
    }
  }, [files, label, description, consentKind, signedBy, onCreated]);

  return (
    <div className="rounded-xl border border-[rgba(99,102,241,0.12)] bg-gradient-to-br from-[rgba(99,102,241,0.04)] to-transparent p-6">
      <div className="flex items-start gap-4">
        <div className="rounded-lg border border-[rgba(99,102,241,0.2)] bg-[rgba(99,102,241,0.07)] p-2.5">
          <Upload size={20} className="text-[#6366F1]" />
        </div>
        <div className="flex-1 space-y-4">
          <div>
            <h3 className="text-base font-semibold text-white">Train a new clone</h3>
            <p className="mt-1 text-sm text-white/70">
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
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[rgba(99,102,241,0.25)] bg-[rgba(99,102,241,0.03)] px-4 py-6 text-sm text-[#6366F1]/80 hover:border-[rgba(99,102,241,0.45)] hover:bg-[rgba(99,102,241,0.06)] transition-colors"
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
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[rgba(99,102,241,0.4)] focus:outline-none"
            />
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[rgba(99,102,241,0.4)] focus:outline-none"
            />
          </div>

          <div className="rounded-lg border border-white/10 bg-black/20 p-3">
            <div className="text-xs uppercase tracking-wider text-white/50">
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
                      ? "border-[rgba(99,102,241,0.3)] bg-[rgba(99,102,241,0.08)] text-[#6366F1]"
                      : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
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
                className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[rgba(99,102,241,0.4)] focus:outline-none"
              />
            )}
          </div>

          <div className="flex items-center justify-between gap-4">
            {submitMsg && (
              <div className="text-sm text-[#6366F1]/80">{submitMsg}</div>
            )}
            <button
              type="button"
              onClick={onSubmit}
              disabled={submitting}
              className="ml-auto flex items-center gap-2 rounded-lg bg-[#6366F1] px-4 py-2 text-sm font-medium text-white hover:bg-[#6366F1]/90 transition-colors disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/50"
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

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(99,102,241,0.2)] bg-[rgba(99,102,241,0.07)] text-[#6366F1]">
          <Mic size={20} />
        </div>
        <div className="flex-1 min-w-[180px]">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/dashboard/voice-studio/${clone.id}`}
              className="text-sm font-semibold text-white hover:text-[#6366F1] transition-colors"
            >
              {clone.label}
            </Link>
            <StatusChip status={clone.status} />
            <span className="rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/60">
              {clone.provider}
            </span>
            <span className="rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/60">
              {clone.language}
            </span>
          </div>
          {clone.description && (
            <p className="mt-1 text-xs text-white/60">{clone.description}</p>
          )}
          {clone.failed_reason && (
            <p className="mt-1 text-xs text-rose-300">
              {clone.failed_reason}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onTest}
            disabled={testing || clone.status !== "ready"}
            className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {testing ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Play size={12} />
            )}
            Test playback
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-200 hover:bg-rose-500/20"
          >
            <Trash2 size={12} />
            Delete
          </button>
        </div>
      </div>

      {testUrl && (
        <div className="mt-3 rounded-lg border border-white/10 bg-black/30 p-3">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio src={testUrl} controls className="w-full" />
        </div>
      )}
      {error && (
        <p className="mt-2 text-xs text-rose-300">{error}</p>
      )}

      {clone.status === "ready" && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-white/50">
            Default for:
          </span>
          {SURFACE_FLAGS.map((f) => {
            const active = clone[f.key] as boolean;
            return (
              <button
                key={String(f.key)}
                type="button"
                onClick={() => onToggleDefault(f.key)}
                className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  active
                    ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-200"
                    : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10"
                }`}
              >
                {active && <CheckCircle2 size={10} />}
                {f.icon}
                {f.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusChip({ status }: { status: VoiceClone["status"] }) {
  const map = {
    training: { cls: "bg-amber-500/15 text-amber-200", label: "Training" },
    ready: { cls: "bg-emerald-500/15 text-emerald-200", label: "Ready" },
    failed: { cls: "bg-rose-500/15 text-rose-200", label: "Failed" },
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

// ── Presets ─────────────────────────────────────────────────────
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

function PresetsTab({ presets, loading, onRefresh }: { presets: VoiceClone[]; loading?: boolean; onRefresh?: () => void }) {
  const [categoryFilter, setCategoryFilter] = useState<PresetCategory>("all");
  const [langFilter, setLangFilter] = useState<string>("all");
  const [genderFilter, setGenderFilter] = useState<"all" | "female" | "male">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
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

  const languages = useMemo(() => {
    const langs = new Set(presets.map((p) => p.language || "en").filter(Boolean));
    return ["all", ...Array.from(langs).sort()];
  }, [presets]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return presets.filter((p) => {
      const cat = (p.consent_evidence?.category as string) || "preset";
      if (categoryFilter !== "all" && cat !== categoryFilter) return false;
      if (langFilter !== "all" && (p.language || "en") !== langFilter) return false;
      if (genderFilter !== "all" && inferGender(p) !== genderFilter) return false;
      if (q && !`${p.label} ${p.description ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [presets, categoryFilter, langFilter, genderFilter, searchQuery]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-44 animate-pulse rounded-xl border border-white/10 bg-white/5" />
        ))}
      </div>
    );
  }

  if (presets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-white/10 bg-white/5 p-12 text-center">
        <Library size={28} className="text-white/40" />
        <h3 className="mt-3 text-base font-medium text-white">No presets yet</h3>
        <p className="mt-1 max-w-sm text-sm text-white/60">
          Preset voices are seeded automatically on first dashboard load. Hit the button below if none appeared.
        </p>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="mt-4 flex items-center gap-2 rounded-lg bg-[#6366F1] px-4 py-2 text-sm font-medium text-white hover:bg-[#5E5BFF] transition-colors cursor-pointer"
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
      <div className="space-y-2.5 rounded-xl border border-white/8 bg-white/[0.03] p-3">
        {/* Search row */}
        <div className="relative">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search presets…"
            className="w-full rounded-lg border border-white/10 bg-black/30 py-1.5 pl-8 pr-3 text-xs text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#6366F1]/50"
          />
        </div>
        {/* Gender row */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-14 flex-shrink-0 text-[10px] uppercase tracking-wider text-white/30">Gender</span>
          {(["all", "female", "male"] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGenderFilter(g)}
              className={[
                "rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150 cursor-pointer",
                genderFilter === g
                  ? "border border-[rgba(99,102,241,0.3)] bg-[rgba(99,102,241,0.08)] text-[#6366F1]"
                  : "border border-white/10 bg-white/5 text-white/60 hover:text-white hover:bg-white/10",
              ].join(" ")}
            >
              {g === "all" ? "All" : g.charAt(0).toUpperCase() + g.slice(1)}
            </button>
          ))}
        </div>
        {/* Category + language row */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5">
            {PRESET_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategoryFilter(c)}
                className={[
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150 cursor-pointer",
                  categoryFilter === c
                    ? "border border-[rgba(99,102,241,0.3)] bg-[rgba(99,102,241,0.1)] text-[#6366F1] shadow-[0_0_10px_rgba(99,102,241,0.1)]"
                    : "border border-white/10 bg-white/5 text-white/60 hover:text-white hover:bg-white/10",
                ].join(" ")}
              >
                {c === "all" ? "All" : c.charAt(0).toUpperCase() + c.slice(1)}
              </button>
            ))}
          </div>
          {languages.length > 1 && (
            <select
              value={langFilter}
              onChange={(e) => setLangFilter(e.target.value)}
              className="ml-auto rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/70 focus:outline-none focus:ring-1 focus:ring-[#6366F1]/50 cursor-pointer"
            >
              {languages.map((l) => (
                <option key={l} value={l} className="bg-[#17171A]">
                  {l === "all" ? "All languages" : l.toUpperCase()}
                </option>
              ))}
            </select>
          )}
          <span className="ml-auto text-xs text-white/40">{filtered.length} of {presets.length} presets</span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center text-sm text-white/50">
          No presets match the current filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <PresetCard
              key={p.id}
              preset={p}
              cachedUrl={previewCache[p.id] ?? null}
              cachedText={textCache[p.id] ?? TEST_PROMPT_DEFAULT}
              onUrlCached={(url) => setPreviewCache((prev) => ({ ...prev, [p.id]: url }))}
              onTextChanged={(text) => setTextCache((prev) => ({ ...prev, [p.id]: text }))}
              onSaved={onRefresh}
            />
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
}

function PresetCard({ preset, cachedUrl, cachedText, onUrlCached, onTextChanged, onSaved }: PresetCardProps) {
  const [testing, setTesting] = useState(false);
  const [testUrl, setTestUrl] = useState<string | null>(cachedUrl);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [testText, setTestText] = useState(cachedText);
  const [isHovering, setIsHovering] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep previous audio URL while re-generating so the player doesn't vanish.
  const prevUrlRef = useRef<string | null>(cachedUrl);

  const onTest = useCallback(async () => {
    setTesting(true);
    setError(null);
    // Don't wipe testUrl here — keep the old audio until the new one arrives.
    try {
      const res = await fetch(`/api/voice/clones/${preset.id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: testText.trim() || TEST_PROMPT_DEFAULT }),
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
  const lang = preset.language?.toUpperCase() || "EN";

  return (
    <div
      className="group flex flex-col rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-5 transition-colors duration-150 hover:border-[rgba(99,102,241,0.2)]"
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
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-[rgba(99,102,241,0.2)] bg-[rgba(99,102,241,0.07)] text-[#6366F1]">
          <Mic size={16} />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/50">
            {lang}
          </span>
          <span className="rounded-full border border-[rgba(99,102,241,0.2)] bg-[rgba(99,102,241,0.07)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#6366F1]/70">
            {category}
          </span>
        </div>
      </div>

      {/* Info */}
      <h3 className="mt-3 text-sm font-semibold text-white">{preset.label}</h3>
      {preset.description && (
        <p className="mt-1 text-xs text-white/55 leading-relaxed">{preset.description}</p>
      )}

      {/* Edit test text */}
      {editMode ? (
        <div className="mt-3 space-y-1.5">
          <textarea
            value={testText}
            onChange={(e) => { setTestText(e.target.value); onTextChanged(e.target.value); }}
            rows={3}
            maxLength={300}
            placeholder="Type what you want the voice to say…"
            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#6366F1]/50 resize-none"
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/30">{testText.length}/300</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setEditMode(false); onTest(); }}
                className="text-[10px] text-[rgba(99,102,241,0.7)] hover:text-[#6366F1] cursor-pointer"
              >
                Preview
              </button>
              <button
                type="button"
                onClick={() => setEditMode(false)}
                className="text-[10px] text-white/40 hover:text-white/70 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-1.5">
          <p className="flex-1 truncate text-[11px] text-white/35 italic">{testText}</p>
          <button
            type="button"
            onClick={() => setEditMode(true)}
            className="flex-shrink-0 text-[10px] text-[rgba(99,102,241,0.55)] hover:text-[#6366F1] cursor-pointer"
            aria-label="Edit test phrase"
          >
            Edit
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onTest}
          disabled={testing}
          className={[
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors duration-150 cursor-pointer",
            // Pulse border when hover detected but audio not yet loading
            isHovering && !testing && !testUrl
              ? "border-[rgba(99,102,241,0.3)] bg-[rgba(99,102,241,0.05)] text-[#6366F1]/80 animate-pulse"
              : "border-white/15 bg-white/5 text-white hover:bg-white/10",
            "disabled:cursor-not-allowed disabled:opacity-40",
          ].join(" ")}
        >
          {testing ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Play size={12} />
          )}
          {testing ? "Generating…" : testUrl ? "Re-preview" : "Preview"}
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
              ? "border-[rgba(99,102,241,0.25)] bg-[rgba(99,102,241,0.07)] text-[#6366F1]/70"
              : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white",
          ].join(" ")}
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : saved ? <CheckCircle2 size={12} /> : <Sparkles size={12} />}
          {saved ? "Saved" : "Use"}
        </button>
      </div>

      {/* Audio player — kept visible while re-generating (prevUrlRef) */}
      {(testUrl || (testing && prevUrlRef.current)) && (
        <div className="relative mt-3 rounded-lg border border-white/10 bg-black/30 p-2">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio src={testUrl ?? prevUrlRef.current ?? ""} controls className="w-full" style={{ height: 32 }} />
          {testing && (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50">
              <Loader2 size={16} className="animate-spin text-[#6366F1]" />
            </div>
          )}
        </div>
      )}
      {error && <p className="mt-2 text-xs text-[#F26063]">{error}</p>}
    </div>
  );
}

// ── Renders ─────────────────────────────────────────────────────
const R2_BASE = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "";

function RendersTab({ renders }: { renders: VoiceRenderRow[] }) {
  const [playingId, setPlayingId] = useState<string | null>(null);

  if (renders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-white/10 bg-white/5 p-12 text-center">
        <Headphones size={28} className="text-white/40" />
        <h3 className="mt-3 text-base font-medium text-white">No renders yet</h3>
        <p className="mt-1 max-w-sm text-sm text-white/60">
          Renders show up here once your clones synthesise audio for cold calls,
          voicemails, SMS, or DMs.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {renders.map((r) => {
        const audioUrl = r.r2_key ? `${R2_BASE}/${r.r2_key}` : null;
        const isOpen = playingId === r.id;
        return (
          <div
            key={r.id}
            className="rounded-xl border border-white/10 bg-white/5 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex-1 min-w-[200px]">
                <p className="text-sm text-white">{r.text_preview}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-white/50">
                  <span>
                    {new Date(r.rendered_at).toLocaleString(undefined, {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                  {r.duration_seconds !== null && (
                    <span>· {Math.round(r.duration_seconds)}s</span>
                  )}
                  <span>· used {r.use_count}×</span>
                  {r.context && (
                    <span className="rounded-full border border-white/10 bg-black/30 px-2 py-0.5 uppercase tracking-wider text-white/60">
                      {r.context}
                    </span>
                  )}
                </div>
              </div>
              {audioUrl && (
                <button
                  type="button"
                  onClick={() => setPlayingId(isOpen ? null : r.id)}
                  className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10 hover:text-white transition-colors duration-150 cursor-pointer"
                  aria-label={isOpen ? "Close audio player" : "Play render"}
                >
                  {isOpen ? <Pause size={12} /> : <Play size={12} />}
                  {isOpen ? "Close" : "Play"}
                </button>
              )}
            </div>
            {isOpen && audioUrl && (
              <div className="mt-3 rounded-lg border border-white/10 bg-black/30 p-2">
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <audio
                  src={audioUrl}
                  controls
                  autoPlay
                  className="w-full"
                  style={{ height: 32 }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
