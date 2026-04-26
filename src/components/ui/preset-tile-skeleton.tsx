"use client";

import { Skeleton } from "./skeleton";

/** Shimmer skeleton card that matches a typical preset grid tile aspect ratio. */
export function PresetTileSkeleton() {
  return (
    <div className="rounded-lg border border-border/50 bg-surface-light/30 p-3 space-y-2">
      <Skeleton className="aspect-video w-full rounded-md" />
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-2 w-1/2" />
      </div>
    </div>
  );
}

/** Grid of shimmer skeleton tiles. */
export function PresetGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <PresetTileSkeleton key={i} />
      ))}
    </div>
  );
}

/** Skeleton for a list-style audio row. */
export function AudioRowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-surface-light/30 p-3">
      <Skeleton className="w-10 h-10 rounded-full shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-2 w-1/2" />
      </div>
      <Skeleton className="w-8 h-8 rounded-md shrink-0" />
    </div>
  );
}

export function AudioListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <AudioRowSkeleton key={i} />
      ))}
    </div>
  );
}

export default PresetTileSkeleton;
