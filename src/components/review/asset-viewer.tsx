"use client";

// Asset viewer + pin overlay component. Handles video/image/pdf/audio with
// click-to-pin interactions:
//   - video/audio: click timeline to add a pin at current playback time
//   - image: click anywhere on the image (stored as x/y % of container), or
//            drag to create a region (stored as x/y/w/h %)
//   - pdf: iframe fallback (no pin overlay, page-number comments only via
//          external button — wired from the parent comments pane)

import { useEffect, useRef, useState } from "react";
import type { ReviewAssetType, ReviewComment, ReviewRegion } from "@/lib/review/types";

interface PendingPin {
  timestamp_seconds?: number;
  region?: ReviewRegion;
  page_number?: number;
}

interface Props {
  assetUrl: string;
  assetType: ReviewAssetType;
  comments: ReviewComment[];
  version: number;
  onAddPin: (pin: PendingPin) => void;
  activeCommentId?: string | null;
  onSelectComment?: (id: string) => void;
  pendingPin?: PendingPin | null;
}

export default function AssetViewer({
  assetUrl,
  assetType,
  comments,
  version,
  onAddPin,
  activeCommentId,
  onSelectComment,
  pendingPin,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const imageBoxRef = useRef<HTMLDivElement | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  // Drag-to-region state (image)
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ x: number; y: number } | null>(null);

  const versionComments = comments.filter(
    (c) => c.version === version && !c.thread_parent_id,
  );

  // ───── Video ─────
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const onTime = () => setCurrentTime(el.currentTime);
    const onMeta = () => setDuration(el.duration || 0);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onMeta);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onMeta);
    };
  }, [assetUrl]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => setCurrentTime(el.currentTime);
    const onMeta = () => setDuration(el.duration || 0);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onMeta);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onMeta);
    };
  }, [assetUrl]);

  function handleTimelineClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const t = pct * duration;
    const mediaEl = videoRef.current || audioRef.current;
    if (mediaEl) mediaEl.currentTime = t;
    onAddPin({ timestamp_seconds: Math.round(t * 10) / 10 });
  }

  function scrubTo(seconds: number) {
    const mediaEl = videoRef.current || audioRef.current;
    if (mediaEl) {
      mediaEl.currentTime = seconds;
      mediaEl.play().catch(() => {});
    }
  }

  // ───── Image pin / region drag ─────
  function handleImageMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (!imageBoxRef.current) return;
    const rect = imageBoxRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setDragStart({ x, y });
    setDragEnd({ x, y });
  }
  function handleImageMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!dragStart || !imageBoxRef.current) return;
    const rect = imageBoxRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setDragEnd({ x, y });
  }
  function handleImageMouseUp() {
    if (!dragStart || !dragEnd) return;
    const w = Math.abs(dragEnd.x - dragStart.x);
    const h = Math.abs(dragEnd.y - dragStart.y);
    if (w < 2 && h < 2) {
      // simple click — pin point (no region)
      onAddPin({
        region: {
          x: Math.max(0, dragStart.x - 1.5),
          y: Math.max(0, dragStart.y - 1.5),
          w: 3,
          h: 3,
        },
      });
    } else {
      onAddPin({
        region: {
          x: Math.min(dragStart.x, dragEnd.x),
          y: Math.min(dragStart.y, dragEnd.y),
          w,
          h,
        },
      });
    }
    setDragStart(null);
    setDragEnd(null);
  }

  // ───── Render by asset type ─────

  if (assetType === "video") {
    return (
      <div className="flex flex-col gap-3 h-full">
        <div className="relative bg-black rounded-lg overflow-hidden flex-1 min-h-0 flex items-center justify-center">
          <video
            ref={videoRef}
            src={assetUrl}
            controls
            className="max-w-full max-h-full"
          />
        </div>
        <div className="space-y-1">
          <div
            className="relative h-10 bg-white/5 rounded-md cursor-pointer border border-white/10"
            onClick={handleTimelineClick}
            title="Click to add comment at this time"
          >
            {/* Progress fill */}
            <div
              className="absolute inset-y-0 left-0 bg-[#C9A84C]/20 rounded-md"
              style={{ width: duration ? `${(currentTime / duration) * 100}%` : "0%" }}
            />
            {/* Comment pins */}
            {versionComments
              .filter((c) => c.timestamp_seconds !== null)
              .map((c) => {
                const pct = duration ? ((c.timestamp_seconds as number) / duration) * 100 : 0;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      scrubTo(c.timestamp_seconds as number);
                      onSelectComment?.(c.id);
                    }}
                    className={`absolute -top-1 w-4 h-12 rounded-sm transition-all ${
                      c.resolved
                        ? "bg-green-500/40 hover:bg-green-500/70"
                        : activeCommentId === c.id
                          ? "bg-[#C9A84C] shadow-lg shadow-[#C9A84C]/50"
                          : "bg-[#C9A84C]/70 hover:bg-[#C9A84C]"
                    }`}
                    style={{ left: `calc(${pct}% - 8px)` }}
                    title={`${c.author_name}: ${c.content.slice(0, 60)}`}
                  />
                );
              })}
            {/* Pending pin */}
            {pendingPin?.timestamp_seconds !== undefined && duration > 0 && (
              <div
                className="absolute -top-1 w-4 h-12 bg-blue-500 border-2 border-white rounded-sm"
                style={{
                  left: `calc(${(pendingPin.timestamp_seconds / duration) * 100}% - 8px)`,
                }}
              />
            )}
          </div>
          <div className="text-xs text-white/50">
            {formatTime(currentTime)} / {formatTime(duration)} — click timeline
            to comment at a specific time
          </div>
        </div>
      </div>
    );
  }

  if (assetType === "audio") {
    return (
      <div className="flex flex-col gap-4 p-6">
        <audio ref={audioRef} src={assetUrl} controls className="w-full" />
        <div
          className="relative h-10 bg-white/5 rounded-md cursor-pointer border border-white/10"
          onClick={handleTimelineClick}
        >
          <div
            className="absolute inset-y-0 left-0 bg-[#C9A84C]/20 rounded-md"
            style={{ width: duration ? `${(currentTime / duration) * 100}%` : "0%" }}
          />
          {versionComments
            .filter((c) => c.timestamp_seconds !== null)
            .map((c) => {
              const pct = duration ? ((c.timestamp_seconds as number) / duration) * 100 : 0;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    scrubTo(c.timestamp_seconds as number);
                    onSelectComment?.(c.id);
                  }}
                  className={`absolute -top-1 w-4 h-12 rounded-sm ${
                    c.resolved ? "bg-green-500/50" : "bg-[#C9A84C]/70 hover:bg-[#C9A84C]"
                  }`}
                  style={{ left: `calc(${pct}% - 8px)` }}
                  title={`${c.author_name}: ${c.content.slice(0, 60)}`}
                />
              );
            })}
        </div>
        <div className="text-xs text-white/50">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>
    );
  }

  if (assetType === "image") {
    return (
      <div
        ref={imageBoxRef}
        className="relative inline-block mx-auto cursor-crosshair select-none"
        onMouseDown={handleImageMouseDown}
        onMouseMove={handleImageMouseMove}
        onMouseUp={handleImageMouseUp}
        onMouseLeave={() => {
          if (dragStart) handleImageMouseUp();
        }}
        style={{ maxWidth: "100%", maxHeight: "100%" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={assetUrl}
          alt="Review asset"
          draggable={false}
          className="block max-w-full max-h-[70vh]"
        />
        {versionComments
          .filter((c) => c.region)
          .map((c) => {
            const r = c.region as ReviewRegion;
            const isActive = activeCommentId === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectComment?.(c.id);
                }}
                className={`absolute border-2 rounded ${
                  c.resolved
                    ? "border-green-400/60 bg-green-400/10"
                    : isActive
                      ? "border-[#C9A84C] bg-[#C9A84C]/20"
                      : "border-[#C9A84C]/70 bg-[#C9A84C]/10 hover:bg-[#C9A84C]/25"
                }`}
                style={{
                  left: `${r.x}%`,
                  top: `${r.y}%`,
                  width: `${r.w}%`,
                  height: `${r.h}%`,
                }}
                title={`${c.author_name}: ${c.content.slice(0, 60)}`}
              />
            );
          })}
        {/* Live drag rectangle */}
        {dragStart && dragEnd && (
          <div
            className="absolute border-2 border-blue-400 bg-blue-400/20 pointer-events-none"
            style={{
              left: `${Math.min(dragStart.x, dragEnd.x)}%`,
              top: `${Math.min(dragStart.y, dragEnd.y)}%`,
              width: `${Math.abs(dragEnd.x - dragStart.x)}%`,
              height: `${Math.abs(dragEnd.y - dragStart.y)}%`,
            }}
          />
        )}
        {/* Pending pin */}
        {pendingPin?.region && (
          <div
            className="absolute border-2 border-blue-500 bg-blue-500/30 pointer-events-none animate-pulse"
            style={{
              left: `${pendingPin.region.x}%`,
              top: `${pendingPin.region.y}%`,
              width: `${pendingPin.region.w}%`,
              height: `${pendingPin.region.h}%`,
            }}
          />
        )}
      </div>
    );
  }

  // PDF — iframe fallback (react-pdf not in deps). Page-number comments are
  // added via the right pane's "add at page N" picker.
  return (
    <div className="flex flex-col gap-2 h-full">
      <iframe
        src={assetUrl}
        title="PDF preview"
        className="w-full h-full min-h-[60vh] bg-white rounded-lg border border-white/10"
      />
      <div className="text-xs text-white/50">
        PDF comments are tied to page numbers — set the page number in the
        comment composer.
      </div>
    </div>
  );
}

function formatTime(s: number): string {
  if (!s || !isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}
