"use client";

import { ArrowCounterClockwise, Calendar, CircleNotch, CloudArrowUp, File, Image, MagicWand, PaperPlaneTilt, Sparkle, TrendUp } from "@phosphor-icons/react";

import { useCallback, useRef, useState, useMemo } from "react";
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

/** Lightweight visual mockup of what the post looks like per platform. */
function PostPreviewCard({
  platform,
  asset,
  caption,
  hashtags,
}: {
  platform: SocialPlatform;
  asset: DroppedAsset;
  caption: string;
  hashtags: string[];
}) {
  const meta = PLATFORM_META[platform];
  const isVertical = platform === "tiktok";
  const mediaUrl = asset && (asset.kind === "image" || asset.kind === "video") ? asset.url : null;
  const isVideo = asset?.kind === "video";

  return (
    <div
      className="rounded-xl border overflow-hidden text-xs"
      style={{ borderColor: `${meta.color}30` }}
    >
      {/* Platform header */}
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ background: `${meta.color}10` }}
      >
        <span className="font-medium" style={{ color: meta.color }}>{meta.label}</span>
        <span className="ml-auto text-[10px] text-text-muted opacity-60">Preview</span>
      </div>

      {/* Media area */}
      {mediaUrl ? (
        <div
          className="relative bg-black overflow-hidden"
          style={{ aspectRatio: isVertical ? "9/16" : "16/9", maxHeight: 160 }}
        >
          {isVideo ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/[0.04]">
              <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <span className="text-white text-sm pl-0.5">▶</span>
              </div>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mediaUrl}
              alt="Post media preview"
              className="w-full h-full object-cover"
              style={{ maxHeight: 160 }}
            />
          )}
        </div>
      ) : (
        <div
          className="flex items-center justify-center text-text-muted text-[10px] py-6 bg-white/[0.02]"
        >
          No media
        </div>
      )}

      {/* Caption preview */}
      <div className="px-3 py-2.5 space-y-1">
        <p className="text-[11px] text-text-secondary line-clamp-3 leading-relaxed">
          {caption || <span className="italic opacity-40">No caption yet</span>}
        </p>
        {hashtags.length > 0 && (
          <p className="text-[10px] opacity-50 line-clamp-1" style={{ color: meta.color }}>
            {hashtags.slice(0, 5).join(" ")}
            {hashtags.length > 5 && ` +${hashtags.length - 5}`}
          </p>
        )}
      </div>
    </div>
  );
}

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
  const [uploading, setUploading] = useState(false);
  const [suggestions, setSuggestions] = useState<AutoUploadSuggestions | null>(null);
  const [edits, setEdits] = useState<Partial<Record<SocialPlatform, PlatformEdit>>>({});
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Audit Apr 26 M1: upload to R2 before storing the asset URL. blob:
  // URLs only exist in the browser tab that created them, so the server
  // routes (/auto-upload → Claude, /schedule → Zernio) couldn't fetch
  // them and treated the post as having no media.
  const uploadFile = useCallback(async (f: File) => {
    const isVideo = f.type.startsWith("video/");
    const isImage = f.type.startsWith("image/");
    if (!isVideo && !isImage) {
      toast.error("Drop an image, video, or text");
      return;
    }
    setUploading(true);
    setAsset(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/uploads/r2", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? "Upload failed — try again.");
        return;
      }
      const json = (await res.json()) as { url: string; kind: "image" | "video" };
      setAsset({ kind: json.kind, url: json.url, name: f.name });
    } catch (err) {
      console.error("[social-studio/ai-upload] upload error", err);
      toast.error("Network error during upload — try again.");
    } finally {
      setUploading(false);
    }
  }, []);

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
    await uploadFile(files[0]);
  }, [uploadFile]);

  const handleFilePick = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    await uploadFile(f);
    // Reset the input so picking the same file twice still fires onChange.
    e.target.value = "";
  }, [uploadFile]);

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

  type PostStrengthSignal = { id: string; label: string; tip: string; pass: boolean };

  const postStrengthSignals = useMemo((): PostStrengthSignal[] | null => {
    if (!suggestions) return null;
    const repPlatform = suggestions.platforms_recommended.find((p) => edits[p]?.enabled) ?? null;
    if (!repPlatform) return null;
    const e = edits[repPlatform];
    if (!e) return null;

    const captionText = e.captionText.trim();
    const firstLine = captionText.split(/\n/)[0].trim();
    const firstWordCount = firstLine.split(/\s+/).filter(Boolean).length;

    const hookRe = /\b(stop|secret|truth|never|mistake|wrong|realize|admit|expose|reveal|shocking|warning|hidden|most people|don't|won't|actually|you need|are you|did you|do you|number one)\b/i;
    const hasHook = hookRe.test(firstLine) || firstWordCount <= 10 || firstLine.includes("?");

    const ctaRe = /\b(follow|save|share|comment|tap|click|subscribe|dm|tag|link in bio|send this|bookmark|repost|like|drop a|tell me|let me know|check out|grab|join)\b/i;
    const hasCta = ctaRe.test(captionText);

    const hashtagCount = e.hashtags.length + (captionText.match(/#\w+/g) ?? []).length;
    const hasHashtags = hashtagCount >= 1 && hashtagCount <= 15;

    const captionLen = captionText.length;
    const hasLength = captionLen >= 50 && captionLen <= 2200;

    // Emoji detection without /u flag (tsconfig has no explicit ES6+ target).
    // Covers BMP symbol blocks + surrogate-pair encoded emoji (U+1F000–U+1FAFF).
    const hasEmoji = /[☀-➿⌀-⏿⬀-⯿]|[\uD83C-\uD83E][\uDC00-\uDFFF]/.test(captionText);

    const isScheduled = !!e.scheduledAt;

    return [
      { id: "hook",      label: "Hook",       tip: "Opening line ≤10 words, a question, or a curiosity-trigger phrase",  pass: hasHook },
      { id: "cta",       label: "CTA",        tip: "Caption includes a clear call to action (follow, save, share…)",     pass: hasCta },
      { id: "hashtags",  label: "Hashtags",   tip: "1–15 hashtags — enough for reach without looking spammy",            pass: hasHashtags },
      { id: "length",    label: "Length",     tip: "Caption is 50–2,200 chars — substantial but easy to read",           pass: hasLength },
      { id: "emoji",     label: "Emoji",      tip: "At least one emoji adds personality and stops the scroll",           pass: hasEmoji },
      { id: "scheduled", label: "Scheduled",  tip: "Timed to AI-suggested peak hours for maximum reach",                 pass: isScheduled },
    ];
  }, [suggestions, edits]);

  const postStrengthScore = useMemo(() => {
    if (!postStrengthSignals) return 0;
    const passing = postStrengthSignals.filter((s) => s.pass).length;
    return Math.round((passing / postStrengthSignals.length) * 100);
  }, [postStrengthSignals]);

  return (
    <div className="space-y-6">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`relative  border-2 border-dashed transition-all p-8 text-center ${
          dragOver
            ? "border-[rgba(212,255,0,0.5)] bg-[rgba(212,255,0,0.05)]"
            : "border-border-subtle/40 bg-surface hover:border-border-subtle/60"
        }`}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14  bg-[rgba(212,255,0,0.08)] border border-[rgba(212,255,0,0.25)] flex items-center justify-center">
            <CloudArrowUp size={26} className="text-brand-accent" />
          </div>
          <div>
            <h3 className="text-base font-semibold tracking-tight">
              Drop your image, video, or text here
            </h3>
            <p className="text-xs text-text-muted mt-1">
              AI picks platforms, writes captions, suggests hashtags + the best time to post.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-md text-xs border border-border-subtle/40 hover:bg-elevated inline-flex items-center gap-1.5"
            >
              <Image size={12} />
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
          {uploading && (
            <div className="text-xs text-text-muted inline-flex items-center gap-1.5">
              <CircleNotch size={12} className="animate-spin" />
              Uploading to storage...
            </div>
          )}
          {!uploading && asset && (
            <div className="text-xs text-text-muted">
              Loaded: <span className="text-text-primary">{asset.kind === "text" ? "text snippet" : (asset as { name: string }).name}</span>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border-subtle/40 bg-surface p-4 space-y-3">
        <label className="text-[10px] uppercase tracking-wider text-text-muted">
          Or paste / type your post text
        </label>
        <textarea
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          rows={4}
          placeholder="What do you want to say?"
          className="w-full px-3 py-2 rounded-md bg-elevated border border-border-subtle/40 text-sm"
        />
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-[10px] uppercase tracking-wider text-text-muted">Tone</label>
            {["professional", "playful", "punchy", "story-driven", "expert"].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTone(t)}
                className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${
                  tone === t
                    ? "bg-[rgba(212,255,0,0.12)] border-[rgba(212,255,0,0.4)] text-brand-accent"
                    : "border-border-subtle/40 text-text-muted hover:bg-elevated"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={analyzing || uploading || (!asset && !textInput.trim())}
            className="btn-pill-ghost text-xs inline-flex items-center gap-2 disabled:opacity-50"
          >
            {analyzing ? <CircleNotch size={12} className="animate-spin" /> : <Sparkle size={12} />}
            {analyzing ? "AI thinking..." : "Run AI"}
          </button>
        </div>
      </div>

      {suggestions && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border-subtle/40 bg-surface p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MagicWand size={14} className="text-brand-accent" />
                <h3 className="text-sm font-semibold tracking-tight">AI summary</h3>
              </div>
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={analyzing}
                className="text-[10px] inline-flex items-center gap-1 text-text-muted hover:text-text-primary"
              >
                <ArrowCounterClockwise size={10} className={analyzing ? "animate-spin" : ""} />
                Regenerate
              </button>
            </div>
            <p className="text-xs text-text-muted mt-2">{suggestions.asset_summary}</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-3">
              <span className="text-[10px] uppercase tracking-wider text-text-muted">Recommended</span>
              {suggestions.platforms_recommended.map((p) => (
                <PlatformChip key={p} platform={p} />
              ))}
            </div>
          </div>

          {/* Platform post previews — visual mockups before committing */}
          {ALL_PLATFORMS.filter((p) => suggestions.platforms_recommended.includes(p) && edits[p]?.enabled).length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-text-muted mb-2">Post previews</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {ALL_PLATFORMS.filter((p) => suggestions.platforms_recommended.includes(p) && edits[p]?.enabled).map((platform) => {
                  const e = edits[platform];
                  if (!e) return null;
                  return (
                    <PostPreviewCard
                      key={platform}
                      platform={platform}
                      asset={asset}
                      caption={e.captionText}
                      hashtags={e.hashtags}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Post Strength Score ── */}
          {postStrengthSignals && (
            <div className="rounded-xl border border-border-subtle/40 bg-surface p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <TrendUp size={13} className="text-brand-accent" />
                  <span className="text-xs font-semibold text-text-primary">Post Strength</span>
                </div>
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tabular-nums"
                  style={{
                    background: postStrengthScore >= 71 ? "rgba(34,197,94,0.12)" : postStrengthScore >= 43 ? "rgba(245,158,11,0.12)" : "rgba(239,68,68,0.12)",
                    color: postStrengthScore >= 71 ? "#4ade80" : postStrengthScore >= 43 ? "#fbbf24" : "#f87171",
                  }}
                >
                  {postStrengthScore}
                  <span className="font-normal opacity-60 ml-0.5">/ 100</span>
                </div>
              </div>
              <div className="w-full h-1.5 rounded-full mb-3 overflow-hidden bg-elevated">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${postStrengthScore}%`,
                    background: postStrengthScore >= 71 ? "linear-gradient(90deg,#22c55e,#4ade80)" : postStrengthScore >= 43 ? "linear-gradient(90deg,#f59e0b,#fbbf24)" : "linear-gradient(90deg,#ef4444,#f87171)",
                  }}
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {postStrengthSignals.map((sig) => (
                  <div
                    key={sig.id}
                    title={sig.tip}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium cursor-default border ${
                      sig.pass
                        ? "bg-[rgba(34,197,94,0.10)] border-[rgba(34,197,94,0.25)] text-green-400"
                        : "bg-elevated border-border-subtle/30 text-text-muted"
                    }`}
                  >
                    <span className="text-[8px]">{sig.pass ? "✓" : "–"}</span>
                    {sig.label}
                  </div>
                ))}
              </div>
              {(() => {
                const firstFail = postStrengthSignals.find((s) => !s.pass);
                return firstFail ? (
                  <p className="mt-2.5 text-[10px] text-text-muted leading-relaxed">
                    <span className="font-medium text-text-secondary">Tip: </span>
                    {firstFail.tip}
                  </p>
                ) : (
                  <p className="mt-2.5 text-[10px] text-green-400">
                    All signals passing — this post is optimised for reach.
                  </p>
                );
              })()}
            </div>
          )}

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
                    <label className="inline-flex items-center gap-2 text-[10px] text-text-muted cursor-pointer">
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
                      <label className="text-[10px] uppercase tracking-wider text-text-muted">Caption variants</label>
                      <div className="grid grid-cols-3 gap-1.5 mt-1">
                        {captions.map((c) => (
                          <button
                            key={c.variant}
                            type="button"
                            onClick={() => pickVariant(platform, c)}
                            className={`text-[10px] px-2 py-1 rounded border transition-all ${
                              e.selectedVariant === c.variant
                                ? "border-[rgba(212,255,0,0.4)] bg-[rgba(212,255,0,0.08)] text-brand-accent"
                                : "border-border-subtle/40 text-text-muted hover:bg-elevated"
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
                        className="w-full mt-2 px-3 py-2 rounded-md bg-elevated border border-border-subtle/40 text-sm"
                      />
                      {captions[e.selectedVariant - 1]?.rationale && (
                        <p className="text-[10px] text-text-muted mt-1">
                          Why: {captions[e.selectedVariant - 1]?.rationale}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-text-muted">Hashtags</label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {e.hashtags.map((h, idx) => (
                          <span
                            key={`${h}-${idx}`}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-elevated text-text-muted"
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
                        className="w-full mt-1 px-2 py-1 rounded-md bg-elevated border border-border-subtle/40 text-[11px]"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-text-muted inline-flex items-center gap-1">
                        <Calendar size={10} />
                        Schedule for
                      </label>
                      <input
                        type="datetime-local"
                        value={e.scheduledAt}
                        onChange={(ev) => updateEdit(platform, { scheduledAt: ev.target.value })}
                        className="w-full mt-1 px-3 py-1.5 rounded-md bg-elevated border border-border-subtle/40 text-sm"
                      />
                      {(() => {
                        const reco = suggestions.times_recommended.find((t) => t.platform === platform);
                        if (!reco) return null;
                        return <p className="text-[10px] text-text-muted mt-1">AI suggested: {reco.label}. {reco.rationale}</p>;
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
              className="px-4 py-2 rounded-md border border-border-subtle/40 text-xs hover:bg-elevated inline-flex items-center gap-2 disabled:opacity-50"
            >
              {scheduling ? <CircleNotch size={12} className="animate-spin" /> : <PaperPlaneTilt size={12} />}
              Publish all now
            </button>
            <button
              type="button"
              onClick={() => handleScheduleAll(false)}
              disabled={scheduling}
              className="btn-pill-ghost text-xs inline-flex items-center gap-2 disabled:opacity-50"
            >
              {scheduling ? <CircleNotch size={12} className="animate-spin" /> : <Calendar size={12} />}
              Schedule all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
