"use client";

import { useCallback, useRef, useState } from "react";
import {
  Sparkles,
  UploadCloud,
  Loader2,
  Wand2,
  Calendar as CalendarIcon,
  Send,
  RefreshCcw,
  Image as ImageIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { ALL_PLATFORMS, PLATFORM_META } from "@/lib/social-studio/constants";
import type {
  AutoUploadSuggestions,
  CaptionVariation,
  SocialPlatform,
} from "@/lib/social-studio/types";
import PlatformChip from "./PlatformChip";

type DroppedAsset =
  | { kind: "image" | "video"; url: string; name: string }
  | { kind: "text"; text: string }
  | null;

/** Per-platform editor state — caption pick + edited hashtag list + chosen iso. */
interface PlatformEdit {
  enabled: boolean;
  selectedVariant: number;
  captionText: string;
  hashtags: string[];
  scheduledAt: string;
}

function fmtDateTimeLocal(iso: string): string {
  // datetime-local inputs need YYYY-MM-DDTHH:mm — strip seconds + Z.
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function Tab2AIUpload() {
  const [asset, setAsset] = useState<DroppedAsset>(null);
  const [textInput, setTextInput] = useState("");
  const [tone, setTone] = useState("professional");
  const [analyzing, setAnalyzing] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [suggestions, setSuggestions] = useState<AutoUploadSuggestions | null>(null);
  const [edits, setEdits] = useState<Partial<Record<SocialPlatform, PlatformEdit>>>({});
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) {
      const dropped = e.dataTransfer.getData("text");
      if (dropped) {
        setAsset({ kind: "text", text: dropped });
        setTextInput(dropped);
      }
      return;
    }
    const f = files[0];
    const isVideo = f.type.startsWith("video/");
    const isImage = f.type.startsWith("image/");
    if (!isVideo && !isImage) {
      toast.error("Drop an image, video, or text");
      return;
    }
    // For v1 we use a local object URL. Production wiring will upload to
    // R2 via /api/uploads and pass the public URL to /auto-upload.
    const url = URL.createObjectURL(f);
    setAsset({ kind: isVideo ? "video" : "image", url, name: f.name });
  }, []);

  const handleFilePick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const isVideo = f.type.startsWith("video/");
    const isImage = f.type.startsWith("image/");
    if (!isVideo && !isImage) {
      toast.error("Pick an image or video");
      return;
    }
    const url = URL.createObjectURL(f);
    setAsset({ kind: isVideo ? "video" : "image", url, name: f.name });
  }, []);

  const handleAnalyze = useCallback(async () => {
    setAnalyzing(true);
    setSuggestions(null);
    setEdits({});
    try {
      const body: Record<string, unknown> = { tone };
      if (asset?.kind === "image" || asset?.kind === "video") {
        body.media_url = asset.url;
        body.media_kind = asset.kind;
      }
      if (asset?.kind === "text") body.text = asset.text;
      else if (textInput.trim()) body.text = textInput.trim();

      const res = await fetch("/api/social/auto-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? "AI couldn't analyse this — try again.");
        return;
      }
      const json = (await res.json()) as AutoUploadSuggestions;
      setSuggestions(json);

      // Hydrate per-platform edit state with the AI's first variant.
      const initialEdits: Partial<Record<SocialPlatform, PlatformEdit>> = {};
      for (const platform of json.platforms_recommended) {
        const captions = json.captions_per_platform[platform] ?? [];
        const time = json.times_recommended.find((t) => t.platform === platform);
        initialEdits[platform] = {
          enabled: true,
          selectedVariant: 1,
          captionText: captions[0]?.text ?? "",
          hashtags: json.hashtags_per_platform[platform] ?? [],
          scheduledAt: time ? fmtDateTimeLocal(time.iso) : "",
        };
      }
      setEdits(initialEdits);
      toast.success("AI suggestions ready — review and schedule.");
    } catch (err) {
      console.error("[social-studio/ai-upload] analyze error", err);
      toast.error("Network error — try again.");
    } finally {
      setAnalyzing(false);
    }
  }, [asset, textInput, tone]);

  const updateEdit = (platform: SocialPlatform, patch: Partial<PlatformEdit>) => {
    setEdits((prev) => {
      const current = prev[platform];
      if (!current) return prev;
      return { ...prev, [platform]: { ...current, ...patch } };
    });
  };

  const pickVariant = (platform: SocialPlatform, variant: CaptionVariation) => {
    updateEdit(platform, {
      selectedVariant: variant.variant,
      captionText: variant.text,
    });
  };

  const handleScheduleAll = async (publishNow: boolean) => {
    if (!suggestions) return;
    const enabledPlatforms = Object.entries(edits)
      .filter(([, e]) => e?.enabled)
      .map(([p]) => p as SocialPlatform);
    if (enabledPlatforms.length === 0) {
      toast.error("Pick at least one platform.");
      return;
    }

    setScheduling(true);
    let successCount = 0;
    let failCount = 0;

    // Schedule each platform separately so a per-platform Zernio failure
    // doesn't take down the others. Future iteration can batch these.
    for (const platform of enabledPlatforms) {
      const e = edits[platform];
      if (!e) continue;
      try {
        const body = {
          platforms: [platform],
          caption: e.captionText,
          hashtags: e.hashtags,
          media_urls:
            asset && (asset.kind === "image" || asset.kind === "video")
              ? [asset.url]
              : [],
          scheduled_at: publishNow
            ? undefined
            : e.scheduledAt
              ? new Date(e.scheduledAt).toISOString()
              : undefined,
          ai_metadata: {
            asset_summary: suggestions.asset_summary,
            selected_variant: e.selectedVariant,
            tone,
          },
        };
        const res = await fetch("/api/social/schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.zernio_error) failCount += 1;
          else successCount += 1;
        } else {
          failCount += 1;
        }
      } catch {
        failCount += 1;
      }
    }

    setScheduling(false);
    if (successCount > 0 && failCount === 0) {
      toast.success(`Scheduled ${successCount} post${successCount > 1 ? "s" : ""}`);
    } else if (successCount > 0) {
      toast(`${successCount} scheduled, ${failCount} failed — check the Calendar tab.`);
    } else {
      toast.error("Couldn't schedule any platform — check Zernio connection.");
    }

    if (successCount > 0) {
      setSuggestions(null);
      setAsset(null);
      setTextInput("");
      setEdits({});
    }
  };

  return (
    <div className="space-y-6">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`relative rounded-2xl border-2 border-dashed transition-all p-8 text-center ${
          dragOver
            ? "border-gold/60 bg-gold/5"
            : "border-border/40 bg-surface hover:border-border/60"
        }`}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-gold/10 border border-gold/30 flex items-center justify-center">
            <UploadCloud size={26} className="text-gold" />
          </div>
          <div>
            <h3 className="text-base font-semibold tracking-tight">
              Drop your image, video, or text here
            </h3>
            <p className="text-xs text-muted mt-1">
              AI picks platforms, writes captions, suggests hashtags + the best time to post.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-md text-xs border border-border/40 hover:bg-elevated inline-flex items-center gap-1.5"
            >
              <ImageIcon size={12} />
              Choose file
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={handleFilePick}
            />
          </div>
          {asset && (
            <div className="text-xs text-muted">
              Loaded: <span className="text-foreground">{asset.kind === "text" ? "text snippet" : (asset as { name: string }).name}</span>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border/40 bg-surface p-4 space-y-3">
        <label className="text-[10px] uppercase tracking-wider text-muted">
          Or paste / type your post text
        </label>
        <textarea
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          rows={4}
          placeholder="What do you want to say?"
          className="w-full px-3 py-2 rounded-md bg-elevated border border-border/40 text-sm"
        />
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-[10px] uppercase tracking-wider text-muted">Tone</label>
            {["professional", "playful", "punchy", "story-driven", "expert"].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTone(t)}
                className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${
                  tone === t
                    ? "bg-gold/20 border-gold/40 text-gold"
                    : "border-border/40 text-muted hover:bg-elevated"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={analyzing || (!asset && !textInput.trim())}
            className="px-4 py-1.5 rounded-md bg-gold/20 border border-gold/40 text-gold inline-flex items-center gap-2 text-xs font-medium hover:bg-gold/30 disabled:opacity-50"
          >
            {analyzing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {analyzing ? "AI thinking..." : "Run AI"}
          </button>
        </div>
      </div>

      {suggestions && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border/40 bg-surface p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wand2 size={14} className="text-gold" />
                <h3 className="text-sm font-semibold tracking-tight">AI summary</h3>
              </div>
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={analyzing}
                className="text-[10px] inline-flex items-center gap-1 text-muted hover:text-foreground"
              >
                <RefreshCcw size={10} className={analyzing ? "animate-spin" : ""} />
                Regenerate
              </button>
            </div>
            <p className="text-xs text-muted mt-2">{suggestions.asset_summary}</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-3">
              <span className="text-[10px] uppercase tracking-wider text-muted">Recommended</span>
              {suggestions.platforms_recommended.map((p) => (
                <PlatformChip key={p} platform={p} />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {ALL_PLATFORMS.filter((p) => suggestions.platforms_recommended.includes(p)).map((platform) => {
              const e = edits[platform];
              if (!e) return null;
              const captions = suggestions.captions_per_platform[platform] ?? [];
              const meta = PLATFORM_META[platform];

              return (
                <div
                  key={platform}
                  className={`rounded-xl border p-4 transition-all ${
                    e.enabled ? "bg-surface" : "bg-surface opacity-60"
                  }`}
                  style={{ borderColor: meta.border }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <PlatformChip platform={platform} size="md" />
                    <label className="inline-flex items-center gap-2 text-[10px] text-muted cursor-pointer">
                      <input
                        type="checkbox"
                        checked={e.enabled}
                        onChange={(ev) => updateEdit(platform, { enabled: ev.target.checked })}
                      />
                      Enabled
                    </label>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-muted">Caption variants</label>
                      <div className="grid grid-cols-3 gap-1.5 mt-1">
                        {captions.map((c) => (
                          <button
                            key={c.variant}
                            type="button"
                            onClick={() => pickVariant(platform, c)}
                            className={`text-[10px] px-2 py-1 rounded border transition-all ${
                              e.selectedVariant === c.variant
                                ? "border-gold/40 bg-gold/10 text-gold"
                                : "border-border/40 text-muted hover:bg-elevated"
                            }`}
                          >
                            #{c.variant}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={e.captionText}
                        onChange={(ev) => updateEdit(platform, { captionText: ev.target.value })}
                        rows={4}
                        className="w-full mt-2 px-3 py-2 rounded-md bg-elevated border border-border/40 text-sm"
                      />
                      {captions[e.selectedVariant - 1]?.rationale && (
                        <p className="text-[10px] text-muted mt-1">
                          Why: {captions[e.selectedVariant - 1]?.rationale}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-muted">Hashtags</label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {e.hashtags.map((h, idx) => (
                          <span
                            key={`${h}-${idx}`}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-elevated text-muted"
                          >
                            {h}
                          </span>
                        ))}
                      </div>
                      <input
                        type="text"
                        defaultValue={e.hashtags.join(" ")}
                        onBlur={(ev) => {
                          const tags = ev.target.value
                            .split(/\s+/)
                            .map((t) => t.trim())
                            .filter(Boolean)
                            .map((t) => (t.startsWith("#") ? t : `#${t}`));
                          updateEdit(platform, { hashtags: tags });
                        }}
                        placeholder="Edit and tab away to save"
                        className="w-full mt-1 px-2 py-1 rounded-md bg-elevated border border-border/40 text-[11px]"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-muted inline-flex items-center gap-1">
                        <CalendarIcon size={10} />
                        Schedule for
                      </label>
                      <input
                        type="datetime-local"
                        value={e.scheduledAt}
                        onChange={(ev) => updateEdit(platform, { scheduledAt: ev.target.value })}
                        className="w-full mt-1 px-3 py-1.5 rounded-md bg-elevated border border-border/40 text-sm"
                      />
                      {(() => {
                        const reco = suggestions.times_recommended.find((t) => t.platform === platform);
                        if (!reco) return null;
                        return <p className="text-[10px] text-muted mt-1">AI suggested: {reco.label}. {reco.rationale}</p>;
                      })()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
            <button
              type="button"
              onClick={() => handleScheduleAll(true)}
              disabled={scheduling}
              className="px-4 py-2 rounded-md border border-border/40 text-xs hover:bg-elevated inline-flex items-center gap-2 disabled:opacity-50"
            >
              {scheduling ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              Publish all now
            </button>
            <button
              type="button"
              onClick={() => handleScheduleAll(false)}
              disabled={scheduling}
              className="px-4 py-2 rounded-md bg-gold/20 border border-gold/40 text-gold text-xs font-medium inline-flex items-center gap-2 disabled:opacity-50"
            >
              {scheduling ? <Loader2 size={12} className="animate-spin" /> : <CalendarIcon size={12} />}
              Schedule all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
