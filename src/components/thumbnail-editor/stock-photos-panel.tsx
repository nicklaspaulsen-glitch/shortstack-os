"use client";

// Stock photos panel — a slide-out drawer with a search input + grid of
// license-clean photos from Pexels (or Unsplash fallback). Clicking a
// thumbnail returns the full-resolution URL up to the parent so the
// editor can insert it as a layer without burning a FLUX render.
//
// Soft-fail: if no API keys are configured, the panel still renders but
// shows a "Provider not configured" hint. The button for opening this
// panel can stay unconditionally — the API endpoint returns
// configured=false and the empty state handles it.

import { useCallback, useEffect, useState } from "react";
import { Search, X, ImagePlus, ExternalLink, Loader2 } from "lucide-react";
import type { StockPhoto, StockPhotoOrientation } from "@/lib/integrations/stock-photos";

interface StockPhotosPanelProps {
  open: boolean;
  onClose: () => void;
  onInsert: (photo: StockPhoto) => void;
  /**
   * Optional default orientation hint based on the canvas aspect ratio.
   * Used to seed the initial search filter.
   */
  defaultOrientation?: StockPhotoOrientation;
}

const CATEGORY_OPTIONS: Array<{ id: "business" | "tech" | "abstract" | "people" | "nature"; label: string }> = [
  { id: "business", label: "Business" },
  { id: "tech", label: "Tech" },
  { id: "abstract", label: "Abstract" },
  { id: "people", label: "People" },
  { id: "nature", label: "Nature" },
];

interface ApiResponse {
  success: boolean;
  photos: StockPhoto[];
  configured: boolean;
  providers: string[];
  error?: string;
  message?: string;
}

export default function StockPhotosPanel({
  open,
  onClose,
  onInsert,
  defaultOrientation,
}: StockPhotosPanelProps) {
  const [query, setQuery] = useState("");
  const [orientation, setOrientation] = useState<StockPhotoOrientation | "">(
    defaultOrientation ?? "",
  );
  const [photos, setPhotos] = useState<StockPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [providers, setProviders] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Auto-load a curated "business" set on first open so the panel never
  // looks empty. Subsequent searches replace these.
  const loadCurated = useCallback(async (category: typeof CATEGORY_OPTIONS[number]["id"]) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/integrations/stock-photos?category=${encodeURIComponent(category)}&per_page=12`,
      );
      const data = (await res.json()) as ApiResponse;
      setConfigured(data.configured);
      setProviders(data.providers || []);
      setPhotos(data.photos || []);
      if (!data.configured) {
        setError("No stock-photo provider configured. Add PEXELS_API_KEY or UNSPLASH_ACCESS_KEY.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  const runSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        q: trimmed,
        per_page: "12",
      });
      if (orientation) params.set("orientation", orientation);
      const res = await fetch(`/api/integrations/stock-photos?${params.toString()}`);
      const data = (await res.json()) as ApiResponse;
      setConfigured(data.configured);
      setProviders(data.providers || []);
      setPhotos(data.photos || []);
      if (!data.configured) {
        setError("No stock-photo provider configured. Add PEXELS_API_KEY or UNSPLASH_ACCESS_KEY.");
      } else if ((data.photos || []).length === 0) {
        setError(`No photos found for "${trimmed}". Try a different query.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to search");
    } finally {
      setLoading(false);
    }
  }, [query, orientation]);

  useEffect(() => {
    if (open && photos.length === 0 && !loading) {
      loadCurated("business");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-[380px] bg-neutral-950 border-l border-neutral-800 flex flex-col shadow-2xl">
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <ImagePlus className="w-4 h-4 text-neutral-300" />
          <span className="text-sm font-semibold text-neutral-100">Stock photos</span>
          {providers.length > 0 && (
            <span className="text-[10px] text-neutral-500 uppercase tracking-wide">
              via {providers.join(" + ")}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded hover:bg-neutral-800 text-neutral-400"
          title="Close stock photos"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search + filters */}
      <div className="p-3 border-b border-neutral-800 space-y-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runSearch();
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search photos..."
              className="w-full bg-neutral-900 border border-neutral-700 rounded pl-7 pr-2 py-1.5 text-xs text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-xs text-white"
          >
            Go
          </button>
        </form>

        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-neutral-500">Orientation:</span>
          {(["", "landscape", "portrait", "square"] as const).map((o) => (
            <button
              key={o || "any"}
              type="button"
              onClick={() => setOrientation(o)}
              className={`px-2 py-0.5 rounded ${
                orientation === o
                  ? "bg-neutral-700 text-neutral-100"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {o || "Any"}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {CATEGORY_OPTIONS.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => loadCurated(cat.id)}
              className="text-[10px] px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700"
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading && (
          <div className="flex items-center justify-center h-32 text-neutral-500 text-xs">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Loading photos...
          </div>
        )}

        {!loading && error && (
          <div className="text-xs text-amber-400 bg-amber-950/40 border border-amber-900 rounded p-2">
            {error}
            {configured === false && (
              <div className="mt-1 text-neutral-500">
                Set <code className="text-neutral-300">PEXELS_API_KEY</code> in env to enable.
              </div>
            )}
          </div>
        )}

        {!loading && !error && photos.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {photos.map((photo) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => onInsert(photo)}
                className="group relative aspect-video bg-neutral-900 rounded overflow-hidden border border-neutral-800 hover:border-blue-500 transition-colors"
                title={`Insert: ${photo.photographer}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.src_thumb}
                  alt={`Photo by ${photo.photographer}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="text-[9px] text-white truncate">
                    {photo.photographer}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {!loading && photos.length > 0 && providers.includes("unsplash") && (
          <div className="mt-3 text-[10px] text-neutral-500 leading-relaxed">
            <ExternalLink className="w-3 h-3 inline mr-1" />
            Photos via Unsplash require attribution when published. Click any
            photo to view license details.
          </div>
        )}
      </div>
    </div>
  );
}
