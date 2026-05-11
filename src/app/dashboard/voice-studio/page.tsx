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
import { motion } from "framer-motion";
import { MotionPage } from "@/components/motion/motion-page";

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
  "Hi there � this is a quick test of my new voice clone. How does it sound?";

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
  // Previously used a serial `for�await` loop (N+1 fetches). Now fires all
  // clone-detail requests in parallel with Promise.all � same result, far
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
    <MotionPage className="min-h-screen pb-12">{/* Voice Studio command strip (slim editorial header, no PageHero) */}
          <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
            <div className="min-w-0">
              <p className="font-editorial text-[11px] italic text-text-muted mb-0.5 truncate">Audio Identity</p>
              <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-primary leading-none truncate">Voice Studio</h1>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {stats.mineCount > 0 && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="hidden sm:flex items-center gap-1 text-[9px] font-semibold px-2 py-1 rounded-full bg-[rgba(0,0,0,0.05)] border border-[rgba(0,0,0,0.10)] text-[#1D4ED8]"
                >
                  <span className="w-1 h-1 rounded-full bg-[#2563EB] animate-pulse" />
                  {stats.mineCount} voice{stats.mineCount !== 1 ? "s" : ""}
                </motion.span>
              )}
              {stats.presetCount > 0 && (
                <span className="hidden md:flex items-center gap-1 text-[9px] text-[#71717A] px-2 py-1 rounded-md bg-[rgba(0,0,0,0.02)] border border-[rgba(0,0,0,0.08)]">
                  {stats.presetCount} presets
                </span>
              )}
              <button
                type="button"
                onClick={refresh}
                className="flex items-center gap-1.5 rounded-lg border border-[rgba(0,0,0,0.08)] bg-[rgba(0,0,0,0.03)] px-2.5 py-1.5 text-[11px] font-medium text-[#52525B] hover:text-[#0A0A0B] hover:bg-[rgba(0,0,0,0.06)] transition-colors duration-150"
              >
                <RefreshCw size={11} /> Refresh
              </button>
            </div>
          </div>
          <div className="mx-auto mt-6 max-w-7xl px-4 sm:px-6">
              {/* -- Tab bar -- */}
              <div className="rounded-xl p-1" style={{ background: "rgba(255,255,255,0.88)", backdropFilter: "blur(24px) saturate(1.8)", WebkitBackdropFilter: "blur(24px) saturate(1.8)", border: "1px solid rgba(255,255,255,0.70)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 2px 12px -2px rgba(0,0,0,0.06)" }}>
                <nav className="flex gap-1 overflow-x-auto" aria-label="Voice Studio tabs">
                  {TAB_ORDER.map((t) => {
                    const isActive = tab === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTab(t)}
                        className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                          isActive
                            ? "bg-[rgba(37,99,235,0.08)] text-[#1D4ED8] border border-[rgba(37,99,235,0.25)]"
                            : "text-[#52525B] hover:text-[#0A0A0B] hover:bg-[rgba(0,0,0,0.04)]"
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
                <div className="mt-6 flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                  <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-rose-500" />
                  <div>{error}</div>
                </div>
              )}

              <div className="mt-6">
                {loading && (
                  <div className="flex items-center justify-center py-12 text-[#71717A]">
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
        <div className="flex flex-col items-center justify-center rounded-xl border border-[rgba(0,0,0,0.08)] bg-[rgba(0,0,0,0.02)] p-12 text-center">
          <Mic size={32} className="text-[#71717A]" />
          <h3 className="mt-4 text-base font-medium text-[#0A0A0B]">
            No clones yet
          </h3>
          <p className="mt-1 max-w-sm text-sm text-[#52525B]">
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
      setSubmitMsg(
        data.status === "ready"
          ? "Clone trained successfully � try it from the row below."
          : "Clone training started � we'll mark it ready when the worker finishes.",
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
    <div className="relative rounded-xl overflow-hidden p-6" style={{ background: "rgba(255,255,255,0.88)", backdropFilter: "blur(24px) saturate(1.8)", WebkitBackdropFilter: "blur(24px) saturate(1.8)", border: "1px solid rgba(255,255,255,0.70)", boxShadow: "inset 0 1px 0 rgba(255,255,255,1), 0 4px 16px -4px rgba(0,0,0,0.08), 0 0 48px -12px rgba(37,99,235,0.10)" }}>
      {/* Blue gradient top accent bar */}
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: "linear-gradient(90deg, #2563EB, #3B82F6, #8B5CF6, #3B82F6, #2563EB)" }} />
      <div className="flex items-start gap-4">
        <div className="rounded-lg border border-[rgba(0,0,0,0.10)] bg-[rgba(0,0,0,0.04)] p-2.5">
          <Upload size={20} className="text-[#2563EB]" />
        </div>
        <div className="flex-1 space-y-4">
          <div>
            <h3 className="text-base font-semibold text-[#0A0A0B]">Train a new clone</h3>
            <p className="mt-1 text-sm text-[#52525B]">
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
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[rgba(0,0,0,0.12)] px-4 py-6 text-sm text-[#1D4ED8] hover:border-[rgba(0,0,0,0.20)] transition-colors"
            style={{ background: "rgba(255,255,255,0.88)" }}
          >
            <Upload size={16} />
            {files.length === 0
              ? "Choose audio samples (mp3, wav, m4a, ogg)"
              : `${files.length} sample${files.length === 1 ? "" : "s"} selected � click to replace`}
          </button>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label (e.g. 'My voice � natural')"
              className="rounded-lg border border-[rgba(0,0,0,0.10)] bg-white px-3 py-2 text-sm text-[#0A0A0B] placeholder:text-[#71717A] focus:border-[rgba(0,0,0,0.25)] focus:outline-none"
            />
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              className="rounded-lg border border-[rgba(0,0,0,0.10)] bg-white px-3 py-2 text-sm text-[#0A0A0B] placeholder:text-[#71717A] focus:border-[rgba(0,0,0,0.25)] focus:outline-none"
            />
          </div>

          <div className="rounded-lg border border-[rgba(0,0,0,0.08)] bg-[rgba(0,0,0,0.02)] p-3">
            <div className="text-xs uppercase tracking-wider text-[#71717A]">
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
                      ? "border-[rgba(0,0,0,0.16)] bg-[rgba(0,0,0,0.06)] text-[#1D4ED8]"
                      : "border-[rgba(0,0,0,0.08)] bg-[rgba(0,0,0,0.02)] text-[#52525B] hover:bg-[rgba(0,0,0,0.05)]"
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
                className="mt-2 w-full rounded-lg border border-[rgba(0,0,0,0.10)] bg-white px-3 py-2 text-sm text-[#0A0A0B] placeholder:text-[#71717A] focus:border-[rgba(0,0,0,0.25)] focus:outline-none"
              />
            )}
          </div>

          <div className="flex items-center justify-between gap-4">
            {submitMsg && (
              <div className="text-sm text-[#2563EB]/80">{submitMsg}</div>
            )}
            <button
              type="button"
              onClick={onSubmit}
              disabled={submitting}
              className="ml-auto flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-medium text-white hover:bg-[#1D4ED8] transition-colors disabled:cursor-not-allowed disabled:bg-[rgba(0,0,0,0.08)] disabled:text-[#9CA3AF]"
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
    <div className="rounded-xl p-5 cursor-pointer tilt-3d" style={{ background: "rgba(255,255,255,0.88)", backdropFilter: "blur(24px) saturate(1.8)", WebkitBackdropFilter: "blur(24px) saturate(1.8)", border: "1px solid rgba(255,255,255,0.70)", boxShadow: "inset 0 1px 0 rgba(255,255,255,1), 0 4px 12px -4px rgba(0,0,0,0.08), 0 0 32px -8px rgba(37,99,235,0.08)" }}>
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(0,0,0,0.10)] bg-[rgba(0,0,0,0.04)] text-[#1D4ED8]">
          <Mic size={20} />
        </div>
        <div className="flex-1 min-w-[180px]">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/dashboard/voice-studio/${clone.id}`}
              className="text-sm font-semibold text-[#0A0A0B] hover:text-[#1D4ED8] transition-colors"
            >
              {clone.label}
            </Link>
            <StatusChip status={clone.status} />
            <span className="rounded-full border border-[rgba(0,0,0,0.08)] bg-[rgba(0,0,0,0.04)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#71717A]">
              {clone.provider}
            </span>
            <span className="rounded-full border border-[rgba(0,0,0,0.08)] bg-[rgba(0,0,0,0.04)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#71717A]">
              {clone.language}
            </span>
          </div>
          {clone.description && (
            <p className="mt-1 text-xs text-[#52525B]">{clone.description}</p>
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
            className="flex items-center gap-1.5 rounded-lg border border-[rgba(0,0,0,0.08)] bg-[rgba(0,0,0,0.03)] px-3 py-1.5 text-xs font-medium text-[#0A0A0B] hover:bg-[rgba(0,0,0,0.06)] disabled:cursor-not-allowed disabled:opacity-40"
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
            className="flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-500/20"
          >
            <Trash2 size={12} />
            Delete
          </button>
        </div>
      </div>

      {testUrl && (
        <div className="mt-3 rounded-lg border border-[rgba(0,0,0,0.08)] bg-[rgba(0,0,0,0.03)] p-3">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio src={testUrl} controls className="w-full" />
        </div>
      )}
      {error && (
        <p className="mt-2 text-xs text-rose-300">{error}</p>
      )}

      {clone.status === "ready" && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-[#71717A]">
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
                    ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-700"
                    : "border-[rgba(0,0,0,0.08)] bg-[rgba(0,0,0,0.03)] text-[#52525B] hover:bg-[rgba(0,0,0,0.06)]"
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
    training: { cls: "bg-[rgba(37,99,235,0.10)] text-[#2563EB]", label: "Training" },
    ready: { cls: "bg-emerald-500/15 text-emerald-700", label: "Ready" },
    failed: { cls: "bg-rose-500/15 text-rose-700", label: "Failed" },
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
// src/lib/voice/preset-library.ts � the filter reads
// `consent_evidence.category` from each seeded preset row.
const PRESET_CATEGORIES = ["all", "warm", "authoritative", "youthful", "narrator", "casual", "british"] as const;
type PresetCategory = (typeof PRESET_CATEGORIES)[number];

function PresetsTab({ presets, loading, onRefresh }: { presets: VoiceClone[]; loading?: boolean; onRefresh?: () => void }) {
  const [categoryFilter, setCategoryFilter] = useState<PresetCategory>("all");
  const [langFilter, setLangFilter] = useState<string>("all");
  const [genderFilter, setGenderFilter] = useState<"all" | "female" | "male">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const resetFilters = useCallback(() => {
    setCategoryFilter("all");
    setLangFilter("all");
    setGenderFilter("all");
    setSearchQuery("");
  }, []);
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
        if (next[p.id]) continue; // already populated � keep the existing URL
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
          <div key={i} className="h-44 animate-pulse rounded-xl border border-[rgba(0,0,0,0.08)] bg-[rgba(0,0,0,0.04)]" />
        ))}
      </div>
    );
  }

  if (presets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-[rgba(0,0,0,0.08)] bg-[rgba(0,0,0,0.02)] p-12 text-center">
        <Library size={28} className="text-[#71717A]" />
        <h3 className="mt-3 text-base font-medium text-[#0A0A0B]">No presets yet</h3>
        <p className="mt-1 max-w-sm text-sm text-[#52525B]">
          Preset voices are seeded automatically on first dashboard load. Hit the button below if none appeared.
        </p>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="mt-4 flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-medium text-white hover:bg-[#1D4ED8] transition-colors cursor-pointer"
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
      <div className="space-y-2.5 rounded-xl p-3" style={{ background: "rgba(255,255,255,0.88)", backdropFilter: "blur(24px) saturate(1.8)", WebkitBackdropFilter: "blur(24px) saturate(1.8)", border: "1px solid rgba(255,255,255,0.70)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 2px 12px -2px rgba(0,0,0,0.06)" }}>
        {/* Search row */}
        <div className="relative">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#71717A]" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search presets�"
            className="rounded-lg w-full py-1.5 pl-8 pr-3 text-xs text-[#0A0A0B] placeholder-[#71717A] focus:outline-none focus:ring-1 focus:ring-[#1D4ED8]/50"
            style={{ background: "rgba(255,255,255,0.88)", backdropFilter: "blur(20px) saturate(1.8)", WebkitBackdropFilter: "blur(20px) saturate(1.8)", border: "1px solid rgba(255,255,255,0.70)" }}
          />
        </div>
        {/* Gender row */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-14 flex-shrink-0 text-[10px] uppercase tracking-wider text-[#71717A]">Gender</span>
          {(["all", "female", "male"] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGenderFilter(g)}
              className={[
                "rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150 cursor-pointer",
                genderFilter === g
                  ? "border border-[rgba(0,0,0,0.16)] bg-[rgba(0,0,0,0.06)] text-[#1D4ED8]"
                  : "border border-[rgba(0,0,0,0.08)] bg-[rgba(0,0,0,0.02)] text-[#52525B] hover:text-[#0A0A0B] hover:bg-[rgba(0,0,0,0.05)]",
              ].join(" ")}
            >
              {g === "all" ? "All" : g.charAt(0).toUpperCase() + g.slice(1)}
            </button>
          ))}
        </div>
        {/* Category + language row */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5">
            {PRESET_CATEGORIES.map((c) => {
              const isActive = categoryFilter === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategoryFilter(c)}
                  className="relative rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/60"
                  style={{ color: isActive ? "#1D4ED8" : "#52525B" }}
                >
                  {isActive && (
                    <motion.span
                      layoutId="voice-category-pill"
                      className="absolute inset-0 rounded-full border border-[rgba(0,0,0,0.16)] bg-[rgba(0,0,0,0.06)]"
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
              className="ml-auto rounded-lg border border-[rgba(0,0,0,0.08)] bg-[rgba(0,0,0,0.03)] px-2 py-1 text-xs text-[#52525B] focus:outline-none focus:ring-1 focus:ring-[#1D4ED8]/50 cursor-pointer"
            >
              {languages.map((l) => (
                <option key={l} value={l} className="bg-white">
                  {l === "all" ? "All languages" : l.toUpperCase()}
                </option>
              ))}
            </select>
          )}
          <span className="ml-auto text-xs text-[#71717A]">{filtered.length} of {presets.length} presets</span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-[rgba(0,0,0,0.08)] bg-[rgba(0,0,0,0.02)] p-8 text-center">
          <p className="text-sm text-[#71717A]">No presets match the current filters.</p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-3 text-xs text-[#1D4ED8] hover:text-[#1D4ED8]/80 transition-colors cursor-pointer underline-offset-2 hover:underline"
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
  /** Previously generated audio URL � survives tab switches. */
  cachedUrl: string | null;
  /** Previously typed test phrase � survives tab switches. */
  cachedText: string;
  onUrlCached: (url: string) => void;
  onTextChanged: (text: string) => void;
  /** Called after the preset is saved to My Voices so the parent can refresh. */
  onSaved?: () => void;
  /** First card in a filtered set � gets a "Featured" badge and shadow uplift. */
  featured?: boolean;
}

function PresetCard({ preset, cachedUrl, cachedText, onUrlCached, onTextChanged, onSaved, featured }: PresetCardProps) {
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
    // Don't wipe testUrl here � keep the old audio until the new one arrives.
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
  const gender = (preset.consent_evidence?.gender as string) || null;
  const hasStoredPreview = !!(preset.consent_evidence?.preview_url);
  const lang = preset.language?.toUpperCase() || "EN";

  return (
    <div
      className="group flex flex-col rounded-xl cursor-pointer overflow-hidden transition-all duration-200 min-h-[220px] hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)]"
      style={{ background: featured ? "rgba(37,99,235,0.06)" : "rgba(255,255,255,0.88)", backdropFilter: "blur(24px) saturate(1.8)", WebkitBackdropFilter: "blur(24px) saturate(1.8)", border: featured ? "1px solid rgba(37,99,235,0.30)" : "1px solid rgba(255,255,255,0.70)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 4px 16px -4px rgba(0,0,0,0.07)" }}
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
      {/* Brand accent top bar */}
      <div style={{ height: 2, background: "linear-gradient(90deg, #2563EB, #3B82F6, #1D4ED8)" }} className="rounded-t-xl" />
      <div className="p-5 flex flex-col flex-1">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-[rgba(0,0,0,0.10)] bg-[rgba(0,0,0,0.04)] text-[#1D4ED8]">
            <Mic size={16} />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {featured && (
              <span className="text-[10px] font-semibold bg-[rgba(37,99,235,0.1)] text-[#1D4ED8] px-2 py-0.5 rounded-full uppercase tracking-wide">
                Featured
              </span>
            )}
            <span className="rounded-full border border-[rgba(0,0,0,0.10)] bg-[rgba(0,0,0,0.04)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#71717A]">
              {lang}
            </span>
            {gender && (
              <span className="rounded-full border border-[rgba(0,0,0,0.10)] bg-[rgba(0,0,0,0.04)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#71717A]">
                {gender === "female" ? "F" : "M"}
              </span>
            )}
            <span className="rounded-full border border-[rgba(0,0,0,0.10)] bg-[rgba(0,0,0,0.04)] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#1D4ED8]">
              {category}
            </span>
          </div>
        </div>

        {/* Info */}
        <h3 className="mt-3 text-sm font-semibold text-[#0A0A0B]">{preset.label}</h3>
        {preset.description && (
          <p className="mt-1 text-xs text-[#52525B] leading-relaxed">{preset.description}</p>
        )}
        {!hasStoredPreview && !testUrl && !editMode && (
          <div className="mt-3 flex flex-col items-center gap-1.5 py-2 rounded-lg border border-dashed border-[rgba(0,0,0,0.10)] bg-[rgba(0,0,0,0.015)] group-hover:border-[rgba(37,99,235,0.30)] group-hover:bg-[rgba(37,99,235,0.04)] transition-colors duration-300">
            {/* waveform bars — animate when hovering or testing */}
            <div className="flex items-end justify-center gap-[2px] h-6 group-hover:opacity-80 opacity-25 transition-opacity duration-300" aria-hidden="true">
              {[5, 9, 6, 13, 7, 11, 4, 14, 8, 10, 5, 12, 7, 9, 4].map((h, i) => (
                <div
                  key={i}
                  style={{
                    width: 2.5,
                    height: h,
                    background: "#2563EB",
                    borderRadius: 2,
                    transformOrigin: "bottom",
                    ...(isHovering || testing ? {
                      animation: `waveBar ${0.55 + (i % 5) * 0.07}s ease-in-out infinite`,
                      animationDelay: `${(i * 0.045).toFixed(3)}s`,
                    } : {}),
                  }}
                />
              ))}
            </div>
            <span className="text-[10px] text-[#71717A] group-hover:text-[#1D4ED8] transition-colors duration-200">
              Hover to preview
            </span>
          </div>
        )}

        {/* Edit test text */}
        {editMode ? (
          <div className="mt-3 space-y-1.5">
            <textarea
              value={testText}
              onChange={(e) => { setTestText(e.target.value); onTextChanged(e.target.value); }}
              rows={3}
              maxLength={300}
              placeholder="Type what you want the voice to say�"
              className="w-full rounded-lg border border-[rgba(0,0,0,0.08)] bg-white px-3 py-2 text-xs text-[#0A0A0B] placeholder-[#71717A] focus:outline-none focus:ring-1 focus:ring-[#1D4ED8]/50 resize-none"
            />
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#71717A]">{testText.length}/300</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setEditMode(false); onTest(); }}
                  className="text-[10px] text-[#52525B] hover:text-[#1D4ED8] cursor-pointer"
                >
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => setEditMode(false)}
                  className="text-[10px] text-[#71717A] hover:text-[#52525B] cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-1.5">
            <p className="flex-1 truncate text-[11px] text-[#71717A] italic">{testText}</p>
            <button
              type="button"
              onClick={() => setEditMode(true)}
              className="flex-shrink-0 rounded border border-[rgba(0,0,0,0.08)] bg-[rgba(0,0,0,0.03)] px-2 py-0.5 text-[11px] text-[#52525B] hover:border-[#1D4ED8]/40 hover:text-[#1D4ED8] transition-colors duration-150 cursor-pointer"
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
                ? "border-[rgba(0,0,0,0.16)] bg-[rgba(0,0,0,0.04)] text-[#1D4ED8] animate-pulse"
                : "border-[rgba(0,0,0,0.08)] bg-[rgba(0,0,0,0.03)] text-[#0A0A0B] hover:bg-[rgba(0,0,0,0.06)]",
              "disabled:cursor-not-allowed disabled:opacity-40",
            ].join(" ")}
          >
            {testing ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Play size={12} />
            )}
            {testing ? "Generating�" : testUrl ? "Re-preview" : "Preview"}
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
                ? "border-[rgba(0,0,0,0.10)] bg-[rgba(0,0,0,0.04)] text-[#1D4ED8]"
                : "border-[rgba(0,0,0,0.08)] bg-[rgba(0,0,0,0.03)] text-[#52525B] hover:bg-[rgba(0,0,0,0.06)] hover:text-[#0A0A0B]",
            ].join(" ")}
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : saved ? <CheckCircle2 size={12} /> : <Sparkles size={12} />}
            {saved ? "Saved" : "Use"}
          </button>
        </div>

        {/* Audio player � kept visible while re-generating (prevUrlRef) */}
        {(testUrl || (testing && prevUrlRef.current)) && (
          <div className="relative mt-3 rounded-lg border border-[rgba(0,0,0,0.08)] bg-[rgba(0,0,0,0.03)] p-2">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio src={testUrl ?? prevUrlRef.current ?? ""} controls className="w-full" style={{ height: 32 }} />
            {testing && (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-[rgba(0,0,0,0.04)]">
                <Loader2 size={16} className="animate-spin text-[#2563EB]" />
              </div>
            )}
          </div>
        )}
        {error && <p className="mt-2 text-xs text-[#F26063]">{error}</p>}
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
      <div className="flex flex-col items-center justify-center rounded-xl border border-[rgba(0,0,0,0.08)] bg-[rgba(0,0,0,0.02)] p-12 text-center">
        <Headphones size={28} className="text-[#71717A]" />
        <h3 className="mt-3 text-base font-medium text-[#0A0A0B]">No renders yet</h3>
        <p className="mt-1 max-w-sm text-sm text-[#52525B]">
          Renders show up here once your clones synthesise audio for cold calls,
          voicemails, SMS, or DMs.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.88)", backdropFilter: "blur(24px) saturate(1.8)", WebkitBackdropFilter: "blur(24px) saturate(1.8)", border: "1px solid rgba(255,255,255,0.70)" }}>
      <div className="divide-y divide-[rgba(0,0,0,0.06)]">
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
                  <p className="text-sm text-[#0A0A0B]">{r.text_preview}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[#71717A]">
                    <span>
                      {new Date(r.rendered_at).toLocaleString(undefined, {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>
                    {r.duration_seconds !== null && (
                      <span>� {Math.round(r.duration_seconds)}s</span>
                    )}
                    <span>� used {r.use_count}�</span>
                    {r.context && (
                      <span className="rounded-full border border-[rgba(0,0,0,0.08)] bg-[rgba(0,0,0,0.04)] px-2 py-0.5 uppercase tracking-wider text-[#71717A]">
                        {r.context}
                      </span>
                    )}
                  </div>
                </div>
                {audioUrl && (
                  <button
                    type="button"
                    onClick={() => setPlayingId(isOpen ? null : r.id)}
                    className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-[rgba(0,0,0,0.08)] bg-[rgba(0,0,0,0.03)] px-3 py-1.5 text-xs text-[#52525B] hover:bg-[rgba(0,0,0,0.06)] hover:text-[#0A0A0B] transition-colors duration-150 cursor-pointer"
                    aria-label={isOpen ? "Close audio player" : "Play render"}
                  >
                    {isOpen ? <Pause size={12} /> : <Play size={12} />}
                    {isOpen ? "Close" : "Play"}
                  </button>
                )}
              </div>
              {isOpen && audioUrl && (
                <div className="mt-3 rounded-lg border border-[rgba(0,0,0,0.08)] bg-[rgba(0,0,0,0.03)] p-2">
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
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

