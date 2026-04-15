"use client";

import Link from "next/link";

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}

export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="relative flex flex-col items-center justify-center text-center py-16 px-6 rounded-2xl border border-dashed border-border bg-gradient-to-b from-gold/[0.02] to-transparent overflow-hidden">
      {/* Background pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Subtle glow behind icon */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full bg-gold/[0.04] blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center">
        <div className="w-14 h-14 rounded-2xl bg-gold/10 flex items-center justify-center mb-4 text-gold">
          {icon}
        </div>
        <h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>
        <p className="text-xs text-muted max-w-xs">{description}</p>

        {actionLabel && (actionHref || onAction) && (
          actionHref ? (
            <Link
              href={actionHref}
              className="mt-5 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-semibold text-white transition-all hover:-translate-y-0.5"
              style={{
                background: "var(--color-accent, #C9A84C)",
                boxShadow: "0 1px 3px rgba(201,168,76,0.2)",
              }}
            >
              {actionLabel}
            </Link>
          ) : (
            <button
              onClick={onAction}
              className="mt-5 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-semibold text-white transition-all hover:-translate-y-0.5"
              style={{
                background: "var(--color-accent, #C9A84C)",
                boxShadow: "0 1px 3px rgba(201,168,76,0.2)",
              }}
            >
              {actionLabel}
            </button>
          )
        )}
      </div>
    </div>
  );
}
