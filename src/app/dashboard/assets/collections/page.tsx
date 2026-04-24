"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Loader2, FolderOpen, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

interface Collection {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  item_count: number;
}

export default function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/assets/collections");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setCollections(data.collections || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/assets/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Create failed");
      toast.success("Collection created");
      setNewName("");
      setNewDesc("");
      setShowCreate(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this collection? Assets inside won't be deleted.")) return;
    try {
      const res = await fetch(`/api/assets/collections/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Delete failed");
      }
      toast.success("Deleted");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-5xl px-4 py-6">
        <Link
          href="/dashboard/assets"
          className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white mb-4"
        >
          <ArrowLeft size={14} /> Asset Library
        </Link>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Collections</h1>
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="inline-flex items-center gap-2 bg-gold text-black hover:bg-gold/90 rounded-lg px-3 py-2 text-sm font-medium"
          >
            <Plus size={14} /> New collection
          </button>
        </div>

        {showCreate && (
          <div className="mb-6 bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Collection name"
              className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm outline-none focus:border-gold/50"
            />
            <textarea
              rows={2}
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Description (optional)"
              className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm outline-none focus:border-gold/50 resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={create}
                disabled={creating || !newName.trim()}
                className="inline-flex items-center gap-2 bg-gold text-black hover:bg-gold/90 rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50"
              >
                {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Create
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="text-sm text-white/60 hover:text-white px-3 py-1.5"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-gold" />
          </div>
        ) : collections.length === 0 ? (
          <div className="text-center py-16 text-white/40 border border-dashed border-white/10 rounded-xl">
            No collections yet. Create one to group related assets.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {collections.map((c) => (
              <div
                key={c.id}
                className="group relative bg-white/5 border border-white/10 hover:border-gold/40 rounded-xl p-4 transition"
              >
                <Link href={`/dashboard/assets/collections/${c.id}`} className="block">
                  <div className="flex items-center gap-2 mb-2">
                    <FolderOpen className="text-gold" size={18} />
                    <div className="font-medium truncate">{c.name}</div>
                  </div>
                  {c.description && (
                    <div className="text-xs text-white/50 line-clamp-2 mb-2">{c.description}</div>
                  )}
                  <div className="text-xs text-white/40">{c.item_count} assets</div>
                </Link>
                <button
                  onClick={() => remove(c.id)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition p-1"
                  aria-label="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
