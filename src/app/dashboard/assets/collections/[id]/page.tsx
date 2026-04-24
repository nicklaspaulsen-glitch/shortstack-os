"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Loader2, GripVertical, X, Image as ImageIcon, Video,
  Music, FileText, File, Plus,
} from "lucide-react";
import toast from "react-hot-toast";

interface AssetLite {
  id: string;
  filename: string | null;
  asset_type: string;
  thumbnail_url: string | null;
  storage_url: string | null;
  source: string;
}

interface Item {
  collection_id: string;
  asset_id: string;
  position: number;
  added_at: string;
  assets: AssetLite | null;
}

interface Collection {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

function typeIcon(t: string): React.ReactNode {
  if (t === "image") return <ImageIcon size={14} />;
  if (t === "video") return <Video size={14} />;
  if (t === "audio") return <Music size={14} />;
  if (t === "doc") return <FileText size={14} />;
  return <File size={14} />;
}

export default function CollectionDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [collection, setCollection] = useState<Collection | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<AssetLite[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/assets/collections/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setCollection(data.collection);
      setItems(data.items || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) load();
  }, [id, load]);

  useEffect(() => {
    if (!showAdd) return;
    const t = setTimeout(() => {
      const params = new URLSearchParams({ limit: "20" });
      if (search) params.set("q", search);
      fetch(`/api/assets?${params}`)
        .then((r) => r.json())
        .then((d) => {
          const existing = new Set(items.map((i) => i.asset_id));
          setSearchResults((d.assets || []).filter((a: AssetLite) => !existing.has(a.id)));
        })
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [search, showAdd, items]);

  const addAsset = async (assetId: string) => {
    try {
      const res = await fetch(`/api/assets/collections/${id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset_id: assetId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Add failed");
      }
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Add failed");
    }
  };

  const removeAsset = async (assetId: string) => {
    try {
      const res = await fetch(`/api/assets/collections/${id}/items?asset_id=${assetId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Remove failed");
      }
      setItems((prev) => prev.filter((i) => i.asset_id !== assetId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Remove failed");
    }
  };

  const onDragStart = (index: number) => setDragIndex(index);
  const onDragOver = (e: React.DragEvent) => e.preventDefault();
  const onDrop = async (dropIndex: number) => {
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      return;
    }
    const next = [...items];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(dropIndex, 0, moved);
    const reassigned = next.map((it, i) => ({ ...it, position: i }));
    setItems(reassigned);
    setDragIndex(null);

    try {
      await fetch(`/api/assets/collections/${id}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order: reassigned.map((it) => ({ asset_id: it.asset_id, position: it.position })),
        }),
      });
    } catch {
      toast.error("Reorder save failed");
      load();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Loader2 className="animate-spin text-gold" />
      </div>
    );
  }
  if (!collection) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
        <div className="text-white/60 mb-4">Collection not found.</div>
        <Link href="/dashboard/assets/collections" className="text-gold hover:underline">
          All collections
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-5xl px-4 py-6">
        <Link
          href="/dashboard/assets/collections"
          className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white mb-4"
        >
          <ArrowLeft size={14} /> Collections
        </Link>

        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">{collection.name}</h1>
            {collection.description && (
              <p className="text-sm text-white/60 mt-1">{collection.description}</p>
            )}
            <p className="text-xs text-white/40 mt-1">{items.length} assets · drag to reorder</p>
          </div>
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="inline-flex items-center gap-2 bg-gold text-black hover:bg-gold/90 rounded-lg px-3 py-2 text-sm font-medium"
          >
            <Plus size={14} /> Add assets
          </button>
        </div>

        {showAdd && (
          <div className="mb-6 bg-white/5 border border-white/10 rounded-xl p-4">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search assets to add…"
              className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm outline-none focus:border-gold/50 mb-3"
            />
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-80 overflow-y-auto">
              {searchResults.map((a) => (
                <button
                  key={a.id}
                  onClick={() => addAsset(a.id)}
                  className="group relative bg-white/5 border border-white/10 hover:border-gold/40 rounded-lg overflow-hidden"
                >
                  <div className="aspect-square bg-black/40 flex items-center justify-center">
                    {a.thumbnail_url || (a.asset_type === "image" && a.storage_url) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={a.thumbnail_url || a.storage_url || ""}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-white/40 scale-125">{typeIcon(a.asset_type)}</div>
                    )}
                  </div>
                  <div className="p-1 text-[10px] text-white/70 truncate">{a.filename || "Untitled"}</div>
                  <div className="absolute inset-0 bg-gold/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                    <Plus className="text-gold" size={24} />
                  </div>
                </button>
              ))}
              {searchResults.length === 0 && (
                <div className="col-span-full text-center py-6 text-white/40 text-xs">
                  No matching assets
                </div>
              )}
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <div className="text-center py-16 text-white/40 border border-dashed border-white/10 rounded-xl">
            No assets in this collection yet.
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((it, idx) => {
              const a = it.assets;
              return (
                <div
                  key={it.asset_id}
                  draggable
                  onDragStart={() => onDragStart(idx)}
                  onDragOver={onDragOver}
                  onDrop={() => onDrop(idx)}
                  className={`flex items-center gap-3 bg-white/5 border border-white/10 rounded-lg p-3 ${
                    dragIndex === idx ? "opacity-50" : ""
                  }`}
                >
                  <GripVertical className="text-white/30 cursor-move" size={16} />
                  <div className="w-12 h-12 rounded bg-black/40 flex items-center justify-center overflow-hidden shrink-0">
                    {a?.thumbnail_url || (a?.asset_type === "image" && a?.storage_url) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.thumbnail_url || a.storage_url || ""} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-white/40">{typeIcon(a?.asset_type || "other")}</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/dashboard/assets/${it.asset_id}`}
                      className="text-sm text-white hover:text-gold truncate block"
                    >
                      {a?.filename || "Untitled"}
                    </Link>
                    <div className="text-xs text-white/40 uppercase">{a?.asset_type}</div>
                  </div>
                  <button
                    onClick={() => removeAsset(it.asset_id)}
                    className="text-white/40 hover:text-red-400 p-1"
                    aria-label="Remove"
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
