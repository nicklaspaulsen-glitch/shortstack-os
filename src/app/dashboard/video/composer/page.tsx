"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Film, Clock, Trash2, Loader2, Video } from "lucide-react";
import toast from "react-hot-toast";

type Composition = {
  id: string;
  title: string;
  duration_seconds: number;
  fps: number;
  width: number;
  height: number;
  project_id: string | null;
  created_at: string;
  updated_at: string;
};

export default function HyperframesComposerListPage() {
  const [compositions, setCompositions] = useState<Composition[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectFilter, setProjectFilter] = useState<string>("");
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    const url = projectFilter
      ? `/api/video/composer/compositions?project_id=${projectFilter}`
      : `/api/video/composer/compositions`;
    try {
      const res = await fetch(url);
      const json = await res.json();
      setCompositions(json.compositions || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load compositions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectFilter]);

  async function createNew() {
    setCreating(true);
    try {
      const res = await fetch(`/api/video/composer/compositions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled composition" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Create failed");
      window.location.href = `/dashboard/video/composer/${json.composition.id}/edit`;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
      setCreating(false);
    }
  }

  async function del(id: string) {
    if (!confirm("Delete this composition?")) return;
    const res = await fetch(`/api/video/composer/compositions/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success("Deleted");
      load();
    } else {
      toast.error("Delete failed");
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Video className="w-8 h-8" />
            Hyperframes Composer
          </h1>
          <p className="text-gray-500 mt-2">
            HTML-based video compositions — additive to Remotion, no build step.
          </p>
        </div>
        <button
          onClick={createNew}
          disabled={creating}
          className="bg-black text-white px-5 py-2.5 rounded-lg flex items-center gap-2 hover:bg-gray-900 disabled:opacity-50"
        >
          {creating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          New composition
        </button>
      </div>

      <div className="mb-6 flex gap-3">
        <input
          type="text"
          placeholder="Filter by project id (optional)"
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg flex-1 max-w-md"
        />
        {projectFilter && (
          <button
            onClick={() => setProjectFilter("")}
            className="px-4 py-2 text-sm text-gray-600 hover:text-black"
          >
            Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : compositions.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-xl">
          <Film className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <h3 className="font-semibold text-gray-700">No compositions yet</h3>
          <p className="text-sm text-gray-500 mt-1">
            Create your first hyperframes composition to get started.
          </p>
          <button
            onClick={createNew}
            disabled={creating}
            className="mt-4 bg-black text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create composition"}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {compositions.map((c) => (
            <div
              key={c.id}
              className="border rounded-xl p-5 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <h3 className="font-semibold truncate flex-1">{c.title}</h3>
                <button
                  onClick={() => del(c.id)}
                  className="text-gray-400 hover:text-red-500"
                  aria-label="Delete composition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="text-xs text-gray-500 flex items-center gap-3 mb-4">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {c.duration_seconds}s @ {c.fps}fps
                </span>
                <span>
                  {c.width}x{c.height}
                </span>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/dashboard/video/composer/${c.id}/edit`}
                  className="flex-1 text-center bg-black text-white px-3 py-1.5 rounded text-sm hover:bg-gray-900"
                >
                  Edit
                </Link>
                <Link
                  href={`/dashboard/video/composer/${c.id}/render`}
                  className="flex-1 text-center border px-3 py-1.5 rounded text-sm hover:bg-gray-50"
                >
                  Renders
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
