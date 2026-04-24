"use client";

import { useEffect, useState } from "react";
import type { CaseStudyAsset } from "@/lib/showcase/types";

/**
 * Gallery grid with a simple CSS/JS lightbox overlay. Images open the
 * lightbox; videos render inline with controls; embeds render as iframe.
 */
export default function Lightbox({
  images,
  assets,
}: {
  images: CaseStudyAsset[];
  assets: CaseStudyAsset[];
}) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  useEffect(() => {
    if (openIdx === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenIdx(null);
      if (e.key === "ArrowRight") setOpenIdx((i) => (i === null ? null : (i + 1) % images.length));
      if (e.key === "ArrowLeft") setOpenIdx((i) => (i === null ? null : (i - 1 + images.length) % images.length));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openIdx, images.length]);

  return (
    <>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {assets.map((a) => {
          if (a.asset_type === "image") {
            const idx = images.findIndex((i) => i.id === a.id);
            return (
              <button
                key={a.id}
                onClick={() => setOpenIdx(idx)}
                className="group block rounded-xl overflow-hidden border border-white/10 hover:border-white/30 transition text-left"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.asset_url} alt={a.caption || ""} className="w-full aspect-video object-cover group-hover:scale-[1.02] transition-transform duration-500" />
                {a.caption && <div className="p-3 text-xs text-white/60">{a.caption}</div>}
              </button>
            );
          }
          if (a.asset_type === "video") {
            return (
              <div key={a.id} className="rounded-xl overflow-hidden border border-white/10">
                <video src={a.asset_url} controls className="w-full aspect-video object-cover" />
                {a.caption && <div className="p-3 text-xs text-white/60">{a.caption}</div>}
              </div>
            );
          }
          return (
            <div key={a.id} className="rounded-xl overflow-hidden border border-white/10">
              <iframe
                src={a.asset_url}
                className="w-full aspect-video"
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
              {a.caption && <div className="p-3 text-xs text-white/60">{a.caption}</div>}
            </div>
          );
        })}
      </div>

      {openIdx !== null && images[openIdx] && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
          onClick={() => setOpenIdx(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="relative max-w-6xl max-h-[92vh] w-full" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={images[openIdx].asset_url}
              alt={images[openIdx].caption || ""}
              className="w-full h-full max-h-[84vh] object-contain"
            />
            {images[openIdx].caption && (
              <div className="mt-3 text-center text-sm text-white/70">{images[openIdx].caption}</div>
            )}
            <button
              onClick={() => setOpenIdx(null)}
              aria-label="Close"
              className="absolute top-2 right-2 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-xl"
            >
              x
            </button>
            {images.length > 1 && (
              <>
                <button
                  onClick={() => setOpenIdx((i) => (i === null ? null : (i - 1 + images.length) % images.length))}
                  aria-label="Previous"
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
                >
                  {"<"}
                </button>
                <button
                  onClick={() => setOpenIdx((i) => (i === null ? null : (i + 1) % images.length))}
                  aria-label="Next"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
                >
                  {">"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
