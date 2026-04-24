"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Upload, Link as LinkIcon, Loader2 } from "lucide-react";
import PageHero from "@/components/ui/page-hero";
import { createClient } from "@/lib/supabase/client";
import type { ReviewAssetType } from "@/lib/review/types";

const ASSET_TYPES: { value: ReviewAssetType; label: string; exts: string[] }[] = [
  { value: "video", label: "Video", exts: ["mp4", "mov", "webm", "m4v"] },
  { value: "image", label: "Image", exts: ["jpg", "jpeg", "png", "gif", "webp"] },
  { value: "pdf", label: "PDF", exts: ["pdf"] },
  { value: "audio", label: "Audio", exts: ["mp3", "wav", "m4a", "ogg"] },
];

function guessAssetType(url: string): ReviewAssetType {
  const u = url.toLowerCase();
  for (const t of ASSET_TYPES) {
    if (t.exts.some((ext) => u.endsWith(`.${ext}`))) return t.value;
  }
  return "video";
}

export default function NewReviewPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [assetUrl, setAssetUrl] = useState("");
  const [assetType, setAssetType] = useState<ReviewAssetType>("video");
  const [projectId, setProjectId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFileUpload(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error } = await supabase.storage
        .from("review-assets")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (error) throw error;

      const {
        data: { publicUrl },
      } = supabase.storage.from("review-assets").getPublicUrl(path);
      setAssetUrl(publicUrl);
      setAssetType(guessAssetType(file.name));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !assetUrl.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/review/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          asset_url: assetUrl.trim(),
          asset_type: assetType,
          project_id: projectId.trim() || null,
        }),
      });
      if (res.ok) {
        const j = await res.json();
        router.push(`/dashboard/review/${j.session.id}`);
      } else {
        const j = await res.json().catch(() => ({}));
        alert(j.error || "Failed to create review");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/review"
        className="inline-flex items-center gap-1 text-sm text-white/60 hover:text-white"
      >
        <ArrowLeft className="w-4 h-4" /> Back to reviews
      </Link>

      <PageHero
        title="New review session"
        subtitle="Upload a deliverable or paste a URL. You'll get a magic link to share with your client."
        gradient="gold"
        icon={<Upload className="w-6 h-6" />}
      />

      <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
        <div>
          <label className="block text-sm font-medium text-white/80 mb-1.5">
            Title
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Nordic campaign — hero video v1"
            required
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-[#C9A84C]/50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/80 mb-1.5">
            Asset type
          </label>
          <div className="grid grid-cols-4 gap-2">
            {ASSET_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setAssetType(t.value)}
                className={`py-2 rounded-lg border text-sm transition ${
                  assetType === t.value
                    ? "bg-[#C9A84C]/15 border-[#C9A84C]/60 text-white"
                    : "bg-white/5 border-white/10 text-white/70 hover:border-white/30"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-white/80 mb-1.5">
            Asset
          </label>
          <div className="flex items-center gap-2">
            <input
              type="file"
              id="review-asset-upload"
              className="hidden"
              accept={ASSET_TYPES.find((t) => t.value === assetType)?.exts
                .map((e) => `.${e}`)
                .join(",")}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileUpload(f);
              }}
            />
            <label
              htmlFor="review-asset-upload"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white/80 text-sm cursor-pointer hover:border-white/30"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" /> Upload
                </>
              )}
            </label>
            <span className="text-xs text-white/40">or</span>
            <div className="relative flex-1">
              <LinkIcon className="absolute left-2.5 top-2.5 w-4 h-4 text-white/40" />
              <input
                value={assetUrl}
                onChange={(e) => setAssetUrl(e.target.value)}
                placeholder="Paste asset URL"
                className="w-full pl-8 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-[#C9A84C]/50"
              />
            </div>
          </div>
          {uploadError && (
            <p className="text-xs text-red-400">{uploadError}</p>
          )}
          {assetUrl && !uploading && (
            <p className="text-xs text-green-400 truncate">
              Asset ready: {assetUrl}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-white/80 mb-1.5">
            Project ID (optional)
          </label>
          <input
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            placeholder="Link to an existing project UUID"
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-[#C9A84C]/50"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || !title.trim() || !assetUrl.trim()}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#C9A84C] text-black font-semibold text-sm hover:bg-[#d4b559] disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          Create review session
        </button>
      </form>
    </div>
  );
}
