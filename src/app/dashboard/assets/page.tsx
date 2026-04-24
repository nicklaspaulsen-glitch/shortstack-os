"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Search, Grid, List, Image as ImageIcon, Video, Music,
  FileText, File, Layers, Tag as TagIcon, Sparkles, Filter,
  Clock, X, ChevronDown,
} from "lucide-react";
import toast from "react-hot-toast";
import PageHero from "@/components/ui/page-hero";

interface Asset {
  id: string;
  org_id: string;
  project_id: string | null;
  asset_type: "image" | "video" | "audio" | "doc" | "link" | "3d" | "other";
  source: string;
  storage_url: string | null;
  thumbnail_url: string | null;
  filename: string | null;
  mime_type: string | null;
  size_bytes: number;
  tags: string[];
  description: string | null;
  ai_metadata: Record<string, unknown>;
  original_asset_id: string | null;
  created_by: string | null;
  created_at: string;
}

interface AssetTag {
  id: string;
  name: string;
  color: string;
}

const TYPE_CHIPS: { key: Asset["asset_type"]; label: string; icon: React.ReactNode }[] = [
  { key: "image", label: "Images", icon: <ImageIcon size={14} /> },
  { key: "video", label: "Videos", icon: <Video size={14} /> },
  { key: "audio", label: "Audio", icon: <Music size={14} /> },
  { key: "doc", label: "Docs", icon: <FileText size={14} /> },
  { key: "link", label: "Links", icon: <File size={14} /> },
  { key: "3d", label: "3D", icon: <Layers size={14} /> },
  { key: "other", label: "Other", icon: <File size={14} /> },
];

const SOURCE_OPTIONS = [
  { key: "ai_generated", label: "AI Generated" },
  { key: "uploaded", label: "Uploaded" },
  { key: "gdrive", label: "Google Drive" },
  { key: "dropbox", label: "Dropbox" },
  { key: "external", label: "External" },
  { key: "from_review", label: "From Review" },
  { key: "from_thumbnail_tool", label: "Thumbnail Tool" },
  { key: "from_copywriter", label: "Copywriter" },
];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatSize(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function typeIcon(t: Asset["asset_type"]): React.ReactNode {
  const spec = TYPE_CHIPS.find((c) => c.key === t);
  return spec?.icon || <File size={14} />;
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [tagCatalog, setTagCatalog] = useState<AssetTag[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const limit = 40;
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    fetch("/api/assets/tags")
      .then((r) => r.json())
      .then((d) => setTagCatalog(d.tags || []))
      .catch(() => {});
  }, []);

  const fetchAssets = useCallback(
    async (append: boolean) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (debouncedSearch) params.set("q", debouncedSearch);
        if (selectedTypes.length) params.set("types", selectedTypes.join(","));
        if (selectedSources.length) params.set("sources", selectedSources.join(","));
        if (selectedTags.length) params.set("tags", selectedTags.join(","));
        if (dateFrom) params.set("date_from", dateFrom);
        if (dateTo) params.set("date_to", dateTo);
        params.set("limit", String(limit));
        params.set("offset", String(append ? offset : 0));

        const res = await fetch(`/api/assets?${params}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Load failed");

        setAssets((prev) => (append ? [...prev, ...(data.assets || [])] : data.assets || []));
        setTotal(data.total || 0);
        setHasMore(!!data.has_more);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    },
    [debouncedSearch, selectedTypes, selectedSources, selectedTags, dateFrom, dateTo, offset],
  );

  useEffect(() => {
    setOffset(0);
    fetchAssets(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, selectedTypes.join(","), selectedSources.join(","), selectedTags.join(","), dateFrom, dateTo]);

  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loading) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          setOffset((prev) => prev + limit);
        }
      },
      { threshold: 0.1 },
    );
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [hasMore, loading]);

  useEffect(() => {
    if (offset > 0) fetchAssets(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset]);

  const toggleType = (k: string) =>
    setSelectedTypes((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  const toggleSource = (k: string) =>
    setSelectedSources((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  const toggleTag = (name: string) =>
    setSelectedTags((prev) => (prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]));

  const clearFilters = () => {
    setSelectedTypes([]);
    setSelectedSources([]);
    setSelectedTags([]);
    setDateFrom("");
    setDateTo("");
    setSearch("");
  };

  const aiGenerated = assets.filter((a) => a.source === "ai_generated" || a.source.startsWith("from_")).slice(0, 8);
  const recent = [...assets]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8);

  const anyFilter =
    selectedTypes.length ||
    selectedSources.length ||
    selectedTags.length ||
    dateFrom ||
    dateTo ||
    debouncedSearch;

  return (
    <div className="min-h-screen bg-black text-white">
      <PageHero
        title="Asset Library"
        subtitle="Every deliverable in one searchable home — AI outputs, uploads, portal drops, all tagged and cross-linked."
        icon={<Layers size={28} />}
      />

      <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={16} />
            <input
              type="text"
              placeholder="Search filenames, descriptions, tags…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-3 py-2 text-sm outline-none focus:border-gold/50"
            />
          </div>

          <button
            onClick={() => setShowFilters((v) => !v)}
            className="inline-flex items-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg px-3 py-2 text-sm"
          >
            <Filter size={14} />
            Filters
            <ChevronDown size={14} className={showFilters ? "rotate-180 transition-transform" : "transition-transform"} />
          </button>

          <div className="flex rounded-lg overflow-hidden border border-white/10">
            <button
              onClick={() => setView("grid")}
              className={`p-2 ${view === "grid" ? "bg-gold/20 text-gold" : "bg-white/5 text-white/60 hover:bg-white/10"}`}
              aria-label="Grid view"
            >
              <Grid size={16} />
            </button>
            <button
              onClick={() => setView("list")}
              className={`p-2 ${view === "list" ? "bg-gold/20 text-gold" : "bg-white/5 text-white/60 hover:bg-white/10"}`}
              aria-label="List view"
            >
              <List size={16} />
            </button>
          </div>

          <Link
            href="/dashboard/assets/collections"
            className="inline-flex items-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg px-3 py-2 text-sm"
          >
            <Layers size={14} /> Collections
          </Link>
        </div>

        {showFilters && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-white/40 mb-2">Type</div>
              <div className="flex flex-wrap gap-2">
                {TYPE_CHIPS.map((chip) => {
                  const active = selectedTypes.includes(chip.key);
                  return (
                    <button
                      key={chip.key}
                      onClick={() => toggleType(chip.key)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs border transition ${
                        active
                          ? "bg-gold/20 border-gold/50 text-gold"
                          : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                      }`}
                    >
                      {chip.icon}
                      {chip.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wider text-white/40 mb-2">Source</div>
              <div className="flex flex-wrap gap-2">
                {SOURCE_OPTIONS.map((s) => {
                  const active = selectedSources.includes(s.key);
                  return (
                    <button
                      key={s.key}
                      onClick={() => toggleSource(s.key)}
                      className={`rounded-full px-3 py-1 text-xs border transition ${
                        active
                          ? "bg-gold/20 border-gold/50 text-gold"
                          : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {tagCatalog.length > 0 && (
              <div>
                <div className="text-xs uppercase tracking-wider text-white/40 mb-2">Tags</div>
                <div className="flex flex-wrap gap-2">
                  {tagCatalog.slice(0, 30).map((t) => {
                    const active = selectedTags.includes(t.name);
                    return (
                      <button
                        key={t.id}
                        onClick={() => toggleTag(t.name)}
                        style={{ borderColor: active ? t.color : undefined, color: active ? t.color : undefined }}
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs border ${
                          active ? "bg-white/10" : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                        }`}
                      >
                        <TagIcon size={10} />
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3 items-center">
              <div className="text-xs uppercase tracking-wider text-white/40">Date</div>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs"
              />
              <span className="text-white/30">→</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs"
              />
              {anyFilter ? (
                <button
                  onClick={clearFilters}
                  className="ml-auto inline-flex items-center gap-1 text-xs text-white/60 hover:text-white"
                >
                  <X size={12} /> Clear
                </button>
              ) : null}
            </div>
          </div>
        )}

        <div className="flex items-center gap-4 text-xs text-white/50">
          <span>{total.toLocaleString()} assets</span>
          {loading && <span>Loading…</span>}
        </div>

        {!anyFilter && aiGenerated.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3 text-sm font-medium text-white/80">
              <Sparkles size={14} className="text-gold" /> AI-Generated
            </div>
            <AssetGrid assets={aiGenerated} compact />
          </section>
        )}

        {!anyFilter && recent.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3 text-sm font-medium text-white/80">
              <Clock size={14} className="text-gold" /> Recent
            </div>
            <AssetGrid assets={recent} compact />
          </section>
        )}

        <section>
          {anyFilter && <div className="mb-3 text-sm font-medium text-white/80">Results</div>}
          {assets.length === 0 && !loading ? (
            <div className="text-center py-16 text-white/40 border border-dashed border-white/10 rounded-xl">
              No assets match your filters.
            </div>
          ) : view === "grid" ? (
            <AssetGrid assets={assets} />
          ) : (
            <AssetList assets={assets} />
          )}
          <div ref={sentinelRef} className="h-10" />
        </section>
      </div>
    </div>
  );

  function AssetGrid({ assets, compact }: { assets: Asset[]; compact?: boolean }) {
    return (
      <div
        className={`grid gap-3 ${
          compact
            ? "grid-cols-2 sm:grid-cols-4 lg:grid-cols-8"
            : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
        }`}
      >
        {assets.map((a) => (
          <Link
            key={a.id}
            href={`/dashboard/assets/${a.id}`}
            className="group relative bg-white/5 border border-white/10 hover:border-gold/40 rounded-lg overflow-hidden transition"
          >
            <div className="aspect-square bg-black/40 flex items-center justify-center overflow-hidden">
              {a.thumbnail_url || (a.asset_type === "image" && a.storage_url) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={a.thumbnail_url || a.storage_url || ""}
                  alt={a.filename || "asset"}
                  className="w-full h-full object-cover group-hover:scale-105 transition"
                />
              ) : (
                <div className="text-white/30 flex flex-col items-center gap-1">
                  <div className="scale-150">{typeIcon(a.asset_type)}</div>
                  <span className="text-[10px] uppercase tracking-wider">{a.asset_type}</span>
                </div>
              )}
            </div>
            {!compact && (
              <div className="p-2">
                <div className="text-xs text-white/80 truncate">{a.filename || "Untitled"}</div>
                <div className="text-[10px] text-white/40 mt-0.5">{timeAgo(a.created_at)}</div>
              </div>
            )}
          </Link>
        ))}
      </div>
    );
  }

  function AssetList({ assets }: { assets: Asset[] }) {
    return (
      <div className="divide-y divide-white/10 border border-white/10 rounded-xl overflow-hidden">
        {assets.map((a) => (
          <Link
            key={a.id}
            href={`/dashboard/assets/${a.id}`}
            className="flex items-center gap-3 p-3 hover:bg-white/5 transition"
          >
            <div className="w-12 h-12 rounded bg-black/40 flex items-center justify-center overflow-hidden shrink-0">
              {a.thumbnail_url || (a.asset_type === "image" && a.storage_url) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.thumbnail_url || a.storage_url || ""} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="text-white/30">{typeIcon(a.asset_type)}</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-white truncate">{a.filename || "Untitled"}</div>
              <div className="text-xs text-white/40 flex items-center gap-2">
                <span className="uppercase tracking-wider">{a.asset_type}</span>
                <span>·</span>
                <span>{a.source.replace(/_/g, " ")}</span>
                {a.tags.length > 0 && (
                  <>
                    <span>·</span>
                    <span className="truncate">{a.tags.slice(0, 3).join(", ")}</span>
                  </>
                )}
              </div>
            </div>
            <div className="text-xs text-white/40 shrink-0">{formatSize(a.size_bytes)}</div>
            <div className="text-xs text-white/40 shrink-0 w-20 text-right">{timeAgo(a.created_at)}</div>
          </Link>
        ))}
      </div>
    );
  }
}
