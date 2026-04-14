"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import {
  FolderOpen, Upload, Search, Grid, List, Image as ImageIcon,
  Video, Music, FileText, File, Palette, Tag, Trash2, Eye,
  Download, X, Layers, Star, Copy,
  CheckSquare, Square, FolderPlus, ArrowUpDown, Loader
} from "lucide-react";
import toast from "react-hot-toast";

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
}

const CATEGORIES = [
  { key: "all", label: "All Assets", icon: <FolderOpen size={14} /> },
  { key: "image", label: "Images", icon: <ImageIcon size={14} /> },
  { key: "video", label: "Videos", icon: <Video size={14} /> },
  { key: "audio", label: "Audio", icon: <Music size={14} /> },
  { key: "document", label: "Documents", icon: <FileText size={14} /> },
  { key: "template", label: "Templates", icon: <File size={14} /> },
  { key: "brand", label: "Brand Assets", icon: <Palette size={14} /> },
];

const MOCK_ASSETS: Asset[] = [
  { id: "1", name: "hero-banner-q1.png", type: "image", url: "#", thumbnail: "", size: "2.4 MB", dimensions: "1920x1080", uploadDate: "2026-04-10", tags: ["banner", "hero", "homepage"], client: "Meridian Health", usedIn: ["Q1 Campaign", "Website Redesign"], collection: "Q1 Content", starred: true },
  { id: "2", name: "product-demo.mp4", type: "video", url: "#", thumbnail: "", size: "48.2 MB", dimensions: "1920x1080", uploadDate: "2026-04-08", tags: ["demo", "product", "video"], client: "Meridian Health", usedIn: ["Product Launch"], collection: "Product Assets", starred: false },
  { id: "3", name: "podcast-intro.mp3", type: "audio", url: "#", thumbnail: "", size: "1.1 MB", dimensions: "N/A", uploadDate: "2026-04-05", tags: ["podcast", "intro", "audio"], client: "Neon Skateshop", usedIn: ["Weekly Podcast"], collection: "Audio Assets", starred: false },
  { id: "4", name: "brand-guidelines.pdf", type: "document", url: "#", thumbnail: "", size: "5.8 MB", dimensions: "N/A", uploadDate: "2026-04-02", tags: ["brand", "guidelines", "pdf"], client: "Ashford Legal", usedIn: [], collection: "Brand Assets", starred: true },
  { id: "5", name: "social-template-pack.psd", type: "template", url: "#", thumbnail: "", size: "12.3 MB", dimensions: "1080x1080", uploadDate: "2026-03-28", tags: ["template", "social", "instagram"], client: "Neon Skateshop", usedIn: ["March Posts", "April Posts"], collection: "Templates", starred: false },
  { id: "6", name: "logo-primary.svg", type: "brand", url: "#", thumbnail: "", size: "24 KB", dimensions: "512x512", uploadDate: "2026-03-25", tags: ["logo", "brand", "primary"], client: "Meridian Health", usedIn: ["All Campaigns"], collection: "Brand Assets", starred: true },
  { id: "7", name: "testimonial-sarah.mp4", type: "video", url: "#", thumbnail: "", size: "22.1 MB", dimensions: "1080x1920", uploadDate: "2026-04-12", tags: ["testimonial", "vertical", "reels"], client: "Meridian Health", usedIn: ["Social Q1"], collection: "Q1 Content", starred: false },
  { id: "8", name: "infographic-stats.png", type: "image", url: "#", thumbnail: "", size: "890 KB", dimensions: "1080x1350", uploadDate: "2026-04-11", tags: ["infographic", "stats", "carousel"], client: "Ashford Legal", usedIn: ["LinkedIn Campaign"], collection: "Q1 Content", starred: false },
  { id: "9", name: "ad-copy-v2.docx", type: "document", url: "#", thumbnail: "", size: "42 KB", dimensions: "N/A", uploadDate: "2026-04-09", tags: ["copy", "ads", "draft"], client: "Neon Skateshop", usedIn: ["Spring Ads"], collection: "Campaign X", starred: false },
  { id: "10", name: "email-header.png", type: "template", url: "#", thumbnail: "", size: "320 KB", dimensions: "600x200", uploadDate: "2026-04-07", tags: ["email", "header", "newsletter"], client: "Meridian Health", usedIn: ["April Newsletter"], collection: "Templates", starred: false },
  { id: "11", name: "icon-set.svg", type: "brand", url: "#", thumbnail: "", size: "56 KB", dimensions: "Various", uploadDate: "2026-04-01", tags: ["icons", "brand", "ui"], client: "Ashford Legal", usedIn: ["Website", "App"], collection: "Brand Assets", starred: false },
  { id: "12", name: "bg-music-chill.mp3", type: "audio", url: "#", thumbnail: "", size: "3.4 MB", dimensions: "N/A", uploadDate: "2026-03-30", tags: ["music", "background", "chill"], client: "Neon Skateshop", usedIn: ["TikTok Videos"], collection: "Audio Assets", starred: false },
];

const MOCK_COLLECTIONS: Collection[] = [
  { id: "1", name: "Q1 Content", assetCount: 3, color: "blue" },
  { id: "2", name: "Campaign X", assetCount: 1, color: "purple" },
  { id: "3", name: "Brand Assets", assetCount: 3, color: "gold" },
  { id: "4", name: "Templates", assetCount: 2, color: "green" },
  { id: "5", name: "Product Assets", assetCount: 1, color: "pink" },
  { id: "6", name: "Audio Assets", assetCount: 2, color: "orange" },
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

export default function ContentLibraryPage() {
  useAuth();
  const supabase = createClient();

  const [assets, setAssets] = useState<Asset[]>(MOCK_ASSETS);
  const [collections] = useState<Collection[]>(MOCK_COLLECTIONS);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [category, setCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [clientFilter, setClientFilter] = useState("all");
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const [dragging, setDragging] = useState(false);
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [bulkTagInput, setBulkTagInput] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "name" | "size">("date");
  const [showCollections, setShowCollections] = useState(false);
  const [uploading, setUploading] = useState(false);

  void supabase;

  const clients = Array.from(new Set(assets.map(a => a.client)));

  const filteredAssets = assets
    .filter(a => category === "all" || a.type === category)
    .filter(a => clientFilter === "all" || a.client === clientFilter)
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

  const bulkDelete = () => {
    if (selectedAssets.size === 0) return;
    setAssets(prev => prev.filter(a => !selectedAssets.has(a.id)));
    toast.success(`Deleted ${selectedAssets.size} asset(s)`);
    setSelectedAssets(new Set());
  };

  const bulkTag = () => {
    if (!bulkTagInput.trim() || selectedAssets.size === 0) return;
    const newTag = bulkTagInput.trim().toLowerCase();
    setAssets(prev => prev.map(a =>
      selectedAssets.has(a.id) && !a.tags.includes(newTag)
        ? { ...a, tags: [...a.tags, newTag] }
        : a
    ));
    toast.success(`Tagged ${selectedAssets.size} asset(s) with "${newTag}"`);
    setBulkTagInput("");
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    setUploading(true);
    await new Promise(r => setTimeout(r, 1500));
    const newAssets: Asset[] = files.map((f, i) => {
      let type: Asset["type"] = "document";
      if (f.type.startsWith("image/")) type = "image";
      else if (f.type.startsWith("video/")) type = "video";
      else if (f.type.startsWith("audio/")) type = "audio";
      return {
        id: String(Date.now() + i),
        name: f.name,
        type,
        url: "#",
        thumbnail: "",
        size: `${(f.size / 1024 / 1024).toFixed(1)} MB`,
        dimensions: "Unknown",
        uploadDate: new Date().toISOString().split("T")[0],
        tags: [],
        client: clientFilter !== "all" ? clientFilter : "Unassigned",
        usedIn: [],
        collection: "",
        starred: false,
      };
    });
    setAssets(prev => [...newAssets, ...prev]);
    setUploading(false);
    toast.success(`Uploaded ${files.length} file(s)`);
  };

  const createCollection = () => {
    if (!newCollectionName.trim()) return;
    toast.success(`Collection "${newCollectionName}" created`);
    setNewCollectionName("");
    setShowNewCollection(false);
  };

  return (
    <div className="fade-in space-y-6">
      <div className="page-header">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <FolderOpen size={20} className="text-gold" /> Content Library
          </h1>
          <p className="text-xs text-muted">Centralized media library for all client assets</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowCollections(!showCollections)} className="btn-ghost text-xs flex items-center gap-1">
            <Layers size={14} /> Collections
          </button>
          <label className="btn-primary text-xs flex items-center gap-1 cursor-pointer">
            <Upload size={14} /> Upload
            <input type="file" multiple className="hidden" onChange={() => toast.success("Files selected for upload")} />
          </label>
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            {collections.map(c => (
              <div key={c.id} className="card cursor-pointer hover:border-white/20 transition-all p-3">
                <div className={`w-8 h-8 rounded-lg bg-${c.color}-500/20 flex items-center justify-center mb-2`}>
                  <FolderOpen size={14} className={`text-${c.color}-400`} />
                </div>
                <p className="text-xs font-semibold truncate">{c.name}</p>
                <p className="text-[10px] text-muted">{c.assetCount} assets</p>
              </div>
            ))}
          </div>
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

        {/* Client Filter */}
        <select
          value={clientFilter}
          onChange={e => setClientFilter(e.target.value)}
          className="input text-xs"
        >
          <option value="all">All Clients</option>
          {clients.map(c => <option key={c} value={c}>{c}</option>)}
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

      {/* Asset Grid */}
      {viewMode === "grid" ? (
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
                className={`w-full aspect-square rounded-lg mb-2 flex items-center justify-center ${TYPE_BG[asset.type]}`}
              >
                {TYPE_ICON[asset.type]}
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
      ) : (
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
                <th className="text-left p-2 text-[10px] text-muted uppercase tracking-wider">Client</th>
                <th className="text-left p-2 text-[10px] text-muted uppercase tracking-wider">Size</th>
                <th className="text-left p-2 text-[10px] text-muted uppercase tracking-wider">Used In</th>
                <th className="text-left p-2 text-[10px] text-muted uppercase tracking-wider">Date</th>
                <th className="p-2 w-8"></th>
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
                  <td className="p-2 text-xs text-muted">{asset.client}</td>
                  <td className="p-2 text-xs text-muted">{asset.size}</td>
                  <td className="p-2">
                    {asset.usedIn.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {asset.usedIn.map(u => (
                          <span key={u} className="px-1.5 py-0.5 rounded bg-blue-500/10 text-[9px] text-blue-400">{u}</span>
                        ))}
                      </div>
                    ) : <span className="text-[10px] text-muted">Not used</span>}
                  </td>
                  <td className="p-2 text-xs text-muted">{asset.uploadDate}</td>
                  <td className="p-2">
                    <button onClick={() => setPreviewAsset(asset)} className="text-muted hover:text-white">
                      <Eye size={14} />
                    </button>
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
          <p className="text-[10px] text-muted uppercase tracking-wider">Starred</p>
          <p className="text-xl font-bold text-gold">{assets.filter(a => a.starred).length}</p>
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
            <div className={`w-full aspect-video rounded-lg mb-4 flex items-center justify-center ${TYPE_BG[previewAsset.type]}`}>
              <div className="text-center">
                <div className="scale-[3] mb-6">{TYPE_ICON[previewAsset.type]}</div>
                <p className="text-xs text-muted mt-2">{previewAsset.type.toUpperCase()} Preview</p>
              </div>
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
                <p className="text-[10px] text-muted uppercase tracking-wider">Client</p>
                <p>{previewAsset.client}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted uppercase tracking-wider">Uploaded</p>
                <p>{previewAsset.uploadDate}</p>
              </div>
            </div>
            <div className="mb-3">
              <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Tags</p>
              <div className="flex flex-wrap gap-1">
                {previewAsset.tags.map(t => (
                  <span key={t} className="px-2 py-0.5 rounded-full bg-white/10 text-[10px]">{t}</span>
                ))}
              </div>
            </div>
            {previewAsset.usedIn.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Used In</p>
                <div className="flex flex-wrap gap-1">
                  {previewAsset.usedIn.map(u => (
                    <span key={u} className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px]">{u}</span>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => { toast.success("Download started"); }} className="btn-primary text-xs flex items-center gap-1 flex-1">
                <Download size={12} /> Download
              </button>
              <button onClick={() => { navigator.clipboard.writeText(previewAsset.url); toast.success("Link copied"); }} className="btn-ghost text-xs flex items-center gap-1">
                <Copy size={12} /> Copy Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
