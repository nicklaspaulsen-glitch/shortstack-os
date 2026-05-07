"use client";

/**
 * <ClientVoiceProfile> — render a client's writing-voice profile inside
 * the client-detail page. Shares the same look as the agency owner's
 * Settings → Voice Profile page but scoped to a specific client.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Sparkles, Wand2, Type, RefreshCw, MessageSquare } from "lucide-react";
import toast from "react-hot-toast";

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
  prompt_snippet: string | null;
  computed_at: string;
}

interface ProfileResponse {
  profile: VoiceProfile | null;
  minCorpusWords: number;
  active: boolean;
  client: { id: string; business_name: string };
}

interface Props {
  clientId: string;
  clientName: string;
}

export default function ClientVoiceProfile({ clientId, clientName }: Props) {
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [genOpen, setGenOpen] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/voice-profile/client/${clientId}`);
      if (!res.ok) throw new Error(`status ${res.status}`);
      const json = (await res.json()) as ProfileResponse;
      setData(json);
    } catch (err) {
      console.error("[client-voice-profile] load failed", err);
      toast.error("Failed to load voice profile");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleRecompute() {
    setBusy(true);
    try {
      const res = await fetch("/api/voice-profile/recompute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectKind: "client", subjectId: clientId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "recompute failed");
      if (!json.ok) toast(`Recompute skipped: ${json.reason}`);
      else toast.success(`Voice profile recomputed`);
      await reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Recompute failed";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="h-32 rounded-xl bg-white/4 animate-pulse" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-base">Voice Profile</h3>
          <p className="text-xs text-muted">
            How {clientName} writes. We learn from their replies and use it to
            generate copy in their voice.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setGenOpen(true)}
            disabled={!data?.active}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-500 hover:bg-purple-400 disabled:opacity-50 transition-colors"
          >
            <MessageSquare size={13} />
            Generate copy in their voice
          </button>
          <button
            onClick={handleRecompute}
            disabled={busy}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/15 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={13} className={busy ? "animate-spin" : ""} />
            Recompute
          </button>
        </div>
      </div>

      <StatusBanner data={data} clientName={clientName} />
      {data?.profile && <Stats profile={data.profile} />}
      {data?.profile && <Signature profile={data.profile} />}
      {data?.profile?.prompt_snippet && (
        <PromptPanel snippet={data.profile.prompt_snippet} />
      )}

      {genOpen && (
        <GenerateModal
          clientId={clientId}
          clientName={clientName}
          onClose={() => setGenOpen(false)}
        />
      )}
    </div>
  );
}

function StatusBanner({
  data,
  clientName,
}: {
  data: ProfileResponse | null;
  clientName: string;
}) {
  if (!data) return null;
  const profile = data.profile;
  if (!profile) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
        <p className="font-semibold text-amber-300 mb-1">Not yet learned</p>
        <p className="text-amber-200/80">
          Need at least {data.minCorpusWords} words from {clientName}&apos;s
          replies before voice matching activates.
        </p>
      </div>
    );
  }

  if (profile.corpus_size_words < data.minCorpusWords) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200/80">
        {profile.corpus_size_words} words captured. Need ~{data.minCorpusWords - profile.corpus_size_words} more.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-emerald-200/80">
      Active — {profile.corpus_size_words.toLocaleString()} words. Last
      refreshed {new Date(profile.computed_at).toLocaleString()}.
    </div>
  );
}

function Stats({ profile }: { profile: VoiceProfile }) {
  const gauges = [
    { label: "Formality", value: (profile.formality_score ?? 0) * 100, max: 100, suffix: "%" },
    { label: "Avg sentence", value: profile.avg_sentence_length ?? 0, max: 30, suffix: " w" },
    { label: "Contractions", value: (profile.contraction_rate ?? 0) * 100, max: 100, suffix: "%" },
    { label: "Emoji rate", value: profile.emoji_rate ?? 0, max: 10, suffix: "" },
    { label: "Em-dash rate", value: profile.em_dash_rate ?? 0, max: 6, suffix: "" },
    { label: "Exclamations", value: profile.exclamation_rate ?? 0, max: 6, suffix: "" },
  ];
  return (
    <div className="rounded-xl border border-white/10 bg-white/2 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Type size={14} className="text-purple-400" />
        <span className="text-xs font-semibold">Stats</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {gauges.map((g) => {
          const pct = Math.max(0, Math.min(100, (g.value / g.max) * 100));
          return (
            <div key={g.label}>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-zinc-400">{g.label}</span>
                <span className="text-zinc-200 font-mono">
                  {Number.isFinite(g.value) ? g.value.toFixed(2) : "0"}
                  {g.suffix}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Signature({ profile }: { profile: VoiceProfile }) {
  const groups: Array<{ label: string; items: string[] | null }> = [
    { label: "Phrases", items: profile.signature_phrases },
    { label: "Openings", items: profile.signature_openings },
    { label: "Closings", items: profile.signature_closings },
    { label: "Tone", items: profile.tone_keywords },
  ];
  const hasAny = groups.some((g) => g.items && g.items.length > 0);
  if (!hasAny) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-white/2 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles size={14} className="text-purple-400" />
        <span className="text-xs font-semibold">Signature</span>
      </div>
      {groups.map((g) =>
        g.items && g.items.length > 0 ? (
          <div key={g.label}>
            <p className="text-[11px] text-zinc-400 mb-1.5">{g.label}</p>
            <div className="flex flex-wrap gap-1.5">
              {g.items.map((x, i) => (
                <span
                  key={`${g.label}-${i}`}
                  className="text-[10px] px-2 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-200"
                >
                  {x}
                </span>
              ))}
            </div>
          </div>
        ) : null,
      )}
    </div>
  );
}

function PromptPanel({ snippet }: { snippet: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/2 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Wand2 size={14} className="text-purple-400" />
        <span className="text-xs font-semibold">Injected prompt</span>
      </div>
      <pre className="text-[11px] whitespace-pre-wrap font-mono text-zinc-200 rounded-lg bg-black/40 p-3 border border-white/5 max-h-40 overflow-auto">
        {snippet}
      </pre>
    </div>
  );
}

function GenerateModal({
  clientId,
  clientName,
  onClose,
}: {
  clientId: string;
  clientName: string;
  onClose: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleGenerate() {
    if (!prompt.trim()) {
      toast.error("Enter a prompt");
      return;
    }
    setBusy(true);
    setOutput("");
    try {
      const res = await fetch("/api/voice-profile/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectKind: "client",
          subjectId: clientId,
          prompt,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "generate failed");
      setOutput(json.text || "");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Generate failed";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  const promptHelp = useMemo(
    () => `Write a 1-paragraph response to a client who is asking for a status update on their campaign.`,
    [],
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-white/10  w-full max-w-2xl max-h-[90vh] overflow-auto p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Generate copy in {clientName}&apos;s voice</h3>
          <button
            onClick={onClose}
            className="text-xs text-zinc-400 hover:text-zinc-200"
          >
            Close
          </button>
        </div>
        <div>
          <label className="text-xs text-zinc-400 block mb-1">Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={promptHelp}
            rows={4}
            className="w-full text-xs rounded-lg bg-black/40 border border-white/5 p-3 focus:outline-none focus:border-purple-500/50 resize-y"
          />
        </div>
        <button
          onClick={handleGenerate}
          disabled={busy || !prompt.trim()}
          className="px-4 py-2 rounded-lg text-xs font-semibold bg-purple-500 hover:bg-purple-400 disabled:opacity-50 transition-colors"
        >
          {busy ? "Generating..." : "Generate"}
        </button>
        {output && (
          <div>
            <label className="text-xs text-zinc-400 block mb-1">Output</label>
            <pre className="text-xs whitespace-pre-wrap rounded-lg bg-black/40 border border-white/5 p-3">
              {output}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
