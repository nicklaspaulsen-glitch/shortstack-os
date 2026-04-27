"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Mic,
  Upload,
  Play,
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
} from "lucide-react";
import Link from "next/link";
import PageHero from "@/components/ui/page-hero";
import StatCard from "@/components/ui/stat-card";

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
      <PageHero
        title="Voice Studio"
        subtitle="Clone your voice, browse curated presets, and route synthesised audio into the dialer, voicemail drops, SMS, and social DMs."
        gradient="sunset"
        icon={<Mic size={28} />}
        eyebrow={
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-amber-200">
            <Sparkles size={10} /> New
          </span>
        }
        actions={
          <button
            type="button"
            onClick={refresh}
            className="flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10"
          >
            <RefreshCw size={12} /> Refresh
          </button>
        }
      />

      <div className="mx-auto mt-6 max-w-7xl px-4 sm:px-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Your clones"
            value={stats.mineCount}
            icon={<Mic size={16} />}
          />
          <StatCard
            label="Preset library"
            value={stats.presetCount}
            icon={<Library size={16} />}
          />
          <StatCard
            label="Renders this month"
            value={stats.rendersThisMonth}
            icon={<Headphones size={16} />}
          />
        </div>

        <div className="mt-6 border-b border-white/10">
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
                      ? "border-orange-400 text-orange-200"
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
          {!loading && tab === "presets" && <PresetsTab presets={presets} />}
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
    <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-950/30 to-orange-950/20 p-6">
      <div className="flex items-start gap-4">
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5">
          <Upload size={20} className="text-amber-200" />
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
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-amber-400/40 bg-amber-500/5 px-4 py-6 text-sm text-amber-100 hover:border-amber-400 hover:bg-amber-500/10"
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
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-amber-400/60 focus:outline-none"
            />
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-amber-400/60 focus:outline-none"
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
                      ? "border-amber-400/60 bg-amber-500/10 text-amber-100"
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
                className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-amber-400/60 focus:outline-none"
              />
            )}
          </div>

          <div className="flex items-center justify-between gap-4">
            {submitMsg && (
              <div className="text-sm text-amber-200">{submitMsg}</div>
            )}
            <button
              type="button"
              onClick={onSubmit}
              disabled={submitting}
              className="ml-auto flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-black hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/50"
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
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-amber-400/40 bg-amber-500/10 text-amber-200">
          <Mic size={20} />
        </div>
        <div className="flex-1 min-w-[180px]">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/dashboard/voice-studio/${clone.id}`}
              className="text-sm font-semibold text-white hover:text-amber-200"
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
function PresetsTab({ presets }: { presets: VoiceClone[] }) {
  if (presets.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-12 text-center text-white/60">
        Loading preset library...
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {presets.map((p) => (
        <PresetCard key={p.id} preset={p} />
      ))}
    </div>
  );
}

function PresetCard({ preset }: { preset: VoiceClone }) {
  const [testing, setTesting] = useState(false);
  const [testUrl, setTestUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onTest = useCallback(async () => {
    setTesting(true);
    setError(null);
    try {
      const res = await fetch(`/api/voice/clones/${preset.id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: TEST_PROMPT_DEFAULT }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Test failed (${res.status})`);
      setTestUrl(data.r2_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test failed");
    } finally {
      setTesting(false);
    }
  }, [preset.id]);

  const category = (preset.consent_evidence?.category as string) || "preset";

  return (
    <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-amber-400/40 bg-amber-500/10 text-amber-200">
          <Mic size={16} />
        </div>
        <span className="rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/60">
          {category}
        </span>
      </div>
      <h3 className="mt-3 text-sm font-semibold text-white">{preset.label}</h3>
      {preset.description && (
        <p className="mt-1 text-xs text-white/60">{preset.description}</p>
      )}
      <button
        type="button"
        onClick={onTest}
        disabled={testing}
        className="mt-3 flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {testing ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <Play size={12} />
        )}
        Test playback
      </button>
      {testUrl && (
        <div className="mt-3 rounded-lg border border-white/10 bg-black/30 p-2">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio src={testUrl} controls className="w-full" />
        </div>
      )}
      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
    </div>
  );
}

// ── Renders ─────────────────────────────────────────────────────
function RendersTab({ renders }: { renders: VoiceRenderRow[] }) {
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
      {renders.map((r) => (
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
          </div>
        </div>
      ))}
    </div>
  );
}
