"use client";

/* ────────────────────────────────────────────────────────────────
 * LayerPanel — Adobe-Premiere-style "layers" sidebar for thumbnails.
 *
 * Renders the editable decomposition of a finished thumbnail:
 *   • Background color/theme
 *   • Subject / hero face
 *   • Text overlays
 *   • Effects (grain, bloom, vignette, …)
 *   • Style preset (switchable via dropdown)
 *   • Face swap source image
 *
 * Each row = one LAYER with:
 *   eye-toggle • thumb/swatch • name • "Edit" inline editor
 *
 * The consumer supplies the current state as a `ThumbnailLayers`
 * object (below) and receives an updated version via onChange().
 * When the user clicks "Regenerate", we build a plain-English
 * instruction from the changed-flag of each layer and hand it
 * off via onRegenerate(instruction). The parent posts that
 * instruction to /api/thumbnail/edit-with-notes.
 *
 * Defensive defaults: every field is optional so a thumbnail with
 * zero metadata still renders (just shows "—" placeholders).
 * ────────────────────────────────────────────────────────────────*/

import { useMemo, useState } from "react";
import {
  Eye, EyeOff, Edit3, Palette, User, Type, Sparkles,
  Layers as LayersIcon, Image as ImageIcon, RefreshCw,
  ChevronDown, ChevronUp, Check, Plus, Trash2,
} from "lucide-react";
import { THUMBNAIL_STYLES } from "@/lib/thumbnail-styles";

/* ─── Types ────────────────────────────────────────────────── */

export interface LayerTextOverlay {
  id: string;
  text: string;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  x?: number; // % from left
  y?: number; // % from top
  visible?: boolean;
}

export interface LayerEffect {
  id: string;           // "grain" | "bloom" | "vignette" | string
  label: string;
  enabled: boolean;
  intensity?: number;   // 0-100
}

export interface ThumbnailLayers {
  /** background theme ID (e.g. "red_black") + readable name. */
  background?: { id?: string; name?: string; colors?: string[]; visible?: boolean };
  /** hero subject position — overlay of the main person/prop. */
  subject?: { label?: string; x?: number; y?: number; scale?: number; visible?: boolean };
  /** text overlays on top of the thumbnail. */
  texts?: LayerTextOverlay[];
  /** pluggable effects from the style preset. */
  effects?: LayerEffect[];
  /** creator style preset currently applied. */
  style?: { id?: string; name?: string };
  /** face swap source (if any). */
  faceSwap?: { sourceUrl?: string; label?: string };
}

export interface LayerPanelProps {
  /** The finished thumbnail's primary image URL — used in the header preview. */
  imageUrl?: string | null;
  /** Current editable layer state. */
  layers: ThumbnailLayers;
  /** Called whenever any layer field changes. */
  onChange: (next: ThumbnailLayers) => void;
  /** Called when the user clicks "Regenerate with edits".
   *  The instruction is a human-readable summary of the diff. */
  onRegenerate?: (instruction: string) => void | Promise<void>;
  /** Called when the user wants to upload/change the face-swap source. */
  onChangeFaceSwap?: () => void;
  /** If true, the whole panel starts collapsed (mobile-friendly). */
  defaultCollapsed?: boolean;
  /** Show a busy indicator on the Regenerate button. */
  regenerating?: boolean;
  className?: string;
}

/* ─── Palette presets for quick background swatches ────────── */

const COLOR_SWATCHES: Array<{ id: string; name: string; colors: [string, string] }> = [
  { id: "red_black", name: "Red + Black", colors: ["#FF2D2D", "#0A0A0A"] },
  { id: "blue_white", name: "Blue + White", colors: ["#2563EB", "#FFFFFF"] },
  { id: "green_gold", name: "Green + Gold", colors: ["#059669", "#FACC15"] },
  { id: "purple_black", name: "Purple + Black", colors: ["#7C3AED", "#0B0120"] },
  { id: "orange_teal", name: "Orange + Teal", colors: ["#EA580C", "#0E7490"] },
  { id: "pink_black", name: "Pink + Black", colors: ["#EC4899", "#111111"] },
  { id: "yellow_navy", name: "Yellow + Navy", colors: ["#FACC15", "#1E3A8A"] },
  { id: "white_black", name: "Mono B/W", colors: ["#FFFFFF", "#0A0A0A"] },
];

const EFFECT_DEFAULTS: LayerEffect[] = [
  { id: "grain",    label: "Film Grain", enabled: false, intensity: 30 },
  { id: "bloom",    label: "Bloom / Glow", enabled: false, intensity: 50 },
  { id: "vignette", label: "Vignette", enabled: false, intensity: 40 },
  { id: "sharpen",  label: "Sharpen", enabled: false, intensity: 50 },
  { id: "grade",    label: "Color Grade", enabled: false, intensity: 50 },
];

/* ─── Helper: diff layers into a prompt-engineer-friendly sentence ──── */

function buildInstructionFromDiff(
  initial: ThumbnailLayers,
  current: ThumbnailLayers
): string {
  const parts: string[] = [];

  if (initial.background?.id !== current.background?.id && current.background?.name) {
    parts.push(`change the background color theme to ${current.background.name}`);
  }

  if (initial.style?.id !== current.style?.id && current.style?.name) {
    parts.push(`reapply the "${current.style.name}" style preset`);
  }

  const initText = initial.texts || [];
  const curText = current.texts || [];
  curText.forEach((t, i) => {
    const before = initText[i];
    if (!before) {
      parts.push(`add text overlay "${t.text}"`);
    } else if (before.text !== t.text) {
      parts.push(`change text overlay "${before.text}" to "${t.text}"`);
    } else if (before.color !== t.color && t.color) {
      parts.push(`make text "${t.text}" the color ${t.color}`);
    } else if (before.fontSize !== t.fontSize && t.fontSize) {
      parts.push(`change text "${t.text}" size to ${t.fontSize}px`);
    }
  });

  const initEff = initial.effects || [];
  const curEff = current.effects || [];
  curEff.forEach((e) => {
    const before = initEff.find((x) => x.id === e.id);
    if (!before) return;
    if (before.enabled !== e.enabled) {
      parts.push(e.enabled ? `enable the ${e.label} effect` : `remove the ${e.label} effect`);
    }
  });

  if (initial.subject?.visible !== current.subject?.visible && current.subject) {
    parts.push(current.subject.visible === false ? "hide the hero subject" : "show the hero subject");
  }

  if (parts.length === 0) return "re-render with the same layers";
  return parts.join(", ");
}

/* ─── Component ─────────────────────────────────────────────── */

export function LayerPanel({
  imageUrl,
  layers,
  onChange,
  onRegenerate,
  onChangeFaceSwap,
  defaultCollapsed = false,
  regenerating = false,
  className = "",
}: LayerPanelProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Snapshot of the initial layer state so we can diff on Regenerate.
  const [initial] = useState<ThumbnailLayers>(() => JSON.parse(JSON.stringify(layers)) as ThumbnailLayers);

  // Merge incoming effects with defaults so all toggles show up even if
  // the parent didn't supply them.
  const effects: LayerEffect[] = useMemo(() => {
    const incoming = layers.effects || [];
    const byId = new Map(incoming.map((e) => [e.id, e]));
    return EFFECT_DEFAULTS.map((d) => byId.get(d.id) || d).concat(
      incoming.filter((e) => !EFFECT_DEFAULTS.some((d) => d.id === e.id))
    );
  }, [layers.effects]);

  function patch(update: Partial<ThumbnailLayers>) {
    onChange({ ...layers, ...update });
  }

  function toggleEffect(id: string) {
    const next = effects.map((e) => e.id === id ? { ...e, enabled: !e.enabled } : e);
    patch({ effects: next });
  }

  function setEffectIntensity(id: string, intensity: number) {
    const next = effects.map((e) => e.id === id ? { ...e, intensity } : e);
    patch({ effects: next });
  }

  function toggleTextVisible(id: string) {
    const next = (layers.texts || []).map((t) =>
      t.id === id ? { ...t, visible: t.visible === false ? true : false } : t
    );
    patch({ texts: next });
  }

  function editText(id: string, update: Partial<LayerTextOverlay>) {
    const next = (layers.texts || []).map((t) => t.id === id ? { ...t, ...update } : t);
    patch({ texts: next });
  }

  function addText() {
    const id = `t${Date.now()}`;
    const next = [
      ...(layers.texts || []),
      { id, text: "NEW TEXT", fontFamily: "Inter", fontSize: 72, color: "#FFFFFF", visible: true, x: 50, y: 50 } as LayerTextOverlay,
    ];
    patch({ texts: next });
    setEditingId(`text:${id}`);
  }

  function removeText(id: string) {
    patch({ texts: (layers.texts || []).filter((t) => t.id !== id) });
  }

  function handleRegenerate() {
    if (!onRegenerate) return;
    const instruction = buildInstructionFromDiff(initial, layers);
    void onRegenerate(instruction);
  }

  const styleOptions = THUMBNAIL_STYLES;

  /* ─── Render ────────────────────────────────────────────── */

  return (
    <div
      className={`flex flex-col gap-2 rounded-xl border border-border bg-surface/70 backdrop-blur-sm p-3 ${className}`}
      data-testid="thumbnail-layer-panel"
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="flex items-center justify-between gap-2 w-full text-left"
      >
        <div className="flex items-center gap-2">
          <LayersIcon size={14} className="text-gold" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground">
            Layers
          </span>
          <span className="text-[9px] text-muted rounded-full bg-surface-light px-2 py-0.5">
            {1 + 1 + (layers.texts?.length || 0) + effects.filter((e) => e.enabled).length + (layers.faceSwap?.sourceUrl ? 1 : 0)}
          </span>
        </div>
        {collapsed ? <ChevronDown size={14} className="text-muted" /> : <ChevronUp size={14} className="text-muted" />}
      </button>

      {!collapsed && (
        <div className="flex flex-col gap-1.5">
          {/* ── Background ── */}
          <LayerRow
            icon={<Palette size={12} />}
            name="Background"
            description={layers.background?.name || "—"}
            visible={layers.background?.visible !== false}
            onToggleVisible={() => patch({
              background: { ...(layers.background || {}), visible: layers.background?.visible === false ? true : false },
            })}
            swatch={
              <div className="flex gap-[2px] rounded overflow-hidden border border-border">
                {(layers.background?.colors || ["#222", "#111"]).slice(0, 2).map((c, i) => (
                  <span key={i} style={{ background: c }} className="block w-3 h-4" />
                ))}
              </div>
            }
            onEdit={() => setEditingId(editingId === "bg" ? null : "bg")}
            editing={editingId === "bg"}
          >
            {/* Inline editor */}
            <div className="grid grid-cols-4 gap-1.5 mt-2">
              {COLOR_SWATCHES.map((sw) => (
                <button
                  key={sw.id}
                  type="button"
                  onClick={() => {
                    patch({ background: { id: sw.id, name: sw.name, colors: sw.colors, visible: true } });
                  }}
                  title={sw.name}
                  className={`aspect-video rounded border ${
                    layers.background?.id === sw.id ? "border-gold ring-1 ring-gold/40" : "border-border hover:border-white/30"
                  }`}
                  style={{ background: `linear-gradient(135deg, ${sw.colors[0]}, ${sw.colors[1]})` }}
                >
                  <span className="sr-only">{sw.name}</span>
                </button>
              ))}
            </div>
          </LayerRow>

          {/* ── Subject / hero ── */}
          <LayerRow
            icon={<User size={12} />}
            name="Subject"
            description={layers.subject?.label || "Hero person / main prop"}
            visible={layers.subject?.visible !== false}
            onToggleVisible={() => patch({
              subject: { ...(layers.subject || {}), visible: layers.subject?.visible === false ? true : false },
            })}
            swatch={
              imageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={imageUrl} alt="" className="h-4 w-6 object-cover rounded border border-border" />
              ) : (
                <div className="h-4 w-6 rounded bg-surface-light border border-border" />
              )
            }
            onEdit={() => setEditingId(editingId === "subject" ? null : "subject")}
            editing={editingId === "subject"}
          >
            <div className="mt-2 grid grid-cols-2 gap-2">
              <NumberField
                label="Position X (%)"
                value={layers.subject?.x ?? 50}
                min={0}
                max={100}
                onChange={(x) => patch({ subject: { ...(layers.subject || {}), x, visible: true } })}
              />
              <NumberField
                label="Position Y (%)"
                value={layers.subject?.y ?? 50}
                min={0}
                max={100}
                onChange={(y) => patch({ subject: { ...(layers.subject || {}), y, visible: true } })}
              />
              <NumberField
                label="Scale (%)"
                value={layers.subject?.scale ?? 100}
                min={25}
                max={200}
                onChange={(scale) => patch({ subject: { ...(layers.subject || {}), scale, visible: true } })}
              />
            </div>
          </LayerRow>

          {/* ── Text overlays ── */}
          <div>
            <div className="flex items-center justify-between px-1 py-1">
              <span className="text-[9px] uppercase tracking-wider text-muted flex items-center gap-1.5">
                <Type size={10} /> Text overlays ({(layers.texts || []).length})
              </span>
              <button
                type="button"
                onClick={addText}
                className="text-[9px] text-gold hover:text-gold-light flex items-center gap-1"
              >
                <Plus size={10} /> Add text
              </button>
            </div>

            {(layers.texts || []).length === 0 && (
              <div className="text-[9px] text-muted italic px-2 py-1">No text overlays &mdash; click &ldquo;Add text&rdquo; to create one.</div>
            )}

            {(layers.texts || []).map((t) => (
              <LayerRow
                key={t.id}
                icon={<Type size={12} />}
                name={t.text || "Empty text"}
                description={`${t.fontFamily || "Inter"} · ${t.fontSize || 48}px`}
                visible={t.visible !== false}
                onToggleVisible={() => toggleTextVisible(t.id)}
                swatch={
                  <div className="w-4 h-4 rounded border border-border" style={{ background: t.color || "#ffffff" }} />
                }
                onEdit={() => setEditingId(editingId === `text:${t.id}` ? null : `text:${t.id}`)}
                editing={editingId === `text:${t.id}`}
                onDelete={() => removeText(t.id)}
              >
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="col-span-2 text-[9px] text-muted">
                    Content
                    <input
                      type="text"
                      value={t.text}
                      onChange={(e) => editText(t.id, { text: e.target.value })}
                      className="mt-0.5 w-full rounded border border-border bg-surface-light px-2 py-1 text-xs text-foreground focus:border-gold/40 focus:outline-none"
                    />
                  </label>
                  <label className="text-[9px] text-muted">
                    Font
                    <input
                      type="text"
                      value={t.fontFamily || "Inter"}
                      onChange={(e) => editText(t.id, { fontFamily: e.target.value })}
                      className="mt-0.5 w-full rounded border border-border bg-surface-light px-2 py-1 text-[11px] text-foreground focus:border-gold/40 focus:outline-none"
                    />
                  </label>
                  <NumberField
                    label="Size (px)"
                    value={t.fontSize ?? 48}
                    min={12}
                    max={300}
                    onChange={(v) => editText(t.id, { fontSize: v })}
                  />
                  <label className="text-[9px] text-muted">
                    Color
                    <input
                      type="color"
                      value={t.color || "#FFFFFF"}
                      onChange={(e) => editText(t.id, { color: e.target.value })}
                      className="mt-0.5 w-full h-7 rounded border border-border bg-surface-light cursor-pointer"
                    />
                  </label>
                  <NumberField
                    label="X (%)"
                    value={t.x ?? 50}
                    min={0}
                    max={100}
                    onChange={(v) => editText(t.id, { x: v })}
                  />
                </div>
              </LayerRow>
            ))}
          </div>

          {/* ── Effects ── */}
          <LayerRow
            icon={<Sparkles size={12} />}
            name="Effects"
            description={`${effects.filter((e) => e.enabled).length} active`}
            visible={effects.some((e) => e.enabled)}
            onToggleVisible={() => {
              const allOn = effects.every((e) => e.enabled);
              patch({ effects: effects.map((e) => ({ ...e, enabled: !allOn })) });
            }}
            swatch={<span className="text-[9px] text-gold">{effects.filter((e) => e.enabled).length}/{effects.length}</span>}
            onEdit={() => setEditingId(editingId === "fx" ? null : "fx")}
            editing={editingId === "fx"}
          >
            <div className="mt-2 flex flex-col gap-1.5">
              {effects.map((e) => (
                <div key={e.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleEffect(e.id)}
                    className={`h-4 w-7 rounded-full transition-all ${
                      e.enabled ? "bg-gold" : "bg-surface-light"
                    } relative`}
                    aria-label={`Toggle ${e.label}`}
                  >
                    <span
                      className={`absolute top-[2px] h-3 w-3 rounded-full bg-white transition-all ${
                        e.enabled ? "left-[14px]" : "left-[2px]"
                      }`}
                    />
                  </button>
                  <span className="text-[10px] text-foreground flex-1">{e.label}</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={e.intensity ?? 50}
                    disabled={!e.enabled}
                    onChange={(ev) => setEffectIntensity(e.id, Number(ev.target.value))}
                    className="flex-1 h-1 accent-gold disabled:opacity-30"
                  />
                  <span className="text-[9px] text-muted w-7 text-right font-mono">{e.intensity ?? 50}</span>
                </div>
              ))}
            </div>
          </LayerRow>

          {/* ── Style preset ── */}
          <LayerRow
            icon={<ImageIcon size={12} />}
            name="Style Preset"
            description={styleOptions.find((s) => s.id === layers.style?.id)?.name || layers.style?.name || "—"}
            visible
            onToggleVisible={undefined}
            swatch={
              layers.style?.id ? (
                <div
                  className="w-6 h-4 rounded border border-border"
                  style={{
                    background: `linear-gradient(135deg, ${
                      styleOptions.find((s) => s.id === layers.style?.id)?.gradient?.[0] || "#222"
                    }, ${styleOptions.find((s) => s.id === layers.style?.id)?.gradient?.[1] || "#111"})`,
                  }}
                />
              ) : (
                <div className="w-6 h-4 rounded bg-surface-light border border-border" />
              )
            }
            onEdit={() => setEditingId(editingId === "style" ? null : "style")}
            editing={editingId === "style"}
          >
            <div className="mt-2">
              <select
                value={layers.style?.id || ""}
                onChange={(e) => {
                  const s = styleOptions.find((x) => x.id === e.target.value);
                  if (s) patch({ style: { id: s.id, name: s.name } });
                }}
                className="w-full rounded border border-border bg-surface-light px-2 py-1 text-[11px] text-foreground focus:border-gold/40 focus:outline-none"
              >
                <option value="">Select a style…</option>
                {styleOptions.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} — {s.category}</option>
                ))}
              </select>
            </div>
          </LayerRow>

          {/* ── Face Swap ── */}
          {(layers.faceSwap?.sourceUrl || onChangeFaceSwap) && (
            <LayerRow
              icon={<User size={12} />}
              name="Face Swap"
              description={layers.faceSwap?.label || "Source face"}
              visible
              onToggleVisible={undefined}
              swatch={
                layers.faceSwap?.sourceUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={layers.faceSwap.sourceUrl} alt="" className="h-4 w-4 rounded-full object-cover border border-border" />
                ) : (
                  <div className="h-4 w-4 rounded-full bg-surface-light border border-border" />
                )
              }
              onEdit={onChangeFaceSwap}
              editing={false}
            />
          )}

          {/* Regenerate button */}
          {onRegenerate && (
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={regenerating}
              className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-lg bg-gold text-black text-[11px] font-semibold py-2 hover:bg-gold-light disabled:opacity-50 transition"
            >
              <RefreshCw size={12} className={regenerating ? "animate-spin" : ""} />
              {regenerating ? "Regenerating…" : "Regenerate with edits"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── LayerRow: one reusable row ───────────────────────────── */

interface LayerRowProps {
  icon: React.ReactNode;
  name: string;
  description?: string;
  visible: boolean;
  onToggleVisible?: () => void;
  swatch: React.ReactNode;
  onEdit?: () => void;
  editing: boolean;
  onDelete?: () => void;
  children?: React.ReactNode;
}

function LayerRow({
  icon, name, description, visible, onToggleVisible, swatch, onEdit, editing, onDelete, children,
}: LayerRowProps) {
  return (
    <div className={`rounded-lg border ${editing ? "border-gold/40 bg-gold/5" : "border-border bg-surface/40"} transition-colors`}>
      <div className="flex items-center gap-2 px-2 py-1.5">
        {onToggleVisible ? (
          <button
            type="button"
            onClick={onToggleVisible}
            className="text-muted hover:text-foreground transition-colors"
            aria-label={visible ? "Hide layer" : "Show layer"}
          >
            {visible ? <Eye size={12} /> : <EyeOff size={12} />}
          </button>
        ) : (
          <span className="w-3 h-3" />
        )}
        <span className="text-gold">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-medium text-foreground truncate">{name}</div>
          {description ? (
            <div className="text-[9px] text-muted truncate">{description}</div>
          ) : null}
        </div>
        {swatch}
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="text-muted hover:text-foreground rounded border border-border px-1.5 py-0.5 text-[9px] flex items-center gap-1"
          >
            {editing ? <><Check size={9} /> Done</> : <><Edit3 size={9} /> Edit</>}
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="text-muted hover:text-danger"
            aria-label="Delete layer"
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>
      {editing && children && (
        <div className="border-t border-border/60 px-2 py-2">{children}</div>
      )}
    </div>
  );
}

/* ─── Tiny number field used in editors ────────────────────── */

function NumberField({
  label, value, min, max, step = 1, onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="text-[9px] text-muted">
      {label}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-0.5 w-full rounded border border-border bg-surface-light px-2 py-1 text-[11px] text-foreground focus:border-gold/40 focus:outline-none"
      />
    </label>
  );
}

/* ─── Helper: derive an initial ThumbnailLayers from a finished
 *   ThumbnailResult-ish object. The thumbnail-generator page
 *   calls this to seed state when a render completes. ──────── */

export function deriveLayersFromThumbnail(input: {
  style?: string;
  colorTheme?: string;
  textOverlay?: string;
  faces?: string[];
  faceSwapUrl?: string | null;
}): ThumbnailLayers {
  const match = COLOR_SWATCHES.find((s) => s.id === input.colorTheme);
  const style = THUMBNAIL_STYLES.find((s) => s.id === input.style);
  const textLayers: LayerTextOverlay[] = input.textOverlay
    ? [{
        id: "t-primary",
        text: input.textOverlay,
        fontFamily: "Inter",
        fontSize: 72,
        color: "#FFFFFF",
        visible: true,
        x: 50,
        y: 70,
      }]
    : [];

  return {
    background: match ? { id: match.id, name: match.name, colors: match.colors, visible: true } : { id: input.colorTheme, name: input.colorTheme, visible: true },
    subject: { label: "Hero subject", x: 50, y: 50, scale: 100, visible: true },
    texts: textLayers,
    effects: EFFECT_DEFAULTS.map((e) => ({ ...e })),
    style: style ? { id: style.id, name: style.name } : undefined,
    faceSwap: input.faceSwapUrl ? { sourceUrl: input.faceSwapUrl, label: "Uploaded face" } : undefined,
  };
}

export default LayerPanel;
