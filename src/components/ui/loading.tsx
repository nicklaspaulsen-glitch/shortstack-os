"use client";

export default function Loading({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <div className="w-8 h-8 border-2 border-gold/20 border-t-gold rounded-full animate-spin" />
      <span className="text-sm text-muted">{text}</span>
    </div>
  );
}

export function PageLoading() {
  return (
    <div className="flex items-center justify-center h-[60vh]">
      <Loading />
    </div>
  );
}
