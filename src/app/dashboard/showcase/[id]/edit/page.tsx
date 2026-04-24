"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Save, Loader2, Plus, Trash2, ArrowUp, ArrowDown, Eye, EyeOff,
  ExternalLink, Video, Code,
} from "lucide-react";
import toast from "react-hot-toast";
import PageHero from "@/components/ui/page-hero";
import Markdown from "@/lib/showcase/markdown";
import type { CaseStudy, CaseStudyAsset, CaseStudyMetric } from "@/lib/showcase/types";

export default function ShowcaseEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id ?? "";

  const [cs, setCs] = useState<CaseStudy | null>(null);
  const [assets, setAssets] = useState<CaseStudyAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/showcase/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Load failed");
      setCs(json.case_study);
      setAssets(json.assets || []);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  function patch<K extends keyof CaseStudy>(key: K, value: CaseStudy[K]) {
    setCs((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function save() {
    if (!cs) return;
    setSaving(true);
    try {
      const { id: _id, org_id, created_by, created_at, updated_at, published, published_at, ...editable } = cs;
      void _id; void org_id; void created_by; void created_at; void updated_at; void published; void published_at;
      const res = await fetch(`/api/showcase/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editable),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setCs(json.case_study);
      toast.success("Saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish() {
    if (!cs) return;
    const path = cs.published ? "unpublish" : "publish";
    const res = await fetch(`/api/showcase/${id}/${path}`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || "Failed");
      return;
    }
    setCs(json.case_study);
    toast.success(cs.published ? "Unpublished" : "Published");
  }

  // ── Metrics builder ──
  function addMetric() {
    if (!cs) return;
    const next = [...(cs.metrics || []), { label: "", value: "", delta: null }];
    patch("metrics", next);
  }
  function updateMetric(i: number, field: keyof CaseStudyMetric, value: string) {
    if (!cs) return;
    const next = [...cs.metrics];
    next[i] = { ...next[i], [field]: value };
    patch("metrics", next);
  }
  function removeMetric(i: number) {
    if (!cs) return;
    patch("metrics", cs.metrics.filter((_, idx) => idx !== i));
  }

  // ── Assets ──
  async function addAsset() {
    const url = window.prompt("Asset URL (image, video, or embed)");
    if (!url) return;
    const kind = window.prompt("Type: image | video | embed", "image") || "image";
    if (!["image", "video", "embed"].includes(kind)) {
      toast.error("Invalid type");
      return;
    }
    const res = await fetch(`/api/showcase/${id}/assets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ asset_url: url, asset_type: kind }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast.error(j.error || "Add failed");
      return;
    }
    load();
  }

  async function removeAsset(assetId: string) {
    const res = await fetch(`/api/showcase/${id}/assets?asset_id=${assetId}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Delete failed");
      return;
    }
    setAssets((a) => a.filter((x) => x.id !== assetId));
  }

  async function move(assetId: string, dir: -1 | 1) {
    const idx = assets.findIndex((a) => a.id === assetId);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= assets.length) return;
    const next = [...assets];
    const [item] = next.splice(idx, 1);
    next.splice(newIdx, 0, item);
    setAssets(next);
    const res = await fetch(`/api/showcase/${id}/assets`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: next.map((a) => a.id) }),
    });
    if (!res.ok) toast.error("Reorder failed");
  }

  async function updateCaption(assetId: string, caption: string) {
    const res = await fetch(`/api/showcase/${id}/assets`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates: [{ id: assetId, caption }] }),
    });
    if (!res.ok) toast.error("Update failed");
  }

  if (loading || !cs) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-white/40" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <PageHero
        title={cs.title || "Untitled"}
        subtitle={`Slug: /${cs.slug}  ·  ${cs.published ? "Published" : "Draft"}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setPreview((p) => !p)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs"
            >
              {preview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {preview ? "Edit" : "Preview markdown"}
            </button>
            <button
              onClick={togglePublish}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs"
            >
              {cs.published ? "Unpublish" : "Publish"}
            </button>
            {cs.published && (
              <Link
                href={`/showcase/${cs.slug}`}
                target="_blank"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs"
              >
                <ExternalLink className="w-3.5 h-3.5" /> View public
              </Link>
            )}
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-primary text-black text-xs font-semibold disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save
            </button>
          </div>
        }
      />

      <div className="space-y-8">
        {/* Hero */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider">Hero</h2>
          <Input label="Title" value={cs.title} onChange={(v) => patch("title", v)} />
          <Input label="Subtitle" value={cs.subtitle || ""} onChange={(v) => patch("subtitle", v)} />
          <Input label="Slug" value={cs.slug} onChange={(v) => patch("slug", v)} />
          <Input label="Hero image URL" value={cs.hero_image_url || ""} onChange={(v) => patch("hero_image_url", v)} />
          <Input label="Hero video URL" value={cs.hero_video_url || ""} onChange={(v) => patch("hero_video_url", v)} />
        </section>

        {/* Client */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider">Client</h2>
          <Input label="Client name" value={cs.client_name || ""} onChange={(v) => patch("client_name", v)} />
          <Input label="Client logo URL" value={cs.client_logo_url || ""} onChange={(v) => patch("client_logo_url", v)} />
        </section>

        {/* Summary + body */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider">Content</h2>
          <Textarea label="Summary" rows={3} value={cs.summary || ""} onChange={(v) => patch("summary", v)} />
          <div>
            <label className="block text-xs font-medium mb-1">Body (markdown)</label>
            {preview ? (
              <div className="px-4 py-3 rounded-lg bg-white/5 border border-white/10 prose prose-invert max-w-none">
                <Markdown source={cs.body_markdown || ""} />
              </div>
            ) : (
              <textarea
                rows={18}
                value={cs.body_markdown || ""}
                onChange={(e) => patch("body_markdown", e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm font-mono"
              />
            )}
          </div>
        </section>

        {/* Metrics */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider">Metrics</h2>
            <button onClick={addMetric} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-white/5 border border-white/10">
              <Plus className="w-3 h-3" /> Add row
            </button>
          </div>
          {(!cs.metrics || cs.metrics.length === 0) && (
            <p className="text-xs text-white/50">No metrics yet. Add 2-4 for best social proof.</p>
          )}
          <div className="space-y-2">
            {(cs.metrics || []).map((m, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                <input
                  placeholder="Label (e.g. CVR)"
                  value={m.label}
                  onChange={(e) => updateMetric(i, "label", e.target.value)}
                  className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm"
                />
                <input
                  placeholder="Value (e.g. 12.4%)"
                  value={m.value}
                  onChange={(e) => updateMetric(i, "value", e.target.value)}
                  className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm"
                />
                <input
                  placeholder="Delta (e.g. +210%)"
                  value={m.delta || ""}
                  onChange={(e) => updateMetric(i, "delta", e.target.value)}
                  className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm"
                />
                <button onClick={() => removeMetric(i)} className="text-white/50 hover:text-red-400 px-2">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Testimonial */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider">Testimonial</h2>
          <Textarea label="Quote" rows={3} value={cs.testimonial || ""} onChange={(v) => patch("testimonial", v)} />
          <Input label="Author" value={cs.testimonial_author || ""} onChange={(v) => patch("testimonial_author", v)} />
          <Input label="Author role" value={cs.testimonial_role || ""} onChange={(v) => patch("testimonial_role", v)} />
          <Input label="Author avatar URL" value={cs.testimonial_avatar_url || ""} onChange={(v) => patch("testimonial_avatar_url", v)} />
        </section>

        {/* Tags */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider">Tags</h2>
          <TagsInput
            label="Industry tags"
            value={cs.industry_tags || []}
            onChange={(next) => patch("industry_tags", next)}
          />
          <TagsInput
            label="Service tags"
            value={cs.service_tags || []}
            onChange={(next) => patch("service_tags", next)}
          />
        </section>

        {/* Assets gallery */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider">Gallery</h2>
            <button onClick={addAsset} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-white/5 border border-white/10">
              <Plus className="w-3 h-3" /> Add asset
            </button>
          </div>
          {assets.length === 0 && (
            <p className="text-xs text-white/50">No assets yet.</p>
          )}
          <div className="space-y-2">
            {assets.map((a, idx) => (
              <div key={a.id} className="flex items-center gap-3 p-2 rounded-lg border border-white/10 bg-white/5">
                <div className="w-16 h-16 rounded bg-black/40 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {a.asset_type === "image" ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={a.asset_url} alt="" className="w-full h-full object-cover" />
                  ) : a.asset_type === "video" ? (
                    <Video className="w-5 h-5 text-white/50" />
                  ) : (
                    <Code className="w-5 h-5 text-white/50" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white/60 truncate">{a.asset_url}</div>
                  <input
                    placeholder="Caption"
                    defaultValue={a.caption || ""}
                    onBlur={(e) => updateCaption(a.id, e.target.value)}
                    className="w-full mt-1 px-2 py-1 rounded bg-white/5 border border-white/10 text-xs"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => move(a.id, -1)} disabled={idx === 0} className="p-1 text-white/50 hover:text-white disabled:opacity-30"><ArrowUp className="w-3.5 h-3.5" /></button>
                  <button onClick={() => move(a.id, 1)} disabled={idx === assets.length - 1} className="p-1 text-white/50 hover:text-white disabled:opacity-30"><ArrowDown className="w-3.5 h-3.5" /></button>
                  <button onClick={() => removeAsset(a.id)} className="p-1 text-white/50 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SEO */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider">SEO</h2>
          <Input label="SEO title (<60 chars)" value={cs.seo_title || ""} onChange={(v) => patch("seo_title", v)} />
          <Textarea label="SEO description (<160 chars)" rows={2} value={cs.seo_description || ""} onChange={(v) => patch("seo_description", v)} />
          <Input label="OG image URL" value={cs.og_image_url || ""} onChange={(v) => patch("og_image_url", v)} />
        </section>

        <div className="flex gap-2 pt-4 border-t border-white/10">
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-black text-sm font-semibold disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save changes
          </button>
          <button
            onClick={() => router.push("/dashboard/showcase")}
            className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm"
          >
            Back to list
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Small inputs ───────────────────────────────────────────────
function Input({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm"
      />
    </div>
  );
}
function Textarea({ label, value, onChange, rows }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1">{label}</label>
      <textarea
        rows={rows || 3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm"
      />
    </div>
  );
}
function TagsInput({ label, value, onChange }: { label: string; value: string[]; onChange: (next: string[]) => void }) {
  const [input, setInput] = useState("");
  function add() {
    const v = input.trim().toLowerCase();
    if (!v) return;
    if (value.includes(v)) { setInput(""); return; }
    onChange([...value, v]);
    setInput("");
  }
  return (
    <div>
      <label className="block text-xs font-medium mb-1">{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 text-xs">
            {t}
            <button onClick={() => onChange(value.filter((x) => x !== t))} className="text-white/50 hover:text-white">×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="Add tag and press Enter"
          className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm"
        />
        <button onClick={add} className="px-3 py-2 rounded-lg bg-white/10 text-xs">Add</button>
      </div>
    </div>
  );
}
