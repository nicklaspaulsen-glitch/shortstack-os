"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, AlertCircle } from "lucide-react";
import type { AutoSaveStatus } from "@/lib/use-auto-save";

interface AutoSaveIndicatorProps {
  status: AutoSaveStatus;
  lastSavedAt?: Date | null;
  error?: string | null;
  className?: string;
}

function formatRelativeTime(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  const minutes = Math.floor(diff / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function AutoSaveIndicator({ status, lastSavedAt, error, className = "" }: AutoSaveIndicatorProps) {
  // Tick so the "saved Xs ago" label stays current
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!lastSavedAt) return;
    const id = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(id);
  }, [lastSavedAt]);

  // Hide entirely when idle and no previous save
  if (status === "idle" && !lastSavedAt) return null;

  let content: React.ReactNode = null;
  let colorClass = "";
  let borderClass = "";
  let bgClass = "";

  if (status === "saving") {
    colorClass = "text-gold";
    borderClass = "border-gold/30";
    bgClass = "bg-gold/5";
    content = (
      <>
        <Loader2 size={12} className="animate-spin" />
        <span>Saving...</span>
      </>
    );
  } else if (status === "error") {
    colorClass = "text-red-400";
    borderClass = "border-red-500/30";
    bgClass = "bg-red-500/5";
    content = (
      <>
        <AlertCircle size={12} />
        <span>{error || "Save failed"}</span>
      </>
    );
  } else if (status === "saved") {
    colorClass = "text-emerald-400";
    borderClass = "border-emerald-500/30";
    bgClass = "bg-emerald-500/5";
    content = (
      <>
        <Check size={12} />
        <span>Saved</span>
      </>
    );
  } else if (lastSavedAt) {
    // idle, but has a last save timestamp
    colorClass = "text-muted";
    borderClass = "border-border/30";
    bgClass = "bg-surface/70";
    content = (
      <>
        <Check size={12} className="opacity-60" />
        <span>Saved {formatRelativeTime(lastSavedAt)}</span>
      </>
    );
  }

  return (
    <div
      className={`fixed top-20 right-6 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-full border backdrop-blur-md text-[11px] font-medium transition-all duration-300 ${colorClass} ${borderClass} ${bgClass} ${className}`}
      style={{
        animation: "autosave-fade 0.25s ease-out",
      }}
    >
      {content}
      <style jsx>{`
        @keyframes autosave-fade {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
