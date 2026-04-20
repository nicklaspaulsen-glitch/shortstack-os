"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  FolderOpen, Upload, Search, Grid, List, Image as ImageIcon,
  Video, Music, FileText, File, Palette, Tag, Trash2, Eye,
  Download, X, Layers, Star, Copy,
  CheckSquare, Square, FolderPlus, ArrowUpDown, Loader
} from "lucide-react";
import toast from "react-hot-toast";
import { EmptyState } from "@/components/ui/empty-state-illustration";
import PageHero from "@/components/ui/page-hero";
import RollingPreview, { type RollingPreviewItem } from "@/components/RollingPreview";

// Sample content-piece tiles shown in the Content Library landing state.
const CONTENT_LIBRARY_PREVIEW_FALLBACK: RollingPreviewItem[] = [
  { id: "cl1", src: "https://images.unsplash.com/photo-1522542550221-31fd19575a2d?w=640&h=360&fit=crop", alt: "Blog post", tag: "Blog" },
  { id: "cl2", src: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=640&h=360&fit=crop", alt: "Finance asset", tag: "Finance" },
  { id: "cl3", src: "https://images.unsplash.com/photo-1533106418989-88406c7cc8ca?w=640&h=360&fit=crop", alt: "Product shot", tag: "Product" },
  { id: "cl4", src: "https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=640&h=360&fit=crop", alt: "Tutorial asset", tag: "Tutorial" },
  { id: "cl5", src: "https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=640&h=360&fit=crop", alt: "Podcast asset", tag: "Podcast" },
  { id: "cl6", src: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=640&h=360&fit=crop", alt: "Design asset", tag: "Design" },
  { id: "cl7", src: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=640&h=360&fit=crop", alt: "Minimal asset", tag: "Minimal" },
  { id: "cl8", src: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=640&h=360&fit=crop", alt: "Beauty asset", tag: "Beauty" },
  { id: "cl9", src: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=640&h=360&fit=crop", alt: "E-commerce", tag: "E-com" },
  { id: "cl10", src: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=640&h=360&fit=crop", alt: "Moody asset", tag: "Moody" },
  { id: "cl11", src: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=640&h=360&fit=crop", alt: "Startup asset", tag: "Startup" },
  { id: "cl12", src: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=640&h=360&fit=crop", alt: "Creator asset", tag: "Creator" },
];

// ── DB-aligned types ──

interface DbAsset {
  id: string;
  user_id: string;
  name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  mime_type: string | null;
  tags: string[];
  collection_id: string | null;
  width: number | null;
  height: number | null;
  created_at: string;
}

interface DbCollection {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string | null;
  asset_count: number;
  created_at: string;
}

// ── View-layer types for the existing UI ──

interface Asset {
  id: string;
  name: string;
  type: "image" | "video" | "audio" | "document" | "template" | "brand";
  url: string;
  thumbnail: string;
  size: string;
  dimensions: string;
  uploadDate: string;
  tags: string[];
  client: string;
  usedIn: string[];
  collection: string;
  starred: boolean;
}

interface Collection {
  id: string;
  name: string;
  assetCount: number;
  color: string;
  description: string;
}

// ── Helpers ──

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function dbAssetToView(a: DbAsset): Asset {
  const typeMap: Record<string, Asset["type"]> = {
    image: "image",
    video: "video",
    audio: "audio",
    document: "document",
  };
  return {
    id: a.id,
    name: a.name,
    type: typeMap[a.file_type] || "document",
    url: a.file_url,
    thumbnail: a.file_type === "image" ? a.file_url : "",
    size: formatBytes(a.file_size),
    dimensions: a.width && a.height ? `${a.width}x${a.height}` : "N/A",
    uploadDate: new Date(a.created_at).toISOString().split("T")[0],
    tags: a.tags || [],
    client: "Unassigned",
    usedIn: [],
    collection: a.collection_id || "",
    starred: false,
  };
}

function dbCollectionToView(c: DbCollection): Collection {
  return {
    id: c.id,
    name: c.name,
    assetCount: c.asset_count,
    color: c.color || "blue",
    description: c.description || "",
  };
}

// ── Constants ──

const CATEGORIES = [
  { key: "all", label: "All Assets", icon: <FolderOpen size={14} /> },
  { key: "image", label: "Images", icon: <ImageIcon size={14} /> },
  { key: "video", label: "Videos", icon: <Video size={14} /> },
  { key: "audio", label: "Audio", icon: <Music size={14} /> },
  { key: "document", label: "Documents", icon: <FileText size={14} /> },
  { key: "template", label: "Templates", icon: <File size={14} /> },
  { key: "brand", label: "Brand Assets", icon: <Palette size={14} /> },
];

const TYPE_ICON: Record<string, React.ReactNode> = {
  image: <ImageIcon size={16} className="text-blue-400" />,
  video: <Video size={16} className="text-purple-400" />,
  audio: <Music size={16} className="text-orange-400" />,
  document: <FileText size={16} className="text-green-400" />,
  template: <File size={16} className="text-pink-400" />,
  brand: <Palette size={16} className="text-gold" />,
};

const TYPE_BG: Record<string, string> = {
  image: "bg-blue-500/10",
  video: "bg-purple-500/10",
  audio: "bg-orange-500/10",
  document: "bg-green-500/10",
  template: "bg-pink-500/10",
  brand: "bg-gold/10",
};

// ── Component ──

export default function ContentLibraryPage() {
  useAuth();

  const [assets, setAssets] = useState<Asset[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [category, setCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [collectionFilter, setCollectionFilter] = useState("all");
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const [dragging, setDragging] = useState(false);
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [bulkTagInput, setBulkTagInput] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "name" | "size">("date");
  const [showCollections, setShowCollections] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Data fetching ──

  const fetchAssets = useCallback(async () => {
    try {
      const res = await fetch("/api/content-library");
      if (!res.ok) throw new Error("Failed to load assets");
      const json = await res.json();
      setAssets((json.assets || []).map((a: DbAsset) => dbAssetToView(a)));
    } catch {
      // Silently handle — empty state is fine
    }
  }, []);

  const fetchCollections = useCallback(async () => {
    try {
      const res = await fetch("/api/content-library/collections");
      if (!res.ok) throw new Error("Failed to load collections");
      const json = await res.json();
      setCollections((json.collections || []).map((c: DbCollection) => dbCollectionToView(c)));
    } catch {
      // Silently handle
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchAssets(), fetchCollections()]).finally(() => setLoading(false));
  }, [fetchAssets, fetchCollections]);

  // ── Upload logic ──

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setUploading(true);

    let successCount = 0;
    for (const file of files) {
      try {
        const form = new FormData();
        form.append("file", file);
        if (collectionFilter !== "all") form.append("collection_id", collectionFilter);

        const res = await fetch("/api/content-library", { method: "POST", body: form });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Upload failed" }));
          toast.error(`Failed to upload ${file.name}: ${err.error}`);
          continue;
        }
        const json = await res.json();
        if (json.asset) {
          setAssets(prev => [dbAssetToView(json.asset), ...prev]);
          successCount++;
        }
      } catch {
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    setUploading(false);
    if (successCount > 0) toast.success(`Uploaded ${successCount} file(s)`);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    await uploadFiles(files);
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    await uploadFiles(files);
    // Reset input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Asset operations ──

  const deleteAsset = async (id: string) => {
    try {
      const res = await fetch(`/api/content-library?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setAssets(prev => prev.filter(a => a.id !== id));
      setSelectedAssets(prev => { const next = new Set(prev); next.delete(id); return next; });
      toast.success("Asset deleted");
    } catch {
      toast.error("Failed to delete asset");
    }
  };

  const updateAssetTags = async (id: string, tags: string[]) => {
    try {
      const res = await fetch("/api/content-library", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, tags }),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      if (json.asset) {
        setAssets(prev => prev.map(a => a.id === id ? dbAssetToView(json.asset) : a));
      }
    } catch {
      toast.error("Failed to update tags");
    }
  };

  // ── Collection operations ──

  const createCollection = async () => {
    if (!newCollectionName.trim()) return;
    try {
      const res = await fetch("/api/content-library/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCollectionName.trim() }),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      if (json.collection) {
        setCollections(prev => [dbCollectionToView(json.collection), ...prev]);
      }
      toast.success(`Collection "${newCollectionName}" created`);
      setNewCollectionName("");
      setShowNewCollection(false);
    } catch {
      toast.error("Failed to create collection");
    }
  };

  const deleteCollection = async (id: string) => {
    try {
      const res = await fetch(`/api/content-library/collections?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setCollections(prev => prev.filter(c => c.id !== id));
      // Reset filter if the deleted collection was selected
      if (collectionFilter === id) setCollectionFilter("all");
      toast.success("Collection deleted");
    } catch {
      toast.error("Failed to delete collection");
    }
  };

  // ── Filtering & sorting ──

  const filteredAssets = assets
    .filter(a => category === "all" || a.type === category)
    .filter(a => collectionFilter === "all" || a.collection === collectionFilter)
    .filter(a => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return a.name.toLowerCase().includes(q) || a.tags.some(t => t.toLowerCase().includes(q));
    })
    .sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "size") return parseFloat(a.size) - parseFloat(b.size);
      return new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime();
    });

  // ── Selection helpers ──

  const toggleSelect = (id: string) => {
    setSelectedAssets(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedAssets.size === filteredAssets.length) {
      setSelectedAssets(new Set());
    } else {
      setSelectedAssets(new Set(filteredAssets.map(a => a.id)));
    }
  };

  const toggleStar = (id: string) => {
    setAssets(prev => prev.map(a => a.id === id ? { ...a, starred: !a.starred } : a));
    toast.success("Updated");
  };

  // ── Bulk actions ──

  const bulkDelete = async () => {
    if (selectedAssets.size === 0) return;
    const ids = Array.from(selectedAssets);
    let deleted = 0;
    for (const id of ids) {
      try {
        const res = await fetch(`/api/content-library?id=${id}`, { method: "DELETE" });
        if (res.ok) deleted++;
      } catch { /* continue */ }
    }
    setAssets(prev => prev.filter(a => !selectedAssets.has(a.id)));
    toast.success(`Deleted ${deleted} asset(s)`);
    setSelectedAssets(new Set());
  };

  const bulkTag = async () => {
    if (!bulkTagInput.trim() || selectedAssets.size === 0) return;
    const newTag = bulkTagInput.trim().toLowerCase();
    const ids = Array.from(selectedAssets);
    let updated = 0;

    for (const id of ids) {
      const asset = assets.find(a => a.id === id);
      if (!asset || asset.tags.includes(newTag)) continue;
      const newTags = [...asset.tags, newTag];
      await updateAssetTags(id, newTags);
      updated++;
    }

    // Refetch to get clean state
    await fetchAssets();
    toast.success(`Tagged ${updated} asset(s) with "${newTag}"`);
    setBulkTagInput("");
  };

  // ── Loading state ──

  if (loading) {
    return (
      <div className="fade-in flex items-center justify-center py-20">
        <div className="text-center">
          <Loader size={24} className="animate-spin text-gold mx-auto mb-3" />
          <p className="text-sm text-muted">Loading content library...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in space-y-6">
      <PageHero
        icon={<FolderOpen size={28} />}
        title="Content Library"
        subtitle="Centralized media library for client assets."
        gradient="ocean"
        actions={
          <>
            <button onClick={() => setShowCollections(!showCollections)} className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white text-xs font-medium hover:bg-white/20 transition-all flex items-center gap-1">
              <Layers size={14} /> Collections
            </button>
            <label className="px-3 py-1.5 rounded-lg bg-white/15 border border-white/25 text-white text-xs font-semibold hover:bg-white/25 transition-all flex items-center gap-1 cursor-pointer">
              <Upload size={14} /> Upload
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileInput}
              />
            </label>
          </>
        }
      />

      {/* Rolling preview of example content */}
      <div className="relative rounded-2xl overflow-hidden border border-border bg-surface-light/30 py-6">
        <div className="absolute inset-0 pointer-events-none">
          <RollingPreview
            items={CONTENT_LIBRARY_PREVIEW_FALLBACK}
            rows={2}
            aspectRatio="16:9"
            opacity={0.32}
            speed="medium"
          />
        </div>
        <div className="relative text-center px-4">
          <p className="text-[11px] uppercase tracking-widest text-gold/80 font-semibold">
            Content library
          </p>
          <h3 className="text-lg font-bold text-foreground mt-1">
            Every asset, every client, one searchable vault
          </h3>
          <p className="text-xs text-muted max-w-md mx-auto mt-1">
            Images, videos, audio, docs and brand kits — tagged, versioned
            and ready to drop into any campaign.
          </p>
        </div>
      </div>

      {/* Upload Drop Zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
          dragging ? "border-gold bg-gold/5" : "border-white/10 hover:border-white/20"
        }`}
      >
        {uploading ? (
          <div className="flex items-center justify-center gap-2">
            <Loader size={18} className="animate-spin text-gold" />
            <span className="text-sm text-muted">Uploading files...</span>
          </div>
        ) : (
          <>
            <Upload size={24} className={`mx-auto mb-2 ${dragging ? "text-gold" : "text-muted"}`} />
            <p className="text-xs text-muted">Drag and drop files here, or click Upload</p>
            <p className="text-[10px] text-muted mt-1">Supports images, videos, audio, documents, and more</p>
          </>
        )}
      </div>

      {/* Collections Panel */}
      {showCollections && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-gold" />
              <span className="text-sm font-semibold">Collections</span>
            </div>
            <button onClick={() => setShowNewCollection(!showNewCollection)} className="text-xs text-gold hover:underline flex items-center gap-1">
              <FolderPlus size={12} /> New
            </button>
          </div>
          {showNewCollection && (
            <div className="flex gap-2 mb-3">
              <input
                value={newCollectionName}
                onChange={e => setNewCollectionName(e.target.value)}
                placeholder="Collection name..."
                className="input text-xs flex-1"
                onKeyDown={e => e.key === "Enter" && createCollection()}
              />
              <button onClick={createCollection} className="btn-primary text-xs">Create</button>
            </div>
          )}
          {collections.length === 0 && !showNewCollection ? (
            <p className="text-xs text-muted text-center py-4">No collections yet. Create one to organize your assets.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
              {collections.map(c => (
                <div
                  key={c.id}
                  className={`card cursor-pointer hover:border-white/20 transition-all p-3 relative group ${
                    collectionFilter === c.id ? "border border-gold/40 bg-gold/5" : ""
                  }`}
                  onClick={() => setCollectionFilter(collectionFilter === c.id ? "all" : c.id)}
                >
                  <button
                    onClick={e => { e.stopPropagation(); deleteCollection(c.id); }}
                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-all text-muted hover:text-red-400"
                  >
                    <X size={12} />
                  </button>
                  <div className={`w-8 h-8 rounded-lg bg-${c.color}-500/20 flex items-center justify-center mb-2`}>
                    <FolderOpen size={14} className={`text-${c.color}-400`} />
                  </div>
                  <p className="text-xs font-semibold truncate">{c.name}</p>
                  <p className="text-[10px] text-muted">{c.assetCount} assets</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Category Pills */}
        <div className="flex gap-1 flex-wrap">
          {CATEGORIES.map(c => (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${
                category === c.key ? "bg-gold/20 text-gold border border-gold/30" : "bg-white/5 text-muted hover:text-white border border-white/10"
              }`}
            >
              {c.icon} {c.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by name or tag..."
            className="input text-xs pl-8 w-48"
          />
        </div>

        {/* Collection Filter */}
        <select
          value={collectionFilter}
          onChange={e => setCollectionFilter(e.target.value)}
          className="input text-xs"
        >
          <option value="all">All Collections</option>
          {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        {/* Sort */}
        <button onClick={() => setSortBy(sortBy === "date" ? "name" : sortBy === "name" ? "size" : "date")} className="btn-ghost text-xs flex items-center gap-1">
          <ArrowUpDown size={12} /> {sortBy === "date" ? "Date" : sortBy === "name" ? "Name" : "Size"}
        </button>

        {/* View Toggle */}
        <div className="flex bg-white/5 rounded-lg p-0.5">
          <button onClick={() => setViewMode("grid")} className={`p-1.5 rounded ${viewMode === "grid" ? "bg-gold/20 text-gold" : "text-muted"}`}>
            <Grid size={14} />
          </button>
          <button onClick={() => setViewMode("list")} className={`p-1.5 rounded ${viewMode === "list" ? "bg-gold/20 text-gold" : "text-muted"}`}>
            <List size={14} />
          </button>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedAssets.size > 0 && (
        <div className="card flex items-center gap-3 border border-gold/20">
          <button onClick={selectAll} className="text-xs text-muted hover:text-white flex items-center gap-1">
            <CheckSquare size={14} /> {selectedAssets.size} selected
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-1">
            <input
              value={bulkTagInput}
              onChange={e => setBulkTagInput(e.target.value)}
              placeholder="Add tag..."
              className="input text-xs w-28"
              onKeyDown={e => e.key === "Enter" && bulkTag()}
            />
            <button onClick={bulkTag} className="btn-ghost text-xs"><Tag size={12} /></button>
          </div>
          <button onClick={bulkDelete} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
            <Trash2 size={12} /> Delete
          </button>
          <button onClick={() => setSelectedAssets(new Set())} className="text-xs text-muted hover:text-white">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Empty State */}
      {filteredAssets.length === 0 && !uploading && (
        <div className="card">
          <EmptyState
            type={assets.length === 0 ? "no-files" : "no-content"}
            title={assets.length === 0 ? "No assets yet" : "No matching assets"}
            description={assets.length === 0
              ? "Upload files using the drop zone above or the Upload button."
              : "Try adjusting your filters or search query."}
          />
        </div>
      )}

      {/* Asset Grid */}
      {filteredAssets.length > 0 && viewMode === "grid" && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {filteredAssets.map(asset => (
            <div
              key={asset.id}
              className={`card group cursor-pointer transition-all hover:border-white/20 relative ${
                selectedAssets.has(asset.id) ? "border border-gold/40 bg-gold/5" : ""
              }`}
            >
              {/* Select checkbox */}
              <button
                onClick={e => { e.stopPropagation(); toggleSelect(asset.id); }}
                className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-all"
              >
                {selectedAssets.has(asset.id) ? <CheckSquare size={14} className="text-gold" /> : <Square size={14} className="text-muted" />}
              </button>

              {/* Star */}
              <button
                onClick={e => { e.stopPropagation(); toggleStar(asset.id); }}
                className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-all"
              >
                <Star size={14} className={asset.starred ? "fill-gold text-gold" : "text-muted"} />
              </button>

              {/* Thumbnail */}
              <div
                onClick={() => setPreviewAsset(asset)}
                className={`w-full aspect-square rounded-lg mb-2 flex items-center justify-center overflow-hidden ${TYPE_BG[asset.type]}`}
              >
                {asset.type === "image" && asset.thumbnail ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={asset.thumbnail} alt={asset.name} className="w-full h-full object-cover rounded-lg" />
                ) : (
                  TYPE_ICON[asset.type]
                )}
              </div>

              <p className="text-xs font-medium truncate">{asset.name}</p>
              <p className="text-[10px] text-muted">{asset.size} {asset.dimensions !== "N/A" ? `- ${asset.dimensions}` : ""}</p>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {asset.tags.slice(0, 2).map(t => (
                  <span key={t} className="px-1.5 py-0.5 rounded bg-white/5 text-[9px] text-muted">{t}</span>
                ))}
                {asset.tags.length > 2 && (
                  <span className="px-1.5 py-0.5 rounded bg-white/5 text-[9px] text-muted">+{asset.tags.length - 2}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Asset List */}
      {filteredAssets.length > 0 && viewMode === "list" && (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left p-2 w-8">
                  <button onClick={selectAll}>
                    {selectedAssets.size === filteredAssets.length ? <CheckSquare size={14} className="text-gold" /> : <Square size={14} className="text-muted" />}
                  </button>
                </th>
                <th className="text-left p-2 text-[10px] text-muted uppercase tracking-wider">Name</th>
                <th className="text-left p-2 text-[10px] text-muted uppercase tracking-wider">Type</th>
                <th className="text-left p-2 text-[10px] text-muted uppercase tracking-wider">Size</th>
                <th className="text-left p-2 text-[10px] text-muted uppercase tracking-wider">Date</th>
                <th className="p-2 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {filteredAssets.map(asset => (
                <tr
                  key={asset.id}
                  className={`border-b border-white/5 hover:bg-white/5 transition-colors ${
                    selectedAssets.has(asset.id) ? "bg-gold/5" : ""
                  }`}
                >
                  <td className="p-2">
                    <button onClick={() => toggleSelect(asset.id)}>
                      {selectedAssets.has(asset.id) ? <CheckSquare size={14} className="text-gold" /> : <Square size={14} className="text-muted" />}
                    </button>
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <div className={`p-1 rounded ${TYPE_BG[asset.type]}`}>{TYPE_ICON[asset.type]}</div>
                      <div>
                        <p className="text-xs font-medium">{asset.name}</p>
                        <div className="flex gap-1 mt-0.5">
                          {asset.tags.slice(0, 3).map(t => (
                            <span key={t} className="px-1 py-0 rounded bg-white/5 text-[9px] text-muted">{t}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-2 text-xs text-muted capitalize">{asset.type}</td>
                  <td className="p-2 text-xs text-muted">{asset.size}</td>
                  <td className="p-2 text-xs text-muted">{asset.uploadDate}</td>
                  <td className="p-2">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setPreviewAsset(asset)} className="text-muted hover:text-white">
                        <Eye size={14} />
                      </button>
                      <button onClick={() => deleteAsset(asset.id)} className="text-muted hover:text-red-400">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card">
          <p className="text-[10px] text-muted uppercase tracking-wider">Total Assets</p>
          <p className="text-xl font-bold">{assets.length}</p>
        </div>
        <div className="card">
          <p className="text-[10px] text-muted uppercase tracking-wider">Images</p>
          <p className="text-xl font-bold text-blue-400">{assets.filter(a => a.type === "image").length}</p>
        </div>
        <div className="card">
          <p className="text-[10px] text-muted uppercase tracking-wider">Videos</p>
          <p className="text-xl font-bold text-purple-400">{assets.filter(a => a.type === "video").length}</p>
        </div>
        <div className="card">
          <p className="text-[10px] text-muted uppercase tracking-wider">Collections</p>
          <p className="text-xl font-bold text-gold">{collections.length}</p>
        </div>
      </div>

      {/* Preview Modal */}
      {previewAsset && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setPreviewAsset(null)}>
          <div className="card max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold">{previewAsset.name}</h3>
              <button onClick={() => setPreviewAsset(null)} className="text-muted hover:text-white"><X size={16} /></button>
            </div>
            <div className={`w-full aspect-video rounded-lg mb-4 flex items-center justify-center overflow-hidden ${TYPE_BG[previewAsset.type]}`}>
              {previewAsset.type === "image" && previewAsset.url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={previewAsset.url} alt={previewAsset.name} className="w-full h-full object-contain" />
              ) : (
                <div className="text-center">
                  <div className="scale-[3] mb-6">{TYPE_ICON[previewAsset.type]}</div>
                  <p className="text-xs text-muted mt-2">{previewAsset.type.toUpperCase()} Preview</p>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs mb-4">
              <div>
                <p className="text-[10px] text-muted uppercase tracking-wider">Size</p>
                <p>{previewAsset.size}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted uppercase tracking-wider">Dimensions</p>
                <p>{previewAsset.dimensions}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted uppercase tracking-wider">Type</p>
                <p className="capitalize">{previewAsset.type}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted uppercase tracking-wider">Uploaded</p>
                <p>{previewAsset.uploadDate}</p>
              </div>
            </div>
            {previewAsset.tags.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Tags</p>
                <div className="flex flex-wrap gap-1">
                  {previewAsset.tags.map(t => (
                    <span key={t} className="px-2 py-0.5 rounded-full bg-white/10 text-[10px]">{t}</span>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <a href={previewAsset.url} target="_blank" rel="noopener noreferrer" className="btn-primary text-xs flex items-center gap-1 flex-1 justify-center" download>
                <Download size={12} /> Download
              </a>
              <button onClick={() => { navigator.clipboard.writeText(previewAsset.url); toast.success("Link copied"); }} className="btn-ghost text-xs flex items-center gap-1">
                <Copy size={12} /> Copy Link
              </button>
              <button onClick={() => { deleteAsset(previewAsset.id); setPreviewAsset(null); }} className="btn-ghost text-xs flex items-center gap-1 text-red-400 hover:text-red-300">
                <Trash2 size={12} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
