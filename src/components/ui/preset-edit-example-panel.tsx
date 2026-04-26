"use client";

/**
 * PresetEditExamplePanel — shared slide-in side-panel used across all three
 * preset library categories (video, thumbnail, telegram).
 *
 * Props are a discriminated union so each category gets the right live preview
 * without any `any` leaks:
 *   - kind: "video"     → animated SVG mock of the effect/style
 *   - kind: "thumbnail" → sample thumbnail with editable overlay copy
 *   - kind: "telegram"  → fake Telegram message bubble with editable variables
 *
 * "Save as custom" button calls /api/custom-presets POST. Requires auth;
 * shows an error toast if the user is unauthenticated.
 */

import { useCallback, useState, type ReactNode } from "react";
import { X, Save, Loader, Check } from "lucide-react";
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

type PresetPanelProps =
  | { kind: "video"; preset: VideoPresetData; onClose: () => void }
  | { kind: "thumbnail"; preset: ThumbnailPresetData; onClose: () => void }
  | { kind: "telegram"; preset: TelegramPresetData; onClose: () => void };

/* ─── Helpers ─────────────────────────────────────────────────── */

/*
 * codex round-1: client-side payload sanitization before POST to /api/custom-presets.
 * Mirrors server-side limits (defense-in-depth + better UX — rejects oversized
 * payloads with an error toast before hitting the network).
 */
const VALID_PRESET_CATEGORIES = ["video", "thumbnail", "telegram"] as const;
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
      <aside className="fixed right-0 top-0 h-screen w-full max-w-[480px] z-50 flex flex-col border-l border-border bg-surface shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border bg-surface-light/40">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground truncate">{title}</h2>
            {subtitle && (
              <p className="text-[11px] text-muted mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-muted hover:text-foreground hover:bg-surface-light transition"
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
        <div className="border-t border-border bg-surface-light/40 px-5 py-3">
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
            className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-gold/40"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="shrink-0 flex items-center gap-1.5 rounded-lg bg-gold text-black px-4 py-2 text-sm font-semibold hover:bg-gold/90 disabled:opacity-60 transition"
          >
            {saving ? (
              <Loader size={13} className="animate-spin" />
            ) : saved ? (
              <Check size={13} />
            ) : (
              <Save size={13} />
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
            className="rounded-lg border border-border/50 bg-surface-light/40 px-3 py-2.5"
          >
            <p className="text-[10px] text-muted uppercase tracking-wide">{label}</p>
            <p className="text-sm font-medium text-foreground mt-0.5 capitalize">
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Info note */}
      <div className="rounded-lg border border-border/50 bg-surface-light/30 px-3 py-2.5 text-[11px] text-muted leading-relaxed">
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
            className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-gold/40"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="shrink-0 flex items-center gap-1.5 rounded-lg bg-gold text-black px-4 py-2 text-sm font-semibold hover:bg-gold/90 disabled:opacity-60 transition"
          >
            {saving ? (
              <Loader size={13} className="animate-spin" />
            ) : saved ? (
              <Check size={13} />
            ) : (
              <Save size={13} />
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
        <label className="text-xs text-muted mb-1.5 block">Overlay text (editable)</label>
        <input
          value={overlayText}
          onChange={(e) => setOverlayText(e.target.value)}
          placeholder="Your headline here..."
          className="w-full bg-surface-light border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-gold/40"
        />
      </div>

      {/* Description */}
      {preset.description && (
        <div className="rounded-lg border border-border/50 bg-surface-light/30 px-3 py-2.5 text-[11px] text-muted leading-relaxed">
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
            className="rounded-lg border border-border/50 bg-surface-light/40 px-3 py-2.5"
          >
            <p className="text-[10px] text-muted uppercase tracking-wide">{label}</p>
            <p className="text-sm font-medium text-foreground mt-0.5 capitalize">
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
            className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-gold/40"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="shrink-0 flex items-center gap-1.5 rounded-lg bg-gold text-black px-4 py-2 text-sm font-semibold hover:bg-gold/90 disabled:opacity-60 transition"
          >
            {saving ? (
              <Loader size={13} className="animate-spin" />
            ) : saved ? (
              <Check size={13} />
            ) : (
              <Save size={13} />
            )}
            {saved ? "Saved!" : "Save as custom"}
          </button>
        </div>
      }
    >
      {/* Variable inputs */}
      {vars.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted font-medium">Fill in variables to preview</p>
          {vars.map((v) => (
            <div key={v} className="flex items-center gap-2">
              <span className="text-[10px] text-gold font-mono bg-gold/10 border border-gold/20 rounded px-2 py-1 min-w-[110px] text-center shrink-0">
                {`{{${v}}}`}
              </span>
              <input
                value={varValues[v] ?? ""}
                onChange={(e) =>
                  setVarValues((prev) => ({ ...prev, [v]: e.target.value }))
                }
                placeholder={v}
                className="flex-1 bg-surface-light border border-border rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-gold/40"
              />
            </div>
          ))}
        </div>
      )}

      {/* Fake Telegram bubble */}
      <div>
        <p className="text-xs text-muted mb-2">Live preview</p>
        <div className="rounded-2xl rounded-tl-sm bg-[#17212b] border border-[#2b5278]/40 px-4 py-3 max-w-sm">
          {/* Telegram sender line */}
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
              AI
            </div>
            <span className="text-[11px] font-semibold text-[#5fa5d9]">ShortStack Bot</span>
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

/* ─── Public export — discriminated-union router ─────────────── */

export function PresetEditExamplePanel(props: PresetPanelProps) {
  if (props.kind === "video") {
    return <VideoEditExample preset={props.preset} onClose={props.onClose} />;
  }
  if (props.kind === "thumbnail") {
    return <ThumbnailEditExample preset={props.preset} onClose={props.onClose} />;
  }
  return <TelegramEditExample preset={props.preset} onClose={props.onClose} />;
}

export default PresetEditExamplePanel;
