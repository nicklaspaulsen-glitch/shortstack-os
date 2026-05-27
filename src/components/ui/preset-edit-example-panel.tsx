"use client";
import { Check, CircleNotch, FloppyDisk, Microphone, Pause, Play, Robot, Shuffle, TrendUp, X } from "@phosphor-icons/react";

/**
 * PresetEditExamplePanel — shared slide-in side-panel used across all four
 * preset library categories (video, thumbnail, telegram, voice).
 *
 * Props are a discriminated union so each category gets the right live preview
 * without any `any` leaks:
 *   - kind: "video"     → animated SVG mock of the effect/style
 *   - kind: "thumbnail" → sample thumbnail with editable overlay copy
 *   - kind: "telegram"  → fake Telegram message bubble with editable variables
 *   - kind: "voice"     → audio player, TTS quality signals, voice settings
 *
 * "Save as custom" button calls /api/custom-presets POST. Requires auth;
 * shows an error toast if the user is unauthenticated.
 */

import { useCallback, useState, useRef, useMemo, useEffect, type ReactNode } from "react";
import toast from "react-hot-toast";
import { PresetSvgPlaceholder } from "./preset-svg-placeholder";

/* ─── Discriminated-union prop types ─────────────────────────── */

interface VideoPresetData {
  id: string;
  name: string;
  category: string;
  style: string;
  duration: number;
  aspect_ratio: string;
  music_mood: string;
  caption_style: string;
  target_platform: string;
}

interface ThumbnailPresetData {
  id: string;
  name: string;
  category: string;
  text_overlay: string;
  color_scheme: string;
  background: string;
  description?: string;
}

interface TelegramPresetData {
  id: string;
  name: string;
  category: string;
  body: string;
  variables: string[];
}

interface VoicePresetData {
  id: string;
  name: string;
  category: string;
  language: string;
  gender: "female" | "male" | "neutral";
  description?: string;
  useCases: string[];
  defaultExampleText: string;
  suggestedScripts: string[];
  previewUrl?: string;
}

type PresetPanelProps =
  | { kind: "video"; preset: VideoPresetData; onClose: () => void }
  | { kind: "thumbnail"; preset: ThumbnailPresetData; onClose: () => void }
  | { kind: "telegram"; preset: TelegramPresetData; onClose: () => void }
  | { kind: "voice"; preset: VoicePresetData; onClose: () => void };

/* ─── Helpers ─────────────────────────────────────────────────── */

/*
 * codex round-1: client-side payload sanitization before POST to /api/custom-presets.
 * Mirrors server-side limits (defense-in-depth + better UX — rejects oversized
 * payloads with an error toast before hitting the network).
 */
const VALID_PRESET_CATEGORIES = ["video", "thumbnail", "telegram", "voice"] as const;
type ValidPresetCategory = (typeof VALID_PRESET_CATEGORIES)[number];
const PRESET_ID_REGEX = /^[a-zA-Z0-9_-]+$/;
const MAX_PRESET_CONFIG_BYTES = 16 * 1024; // 16 KB

function validatePresetPayload(payload: {
  base_preset_id: string;
  category: string;
  name: string;
  config: Record<string, unknown>;
}): string | null {
  const id = payload.base_preset_id.trim();
  if (!id || id.length > 128 || !PRESET_ID_REGEX.test(id)) {
    return "Preset ID is invalid (must be 1-128 alphanumeric/hyphen/underscore chars)";
  }
  if (!VALID_PRESET_CATEGORIES.includes(payload.category as ValidPresetCategory)) {
    return `Category must be one of: ${VALID_PRESET_CATEGORIES.join(", ")}`;
  }
  const name = payload.name.trim();
  if (!name || name.length > 200) {
    return "Preset name must be 1-200 characters";
  }
  const serialized = JSON.stringify(payload.config);
  if (serialized.length > MAX_PRESET_CONFIG_BYTES) {
    return `Preset config too large (${Math.round(serialized.length / 1024)}KB — max 16KB)`;
  }
  return null;
}

function extractVars(body: string): string[] {
  const found = new Set<string>();
  const regex = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(body)) !== null) {
    found.add(m[1]);
  }
  return Array.from(found);
}

async function saveAsCustom(payload: {
  base_preset_id: string;
  category: string;
  name: string;
  config: Record<string, unknown>;
}): Promise<void> {
  // Client-side validation before hitting the network.
  const validationError = validatePresetPayload(payload);
  if (validationError) {
    throw new Error(validationError);
  }
  const sanitized = {
    base_preset_id: payload.base_preset_id.trim(),
    category: payload.category,
    name: payload.name.trim(),
    config: payload.config,
  };
  const res = await fetch("/api/custom-presets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sanitized),
  });
  const data: { error?: string } = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error ?? "Save failed");
  }
}

/* ─── Panel shell ─────────────────────────────────────────────── */

function PanelShell({
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 z-40 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden
      />
      {/* Panel */}
      <aside className="fixed right-0 top-0 h-screen w-full max-w-[480px] z-50 flex flex-col border-l border-border-subtle bg-surface shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border-subtle bg-surface-light/40">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-text-primary truncate">{title}</h2>
            {subtitle && (
              <p className="text-[11px] text-text-muted mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-light transition"
            aria-label="Close panel"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {children}
        </div>

        {/* Footer */}
        <div className="border-t border-border-subtle bg-surface-light/40 px-5 py-3">
          {footer}
        </div>
      </aside>
    </>
  );
}

/* ─── Video edit example ──────────────────────────────────────── */

function VideoEditExample({
  preset,
  onClose,
}: {
  preset: VideoPresetData;
  onClose: () => void;
}) {
  const [customName, setCustomName] = useState(preset.name);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await saveAsCustom({
        base_preset_id: preset.id,
        category: preset.category,
        name: customName.trim() || preset.name,
        config: {
          style: preset.style,
          duration: preset.duration,
          aspect_ratio: preset.aspect_ratio,
          music_mood: preset.music_mood,
          caption_style: preset.caption_style,
          target_platform: preset.target_platform,
        },
      });
      setSaved(true);
      toast.success("Saved as custom preset");
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [preset, customName]);

  const details = [
    { label: "Style", value: preset.style },
    { label: "Duration", value: `${preset.duration}s` },
    { label: "Aspect ratio", value: preset.aspect_ratio },
    { label: "Music mood", value: preset.music_mood },
    { label: "Caption style", value: preset.caption_style },
    { label: "Platform", value: preset.target_platform },
  ];

  return (
    <PanelShell
      title={preset.name}
      subtitle={`Video preset · ${preset.category}`}
      onClose={onClose}
      footer={
        <div className="flex items-center gap-2">
          <input
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Custom preset name..."
            className="flex-1 bg-surface border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-[rgba(212,255,0,0.4)]"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="shrink-0 flex items-center gap-1.5 rounded-lg bg-[#D4FF00] text-[#020711] px-4 py-2 text-sm font-semibold hover:bg-[#AACC00] disabled:opacity-60 transition"
          >
            {saving ? (
              <CircleNotch size={13} className="animate-spin" />
            ) : saved ? (
              <Check size={13} />
            ) : (
              <FloppyDisk size={13} />
            )}
            {saved ? "Saved!" : "Save as custom"}
          </button>
        </div>
      }
    >
      {/* Animated SVG mock preview */}
      <div className="aspect-video w-full rounded-xl overflow-hidden relative">
        <PresetSvgPlaceholder
          name={preset.name}
          category={preset.category}
          className="w-full h-full"
        />
        {/* Overlay: simulated caption bar */}
        {preset.caption_style !== "none" && (
          <div className="absolute bottom-0 inset-x-0 bg-black/60 px-4 py-2 text-center">
            <span className="text-white text-xs font-bold uppercase tracking-wide animate-pulse">
              {preset.caption_style.replace(/_/g, " ")} captions
            </span>
          </div>
        )}
        {/* Platform badge */}
        <div className="absolute top-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white font-medium">
          {preset.target_platform}
        </div>
        {/* Duration badge */}
        <div className="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white font-medium">
          {preset.duration}s
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-2">
        {details.map(({ label, value }) => (
          <div
            key={label}
            className="rounded-lg border border-border-subtle/50 bg-surface-light/40 px-3 py-2.5"
          >
            <p className="text-[10px] text-text-muted uppercase tracking-wide">{label}</p>
            <p className="text-sm font-medium text-text-primary mt-0.5 capitalize">
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Info note */}
      <div className="rounded-lg border border-border-subtle/50 bg-surface-light/30 px-3 py-2.5 text-[11px] text-text-muted leading-relaxed">
        This preview shows the preset configuration. The actual effect will be
        applied by the AI video editor when you use this preset on a clip.
      </div>
    </PanelShell>
  );
}

/* ─── Thumbnail edit example ──────────────────────────────────── */

function ThumbnailEditExample({
  preset,
  onClose,
}: {
  preset: ThumbnailPresetData;
  onClose: () => void;
}) {
  const [overlayText, setOverlayText] = useState(preset.text_overlay);
  const [customName, setCustomName] = useState(preset.name);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await saveAsCustom({
        base_preset_id: preset.id,
        category: preset.category,
        name: customName.trim() || preset.name,
        config: {
          text_overlay: overlayText,
          color_scheme: preset.color_scheme,
          background: preset.background,
          description: preset.description,
        },
      });
      setSaved(true);
      toast.success("Saved as custom preset");
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [preset, customName, overlayText]);

  return (
    <PanelShell
      title={preset.name}
      subtitle={`Thumbnail preset · ${preset.category}`}
      onClose={onClose}
      footer={
        <div className="flex items-center gap-2">
          <input
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Custom preset name..."
            className="flex-1 bg-surface border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-[rgba(212,255,0,0.4)]"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="shrink-0 flex items-center gap-1.5 rounded-lg bg-[#D4FF00] text-[#020711] px-4 py-2 text-sm font-semibold hover:bg-[#AACC00] disabled:opacity-60 transition"
          >
            {saving ? (
              <CircleNotch size={13} className="animate-spin" />
            ) : saved ? (
              <Check size={13} />
            ) : (
              <FloppyDisk size={13} />
            )}
            {saved ? "Saved!" : "Save as custom"}
          </button>
        </div>
      }
    >
      {/* Live thumbnail preview */}
      <div className="aspect-video w-full rounded-xl overflow-hidden relative">
        <PresetSvgPlaceholder
          name={preset.name}
          category={preset.category}
          className="w-full h-full"
        />
        {/* Editable overlay text */}
        {overlayText && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <span className="text-white text-xl font-extrabold uppercase tracking-tight text-center drop-shadow-lg leading-tight">
              {overlayText}
            </span>
          </div>
        )}
        {/* Color scheme badge */}
        <div className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
          {preset.color_scheme}
        </div>
      </div>

      {/* Editable overlay text field */}
      <div>
        <label className="text-xs text-text-muted mb-1.5 block">Overlay text (editable)</label>
        <input
          value={overlayText}
          onChange={(e) => setOverlayText(e.target.value)}
          placeholder="Your headline here..."
          className="w-full bg-surface-light border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-[rgba(212,255,0,0.4)]"
        />
      </div>

      {/* Description */}
      {preset.description && (
        <div className="rounded-lg border border-border-subtle/50 bg-surface-light/30 px-3 py-2.5 text-[11px] text-text-muted leading-relaxed">
          {preset.description}
        </div>
      )}

      {/* Details */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Background", value: preset.background },
          { label: "Colors", value: preset.color_scheme },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-lg border border-border-subtle/50 bg-surface-light/40 px-3 py-2.5"
          >
            <p className="text-[10px] text-text-muted uppercase tracking-wide">{label}</p>
            <p className="text-sm font-medium text-text-primary mt-0.5 capitalize">
              {value.replace(/_/g, " ")}
            </p>
          </div>
        ))}
      </div>
    </PanelShell>
  );
}

/* ─── Telegram edit example ───────────────────────────────────── */

function TelegramEditExample({
  preset,
  onClose,
}: {
  preset: TelegramPresetData;
  onClose: () => void;
}) {
  const vars = extractVars(preset.body);
  const [varValues, setVarValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(vars.map((v) => [v, ""]))
  );
  const [customName, setCustomName] = useState(preset.name);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const resolvedBody = preset.body.replace(
    /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
    (_m, k: string) => varValues[k] || `{{${k}}}`
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await saveAsCustom({
        base_preset_id: preset.id,
        category: preset.category,
        name: customName.trim() || preset.name,
        config: {
          body: preset.body,
          variables: vars,
          sample_values: varValues,
        },
      });
      setSaved(true);
      toast.success("Saved as custom preset");
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [preset, customName, varValues, vars]);

  return (
    <PanelShell
      title={preset.name}
      subtitle={`Telegram preset · ${preset.category}`}
      onClose={onClose}
      footer={
        <div className="flex items-center gap-2">
          <input
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Custom preset name..."
            className="flex-1 bg-surface border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-[rgba(212,255,0,0.4)]"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="shrink-0 flex items-center gap-1.5 rounded-lg bg-[#D4FF00] text-[#020711] px-4 py-2 text-sm font-semibold hover:bg-[#AACC00] disabled:opacity-60 transition"
          >
            {saving ? (
              <CircleNotch size={13} className="animate-spin" />
            ) : saved ? (
              <Check size={13} />
            ) : (
              <FloppyDisk size={13} />
            )}
            {saved ? "Saved!" : "Save as custom"}
          </button>
        </div>
      }
    >
      {/* Variable inputs */}
      {vars.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-text-muted font-medium">Fill in variables to preview</p>
          {vars.map((v) => (
            <div key={v} className="flex items-center gap-2">
              <span className="text-[10px] text-[#D4FF00] font-mono bg-[rgba(212,255,0,0.08)] border border-[rgba(212,255,0,0.2)] rounded px-2 py-1 min-w-[110px] text-center shrink-0">
                {`{{${v}}}`}
              </span>
              <input
                value={varValues[v] ?? ""}
                onChange={(e) =>
                  setVarValues((prev) => ({ ...prev, [v]: e.target.value }))
                }
                placeholder={v}
                className="flex-1 bg-surface-light border border-border-subtle rounded-lg px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-[rgba(212,255,0,0.4)]"
              />
            </div>
          ))}
        </div>
      )}

      {/* Fake Telegram bubble */}
      <div>
        <p className="text-xs text-text-muted mb-2">Live preview</p>
        <div className=" rounded-tl-sm bg-[#17212b] border border-[#2b5278]/40 px-4 py-3 max-w-sm">
          {/* Telegram sender line */}
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
              AI
            </div>
            <span className="text-[11px] font-semibold text-[#5fa5d9]">ShortStack Robot</span>
          </div>
          <p className="whitespace-pre-wrap text-sm text-[#e8e8e8] leading-relaxed">
            {resolvedBody}
          </p>
          <p className="text-right text-[9px] text-[#718096] mt-1.5">
            {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      </div>
    </PanelShell>
  );
}

/* ─── Voice edit example ──────────────────────────────────────── */

interface TtsSignal {
  label: string;
  pass: boolean;
}

function evaluateTtsSignals(text: string): TtsSignal[] {
  const trimmed = text.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  const hasPunctuationPause = /[,;:—–]/.test(trimmed);
  const capsWords = words.filter((w) => w.length >= 4 && w === w.toUpperCase() && /[A-Z]/.test(w));

  return [
    { label: "Complete", pass: /[.!?]$/.test(trimmed) },
    { label: "Length", pass: trimmed.length >= 10 && trimmed.length <= 250 },
    { label: "Clean", pass: !/[&@#/\\]/.test(trimmed) },
    { label: "No Shout", pass: capsWords.length === 0 },
    { label: "Flow", pass: hasPunctuationPause || words.length <= 12 },
  ];
}

function VoiceEditExample({
  preset,
  onClose,
}: {
  preset: VoicePresetData;
  onClose: () => void;
}) {
  const [testText, setTestText] = useState(preset.defaultExampleText);
  const [customName, setCustomName] = useState(preset.name);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [stability, setStability] = useState(0.7);
  const [similarityBoost, setSimilarityBoost] = useState(0.8);
  const [styleExag, setStyleExag] = useState(0.0);
  const [audioUrl, setAudioUrl] = useState<string | null>(preset.previewUrl ?? null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [scriptIndex, setScriptIndex] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const ttsSignals = useMemo(() => evaluateTtsSignals(testText), [testText]);
  const ttsScore = useMemo(() => {
    const passed = ttsSignals.filter((s) => s.pass).length;
    return Math.round((passed / ttsSignals.length) * 100);
  }, [ttsSignals]);

  const ttsScoreColor = useMemo(() => {
    if (ttsScore >= 80) return "#4ade80";
    if (ttsScore >= 50) return "#fbbf24";
    return "#f87171";
  }, [ttsScore]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      setIsPlaying(false);
    } else {
      audio.play().catch((err) => {
        console.error("[VoiceEditExample] audio play failed", err);
      });
      setIsPlaying(true);
      progressIntervalRef.current = setInterval(() => {
        if (audio.duration > 0) {
          setAudioProgress((audio.currentTime / audio.duration) * 100);
        }
      }, 100);
    }
  }, [isPlaying]);

  const handleAudioEnded = useCallback(() => {
    setIsPlaying(false);
    setAudioProgress(0);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
  }, []);

  // Load/swap audio source when URL changes
  useEffect(() => {
    if (!audioUrl) return;
    const audio = new Audio(audioUrl);
    audio.addEventListener("ended", handleAudioEnded);
    audioRef.current = audio;
    setAudioProgress(0);
    setIsPlaying(false);
    return () => {
      audio.pause();
      audio.removeEventListener("ended", handleAudioEnded);
    };
  }, [audioUrl, handleAudioEnded]);

  const handleShuffle = useCallback(() => {
    if (preset.suggestedScripts.length === 0) return;
    const nextIndex = (scriptIndex + 1) % preset.suggestedScripts.length;
    setScriptIndex(nextIndex);
    setTestText(preset.suggestedScripts[nextIndex]);
  }, [preset.suggestedScripts, scriptIndex]);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/voice/clones/${preset.id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: testText,
          stability,
          similarityBoost,
          style: styleExag,
        }),
      });
      const data: { r2_url?: string; error?: string } = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Generation failed");
      }
      if (data.r2_url) {
        setAudioUrl(data.r2_url);
        toast.success("Preview generated");
      }
    } catch (err) {
      console.error("[VoiceEditExample] generate failed", err);
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }, [preset.id, testText, stability, similarityBoost, styleExag]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await saveAsCustom({
        base_preset_id: preset.id,
        category: preset.category,
        name: customName.trim() || preset.name,
        config: {
          language: preset.language,
          gender: preset.gender,
          description: preset.description,
          useCases: preset.useCases,
          defaultExampleText: testText,
          stability,
          similarityBoost,
          styleExag,
        },
      });
      setSaved(true);
      toast.success("Saved as custom preset");
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [preset, customName, testText, stability, similarityBoost, styleExag]);

  const sliders = [
    { label: "Clarity", value: stability, setter: setStability, min: 0, max: 1, step: 0.01 },
    { label: "Match", value: similarityBoost, setter: setSimilarityBoost, min: 0, max: 1, step: 0.01 },
    { label: "Style", value: styleExag, setter: setStyleExag, min: 0, max: 0.5, step: 0.01 },
  ];

  const details = [
    { label: "Language", value: preset.language },
    { label: "Gender", value: preset.gender },
    { label: "Category", value: preset.category },
    { label: "Use cases", value: preset.useCases.join(", ") },
  ];

  return (
    <PanelShell
      title={preset.name}
      subtitle={`Voice preset · ${preset.category}`}
      onClose={onClose}
      footer={
        <div className="flex items-center gap-2">
          <input
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Custom preset name..."
            className="flex-1 bg-surface border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-[rgba(212,255,0,0.4)]"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="shrink-0 flex items-center gap-1.5 rounded-lg bg-[#D4FF00] text-[#020711] px-4 py-2 text-sm font-semibold hover:bg-[#AACC00] disabled:opacity-60 transition"
          >
            {saving ? (
              <CircleNotch size={13} className="animate-spin" />
            ) : saved ? (
              <Check size={13} />
            ) : (
              <FloppyDisk size={13} />
            )}
            {saved ? "Saved!" : "Save as custom"}
          </button>
        </div>
      }
    >
      {/* Audio preview player */}
      <div className="rounded-xl border border-[rgba(212,255,0,0.14)] bg-[rgba(13,17,32,0.85)] backdrop-blur-md p-4">
        <div className="flex items-center gap-3 mb-3">
          <Microphone size={16} className="text-[#D4FF00] shrink-0" />
          <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">Voice preview</span>
        </div>
        {audioUrl ? (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handlePlayPause}
                className="shrink-0 w-9 h-9 rounded-full bg-[#D4FF00] text-[#020711] flex items-center justify-center hover:bg-[#AACC00] transition"
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
              </button>
              <div className="flex-1 h-1.5 rounded-full bg-surface-light overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#D4FF00] transition-all duration-100"
                  style={{ width: `${audioProgress}%` }}
                />
              </div>
              <span className="text-[10px] text-text-muted tabular-nums shrink-0">
                {Math.round(audioProgress)}%
              </span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-text-muted italic">
            No preview available — generate one below.
          </p>
        )}
      </div>

      {/* Test text */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs text-text-muted">Test text</label>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-text-muted tabular-nums">{testText.length}/300</span>
            {preset.suggestedScripts.length > 0 && (
              <button
                type="button"
                onClick={handleShuffle}
                className="flex items-center gap-1 text-[10px] text-[#D4FF00] hover:text-[#E8FF4D] transition"
                aria-label="Shuffle suggested script"
              >
                <Shuffle size={11} />
                <span>Shuffle</span>
              </button>
            )}
          </div>
        </div>
        <textarea
          value={testText}
          onChange={(e) => {
            if (e.target.value.length <= 300) setTestText(e.target.value);
          }}
          rows={3}
          placeholder="Type what you want this voice to say..."
          className="w-full bg-surface-light border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-[rgba(212,255,0,0.4)] resize-none"
        />
      </div>

      {/* Voice settings sliders */}
      <div className="space-y-3">
        <p className="text-xs text-text-muted font-medium">Voice settings</p>
        {sliders.map(({ label, value, setter, min, max, step }) => (
          <div key={label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-text-secondary">{label}</span>
              <span className="text-[10px] text-text-muted tabular-nums font-mono">{value.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={value}
              onChange={(e) => setter(parseFloat(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none bg-surface-light cursor-pointer accent-[#D4FF00]"
            />
          </div>
        ))}
      </div>

      {/* TTS quality signals */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <TrendUp size={13} className="text-text-muted" />
          <span className="text-xs text-text-muted font-medium">TTS quality signals</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ttsSignals.map(({ label, pass }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium border"
              style={{
                backgroundColor: pass ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)",
                borderColor: pass ? "rgba(74,222,128,0.25)" : "rgba(248,113,113,0.25)",
                color: pass ? "#4ade80" : "#f87171",
              }}
            >
              {pass ? <Check size={9} /> : <X size={9} />}
              {label}
            </span>
          ))}
        </div>
        {/* Score bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-surface-light overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${ttsScore}%`, backgroundColor: ttsScoreColor }}
            />
          </div>
          <span
            className="text-[10px] font-semibold tabular-nums"
            style={{ color: ttsScoreColor }}
          >
            {ttsScore}%
          </span>
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-2">
        {details.map(({ label, value }) => (
          <div
            key={label}
            className="rounded-lg border border-border-subtle/50 bg-surface-light/40 px-3 py-2.5"
          >
            <p className="text-[10px] text-text-muted uppercase tracking-wide">{label}</p>
            <p className="text-sm font-medium text-text-primary mt-0.5 capitalize">
              {value || "—"}
            </p>
          </div>
        ))}
      </div>

      {/* Description */}
      {preset.description && (
        <div className="rounded-lg border border-border-subtle/50 bg-surface-light/30 px-3 py-2.5 text-[11px] text-text-muted leading-relaxed">
          {preset.description}
        </div>
      )}

      {/* Generate preview button */}
      <button
        type="button"
        onClick={handleGenerate}
        disabled={generating || testText.trim().length === 0}
        className="w-full flex items-center justify-center gap-2 rounded-lg border border-[rgba(212,255,0,0.25)] bg-[rgba(212,255,0,0.08)] text-[#D4FF00] px-4 py-2.5 text-sm font-semibold hover:bg-[rgba(212,255,0,0.14)] disabled:opacity-50 transition"
      >
        {generating ? (
          <CircleNotch size={14} className="animate-spin" />
        ) : (
          <Microphone size={14} />
        )}
        {generating ? "Generating..." : audioUrl ? "Regenerate preview" : "Generate preview"}
      </button>
    </PanelShell>
  );
}

/* ─── Public export — discriminated-union router ─────────────── */

export function PresetEditExamplePanel(props: PresetPanelProps) {
  if (props.kind === "video") {
    return <VideoEditExample preset={props.preset} onClose={props.onClose} />;
  }
  if (props.kind === "thumbnail") {
    return <ThumbnailEditExample preset={props.preset} onClose={props.onClose} />;
  }
  if (props.kind === "voice") {
    return <VoiceEditExample preset={props.preset} onClose={props.onClose} />;
  }
  return <TelegramEditExample preset={props.preset} onClose={props.onClose} />;
}

export default PresetEditExamplePanel;
