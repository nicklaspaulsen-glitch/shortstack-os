"use client";

/**
 * Settings → Voice Profile
 *
 * Shows the current user's writing-voice profile (stats, signature
 * phrases / openings / closings, tone, the prompt-snippet that gets
 * injected into AI calls). Lets the user paste 5-10 samples to bootstrap
 * the profile, and to manually trigger a recompute.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Sparkles, Wand2, Type, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { MotionPage } from "@/components/motion/motion-page";

const containerVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } };
const itemVariants = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.32, 0.72, 0, 1] as [number, number, number, number] } } };

interface VoiceProfile {
  id: string;
  corpus_size_words: number;
  formality_score: number | null;
  avg_sentence_length: number | null;
  contraction_rate: number | null;
  emoji_rate: number | null;
  em_dash_rate: number | null;
  exclamation_rate: number | null;
  signature_phrases: string[] | null;
  signature_openings: string[] | null;
  signature_closings: string[] | null;
  tone_keywords: string[] | null;
  vocabulary_signature: Record<string, number> | null;
  prompt_snippet: string | null;
  computed_at: string;
}

interface ProfileResponse {
  profile: VoiceProfile | null;
  minCorpusWords: number;
  active: boolean;
}

export default function VoiceProfileSettingsPage() {
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [bootstrapText, setBootstrapText] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/voice-profile/me");
      if (!res.ok) throw new Error(`status ${res.status}`);
      const json = (await res.json()) as ProfileResponse;
      setData(json);
    } catch (err) {
      console.error("[voice-profile] load failed", err);
      toast.error("Failed to load voice profile");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const samples = useMemo(() => {
    return bootstrapText
      .split(/\n\s*---+\s*\n|\n{2,}/)
      .map((s) => s.trim())
      .filter((s) => s.length > 10);
  }, [bootstrapText]);

  async function handleBootstrap() {
    if (samples.length === 0) {
      toast.error("Paste at least one sample (separated by blank lines)");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/voice-profile/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ samples }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "bootstrap failed");
      toast.success(`Captured ${samples.length} samples — profile recomputed.`);
      setBootstrapText("");
      await reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Bootstrap failed";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function handleRecompute() {
    setBusy(true);
    try {
      const res = await fetch("/api/voice-profile/recompute", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "recompute failed");
      if (!json.ok) toast(`Recompute skipped: ${json.reason}`);
      else toast.success("Voice profile recomputed");
      await reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Recompute failed";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <MotionPage className="p-6 space-y-6 max-w-5xl mx-auto">{/* -- Voice Profile command strip -- */}
    <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
      <div className="min-w-0">
        <p className="font-editorial text-[11px] italic text-text-muted mb-0.5">VOICE PROFILE</p>
        <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-primary leading-none">Voice Profile</h1>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
                  onClick={handleRecompute}
                  disabled={busy || loading}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-white text-zinc-900 hover:bg-zinc-100 disabled:opacity-50 transition-colors"
                >
                  <RefreshCw size={15} className={busy ? "animate-spin" : ""} />
                  Recompute
                </button>
      </div>
    </div>{loading ? (
              <div className="h-48 rounded-xl bg-black/4 animate-pulse" />
            ) : (
              <>
                <StatusBanner data={data} />
                {data?.profile && <StatsPanel profile={data.profile} />}
                {data?.profile && <SignatureSection profile={data.profile} />}
                {data?.profile?.prompt_snippet && (
                  <PromptSnippetPanel snippet={data.profile.prompt_snippet} />
                )}
                <BootstrapPanel
                  value={bootstrapText}
                  onChange={setBootstrapText}
                  onSubmit={handleBootstrap}
                  sampleCount={samples.length}
                  busy={busy}
                />
              </>
            )}</MotionPage>
  );
}

function StatusBanner({ data }: { data: ProfileResponse | null }) {
  if (!data) return null;
  const profile = data.profile;
  const min = data.minCorpusWords;

  if (!profile) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-50 p-4 text-sm">
        <p className="font-semibold text-amber-700 mb-1">Not yet learned</p>
        <p className="text-amber-700/80">
          We need at least {min} words from your sent messages before we can
          inject your voice into AI output. You can paste 5-10 samples below
          to seed it instantly, or just keep using the platform — capture is
          automatic.
        </p>
      </div>
    );
  }

  if (profile.corpus_size_words < min) {
    const remaining = min - profile.corpus_size_words;
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-50 p-4 text-sm">
        <p className="font-semibold text-amber-700 mb-1">Building...</p>
        <p className="text-amber-700/80">
          {profile.corpus_size_words} words captured. Need ~{remaining} more
          before voice matching activates. Paste samples below to speed it up.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-50 p-4 text-sm">
      <p className="font-semibold text-emerald-700 mb-1">Active</p>
      <p className="text-emerald-700/80">
        {profile.corpus_size_words.toLocaleString()} words captured. Trinity
        is rewriting AI output to match your voice. Last refreshed{" "}
        {new Date(profile.computed_at).toLocaleString()}.
      </p>
    </div>
  );
}

function StatsPanel({ profile }: { profile: VoiceProfile }) {
  const gauges: Array<{ label: string; value: number; suffix?: string; max: number }> = [
    {
      label: "Formality",
      value: (profile.formality_score ?? 0) * 100,
      suffix: "%",
      max: 100,
    },
    {
      label: "Avg sentence length",
      value: profile.avg_sentence_length ?? 0,
      suffix: " words",
      max: 30,
    },
    {
      label: "Contraction rate",
      value: (profile.contraction_rate ?? 0) * 100,
      suffix: "%",
      max: 100,
    },
    {
      label: "Emoji rate",
      value: profile.emoji_rate ?? 0,
      suffix: " /100w",
      max: 10,
    },
    {
      label: "Em-dash rate",
      value: profile.em_dash_rate ?? 0,
      suffix: " /100w",
      max: 6,
    },
    {
      label: "Exclamations",
      value: profile.exclamation_rate ?? 0,
      suffix: " /100w",
      max: 6,
    },
  ];

  return (
    <div className="rounded-xl border border-black/6 bg-white p-5">
      <div className="flex items-center gap-2 mb-4">
        <Type size={16} className="text-blue-600" />
        <h3 className="font-semibold text-sm">Voice Stats</h3>
      </div>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-2 gap-3"
      >
        {gauges.map((g) => (
          <motion.div key={g.label} variants={itemVariants}>
            <Gauge {...g} />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

function Gauge({
  label,
  value,
  suffix,
  max,
}: {
  label: string;
  value: number;
  suffix?: string;
  max: number;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-500">{label}</span>
        <span className="text-gray-800 font-mono">
          {Number.isFinite(value) ? value.toFixed(2) : "0"}
          {suffix}
        </span>
      </div>
      <div className="h-2 rounded-full bg-black/6 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function SignatureSection({ profile }: { profile: VoiceProfile }) {
  const groups: Array<{ label: string; items: string[] | null }> = [
    { label: "Signature phrases", items: profile.signature_phrases },
    { label: "Signature openings", items: profile.signature_openings },
    { label: "Signature closings", items: profile.signature_closings },
    { label: "Tone keywords", items: profile.tone_keywords },
  ];

  const hasAny = groups.some((g) => g.items && g.items.length > 0);
  if (!hasAny) return null;

  return (
    <div className="rounded-xl border border-black/6 bg-white p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="text-blue-600" />
        <h3 className="font-semibold text-sm">Signature</h3>
      </div>
      {groups.map((g) =>
        g.items && g.items.length > 0 ? (
          <div key={g.label}>
            <p className="text-xs text-gray-500 mb-2">{g.label}</p>
            <div className="flex flex-wrap gap-2">
              {g.items.map((item, i) => (
                <span
                  key={`${g.label}-${i}`}
                  className="text-xs px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        ) : null,
      )}
    </div>
  );
}

function PromptSnippetPanel({ snippet }: { snippet: string }) {
  return (
    <div className="rounded-xl border border-black/6 bg-white p-5">
      <div className="flex items-center gap-2 mb-3">
        <Wand2 size={16} className="text-blue-600" />
        <h3 className="font-semibold text-sm">Prompt Injection</h3>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        This text is appended to AI prompts so generated copy matches your
        voice. Read-only.
      </p>
      <pre className="text-xs whitespace-pre-wrap font-mono text-gray-800 rounded-lg bg-gray-50 p-3 border border-black/6">
        {snippet}
      </pre>
    </div>
  );
}

function BootstrapPanel({
  value,
  onChange,
  onSubmit,
  sampleCount,
  busy,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  sampleCount: number;
  busy: boolean;
}) {
  return (
    <div className="rounded-xl border border-black/6 bg-white p-5">
      <div className="flex items-center gap-2 mb-3">
        <Wand2 size={16} className="text-blue-600" />
        <h3 className="font-semibold text-sm">Bootstrap</h3>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        Paste 5-10 samples of your real writing. Separate samples with a
        blank line or a {"\"---\""} separator. We capture each sample,
        recompute the profile, and switch voice matching on immediately.
      </p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={10}
        placeholder={`Hey,\nThanks for getting back so quick. Quick one — can you send the contract over by EOD?\n\n---\n\nMorning team,\nWanted to flag the budget overrun on the campaign...`}
        className="w-full text-xs font-mono rounded-lg bg-gray-50 border border-black/6 p-3 focus:outline-none focus:border-blue-400 text-gray-800 resize-y"
      />
      <div className="flex items-center justify-between mt-3">
        <p className="text-xs text-gray-500">
          {sampleCount} sample{sampleCount === 1 ? "" : "s"} detected
        </p>
        <button
          onClick={onSubmit}
          disabled={busy || sampleCount === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 transition-colors"
        >
          <Sparkles size={13} />
          Capture & recompute
        </button>
      </div>
    </div>
  );
}
