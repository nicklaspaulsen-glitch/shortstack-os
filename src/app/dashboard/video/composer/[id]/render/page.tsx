"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft, Download, RefreshCw, CheckCircle2, XCircle, Loader2, Clock,
  PlusCircle, Film,
} from "lucide-react";
import toast from "react-hot-toast";

type Render = {
  id: string;
  version: number;
  output_url: string | null;
  status: "queued" | "rendering" | "complete" | "failed";
  error: string | null;
  rendered_at: string | null;
  duration_seconds: number | null;
  file_size_bytes: number | null;
  asset_id: string | null;
  created_at: string;
};

type Composition = {
  id: string;
  title: string;
};

function bytesToMB(b: number | null) {
  if (!b) return "";
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

export default function ComposerRenderPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id as string;

  const [composition, setComposition] = useState<Composition | null>(null);
  const [renders, setRenders] = useState<Render[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);

  async function load() {
    try {
      const res = await fetch(`/api/video/composer/compositions/${id}`);
      const json = await res.json();
      setComposition(json.composition);
      setRenders(json.renders || []);
    } catch {
      toast.error("Failed to load renders");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!id) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Poll every 5s while any render is in-flight
  useEffect(() => {
    const hasInFlight = renders.some(
      (r) => r.status === "queued" || r.status === "rendering"
    );
    if (!hasInFlight) return;
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renders]);

  async function triggerRender() {
    setTriggering(true);
    try {
      const res = await fetch(
        `/api/video/composer/compositions/${id}/render`,
        { method: "POST" }
      );
      const json = await res.json();
      if (res.status === 202 && json.warning) {
        toast(json.warning, { icon: "\u26A0\uFE0F", duration: 8000 });
      } else if (!res.ok) {
        throw new Error(json.error || "Render failed");
      } else {
        toast.success("Render queued");
      }
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Render failed");
    } finally {
      setTriggering(false);
    }
  }

  async function addToAssets(renderId: string) {
    // Uses a best-effort call to the assets-library API (added by the
    // parallel feat/asset-library branch). If that API is not deployed yet
    // we surface a friendly error — existing behaviour, nothing lost.
    try {
      const res = await fetch(`/api/assets/link-render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "hyperframes",
          render_id: renderId,
        }),
      });
      if (!res.ok) {
        throw new Error("Asset library endpoint not yet available");
      }
      toast.success("Added to assets");
      load();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to add to assets"
      );
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/dashboard/video/composer"
          className="text-gray-500 hover:text-black"
          aria-label="Back to compositions"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold flex-1">
          {composition?.title || "Composition"} - Renders
        </h1>
        <Link
          href={`/dashboard/video/composer/${id}/edit`}
          className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
        >
          Edit
        </Link>
        <button
          onClick={triggerRender}
          disabled={triggering}
          className="px-3 py-1.5 text-sm bg-black text-white rounded-lg hover:bg-gray-900 flex items-center gap-1.5 disabled:opacity-50"
        >
          {triggering ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <PlusCircle className="w-3.5 h-3.5" />
          )}
          New render
        </button>
      </div>

      {renders.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-xl">
          <Film className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <h3 className="font-semibold text-gray-700">No renders yet</h3>
          <p className="text-sm text-gray-500 mt-1">
            Click New render above to queue your first render.
          </p>
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="text-left py-3 px-4">Version</th>
                <th className="text-left py-3 px-4">Status</th>
                <th className="text-left py-3 px-4">Duration</th>
                <th className="text-left py-3 px-4">Size</th>
                <th className="text-left py-3 px-4">Rendered</th>
                <th className="text-right py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {renders.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="py-3 px-4 font-mono">v{r.version}</td>
                  <td className="py-3 px-4">
                    <StatusBadge status={r.status} error={r.error} />
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {r.duration_seconds ? `${r.duration_seconds}s` : "-"}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {bytesToMB(r.file_size_bytes)}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {r.rendered_at
                      ? new Date(r.rendered_at).toLocaleString()
                      : "-"}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {r.status === "complete" && r.output_url && (
                      <div className="flex gap-2 justify-end">
                        <a
                          href={r.output_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          download
                          className="text-sm border px-2 py-1 rounded hover:bg-gray-50 inline-flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" />
                          Download
                        </a>
                        {!r.asset_id && (
                          <button
                            onClick={() => addToAssets(r.id)}
                            className="text-sm bg-black text-white px-2 py-1 rounded hover:bg-gray-900"
                          >
                            Add to assets
                          </button>
                        )}
                      </div>
                    )}
                    {(r.status === "queued" || r.status === "rendering") && (
                      <button
                        onClick={load}
                        className="text-sm text-gray-500 hover:text-black inline-flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Refresh
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusBadge({
  status,
  error,
}: {
  status: Render["status"];
  error: string | null;
}) {
  if (status === "complete") {
    return (
      <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-0.5 rounded text-xs">
        <CheckCircle2 className="w-3 h-3" />
        Complete
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span
        title={error || undefined}
        className="inline-flex items-center gap-1 text-red-700 bg-red-50 px-2 py-0.5 rounded text-xs"
      >
        <XCircle className="w-3 h-3" />
        Failed
      </span>
    );
  }
  if (status === "rendering") {
    return (
      <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-xs">
        <Loader2 className="w-3 h-3 animate-spin" />
        Rendering
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-gray-700 bg-gray-100 px-2 py-0.5 rounded text-xs">
      <Clock className="w-3 h-3" />
      Queued
    </span>
  );
}
