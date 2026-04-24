"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Save, Play, Share2, ArrowLeft, Loader2, ChevronRight, ChevronDown,
  Video, Settings, Check,
} from "lucide-react";
import toast from "react-hot-toast";

type Composition = {
  id: string;
  title: string;
  html_source: string;
  duration_seconds: number;
  fps: number;
  width: number;
  height: number;
  project_id: string | null;
  metadata: Record<string, unknown>;
};

type Preset = {
  id: string;
  name: string;
  category: string;
  description: string;
  html: string;
};

export default function ComposerEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id as string;

  const [composition, setComposition] = useState<Composition | null>(null);
  const [html, setHtml] = useState("");
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(10);
  const [saving, setSaving] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [loading, setLoading] = useState(true);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [expandedCategory, setExpandedCategory] = useState<string | null>("clip");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const previewKey = useRef(0);
  const [previewCounter, setPreviewCounter] = useState(0);

  // Load composition + presets in parallel
  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`/api/video/composer/compositions/${id}`).then((r) => r.json()),
      fetch(`/api/video/composer/presets`).then((r) => r.json()),
    ])
      .then(([compRes, presetRes]) => {
        if (compRes.composition) {
          setComposition(compRes.composition);
          setHtml(compRes.composition.html_source || "");
          setTitle(compRes.composition.title);
          setDuration(Number(compRes.composition.duration_seconds) || 10);
        }
        setPresets(presetRes.presets || []);
      })
      .catch(() => toast.error("Failed to load composition"))
      .finally(() => setLoading(false));
  }, [id]);

  // Group presets by category
  const presetsByCategory = useMemo(() => {
    const g: Record<string, Preset[]> = {};
    for (const p of presets) {
      (g[p.category] ||= []).push(p);
    }
    return g;
  }, [presets]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/video/composer/compositions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          html_source: html,
          duration_seconds: duration,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      toast.success("Saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function render() {
    setRendering(true);
    try {
      // Save first so the worker reads the current HTML
      await fetch(`/api/video/composer/compositions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          html_source: html,
          duration_seconds: duration,
        }),
      });

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
      router.push(`/dashboard/video/composer/${id}/render`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Render failed");
    } finally {
      setRendering(false);
    }
  }

  function insertPreset(p: Preset) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? html.length;
    const end = el.selectionEnd ?? html.length;
    const next = html.slice(0, start) + "\n" + p.html + "\n" + html.slice(end);
    setHtml(next);
    // Bump preview on next paint so iframe re-reads srcdoc
    setTimeout(() => refreshPreview(), 50);
  }

  function refreshPreview() {
    previewKey.current += 1;
    setPreviewCounter(previewKey.current);
  }

  function copyShareLink() {
    const url = `${window.location.origin}/dashboard/video/composer/${id}/edit`;
    navigator.clipboard.writeText(url).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (!composition) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600">Composition not found</p>
        <Link
          href="/dashboard/video/composer"
          className="text-sm underline mt-2 inline-block"
        >
          Back to compositions
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Top bar */}
      <div className="border-b bg-white px-4 py-3 flex items-center gap-3">
        <Link
          href="/dashboard/video/composer"
          className="text-gray-500 hover:text-black"
          aria-label="Back to compositions"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <Video className="w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 min-w-0 text-lg font-semibold bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-300 rounded px-2 py-1"
        />
        <button
          onClick={() => setSettingsOpen((v) => !v)}
          className="p-2 text-gray-500 hover:text-black"
          aria-label="Composition settings"
        >
          <Settings className="w-4 h-4" />
        </button>
        <button
          onClick={copyShareLink}
          className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 flex items-center gap-1.5"
        >
          {shareCopied ? (
            <Check className="w-3.5 h-3.5 text-green-600" />
          ) : (
            <Share2 className="w-3.5 h-3.5" />
          )}
          {shareCopied ? "Copied" : "Share"}
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 flex items-center gap-1.5 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          Save
        </button>
        <button
          onClick={render}
          disabled={rendering}
          className="px-3 py-1.5 text-sm bg-black text-white rounded-lg hover:bg-gray-900 flex items-center gap-1.5 disabled:opacity-50"
        >
          {rendering ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
          Render
        </button>
      </div>

      {/* Settings drawer */}
      {settingsOpen && (
        <div className="bg-gray-50 border-b px-4 py-3 flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            Duration (s):
            <input
              type="number"
              value={duration}
              min={1}
              max={600}
              onChange={(e) => setDuration(Number(e.target.value) || 1)}
              className="w-20 px-2 py-1 border rounded"
            />
          </label>
          <div className="text-gray-500">
            {composition.width}x{composition.height} @ {composition.fps}fps
          </div>
        </div>
      )}

      <div className="flex-1 grid grid-cols-12 overflow-hidden">
        {/* Preset sidebar */}
        <aside className="col-span-3 border-r overflow-y-auto bg-gray-50">
          <div className="p-3 border-b bg-white sticky top-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Preset library ({presets.length})
            </div>
          </div>
          <div className="p-2">
            {Object.entries(presetsByCategory).map(([cat, items]) => (
              <div key={cat} className="mb-2">
                <button
                  onClick={() =>
                    setExpandedCategory((c) => (c === cat ? null : cat))
                  }
                  className="w-full flex items-center gap-1 px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-700 hover:bg-gray-100 rounded"
                >
                  {expandedCategory === cat ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                  {cat} ({items.length})
                </button>
                {expandedCategory === cat && (
                  <div className="mt-1 space-y-1">
                    {items.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => insertPreset(p)}
                        className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-200"
                        title={p.description}
                      >
                        <div className="font-medium">{p.name}</div>
                        <div className="text-gray-500 line-clamp-1">
                          {p.description}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </aside>

        {/* Editor + preview split */}
        <main className="col-span-9 grid grid-cols-2 overflow-hidden">
          <div className="border-r flex flex-col overflow-hidden">
            <div className="border-b px-3 py-2 text-xs text-gray-500 bg-gray-50">
              HTML source
            </div>
            <textarea
              ref={textareaRef}
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              onBlur={refreshPreview}
              spellCheck={false}
              className="flex-1 w-full p-4 font-mono text-xs leading-relaxed resize-none focus:outline-none"
              placeholder="Edit your hyperframes composition here. Insert presets from the sidebar."
            />
          </div>
          <div className="flex flex-col overflow-hidden">
            <div className="border-b px-3 py-2 text-xs text-gray-500 bg-gray-50 flex items-center justify-between">
              <span>Live preview</span>
              <button
                onClick={refreshPreview}
                className="text-xs text-blue-600 hover:underline"
              >
                Refresh
              </button>
            </div>
            <div className="flex-1 bg-gray-900 flex items-center justify-center overflow-hidden">
              <iframe
                key={previewCounter}
                srcDoc={html}
                sandbox="allow-scripts"
                className="bg-white"
                style={{
                  width: "100%",
                  height: "100%",
                  border: 0,
                  aspectRatio: `${composition.width} / ${composition.height}`,
                  maxHeight: "100%",
                  maxWidth: "100%",
                }}
                title="Composition preview"
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
