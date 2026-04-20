"use client";

/**
 * PresetPickerPanel — right-side slide-out sidebar that exposes every preset
 * library (SFX / Music / VFX / Transitions / B-roll / Fonts / Favourites) with
 * previews and drag-to-timeline support.
 *
 *  Keyboard:   Cmd+K / Ctrl+K toggles the panel.
 *  Favourites: double-click any card to pin; persists to /api/favourites.
 *
 * Consumers should handle `onDropOnTimeline({ kind, id, payload })` to place
 * the dropped asset at a specific track+time. The callback receives a
 * lightweight payload so callers don't have to re-lookup the preset.
 *
 * Defensive: if /api/favourites is missing the `user_favourites` table,
 * GET returns an empty list and POST/DELETE silently no-op — the UI still
 * works, it just can't persist pins between sessions.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  Search,
  Play,
  Pause,
  Star,
  X,
  Music,
  Wand2,
  Scissors,
  Film,
  Type as TypeIcon,
  Volume2,
  GripVertical,
  Check,
  Heart,
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
  type Sfx,
  type MusicTrack,
} from "@/lib/video-presets";

/* ─────────────────────────── Types ─────────────────────────── */

export type PresetKind =
  | "sfx"
  | "music"
  | "vfx"
  | "transition"
  | "broll"
  | "font"
  | "fav";

export interface PresetDropPayload {
  kind: Exclude<PresetKind, "fav">;
  id: string;
  payload: Record<string, unknown>;
}

export interface BrollCandidate {
  id: string;
  preview_url?: string;
  thumbnail_url?: string;
  source_url?: string;
  label: string;
  duration_sec?: number;
  provider?: string;
  author?: string;
}

export interface PresetPickerPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when the user drops (or clicks "Add") a preset on the timeline. */
  onDropOnTimeline?: (drop: PresetDropPayload) => void;
  /** Called when the user applies a font to the currently selected text layer. */
  onApplyFont?: (font: Font) => void;
  /** Optional client-supplied B-roll candidates. If omitted, panel fetches
   *  curated stock clips lazily once the tab is opened. */
  brollCandidates?: BrollCandidate[];
  className?: string;
}

type Tab = PresetKind;

/* ─────────────────────────── Favourites state ─────────────────────────── */

interface FavRow {
  kind: Exclude<PresetKind, "fav">;
  item_id: string;
}

function favKey(kind: string, id: string): string {
  return `${kind}::${id}`;
}

/* ─────────────────────────── Curated B-roll fallback ─────────────────────────── */

// Coverr.co & Pixabay video CDN links — all royalty-free. These back the panel
// if the host page hasn't wired up brollCandidates / scene-specific suggestions.
const FALLBACK_BROLL: BrollCandidate[] = [
  {
    id: "cv_city_timelapse",
    label: "City Timelapse",
    preview_url: "https://cdn.coverr.co/videos/coverr-a-busy-highway-at-night-0881/1080p.mp4",
    thumbnail_url: "https://images.unsplash.com/photo-1514565131-fce0801e5785?w=320&h=180&fit=crop",
    duration_sec: 10,
    provider: "coverr",
    author: "Coverr",
  },
  {
    id: "cv_ocean_waves",
    label: "Ocean Waves",
    preview_url: "https://cdn.coverr.co/videos/coverr-the-sea-at-sunset-4881/1080p.mp4",
    thumbnail_url: "https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=320&h=180&fit=crop",
    duration_sec: 12,
    provider: "coverr",
    author: "Coverr",
  },
  {
    id: "cv_coffee_pour",
    label: "Coffee Pour",
    preview_url: "https://cdn.coverr.co/videos/coverr-coffee-pouring-0881/1080p.mp4",
    thumbnail_url: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=320&h=180&fit=crop",
    duration_sec: 8,
    provider: "coverr",
    author: "Coverr",
  },
  {
    id: "cv_forest",
    label: "Forest Trail",
    preview_url: "https://cdn.coverr.co/videos/coverr-a-hike-in-the-forest-0881/1080p.mp4",
    thumbnail_url: "https://images.unsplash.com/photo-1511497584788-876760111969?w=320&h=180&fit=crop",
    duration_sec: 11,
    provider: "coverr",
    author: "Coverr",
  },
  {
    id: "cv_laptop_typing",
    label: "Laptop Typing",
    preview_url: "https://cdn.coverr.co/videos/coverr-typing-on-a-laptop-0881/1080p.mp4",
    thumbnail_url: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=320&h=180&fit=crop",
    duration_sec: 9,
    provider: "coverr",
    author: "Coverr",
  },
  {
    id: "cv_skateboarder",
    label: "Skateboarder",
    preview_url: "https://cdn.coverr.co/videos/coverr-skateboarder-in-the-street-0881/1080p.mp4",
    thumbnail_url: "https://images.unsplash.com/photo-1552598911-93ea9f5b6a44?w=320&h=180&fit=crop",
    duration_sec: 10,
    provider: "coverr",
    author: "Coverr",
  },
  {
    id: "cv_neon_city",
    label: "Neon City",
    preview_url: "https://cdn.coverr.co/videos/coverr-neon-city-0881/1080p.mp4",
    thumbnail_url: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=320&h=180&fit=crop",
    duration_sec: 15,
    provider: "coverr",
    author: "Coverr",
  },
  {
    id: "cv_mountain_road",
    label: "Mountain Road",
    preview_url: "https://cdn.coverr.co/videos/coverr-mountain-road-0881/1080p.mp4",
    thumbnail_url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=320&h=180&fit=crop",
    duration_sec: 14,
    provider: "coverr",
    author: "Coverr",
  },
  {
    id: "cv_product_desk",
    label: "Product Desk",
    preview_url: "https://cdn.coverr.co/videos/coverr-product-on-desk-0881/1080p.mp4",
    thumbnail_url: "https://images.unsplash.com/photo-1484156818044-c040038b0719?w=320&h=180&fit=crop",
    duration_sec: 8,
    provider: "coverr",
    author: "Coverr",
  },
  {
    id: "cv_gym_workout",
    label: "Gym Workout",
    preview_url: "https://cdn.coverr.co/videos/coverr-gym-workout-0881/1080p.mp4",
    thumbnail_url: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=320&h=180&fit=crop",
    duration_sec: 12,
    provider: "coverr",
    author: "Coverr",
  },
  {
    id: "cv_cafe_morning",
    label: "Cafe Morning",
    preview_url: "https://cdn.coverr.co/videos/coverr-cafe-morning-0881/1080p.mp4",
    thumbnail_url: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=320&h=180&fit=crop",
    duration_sec: 9,
    provider: "coverr",
    author: "Coverr",
  },
  {
    id: "cv_rain_window",
    label: "Rain Window",
    preview_url: "https://cdn.coverr.co/videos/coverr-rain-on-window-0881/1080p.mp4",
    thumbnail_url: "https://images.unsplash.com/photo-1527766833261-b09c3163a791?w=320&h=180&fit=crop",
    duration_sec: 11,
    provider: "coverr",
    author: "Coverr",
  },
];

/* ─────────────────────────── Panel ─────────────────────────── */

export function PresetPickerPanel({
  open,
  onOpenChange,
  onDropOnTimeline,
  onApplyFont,
  brollCandidates,
  className = "",
}: PresetPickerPanelProps) {
  const [tab, setTab] = useState<Tab>("sfx");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [favLoaded, setFavLoaded] = useState(false);

  // Reset filters on tab switch.
  useEffect(() => {
    setQuery("");
    setFilter("all");
  }, [tab]);

  /* ── Keyboard shortcut: Cmd/Ctrl+K toggles panel ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      if (
        tgt &&
        (tgt.tagName === "INPUT" ||
          tgt.tagName === "TEXTAREA" ||
          tgt.isContentEditable)
      ) {
        // still allow the shortcut while typing in our own search field
        if (!(tgt.closest && tgt.closest("[data-preset-picker-panel]"))) return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        onOpenChange(!open);
      } else if (e.key === "Escape" && open) {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  /* ── Load favourites ── */
  useEffect(() => {
    if (!open || favLoaded) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/favourites", { cache: "no-store" });
        if (!res.ok) {
          setFavLoaded(true);
          return;
        }
        const json = (await res.json()) as { favourites?: FavRow[] };
        if (cancelled) return;
        const s = new Set<string>();
        for (const f of json.favourites || []) {
          if (f && f.kind && f.item_id) s.add(favKey(f.kind, f.item_id));
        }
        setFavs(s);
      } catch {
        /* ignore – keep empty */
      } finally {
        if (!cancelled) setFavLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, favLoaded]);

  const toggleFav = useCallback(
    async (kind: Exclude<PresetKind, "fav">, id: string) => {
      const k = favKey(kind, id);
      const was = favs.has(k);
      const next = new Set(favs);
      if (was) next.delete(k);
      else next.add(k);
      setFavs(next);
      try {
        if (was) {
          await fetch(
            `/api/favourites?kind=${encodeURIComponent(kind)}&item_id=${encodeURIComponent(id)}`,
            { method: "DELETE" },
          );
        } else {
          await fetch("/api/favourites", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ kind, item_id: id }),
          });
        }
      } catch {
        /* best-effort — state is already optimistic */
      }
    },
    [favs],
  );

  /* ── Drag helpers ── */
  const startDrag = useCallback(
    (kind: Exclude<PresetKind, "fav">, id: string, payload: Record<string, unknown>) =>
      (e: React.DragEvent) => {
        const drop: PresetDropPayload = { kind, id, payload };
        try {
          e.dataTransfer.setData("application/x-preset-picker", JSON.stringify(drop));
          e.dataTransfer.setData("text/plain", `${kind}:${id}`);
          e.dataTransfer.effectAllowed = "copy";
        } catch {
          /* ignore */
        }
      },
    [],
  );

  const fireDrop = useCallback(
    (kind: Exclude<PresetKind, "fav">, id: string, payload: Record<string, unknown>) => {
      onDropOnTimeline?.({ kind, id, payload });
    },
    [onDropOnTimeline],
  );

  /* ─────────────────── Render ─────────────────── */

  if (!open) return null;

  return (
    <aside
      data-preset-picker-panel
      className={`fixed right-0 top-0 h-screen w-[420px] max-w-[90vw] z-40 flex flex-col border-l border-border bg-surface/95 backdrop-blur-md shadow-2xl ${className}`}
      role="complementary"
      aria-label="Preset Picker"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-surface-light/30">
        <div className="flex items-center gap-2">
          <Wand2 size={14} className="text-gold" />
          <span className="text-xs font-semibold">Preset Picker</span>
          <span className="text-[9px] text-muted hidden sm:inline">
            Cmd/Ctrl+K
          </span>
        </div>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="p-1 rounded hover:bg-surface-light text-muted hover:text-foreground"
          aria-label="Close preset picker"
        >
          <X size={13} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 px-2 py-1.5 border-b border-border bg-surface/50">
        <TabBtn id="sfx" current={tab} onSelect={setTab} icon={<Volume2 size={11} />} label="SFX" count={SFX_LIBRARY.length} />
        <TabBtn id="music" current={tab} onSelect={setTab} icon={<Music size={11} />} label="Music" count={MUSIC_LIBRARY.length} />
        <TabBtn id="vfx" current={tab} onSelect={setTab} icon={<Wand2 size={11} />} label="VFX" count={EFFECTS_LIBRARY.length} />
        <TabBtn id="transition" current={tab} onSelect={setTab} icon={<Scissors size={11} />} label="Trans" count={TRANSITIONS_LIBRARY.length} />
        <TabBtn id="broll" current={tab} onSelect={setTab} icon={<Film size={11} />} label="B-roll" count={(brollCandidates?.length ?? FALLBACK_BROLL.length)} />
        <TabBtn id="font" current={tab} onSelect={setTab} icon={<TypeIcon size={11} />} label="Fonts" count={FONTS_LIBRARY.length} />
        <TabBtn id="fav" current={tab} onSelect={setTab} icon={<Star size={11} />} label="★" count={favs.size} highlight />
      </div>

      {/* Search */}
      <div className="px-2 py-2 border-b border-border">
        <div className="relative">
          <Search
            size={11}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            placeholder={`Search ${tab === "fav" ? "favourites" : tab}…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="input w-full pl-7 text-[11px] py-1.5"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2">
        {tab === "sfx" && (
          <SfxTab
            query={query}
            filter={filter}
            setFilter={setFilter}
            favs={favs}
            onToggleFav={(id) => toggleFav("sfx", id)}
            onDrop={(id, sfx) => fireDrop("sfx", id, { url: sfx.url, duration_ms: sfx.duration_ms, name: sfx.name, category: sfx.category })}
            startDrag={(id, sfx) => startDrag("sfx", id, { url: sfx.url, duration_ms: sfx.duration_ms, name: sfx.name, category: sfx.category })}
          />
        )}
        {tab === "music" && (
          <MusicTab
            query={query}
            filter={filter}
            setFilter={setFilter}
            favs={favs}
            onToggleFav={(id) => toggleFav("music", id)}
            onDrop={(id, t) => fireDrop("music", id, { url: t.url, bpm: t.bpm, mood: t.mood, genre: t.genre, duration_sec: t.duration_sec, title: t.title })}
            startDrag={(id, t) => startDrag("music", id, { url: t.url, bpm: t.bpm, mood: t.mood, genre: t.genre, duration_sec: t.duration_sec, title: t.title })}
          />
        )}
        {tab === "vfx" && (
          <VfxTab
            query={query}
            filter={filter}
            setFilter={setFilter}
            favs={favs}
            onToggleFav={(id) => toggleFav("vfx", id)}
            onDrop={(id, fx) => fireDrop("vfx", id, { name: fx.name, category: fx.category })}
            startDrag={(id, fx) => startDrag("vfx", id, { name: fx.name, category: fx.category })}
          />
        )}
        {tab === "transition" && (
          <TransitionTab
            query={query}
            filter={filter}
            setFilter={setFilter}
            favs={favs}
            onToggleFav={(id) => toggleFav("transition", id)}
            onDrop={(id, t) => fireDrop("transition", id, { name: t.name, category: t.category, duration_ms: t.duration_ms })}
            startDrag={(id, t) => startDrag("transition", id, { name: t.name, category: t.category, duration_ms: t.duration_ms })}
          />
        )}
        {tab === "broll" && (
          <BrollTab
            query={query}
            filter={filter}
            setFilter={setFilter}
            candidates={brollCandidates && brollCandidates.length > 0 ? brollCandidates : FALLBACK_BROLL}
            favs={favs}
            onToggleFav={(id) => toggleFav("broll", id)}
            onDrop={(id, c) => fireDrop("broll", id, { preview_url: c.preview_url, thumbnail_url: c.thumbnail_url, label: c.label, duration_sec: c.duration_sec })}
            startDrag={(id, c) => startDrag("broll", id, { preview_url: c.preview_url, thumbnail_url: c.thumbnail_url, label: c.label, duration_sec: c.duration_sec })}
          />
        )}
        {tab === "font" && (
          <FontTab
            query={query}
            filter={filter}
            setFilter={setFilter}
            favs={favs}
            onToggleFav={(id) => toggleFav("font", id)}
            onApply={(font) => onApplyFont?.(font)}
            startDrag={(id, f) => startDrag("font", id, { family: f.family, url: f.url })}
          />
        )}
        {tab === "fav" && (
          <FavouritesTab
            query={query}
            favs={favs}
            onToggleFav={toggleFav}
            onDrop={fireDrop}
            onApplyFont={onApplyFont}
            startDrag={startDrag}
          />
        )}
      </div>

      {/* Footer hint */}
      <div className="border-t border-border bg-surface-light/20 px-3 py-1.5 text-[9px] text-muted flex items-center justify-between">
        <span>Drag to timeline</span>
        <span>
          <Heart size={9} className="inline mb-[1px]" /> Double-click to pin
        </span>
      </div>
    </aside>
  );
}

/* ─────────────────────────── Tab button ─────────────────────────── */

function TabBtn({
  id,
  current,
  onSelect,
  icon,
  label,
  count,
  highlight,
}: {
  id: Tab;
  current: Tab;
  onSelect: (t: Tab) => void;
  icon: ReactNode;
  label: string;
  count: number;
  highlight?: boolean;
}) {
  const active = current === id;
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium transition ${
        active
          ? "bg-gold/20 text-gold"
          : highlight
            ? "text-gold/70 hover:bg-surface-light hover:text-gold"
            : "text-muted hover:bg-surface-light hover:text-foreground"
      }`}
      aria-pressed={active}
    >
      {icon}
      <span>{label}</span>
      <span className="text-[8px] bg-surface-light rounded px-1">{count}</span>
    </button>
  );
}

/* ─────────────────────────── Category chips ─────────────────────────── */

function Chips({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 mb-2">
      <Chip active={value === "all"} onClick={() => onChange("all")}>
        All
      </Chip>
      {options.map((o) => (
        <Chip key={o} active={value === o} onClick={() => onChange(o)}>
          {o}
        </Chip>
      ))}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2 py-0.5 text-[9px] transition ${
        active
          ? "bg-white text-black"
          : "bg-surface-light/60 text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

/* ─────────────────────────── Favourite star button ─────────────────────────── */

function FavStar({
  favId,
  favs,
  onToggle,
  className = "",
}: {
  favId: string;
  favs: Set<string>;
  onToggle: () => void;
  className?: string;
}) {
  const isFav = favs.has(favId);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`rounded p-1 transition ${
        isFav ? "text-gold" : "text-muted hover:text-gold"
      } ${className}`}
      title={isFav ? "Unpin from Favourites" : "Pin to Favourites"}
    >
      <Star size={11} fill={isFav ? "currentColor" : "none"} />
    </button>
  );
}

/* ─────────────────────────── SFX tab ─────────────────────────── */

function SfxTab({
  query,
  filter,
  setFilter,
  favs,
  onToggleFav,
  onDrop,
  startDrag,
}: {
  query: string;
  filter: string;
  setFilter: (v: string) => void;
  favs: Set<string>;
  onToggleFav: (id: string) => void;
  onDrop: (id: string, sfx: Sfx) => void;
  startDrag: (id: string, sfx: Sfx) => (e: React.DragEvent) => void;
}) {
  const categories = useMemo(
    () => Array.from(new Set(SFX_LIBRARY.map((s) => s.category))).sort(),
    [],
  );
  const items = useMemo(() => {
    const q = query.toLowerCase().trim();
    return SFX_LIBRARY.filter((s) => {
      if (filter !== "all" && s.category !== filter) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [query, filter]);

  return (
    <>
      <Chips options={categories} value={filter} onChange={setFilter} />
      <div className="flex flex-col gap-1.5">
        {items.map((s) => (
          <AudioRow
            key={s.id}
            id={s.id}
            title={s.name}
            sub={`${s.category} · ${(s.duration_ms / 1000).toFixed(1)}s`}
            url={s.url}
            draggable
            onDragStart={startDrag(s.id, s)}
            onAdd={() => onDrop(s.id, s)}
            onDoubleClick={() => onToggleFav(s.id)}
            favButton={
              <FavStar
                favId={favKey("sfx", s.id)}
                favs={favs}
                onToggle={() => onToggleFav(s.id)}
              />
            }
          />
        ))}
        {items.length === 0 && <Empty label="SFX" />}
      </div>
    </>
  );
}

/* ─────────────────────────── Music tab ─────────────────────────── */

function MusicTab({
  query,
  filter,
  setFilter,
  favs,
  onToggleFav,
  onDrop,
  startDrag,
}: {
  query: string;
  filter: string;
  setFilter: (v: string) => void;
  favs: Set<string>;
  onToggleFav: (id: string) => void;
  onDrop: (id: string, t: MusicTrack) => void;
  startDrag: (id: string, t: MusicTrack) => (e: React.DragEvent) => void;
}) {
  const moods = useMemo(
    () => Array.from(new Set(MUSIC_LIBRARY.map((m) => m.mood))).sort(),
    [],
  );
  const [bpmMin, setBpmMin] = useState<number>(0);
  const [bpmMax, setBpmMax] = useState<number>(240);

  const items = useMemo(() => {
    const q = query.toLowerCase().trim();
    return MUSIC_LIBRARY.filter((m) => {
      if (filter !== "all" && m.mood !== filter) return false;
      if (m.bpm < bpmMin || m.bpm > bpmMax) return false;
      if (!q) return true;
      return (
        m.title.toLowerCase().includes(q) ||
        m.artist.toLowerCase().includes(q) ||
        m.genre.toLowerCase().includes(q) ||
        m.mood.toLowerCase().includes(q)
      );
    });
  }, [query, filter, bpmMin, bpmMax]);

  return (
    <>
      <Chips options={moods} value={filter} onChange={setFilter} />
      <div className="mb-2 flex items-center gap-2 text-[9px] text-muted">
        <span>BPM</span>
        <input
          type="number"
          value={bpmMin}
          onChange={(e) => setBpmMin(Number(e.target.value) || 0)}
          className="w-12 bg-surface-light rounded px-1 py-0.5 text-[9px]"
          min={0}
          max={300}
        />
        <span>–</span>
        <input
          type="number"
          value={bpmMax}
          onChange={(e) => setBpmMax(Number(e.target.value) || 240)}
          className="w-12 bg-surface-light rounded px-1 py-0.5 text-[9px]"
          min={0}
          max={300}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        {items.map((m) => (
          <AudioRow
            key={m.id}
            id={m.id}
            title={m.title}
            sub={`${m.mood} · ${m.genre} · ${m.bpm} BPM · ${Math.floor(m.duration_sec / 60)}:${String(m.duration_sec % 60).padStart(2, "0")}`}
            url={m.url}
            draggable
            onDragStart={startDrag(m.id, m)}
            onAdd={() => onDrop(m.id, m)}
            onDoubleClick={() => onToggleFav(m.id)}
            favButton={
              <FavStar
                favId={favKey("music", m.id)}
                favs={favs}
                onToggle={() => onToggleFav(m.id)}
              />
            }
          />
        ))}
        {items.length === 0 && <Empty label="tracks" />}
      </div>
    </>
  );
}

/* ─────────────────────────── VFX (Effects) tab ─────────────────────────── */

function VfxTab({
  query,
  filter,
  setFilter,
  favs,
  onToggleFav,
  onDrop,
  startDrag,
}: {
  query: string;
  filter: string;
  setFilter: (v: string) => void;
  favs: Set<string>;
  onToggleFav: (id: string) => void;
  onDrop: (id: string, fx: VideoEffect) => void;
  startDrag: (id: string, fx: VideoEffect) => (e: React.DragEvent) => void;
}) {
  const categories = useMemo(
    () => Array.from(new Set(EFFECTS_LIBRARY.map((e) => e.category))).sort(),
    [],
  );
  const items = useMemo(() => {
    const q = query.toLowerCase().trim();
    return EFFECTS_LIBRARY.filter((e) => {
      if (filter !== "all" && e.category !== filter) return false;
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q)
      );
    });
  }, [query, filter]);

  return (
    <>
      <Chips options={categories} value={filter} onChange={setFilter} />
      <div className="grid grid-cols-2 gap-1.5">
        {items.map((e) => (
          <EffectTile
            key={e.id}
            effect={e}
            favs={favs}
            onToggleFav={() => onToggleFav(e.id)}
            onAdd={() => onDrop(e.id, e)}
            onDragStart={startDrag(e.id, e)}
          />
        ))}
        {items.length === 0 && <Empty label="effects" />}
      </div>
    </>
  );
}

function EffectTile({
  effect,
  favs,
  onToggleFav,
  onAdd,
  onDragStart,
}: {
  effect: VideoEffect;
  favs: Set<string>;
  onToggleFav: () => void;
  onAdd: () => void;
  onDragStart: (e: React.DragEvent) => void;
}) {
  const previewStyle: CSSProperties = useMemo(() => {
    switch (effect.category) {
      case "color":
        return { filter: "saturate(1.3) contrast(1.15)" };
      case "filter":
        return { filter: "sepia(0.5) contrast(1.1)" };
      case "distortion":
        return { filter: "blur(2px) hue-rotate(25deg)" };
      case "stylize":
        return { filter: "saturate(2) contrast(1.3)" };
      case "motion":
        return { animation: "pulse 1.5s ease-in-out infinite" };
      default:
        return {};
    }
  }, [effect.category]);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDoubleClick={onToggleFav}
      className="group relative rounded-md border border-border/50 bg-surface-light/30 p-1.5 hover:border-gold/40 transition cursor-grab active:cursor-grabbing"
    >
      <div
        className="aspect-video rounded overflow-hidden bg-gradient-to-br from-amber-500/40 via-rose-500/40 to-indigo-500/40 relative"
        style={previewStyle}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="rounded bg-black/50 px-1 py-0.5 text-[8px] font-semibold text-white">
            {effect.category.toUpperCase()}
          </span>
        </div>
      </div>
      <div className="mt-1 flex items-start justify-between gap-1">
        <p className="text-[10px] font-semibold truncate flex-1">{effect.name}</p>
        <FavStar
          favId={favKey("vfx", effect.id)}
          favs={favs}
          onToggle={onToggleFav}
        />
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="absolute inset-x-1 bottom-1 rounded bg-gold/90 text-black text-[8px] font-semibold py-0.5 opacity-0 group-hover:opacity-100 transition"
      >
        + Add
      </button>
    </div>
  );
}

/* ─────────────────────────── Transitions tab ─────────────────────────── */

function TransitionTab({
  query,
  filter,
  setFilter,
  favs,
  onToggleFav,
  onDrop,
  startDrag,
}: {
  query: string;
  filter: string;
  setFilter: (v: string) => void;
  favs: Set<string>;
  onToggleFav: (id: string) => void;
  onDrop: (id: string, t: Transition) => void;
  startDrag: (id: string, t: Transition) => (e: React.DragEvent) => void;
}) {
  const categories = useMemo(
    () => Array.from(new Set(TRANSITIONS_LIBRARY.map((t) => t.category))).sort(),
    [],
  );
  const items = useMemo(() => {
    const q = query.toLowerCase().trim();
    return TRANSITIONS_LIBRARY.filter((t) => {
      if (filter !== "all" && t.category !== filter) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    });
  }, [query, filter]);

  return (
    <>
      <Chips options={categories} value={filter} onChange={setFilter} />
      <div className="grid grid-cols-2 gap-1.5">
        {items.map((t) => (
          <TransitionTile
            key={t.id}
            transition={t}
            favs={favs}
            onToggleFav={() => onToggleFav(t.id)}
            onAdd={() => onDrop(t.id, t)}
            onDragStart={startDrag(t.id, t)}
          />
        ))}
        {items.length === 0 && <Empty label="transitions" />}
      </div>
    </>
  );
}

function TransitionTile({
  transition,
  favs,
  onToggleFav,
  onAdd,
  onDragStart,
}: {
  transition: Transition;
  favs: Set<string>;
  onToggleFav: () => void;
  onAdd: () => void;
  onDragStart: (e: React.DragEvent) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [k, setK] = useState(0);
  const animClass = useMemo(() => {
    switch (transition.category) {
      case "fade":
        return "animate-[fade_700ms_ease]";
      case "slide":
        return "animate-[slideIn_700ms_ease]";
      case "zoom":
        return "animate-[zoomIn_600ms_ease]";
      case "rotate":
        return "animate-[spin_700ms_ease]";
      case "whip":
        return "animate-[slideIn_300ms_ease-out]";
      case "glitch":
        return "animate-[glitch_450ms_steps(6)]";
      case "masking":
        return "animate-[zoomIn_700ms_ease-out]";
      case "3d":
        return "animate-[spin_900ms_ease]";
      default:
        return "animate-[pulse_600ms_ease]";
    }
  }, [transition.category]);

  function runDemo() {
    setPlaying(true);
    setK((n) => n + 1);
    window.setTimeout(() => setPlaying(false), transition.duration_ms + 200);
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDoubleClick={onToggleFav}
      className="group relative rounded-md border border-border/50 bg-surface-light/30 p-1.5 hover:border-gold/40 transition cursor-grab active:cursor-grabbing"
    >
      <button
        type="button"
        onClick={runDemo}
        className="aspect-video w-full relative overflow-hidden rounded bg-gradient-to-br from-[#1F2937] to-[#0F172A] flex items-center justify-center"
      >
        <div
          key={k}
          className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gold/30 to-red-500/30 text-xs font-semibold ${
            playing ? animClass : "opacity-70"
          }`}
        >
          B
        </div>
        <span className="relative z-10 rounded bg-black/60 px-1 py-0.5 text-[7px] text-white/80">
          {playing ? "…" : "demo"}
        </span>
      </button>
      <div className="mt-1 flex items-start justify-between gap-1">
        <p className="text-[10px] font-semibold truncate flex-1">{transition.name}</p>
        <FavStar
          favId={favKey("transition", transition.id)}
          favs={favs}
          onToggle={onToggleFav}
        />
      </div>
      <p className="text-[8px] text-muted">
        {transition.category} · {transition.duration_ms}ms
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="absolute inset-x-1 bottom-1 rounded bg-gold/90 text-black text-[8px] font-semibold py-0.5 opacity-0 group-hover:opacity-100 transition"
      >
        + Add
      </button>
    </div>
  );
}

/* ─────────────────────────── B-roll tab ─────────────────────────── */

function BrollTab({
  query,
  filter,
  setFilter,
  candidates,
  favs,
  onToggleFav,
  onDrop,
  startDrag,
}: {
  query: string;
  filter: string;
  setFilter: (v: string) => void;
  candidates: BrollCandidate[];
  favs: Set<string>;
  onToggleFav: (id: string) => void;
  onDrop: (id: string, c: BrollCandidate) => void;
  startDrag: (id: string, c: BrollCandidate) => (e: React.DragEvent) => void;
}) {
  const providers = useMemo(
    () =>
      Array.from(
        new Set(candidates.map((c) => c.provider || "stock").filter(Boolean)),
      ).sort(),
    [candidates],
  );
  const items = useMemo(() => {
    const q = query.toLowerCase().trim();
    return candidates.filter((c) => {
      if (filter !== "all" && (c.provider || "stock") !== filter) return false;
      if (!q) return true;
      return (
        c.label.toLowerCase().includes(q) ||
        (c.author || "").toLowerCase().includes(q)
      );
    });
  }, [candidates, query, filter]);

  return (
    <>
      <Chips options={providers} value={filter} onChange={setFilter} />
      <div className="grid grid-cols-2 gap-1.5">
        {items.map((c) => (
          <BrollTile
            key={c.id}
            candidate={c}
            favs={favs}
            onToggleFav={() => onToggleFav(c.id)}
            onAdd={() => onDrop(c.id, c)}
            onDragStart={startDrag(c.id, c)}
          />
        ))}
        {items.length === 0 && <Empty label="B-roll clips" />}
      </div>
    </>
  );
}

function BrollTile({
  candidate,
  favs,
  onToggleFav,
  onAdd,
  onDragStart,
}: {
  candidate: BrollCandidate;
  favs: Set<string>;
  onToggleFav: () => void;
  onAdd: () => void;
  onDragStart: (e: React.DragEvent) => void;
}) {
  const vref = useRef<HTMLVideoElement | null>(null);

  const onEnter = () => {
    if (vref.current) {
      vref.current.currentTime = 0;
      void vref.current.play().catch(() => {});
    }
  };
  const onLeave = () => {
    if (vref.current) {
      vref.current.pause();
    }
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDoubleClick={onToggleFav}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className="group relative rounded-md border border-border/50 bg-surface-light/30 p-1.5 hover:border-gold/40 transition cursor-grab active:cursor-grabbing"
    >
      <div className="aspect-video rounded overflow-hidden bg-black relative">
        {candidate.preview_url ? (
          <video
            ref={vref}
            src={candidate.preview_url}
            poster={candidate.thumbnail_url}
            muted
            playsInline
            loop
            preload="metadata"
            className="h-full w-full object-cover"
          />
        ) : candidate.thumbnail_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={candidate.thumbnail_url}
            alt={candidate.label}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-muted text-[8px]">
            no preview
          </div>
        )}
      </div>
      <div className="mt-1 flex items-start justify-between gap-1">
        <p className="text-[10px] font-semibold truncate flex-1">{candidate.label}</p>
        <FavStar
          favId={favKey("broll", candidate.id)}
          favs={favs}
          onToggle={onToggleFav}
        />
      </div>
      <p className="text-[8px] text-muted">
        {candidate.provider || "stock"}
        {candidate.duration_sec ? ` · ${candidate.duration_sec}s` : ""}
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="absolute inset-x-1 bottom-1 rounded bg-gold/90 text-black text-[8px] font-semibold py-0.5 opacity-0 group-hover:opacity-100 transition"
      >
        + Add
      </button>
    </div>
  );
}

/* ─────────────────────────── Fonts tab ─────────────────────────── */

function FontTab({
  query,
  filter,
  setFilter,
  favs,
  onToggleFav,
  onApply,
  startDrag,
}: {
  query: string;
  filter: string;
  setFilter: (v: string) => void;
  favs: Set<string>;
  onToggleFav: (id: string) => void;
  onApply: (font: Font) => void;
  startDrag: (id: string, f: Font) => (e: React.DragEvent) => void;
}) {
  const categories = useMemo(
    () => Array.from(new Set(FONTS_LIBRARY.map((f) => f.category))).sort(),
    [],
  );
  const items = useMemo(() => {
    const q = query.toLowerCase().trim();
    return FONTS_LIBRARY.filter((f) => {
      if (filter !== "all" && f.category !== filter) return false;
      if (!q) return true;
      return (
        f.family.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q) ||
        f.useCases.some((u) => u.toLowerCase().includes(q))
      );
    });
  }, [query, filter]);

  // Lazy-load stylesheets for visible fonts.
  useEffect(() => {
    const loaded = new Set<string>();
    document
      .querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][data-preset-picker-font]')
      .forEach((el) => loaded.add(el.href));
    for (const f of items) {
      if (!loaded.has(f.url)) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = f.url;
        link.crossOrigin = "anonymous";
        link.setAttribute("data-preset-picker-font", "1");
        document.head.appendChild(link);
        loaded.add(f.url);
      }
    }
  }, [items]);

  return (
    <>
      <Chips options={categories} value={filter} onChange={setFilter} />
      <div className="flex flex-col gap-1.5">
        {items.map((f) => (
          <div
            key={f.id}
            draggable
            onDragStart={startDrag(f.id, f)}
            onDoubleClick={() => onToggleFav(f.id)}
            className="rounded-md border border-border/50 bg-surface-light/30 p-2 hover:border-gold/40 transition cursor-grab active:cursor-grabbing"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold truncate">{f.family}</p>
                <p className="text-[8px] text-muted uppercase tracking-wide">
                  {f.category} · {f.weight.join("/")}
                </p>
              </div>
              <FavStar
                favId={favKey("font", f.id)}
                favs={favs}
                onToggle={() => onToggleFav(f.id)}
              />
            </div>
            <p
              className="mt-1 truncate text-base leading-tight"
              style={{ fontFamily: `"${f.family}", sans-serif` }}
            >
              {f.previewText || "The quick brown fox"}
            </p>
            <button
              type="button"
              onClick={() => onApply(f)}
              className="mt-1 rounded bg-gold/90 text-black text-[8px] font-semibold px-2 py-0.5"
            >
              Apply to text
            </button>
          </div>
        ))}
        {items.length === 0 && <Empty label="fonts" />}
      </div>
    </>
  );
}

/* ─────────────────────────── Favourites tab ─────────────────────────── */

function FavouritesTab({
  query,
  favs,
  onToggleFav,
  onDrop,
  onApplyFont,
  startDrag,
}: {
  query: string;
  favs: Set<string>;
  onToggleFav: (kind: Exclude<PresetKind, "fav">, id: string) => void;
  onDrop: (
    kind: Exclude<PresetKind, "fav">,
    id: string,
    payload: Record<string, unknown>,
  ) => void;
  onApplyFont?: (font: Font) => void;
  startDrag: (
    kind: Exclude<PresetKind, "fav">,
    id: string,
    payload: Record<string, unknown>,
  ) => (e: React.DragEvent) => void;
}) {
  const q = query.toLowerCase().trim();

  // Resolve fav IDs back to actual preset records.
  const items = useMemo(() => {
    const out: Array<
      | { kind: "sfx"; rec: Sfx }
      | { kind: "music"; rec: MusicTrack }
      | { kind: "vfx"; rec: VideoEffect }
      | { kind: "transition"; rec: Transition }
      | { kind: "font"; rec: Font }
      | { kind: "broll"; rec: BrollCandidate }
    > = [];
    for (const key of Array.from(favs)) {
      const [kind, id] = key.split("::");
      if (!kind || !id) continue;
      if (kind === "sfx") {
        const rec = SFX_LIBRARY.find((s) => s.id === id);
        if (rec) out.push({ kind: "sfx", rec });
      } else if (kind === "music") {
        const rec = MUSIC_LIBRARY.find((m) => m.id === id);
        if (rec) out.push({ kind: "music", rec });
      } else if (kind === "vfx") {
        const rec = EFFECTS_LIBRARY.find((e) => e.id === id);
        if (rec) out.push({ kind: "vfx", rec });
      } else if (kind === "transition") {
        const rec = TRANSITIONS_LIBRARY.find((t) => t.id === id);
        if (rec) out.push({ kind: "transition", rec });
      } else if (kind === "font") {
        const rec = FONTS_LIBRARY.find((f) => f.id === id);
        if (rec) out.push({ kind: "font", rec });
      } else if (kind === "broll") {
        // B-roll candidates are not stable across sessions — show id-only stub
        out.push({
          kind: "broll",
          rec: { id, label: id, provider: "pinned" } as BrollCandidate,
        });
      }
    }
    if (!q) return out;
    return out.filter((it) => {
      const hay =
        "label" in it.rec
          ? it.rec.label
          : "title" in it.rec
            ? (it.rec as MusicTrack).title
            : "family" in it.rec
              ? (it.rec as Font).family
              : "name" in it.rec
                ? (it.rec as Sfx | VideoEffect | Transition).name
                : "";
      return String(hay).toLowerCase().includes(q);
    });
  }, [favs, q]);

  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border/50 p-6 text-center text-[10px] text-muted">
        Double-click any preset to pin it here.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {items.map((it) => {
        if (it.kind === "sfx") {
          return (
            <AudioRow
              key={`sfx-${it.rec.id}`}
              id={it.rec.id}
              title={it.rec.name}
              sub={`SFX · ${it.rec.category}`}
              url={it.rec.url}
              draggable
              onDragStart={startDrag("sfx", it.rec.id, {
                url: it.rec.url,
                duration_ms: it.rec.duration_ms,
                name: it.rec.name,
                category: it.rec.category,
              })}
              onAdd={() =>
                onDrop("sfx", it.rec.id, {
                  url: it.rec.url,
                  duration_ms: it.rec.duration_ms,
                  name: it.rec.name,
                  category: it.rec.category,
                })
              }
              onDoubleClick={() => onToggleFav("sfx", it.rec.id)}
              favButton={
                <FavStar
                  favId={favKey("sfx", it.rec.id)}
                  favs={favs}
                  onToggle={() => onToggleFav("sfx", it.rec.id)}
                />
              }
            />
          );
        }
        if (it.kind === "music") {
          return (
            <AudioRow
              key={`music-${it.rec.id}`}
              id={it.rec.id}
              title={it.rec.title}
              sub={`Music · ${it.rec.mood} · ${it.rec.bpm}BPM`}
              url={it.rec.url}
              draggable
              onDragStart={startDrag("music", it.rec.id, {
                url: it.rec.url,
                bpm: it.rec.bpm,
                mood: it.rec.mood,
                genre: it.rec.genre,
                title: it.rec.title,
              })}
              onAdd={() =>
                onDrop("music", it.rec.id, {
                  url: it.rec.url,
                  bpm: it.rec.bpm,
                  mood: it.rec.mood,
                  genre: it.rec.genre,
                  title: it.rec.title,
                })
              }
              onDoubleClick={() => onToggleFav("music", it.rec.id)}
              favButton={
                <FavStar
                  favId={favKey("music", it.rec.id)}
                  favs={favs}
                  onToggle={() => onToggleFav("music", it.rec.id)}
                />
              }
            />
          );
        }
        if (it.kind === "vfx") {
          const fx = it.rec;
          return (
            <div
              key={`vfx-${fx.id}`}
              draggable
              onDragStart={startDrag("vfx", fx.id, { name: fx.name, category: fx.category })}
              onDoubleClick={() => onToggleFav("vfx", fx.id)}
              className="flex items-center gap-2 rounded-md border border-border/50 bg-surface-light/30 p-2 hover:border-gold/40"
            >
              <Wand2 size={12} className="text-gold" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold truncate">{fx.name}</p>
                <p className="text-[8px] text-muted">VFX · {fx.category}</p>
              </div>
              <button
                type="button"
                onClick={() => onDrop("vfx", fx.id, { name: fx.name, category: fx.category })}
                className="rounded bg-gold/80 px-1.5 py-0.5 text-[8px] font-semibold text-black"
              >
                Add
              </button>
              <FavStar favId={favKey("vfx", fx.id)} favs={favs} onToggle={() => onToggleFav("vfx", fx.id)} />
            </div>
          );
        }
        if (it.kind === "transition") {
          const t = it.rec;
          return (
            <div
              key={`tr-${t.id}`}
              draggable
              onDragStart={startDrag("transition", t.id, { name: t.name, category: t.category, duration_ms: t.duration_ms })}
              onDoubleClick={() => onToggleFav("transition", t.id)}
              className="flex items-center gap-2 rounded-md border border-border/50 bg-surface-light/30 p-2 hover:border-gold/40"
            >
              <Scissors size={12} className="text-gold" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold truncate">{t.name}</p>
                <p className="text-[8px] text-muted">Transition · {t.category}</p>
              </div>
              <button
                type="button"
                onClick={() => onDrop("transition", t.id, { name: t.name, category: t.category, duration_ms: t.duration_ms })}
                className="rounded bg-gold/80 px-1.5 py-0.5 text-[8px] font-semibold text-black"
              >
                Add
              </button>
              <FavStar favId={favKey("transition", t.id)} favs={favs} onToggle={() => onToggleFav("transition", t.id)} />
            </div>
          );
        }
        if (it.kind === "font") {
          const f = it.rec;
          return (
            <div
              key={`font-${f.id}`}
              draggable
              onDragStart={startDrag("font", f.id, { family: f.family, url: f.url })}
              onDoubleClick={() => onToggleFav("font", f.id)}
              className="flex items-center gap-2 rounded-md border border-border/50 bg-surface-light/30 p-2 hover:border-gold/40"
            >
              <TypeIcon size={12} className="text-gold" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold truncate">{f.family}</p>
                <p className="text-[8px] text-muted">Font · {f.category}</p>
              </div>
              <button
                type="button"
                onClick={() => onApplyFont?.(f)}
                className="rounded bg-gold/80 px-1.5 py-0.5 text-[8px] font-semibold text-black"
              >
                Apply
              </button>
              <FavStar favId={favKey("font", f.id)} favs={favs} onToggle={() => onToggleFav("font", f.id)} />
            </div>
          );
        }
        if (it.kind === "broll") {
          const b = it.rec;
          return (
            <div
              key={`broll-${b.id}`}
              className="flex items-center gap-2 rounded-md border border-border/50 bg-surface-light/30 p-2"
            >
              <Film size={12} className="text-gold" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold truncate">{b.label}</p>
                <p className="text-[8px] text-muted">B-roll · pinned</p>
              </div>
              <FavStar favId={favKey("broll", b.id)} favs={favs} onToggle={() => onToggleFav("broll", b.id)} />
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

/* ─────────────────────────── Shared audio row ─────────────────────────── */

function AudioRow({
  id,
  title,
  sub,
  url,
  draggable,
  onDragStart,
  onAdd,
  onDoubleClick,
  favButton,
}: {
  id: string;
  title: string;
  sub: string;
  url: string;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onAdd: () => void;
  onDoubleClick?: () => void;
  favButton?: ReactNode;
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
    if (error) return;
    if (!audioRef.current) {
      const a = new Audio(url);
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
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDoubleClick={onDoubleClick}
      data-preset-item-id={id}
      className="flex items-center gap-2 rounded-md border border-border/50 bg-surface-light/30 p-1.5 hover:border-gold/40 cursor-grab active:cursor-grabbing"
    >
      <GripVertical size={10} className="text-muted shrink-0" />
      <button
        type="button"
        onClick={toggle}
        disabled={error}
        className={`h-7 w-7 shrink-0 rounded-full flex items-center justify-center ${
          error
            ? "bg-red-500/10 text-red-400"
            : playing
              ? "bg-gold text-black"
              : "bg-gold/20 text-gold hover:bg-gold/30"
        }`}
        title={error ? "Preview URL broken" : playing ? "Pause" : "Play"}
      >
        {playing ? <Pause size={11} /> : <Play size={11} />}
      </button>
      <div className="flex-1 min-w-0">
        <p className="truncate text-[10px] font-semibold">{title}</p>
        <p className="truncate text-[8px] text-muted">{sub}</p>
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="shrink-0 rounded bg-surface-light/80 p-1 text-muted hover:text-gold"
        title="Add to timeline"
      >
        <Check size={11} />
      </button>
      {favButton}
    </div>
  );
}

/* ─────────────────────────── Empty ─────────────────────────── */

function Empty({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed border-border/40 p-6 text-center text-[10px] text-muted">
      No {label} match that search.
    </div>
  );
}

export default PresetPickerPanel;
