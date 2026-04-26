"use client";

/**
 * Preset Library — preview + try every font, transition, effect, SFX, and
 * music track in the video-editor's preset bank before using it in a project.
 *
 * Tabs: Fonts | Transitions | Effects | SFX | Music
 * - Search/filter bar on every tab (live, no submit).
 * - Shimmer skeleton while loading.
 * - SVG placeholder fallback for missing thumbnails.
 * - "Edit example" panel opens on any card click.
 * - Empty state with "Reset filters" CTA when nothing matches.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Play,
  Pause,
  Copy,
  Check,
  Music,
  Wand2,
  Scissors,
  Type as TypeIcon,
  Volume2,
  ArrowLeft,
  ExternalLink,
} from "lucide-react";
import {
  FONTS_LIBRARY,
  TRANSITIONS_LIBRARY,
  EFFECTS_LIBRARY,
  SFX_LIBRARY,
  MUSIC_LIBRARY,
  type Font,
  type Transition,
  type VideoEffect,
} from "@/lib/video-presets";
import { PresetSearchFilterBar } from "@/components/ui/preset-search-filter-bar";
import { PresetEmptyState } from "@/components/ui/preset-empty-state";
import { PresetGridSkeleton, AudioListSkeleton } from "@/components/ui/preset-tile-skeleton";
import { PresetEditExamplePanel } from "@/components/ui/preset-edit-example-panel";

type Tab = "fonts" | "transitions" | "effects" | "sfx" | "music";

// ── Simulated loading state (presets are static; we still show skeleton on
//    first mount so the UX feels consistent with dynamic pages).
const SKELETON_DURATION_MS = 400;

export default function PresetLibraryPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("fonts");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit example panel
  const [editFont, setEditFont] = useState<Font | null>(null);
  const [editTransition, setEditTransition] = useState<Transition | null>(null);
  const [editEffect, setEditEffect] = useState<VideoEffect | null>(null);

  // Simulate first-load skeleton
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), SKELETON_DURATION_MS);
    return () => clearTimeout(t);
  }, []);

  function copyId(id: string) {
    try {
      navigator.clipboard.writeText(id);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1200);
    } catch {
      /* ignore */
    }
  }

  // Reset filter state when switching tabs.
  useEffect(() => {
    setQuery("");
    setCategory("all");
  }, [tab]);

  function resetFilters() {
    setQuery("");
    setCategory("all");
  }

  const totalPresets =
    FONTS_LIBRARY.length +
    TRANSITIONS_LIBRARY.length +
    EFFECTS_LIBRARY.length +
    SFX_LIBRARY.length +
    MUSIC_LIBRARY.length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-[1400px] px-6 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <button
              onClick={() => router.push("/dashboard/video-editor")}
              className="mb-2 flex items-center gap-1 text-xs text-muted hover:text-foreground transition"
            >
              <ArrowLeft size={13} /> Back to Video Editor
            </button>
            <h1 className="text-2xl font-semibold">Preset Library</h1>
            <p className="text-sm text-muted">
              Try every font, transition, effect, sound, and track before
              dropping it into a project.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted">
            <span>{totalPresets} presets</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-4 flex flex-wrap gap-1 rounded-lg border border-border/50 bg-surface-light/30 p-1">
          <TabButton
            id="fonts"
            active={tab}
            icon={<TypeIcon size={13} />}
            label="Fonts"
            count={FONTS_LIBRARY.length}
            onClick={setTab}
          />
          <TabButton
            id="transitions"
            active={tab}
            icon={<Scissors size={13} />}
            label="Transitions"
            count={TRANSITIONS_LIBRARY.length}
            onClick={setTab}
          />
          <TabButton
            id="effects"
            active={tab}
            icon={<Wand2 size={13} />}
            label="Effects"
            count={EFFECTS_LIBRARY.length}
            onClick={setTab}
          />
          <TabButton
            id="sfx"
            active={tab}
            icon={<Volume2 size={13} />}
            label="SFX"
            count={SFX_LIBRARY.length}
            onClick={setTab}
          />
          <TabButton
            id="music"
            active={tab}
            icon={<Music size={13} />}
            label="Music"
            count={MUSIC_LIBRARY.length}
            onClick={setTab}
          />
        </div>

        {/* Shared search + filter bar */}
        <div className="mb-4">
          <PresetSearchFilterBar
            query={query}
            onQueryChange={setQuery}
            placeholder={`Search ${tab}…`}
          />
        </div>

        {/* Tab bodies */}
        {loading ? (
          tab === "sfx" || tab === "music" ? (
            <AudioListSkeleton count={9} />
          ) : (
            <PresetGridSkeleton count={9} />
          )
        ) : (
          <>
            {tab === "fonts" && (
              <FontsTab
                query={query}
                category={category}
                setCategory={setCategory}
                copiedId={copiedId}
                onCopy={copyId}
                onEdit={setEditFont}
                onReset={resetFilters}
              />
            )}
            {tab === "transitions" && (
              <TransitionsTab
                query={query}
                category={category}
                setCategory={setCategory}
                copiedId={copiedId}
                onCopy={copyId}
                onEdit={setEditTransition}
                onReset={resetFilters}
              />
            )}
            {tab === "effects" && (
              <EffectsTab
                query={query}
                category={category}
                setCategory={setCategory}
                copiedId={copiedId}
                onCopy={copyId}
                onEdit={setEditEffect}
                onReset={resetFilters}
              />
            )}
            {tab === "sfx" && (
              <SfxTab
                query={query}
                category={category}
                setCategory={setCategory}
                copiedId={copiedId}
                onCopy={copyId}
                onReset={resetFilters}
              />
            )}
            {tab === "music" && (
              <MusicTab
                query={query}
                category={category}
                setCategory={setCategory}
                copiedId={copiedId}
                onCopy={copyId}
                onReset={resetFilters}
              />
            )}
          </>
        )}
      </div>

      {/* Edit example panels */}
      {editFont && (
        <PresetEditExamplePanel
          kind="video"
          preset={{
            id: editFont.id,
            name: editFont.family,
            category: editFont.category,
            style: editFont.category,
            duration: 30,
            aspect_ratio: "16:9",
            music_mood: "chill",
            caption_style: "word_highlight",
            target_platform: "instagram",
          }}
          onClose={() => setEditFont(null)}
        />
      )}
      {editTransition && (
        <PresetEditExamplePanel
          kind="video"
          preset={{
            id: editTransition.id,
            name: editTransition.name,
            category: editTransition.category,
            style: editTransition.category,
            duration: editTransition.duration_ms / 1000,
            aspect_ratio: "9:16",
            music_mood: "upbeat",
            caption_style: "none",
            target_platform: "tiktok",
          }}
          onClose={() => setEditTransition(null)}
        />
      )}
      {editEffect && (
        <PresetEditExamplePanel
          kind="video"
          preset={{
            id: editEffect.id,
            name: editEffect.name,
            category: editEffect.category,
            style: editEffect.category,
            duration: 15,
            aspect_ratio: "9:16",
            music_mood: "dramatic",
            caption_style: "none",
            target_platform: "instagram",
          }}
          onClose={() => setEditEffect(null)}
        />
      )}
    </div>
  );
}

/* ─────────────────────────── Tab button ─────────────────────────── */

function TabButton({
  id,
  active,
  icon,
  label,
  count,
  onClick,
}: {
  id: Tab;
  active: Tab;
  icon: React.ReactNode;
  label: string;
  count: number;
  onClick: (t: Tab) => void;
}) {
  const isActive = active === id;
  return (
    <button
      onClick={() => onClick(id)}
      className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition ${
        isActive
          ? "bg-gold/15 text-gold"
          : "text-muted hover:text-foreground hover:bg-surface-light/60"
      }`}
    >
      {icon}
      <span>{label}</span>
      <span
        className={`rounded px-1.5 py-0.5 text-[10px] ${
          isActive ? "bg-gold/20 text-gold" : "bg-surface-light text-muted"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

/* ─────────────────────────── Category chips ─────────────────────────── */

function CategoryChips({
  categories,
  active,
  onChange,
}: {
  categories: string[];
  active: string;
  onChange: (c: string) => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap gap-1.5">
      <button
        onClick={() => onChange("all")}
        className={`rounded-full px-2.5 py-1 text-[11px] transition ${
          active === "all"
            ? "bg-gold/20 text-gold border border-gold/30"
            : "bg-surface-light/60 text-muted hover:text-foreground border border-transparent"
        }`}
      >
        All
      </button>
      {categories.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className={`rounded-full px-2.5 py-1 text-[11px] transition ${
            active === c
              ? "bg-gold/20 text-gold border border-gold/30"
              : "bg-surface-light/60 text-muted hover:text-foreground border border-transparent"
          }`}
        >
          {c}
        </button>
      ))}
    </div>
  );
}

/* ─────────────────────────── Fonts tab ─────────────────────────── */

function FontsTab({
  query,
  category,
  setCategory,
  copiedId,
  onCopy,
  onEdit,
  onReset,
}: {
  query: string;
  category: string;
  setCategory: (c: string) => void;
  copiedId: string | null;
  onCopy: (id: string) => void;
  onEdit: (f: Font) => void;
  onReset: () => void;
}) {
  const categories = useMemo(
    () => Array.from(new Set(FONTS_LIBRARY.map((f) => f.category))).sort(),
    [],
  );
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return FONTS_LIBRARY.filter((f) => {
      if (category !== "all" && f.category !== category) return false;
      if (!q) return true;
      return (
        f.family.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q) ||
        f.useCases.some((u) => u.toLowerCase().includes(q))
      );
    });
  }, [query, category]);

  // Load each font's stylesheet once so previews actually render in the family.
  useEffect(() => {
    const existing = new Set(
      Array.from(document.styleSheets).map((s) => s.href || ""),
    );
    for (const f of filtered) {
      if (existing.has(f.url)) continue;
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = f.url;
      link.crossOrigin = "anonymous";
      document.head.appendChild(link);
    }
  }, [filtered]);

  return (
    <>
      <CategoryChips categories={categories} active={category} onChange={setCategory} />
      {filtered.length === 0 ? (
        <PresetEmptyState onReset={onReset} label="fonts" />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((f) => (
            <FontCard
              key={f.id}
              font={f}
              copied={copiedId === f.id}
              onCopy={() => onCopy(f.id)}
              onEdit={() => onEdit(f)}
            />
          ))}
        </div>
      )}
    </>
  );
}

function FontCard({
  font,
  copied,
  onCopy,
  onEdit,
}: {
  font: Font;
  copied: boolean;
  onCopy: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="group rounded-lg border border-border/50 bg-surface-light/30 p-3 transition hover:border-gold/40">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold">{font.family}</p>
          <p className="text-[10px] uppercase tracking-wide text-muted">
            {font.category} · {font.weight.join("/")}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onEdit}
            className="rounded bg-surface-light/80 p-1 text-muted hover:text-gold transition"
            title="Edit example"
          >
            <ExternalLink size={12} />
          </button>
          <button
            onClick={onCopy}
            className="rounded bg-surface-light/80 p-1 text-muted hover:text-foreground transition"
            title="Copy font id"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
        </div>
      </div>
      <p
        className="truncate text-2xl leading-tight"
        style={{ fontFamily: `"${font.family}", sans-serif` }}
      >
        {font.previewText || "The quick brown fox"}
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        {font.useCases.slice(0, 3).map((u) => (
          <span key={u} className="rounded bg-surface-light px-1.5 py-0.5 text-[9px] text-muted">
            {u}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────── Transitions tab ─────────────────────────── */

function TransitionsTab({
  query,
  category,
  setCategory,
  copiedId,
  onCopy,
  onEdit,
  onReset,
}: {
  query: string;
  category: string;
  setCategory: (c: string) => void;
  copiedId: string | null;
  onCopy: (id: string) => void;
  onEdit: (t: Transition) => void;
  onReset: () => void;
}) {
  const categories = useMemo(
    () => Array.from(new Set(TRANSITIONS_LIBRARY.map((t) => t.category))).sort(),
    [],
  );
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return TRANSITIONS_LIBRARY.filter((t) => {
      if (category !== "all" && t.category !== category) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    });
  }, [query, category]);

  return (
    <>
      <CategoryChips categories={categories} active={category} onChange={setCategory} />
      {filtered.length === 0 ? (
        <PresetEmptyState onReset={onReset} label="transitions" />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((t) => (
            <TransitionCard
              key={t.id}
              transition={t}
              copied={copiedId === t.id}
              onCopy={() => onCopy(t.id)}
              onEdit={() => onEdit(t)}
            />
          ))}
        </div>
      )}
    </>
  );
}

function TransitionCard({
  transition,
  copied,
  onCopy,
  onEdit,
}: {
  transition: Transition;
  copied: boolean;
  onCopy: () => void;
  onEdit: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [k, setK] = useState(0);

  function runDemo() {
    setPlaying(true);
    setK((n) => n + 1);
    window.setTimeout(() => setPlaying(false), transition.duration_ms + 200);
  }

  const animClass = useMemo(() => {
    switch (transition.category) {
      case "fade": return "animate-[fade_700ms_ease]";
      case "slide": return "animate-[slideIn_700ms_ease]";
      case "zoom": return "animate-[zoomIn_600ms_ease]";
      case "rotate": return "animate-[spin_700ms_ease]";
      case "whip": return "animate-[slideIn_300ms_ease-out]";
      case "glitch": return "animate-[glitch_450ms_steps(6)]";
      case "masking": return "animate-[zoomIn_700ms_ease-out]";
      case "3d": return "animate-[spin_900ms_ease]";
      default: return "animate-[pulse_600ms_ease]";
    }
  }, [transition.category]);

  return (
    <div className="rounded-lg border border-border/50 bg-surface-light/30 p-3 transition hover:border-gold/40">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold">{transition.name}</p>
          <p className="text-[10px] uppercase tracking-wide text-muted">
            {transition.category} · {transition.duration_ms}ms
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onEdit}
            className="rounded bg-surface-light/80 p-1 text-muted hover:text-gold transition"
            title="Edit example"
          >
            <ExternalLink size={12} />
          </button>
          <button
            onClick={onCopy}
            className="shrink-0 rounded bg-surface-light/80 p-1 text-muted hover:text-foreground"
            title="Copy transition id"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
        </div>
      </div>

      <button
        onClick={runDemo}
        className="group relative mb-2 flex aspect-video w-full items-center justify-center overflow-hidden rounded-md bg-gradient-to-br from-[#1F2937] to-[#0F172A] text-[10px] text-muted"
      >
        <div
          key={k}
          className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gold/30 to-red-500/30 text-xs font-semibold text-foreground ${
            playing ? animClass : "opacity-70"
          }`}
        >
          B
        </div>
        <span className="relative z-10 rounded bg-black/60 px-2 py-1 backdrop-blur group-hover:bg-black/80">
          {playing ? "Playing…" : "Click to preview"}
        </span>
      </button>

      <p className="text-[11px] text-muted">{transition.description}</p>
    </div>
  );
}

/* ─────────────────────────── Effects tab ─────────────────────────── */

function EffectsTab({
  query,
  category,
  setCategory,
  copiedId,
  onCopy,
  onEdit,
  onReset,
}: {
  query: string;
  category: string;
  setCategory: (c: string) => void;
  copiedId: string | null;
  onCopy: (id: string) => void;
  onEdit: (e: VideoEffect) => void;
  onReset: () => void;
}) {
  const categories = useMemo(
    () => Array.from(new Set(EFFECTS_LIBRARY.map((e) => e.category))).sort(),
    [],
  );
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return EFFECTS_LIBRARY.filter((e) => {
      if (category !== "all" && e.category !== category) return false;
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q)
      );
    });
  }, [query, category]);

  return (
    <>
      <CategoryChips categories={categories} active={category} onChange={setCategory} />
      {filtered.length === 0 ? (
        <PresetEmptyState onReset={onReset} label="effects" />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((e) => (
            <EffectCard
              key={e.id}
              effect={e}
              copied={copiedId === e.id}
              onCopy={() => onCopy(e.id)}
              onEdit={() => onEdit(e)}
            />
          ))}
        </div>
      )}
    </>
  );
}

function EffectCard({
  effect,
  copied,
  onCopy,
  onEdit,
}: {
  effect: VideoEffect;
  copied: boolean;
  onCopy: () => void;
  onEdit: () => void;
}) {
  const previewStyle: React.CSSProperties = useMemo(() => {
    switch (effect.category) {
      case "color": return { filter: "saturate(1.3) contrast(1.15)" };
      case "filter": return { filter: "sepia(0.5) contrast(1.1)" };
      case "distortion": return { filter: "blur(2px) hue-rotate(25deg)" };
      case "stylize": return { filter: "saturate(2) contrast(1.3)" };
      case "motion": return { animation: "pulse 1.5s ease-in-out infinite" };
      default: return {};
    }
  }, [effect.category]);

  return (
    <div className="rounded-lg border border-border/50 bg-surface-light/30 p-3 transition hover:border-gold/40">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold">{effect.name}</p>
          <p className="text-[10px] uppercase tracking-wide text-muted">{effect.category}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onEdit}
            className="rounded bg-surface-light/80 p-1 text-muted hover:text-gold transition"
            title="Edit example"
          >
            <ExternalLink size={12} />
          </button>
          <button
            onClick={onCopy}
            className="shrink-0 rounded bg-surface-light/80 p-1 text-muted hover:text-foreground"
            title="Copy effect id"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
        </div>
      </div>

      <div
        className="relative mb-2 aspect-video w-full overflow-hidden rounded-md bg-gradient-to-br from-amber-500/40 via-rose-500/40 to-indigo-500/40"
        style={previewStyle}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="rounded bg-black/50 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur">
            {effect.category.toUpperCase()}
          </span>
        </div>
      </div>

      <p className="mb-1.5 text-[11px] text-muted">{effect.description}</p>

      {effect.paramHints && effect.paramHints.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {effect.paramHints.slice(0, 4).map((p, i) => (
            <span
              key={i}
              className="rounded bg-surface-light px-1.5 py-0.5 text-[9px] text-muted"
              title={`${p.type}${p.min !== undefined ? ` ${p.min}-${p.max}` : ""}`}
            >
              {p.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── SFX tab ─────────────────────────── */

function SfxTab({
  query,
  category,
  setCategory,
  copiedId,
  onCopy,
  onReset,
}: {
  query: string;
  category: string;
  setCategory: (c: string) => void;
  copiedId: string | null;
  onCopy: (id: string) => void;
  onReset: () => void;
}) {
  const categories = useMemo(
    () => Array.from(new Set(SFX_LIBRARY.map((s) => s.category))).sort(),
    [],
  );
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return SFX_LIBRARY.filter((s) => {
      if (category !== "all" && s.category !== category) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [query, category]);

  return (
    <>
      <CategoryChips categories={categories} active={category} onChange={setCategory} />
      {filtered.length === 0 ? (
        <PresetEmptyState onReset={onReset} label="SFX" />
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <AudioCard
              key={s.id}
              id={s.id}
              url={s.url}
              title={s.name}
              sub={`${s.category} · ${(s.duration_ms / 1000).toFixed(1)}s`}
              tags={s.tags}
              copied={copiedId === s.id}
              onCopy={() => onCopy(s.id)}
            />
          ))}
        </div>
      )}
    </>
  );
}

/* ─────────────────────────── Music tab ─────────────────────────── */

function MusicTab({
  query,
  category,
  setCategory,
  copiedId,
  onCopy,
  onReset,
}: {
  query: string;
  category: string;
  setCategory: (c: string) => void;
  copiedId: string | null;
  onCopy: (id: string) => void;
  onReset: () => void;
}) {
  const categories = useMemo(
    () => Array.from(new Set(MUSIC_LIBRARY.map((m) => m.mood))).sort(),
    [],
  );
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return MUSIC_LIBRARY.filter((m) => {
      if (category !== "all" && m.mood !== category) return false;
      if (!q) return true;
      return (
        m.title.toLowerCase().includes(q) ||
        m.genre.toLowerCase().includes(q) ||
        m.mood.toLowerCase().includes(q) ||
        m.artist.toLowerCase().includes(q)
      );
    });
  }, [query, category]);

  return (
    <>
      <CategoryChips categories={categories} active={category} onChange={setCategory} />
      {filtered.length === 0 ? (
        <PresetEmptyState onReset={onReset} label="tracks" />
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((m) => (
            <AudioCard
              key={m.id}
              id={m.id}
              url={m.url}
              title={m.title}
              sub={`${m.mood} · ${m.genre} · ${m.bpm} BPM · ${Math.floor(m.duration_sec / 60)}:${String(m.duration_sec % 60).padStart(2, "0")}`}
              tags={[m.artist, `energy ${m.energy}/10`, ...(m.keyPreferredFor || [])]}
              copied={copiedId === m.id}
              onCopy={() => onCopy(m.id)}
            />
          ))}
        </div>
      )}
    </>
  );
}

/* ─────────────────────────── Audio card (SFX + Music) ─────────────────────────── */

function AudioCard({
  id,
  url,
  title,
  sub,
  tags,
  copied,
  onCopy,
}: {
  id: string;
  url: string;
  title: string;
  sub: string;
  tags: string[];
  copied: boolean;
  onCopy: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  function toggle() {
    if (!audioRef.current) {
      const proxied = url.startsWith("http")
        ? `/api/audio-proxy?url=${encodeURIComponent(url)}`
        : url;
      const a = new Audio(proxied);
      a.crossOrigin = "anonymous";
      a.onended = () => setPlaying(false);
      a.onerror = () => {
        setError(true);
        setPlaying(false);
      };
      audioRef.current = a;
    }
    const a = audioRef.current;
    if (a.paused) {
      a.play()
        .then(() => setPlaying(true))
        .catch(() => {
          setError(true);
          setPlaying(false);
        });
    } else {
      a.pause();
      setPlaying(false);
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-surface-light/30 p-3 transition hover:border-gold/40">
      <button
        onClick={toggle}
        disabled={error}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition ${
          error
            ? "bg-red-500/20 text-red-400"
            : playing
              ? "bg-gold text-black"
              : "bg-gold/20 text-gold hover:bg-gold/30"
        }`}
        title={error ? "Preview URL broken" : playing ? "Pause" : "Play"}
      >
        {playing ? <Pause size={14} /> : <Play size={14} />}
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold">{title}</p>
        <p className="truncate text-[10px] text-muted">{sub}</p>
        {tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {tags.slice(0, 3).map((t, i) => (
              <span key={i} className="rounded bg-surface-light px-1.5 py-0.5 text-[9px] text-muted">
                {t}
              </span>
            ))}
          </div>
        )}
        {error && (
          <p className="mt-1 text-[9px] text-red-400">
            Preview URL is a placeholder — replace with real audio URL.
          </p>
        )}
      </div>
      <button
        onClick={onCopy}
        className="shrink-0 rounded bg-surface-light/80 p-1.5 text-muted hover:text-foreground"
        title="Copy id"
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
    </div>
  );
}
