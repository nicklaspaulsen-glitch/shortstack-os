"use client";

import { PageSkeleton } from "./skeleton";

export default function Loading({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 fade-in">
      <div className="relative">
        <div className="w-8 h-8 border-2 border-gold/20 border-t-gold rounded-full animate-spin" />
        <div className="absolute inset-0 w-8 h-8 border-2 border-transparent border-b-accent/20 rounded-full animate-spin" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
      </div>
      <span className="text-xs text-muted">{text}</span>
    </div>
  );
}

export function PageLoading() {
  return <PageSkeleton />;
}

export function InlineLoading() {
  return (
    <div className="flex items-center gap-2 py-2">
      <div className="w-4 h-4 border-2 border-gold/20 border-t-gold rounded-full animate-spin" />
      <span className="text-[10px] text-muted">Loading...</span>
    </div>
  );
}
