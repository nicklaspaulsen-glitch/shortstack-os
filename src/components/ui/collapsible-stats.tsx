"use client";

/**
 * CollapsibleStats — a thin wrapper around a stats strip that can be
 * collapsed to a compact inline-pill summary. Collapsed state persists
 * to localStorage per `storageKey` so users keep their preference.
 *
 * Usage:
 *   <CollapsibleStats
 *     storageKey="crm.stats"
 *     title="CRM Stats"
 *     summary={<>Total {total} · Avg {avg}</>}
 *   >
 *     <div className="grid grid-cols-4 gap-3">{...cards}</div>
 *   </CollapsibleStats>
 */

import { ReactNode, useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface CollapsibleStatsProps {
  storageKey: string;
  title: ReactNode;
  summary?: ReactNode;
  children: ReactNode;
  defaultCollapsed?: boolean;
  icon?: ReactNode;
}

export default function CollapsibleStats({
  storageKey,
  title,
  summary,
  children,
  defaultCollapsed = true,
  icon,
}: CollapsibleStatsProps) {
  const [collapsed, setCollapsed] = useState<boolean>(defaultCollapsed);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`stats-collapsed:${storageKey}`);
      if (raw === "true") setCollapsed(true);
      else if (raw === "false") setCollapsed(false);
    } catch {
      /* localStorage unavailable (SSR/privacy mode); keep default */
    }
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(`stats-collapsed:${storageKey}`, String(collapsed));
    } catch {
      /* noop */
    }
  }, [collapsed, hydrated, storageKey]);

  return (
    <div className="card p-0 overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between gap-3 px-4 py-2 hover:bg-surface-light/50 transition-colors"
        aria-expanded={!collapsed}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {icon}
          <span className="text-xs font-semibold shrink-0">{title}</span>
          {collapsed && summary && (
            <span className="text-[10px] text-muted truncate flex items-center gap-1.5">
              {summary}
            </span>
          )}
        </div>
        {collapsed ? (
          <ChevronDown size={14} className="text-muted shrink-0" />
        ) : (
          <ChevronUp size={14} className="text-muted shrink-0" />
        )}
      </button>
      {!collapsed && <div className="px-4 pb-4 pt-1">{children}</div>}
    </div>
  );
}
