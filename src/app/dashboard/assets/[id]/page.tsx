"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Download, Trash2, Save, Tag as TagIcon, Loader2,
  Sparkles, FileText, Image as ImageIcon, Video, Music, File,
  Layers, ChevronRight, ExternalLink, GitBranch,
} from "lucide-react";
import toast from "react-hot-toast";

interface Asset {
  id: string;
  org_id: string;
  project_id: string | null;
  asset_type: string;
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
  updated_at: string;
}

interface LineageAsset {
  id: string;
  filename: string | null;
  asset_type: string;
  created_at: string;
}

const DERIVE_TARGETS: { key: string; label: string }[] = [
  { key: "thumbnail-generator", label: "Thumbnail Generator" },
  { key: "ai-video", label: "AI Video" },
  { key: "copywriter", label: "Copywriter" },
  { key: "carousel-generator", label: "Carousel" },
  { key: "ai-studio", label: "AI Studio" },
];

function typeIcon(t: string): React.ReactNode {
  if (t === "image") return <ImageIcon size={18} />;
  if (t === "video") return <Video size={18} />;
  if (t === "audio") return <Music size={18} />;
  if (t === "doc") return <FileText size={18} />;
  return <File size={18} />;
}

function formatSize(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export default function AssetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [asset, setAsset] = useState<Asset | null>(null);
  const [original, setOriginal] = useState<LineageAsset | null>(null);
  const [derived, setDerived] = useState<LineageAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filename, setFilename] = useState("");
  const [description, setDescription] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/assets/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setAsset(data.asset);
      setOriginal(data.original);
      setDerived(data.derived || []);
      setFilename(data.asset.filename || "");
      setDescription(data.asset.description || "");
      setTags(data.asset.tags || []);
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
    if (!tagInput) {
      setTagSuggestions([]);
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/assets/tags?q=${encodeURIComponent(tagInput)}`)
        .then((r) => r.json())
        .then((d) => {
          const existing = new Set(tags);
          setTagSuggestions(
            (d.tags || [])
              .map((t: { name: string }) => t.name)
              .filter((n: string) => !existing.has(n))
              .slice(0, 6),
          );
        })
        .catch(() => {});
    }, 200);
    return () => clearTimeout(t);
  }, [tagInput, tags]);

  const addTag = (t: string) => {
    const clean = t.trim();
    if (!clean || tags.includes(clean)) return;
    setTags((prev) => [...prev, clean]);
    setTagInput("");
    setTagSuggestions([]);
  };

  const removeTag = (t: string) => setTags((prev) => prev.filter((x) => x !== t));

  const save = async () => {
    if (!asset) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/assets/${asset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, description, tags }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setAsset(data.asset);
      toast.success("Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!asset) return;
    if (!confirm("Move this asset to trash?")) return;
    try {
      const res = await fetch(`/api/assets/${asset.id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Delete failed");
      }
      toast.success("Deleted");
      router.push("/dashboard/assets");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const derive = async (target: string) => {
    if (!asset) return;
    try {
      const res = await fetch(`/api/assets/${asset.id}/derive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Derive failed");
      router.push(data.redirect);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Derive failed");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Loader2 className="animate-spin text-gold" />
      </div>
    );
  }
  if (!asset) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
        <div className="text-white/60 mb-4">Asset not found.</div>
        <Link href="/dashboard/assets" className="text-gold hover:underline">
          Back to library
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <Link
          href="/dashboard/assets"
          className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white mb-4"
        >
          <ArrowLeft size={14} /> Asset Library
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <div className="aspect-video bg-black/60 flex items-center justify-center">
                {asset.asset_type === "image" && (asset.storage_url || asset.thumbnail_url) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={asset.storage_url || asset.thumbnail_url || ""}
                    alt={asset.filename || "preview"}
                    className="max-w-full max-h-full object-contain"
                  />
                ) : asset.asset_type === "video" && asset.storage_url ? (
                  <video src={asset.storage_url} controls className="max-w-full max-h-full" />
                ) : asset.asset_type === "audio" && asset.storage_url ? (
                  <audio src={asset.storage_url} controls className="w-3/4" />
                ) : (
                  <div className="flex flex-col items-center gap-3 text-white/40">
                    <div className="scale-[2]">{typeIcon(asset.asset_type)}</div>
                    <span className="text-xs uppercase tracking-wider">{asset.asset_type}</span>
                    {asset.storage_url && (
                      <a
                        href={asset.storage_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-gold text-xs hover:underline"
                      >
                        <ExternalLink size={12} /> Open source
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3 text-sm font-medium">
                <Sparkles size={14} className="text-gold" />
                Derive variant
              </div>
              <div className="flex flex-wrap gap-2">
                {DERIVE_TARGETS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => derive(t.key)}
                    className="inline-flex items-center gap-1 bg-gold/10 border border-gold/30 hover:bg-gold/20 rounded-full px-3 py-1.5 text-xs text-gold"
                  >
                    {t.label} <ChevronRight size={12} />
                  </button>
                ))}
              </div>
            </div>

            {(original || derived.length > 0) && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3 text-sm font-medium">
                  <GitBranch size={14} className="text-gold" /> Lineage
                </div>
                {original && (
                  <div className="mb-3">
                    <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Original</div>
                    <Link
                      href={`/dashboard/assets/${original.id}`}
                      className="inline-flex items-center gap-2 text-sm text-white/80 hover:text-gold"
                    >
                      {typeIcon(original.asset_type)}
                      {original.filename || "Untitled"}
                    </Link>
                  </div>
                )}
                {derived.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">
                      Derived ({derived.length})
                    </div>
                    <div className="space-y-1">
                      {derived.map((d) => (
                        <Link
                          key={d.id}
                          href={`/dashboard/assets/${d.id}`}
                          className="flex items-center gap-2 text-sm text-white/70 hover:text-gold"
                        >
                          {typeIcon(d.asset_type)}
                          <span className="truncate">{d.filename || "Untitled"}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-white/40">Filename</label>
                <input
                  type="text"
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  className="w-full mt-1 bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm outline-none focus:border-gold/50"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-white/40">Description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full mt-1 bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm outline-none focus:border-gold/50 resize-none"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-white/40">Tags</label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 bg-gold/10 border border-gold/30 text-gold rounded-full px-2 py-0.5 text-xs"
                    >
                      <TagIcon size={10} />
                      {t}
                      <button onClick={() => removeTag(t)} className="hover:text-white">
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="relative mt-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag(tagInput);
                      }
                    }}
                    placeholder="Add tag…"
                    className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-sm outline-none focus:border-gold/50"
                  />
                  {tagSuggestions.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-black border border-white/10 rounded shadow-lg">
                      {tagSuggestions.map((s) => (
                        <button
                          key={s}
                          onClick={() => addTag(s)}
                          className="block w-full text-left px-3 py-1.5 text-sm hover:bg-white/10"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={save}
                disabled={saving}
                className="w-full inline-flex items-center justify-center gap-2 bg-gold text-black hover:bg-gold/90 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
              </button>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-white/40">Type</span>
                <span className="uppercase tracking-wider">{asset.asset_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Source</span>
                <span>{asset.source.replace(/_/g, " ")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Size</span>
                <span>{formatSize(asset.size_bytes)}</span>
              </div>
              {asset.mime_type && (
                <div className="flex justify-between">
                  <span className="text-white/40">MIME</span>
                  <span className="truncate ml-2">{asset.mime_type}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-white/40">Created</span>
                <span>{new Date(asset.created_at).toLocaleString()}</span>
              </div>
            </div>

            <div className="flex gap-2">
              {asset.storage_url && (
                <a
                  href={asset.storage_url}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg px-3 py-2 text-sm"
                >
                  <Download size={14} /> Download
                </a>
              )}
              <button
                onClick={remove}
                className="inline-flex items-center justify-center gap-2 bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 text-red-400 rounded-lg px-3 py-2 text-sm"
              >
                <Trash2 size={14} />
              </button>
            </div>

            <Link
              href="/dashboard/assets/collections"
              className="block text-center text-xs text-white/50 hover:text-gold"
            >
              <Layers size={12} className="inline mr-1" />
              Manage collections
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
