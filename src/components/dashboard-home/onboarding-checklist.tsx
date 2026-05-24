"use client";

import { CaretDown, CaretUp, CheckCircle, Circle, X } from "@phosphor-icons/react";

/**
 * OnboardingChecklist — Persistent new-user activation widget.
 *
 * Shows a progress strip with 5 action items. Each item links directly to the
 * relevant page. Completion is detected from real API data (clients count,
 * voice clones, social posts) so the checkmarks reflect reality, not just
 * "did the user click it".
 *
 * Persists via localStorage — dismissed after 14 days OR when all 5 items
 * are complete. Based on Linear / Intercom / Loom onboarding patterns.
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface ChecklistItem {
  id: string;
  label: string;
  detail: string;
  time: string;
  href: string;
}

const ITEMS: ChecklistItem[] = [
  {
    id: "client",
    label: "Add your first client",
    detail: "Start tracking revenue, projects, and communications in one place.",
    time: "2 min",
    href: "/dashboard/clients",
  },
  {
    id: "voice",
    label: "Record a voice sample",
    detail: "Give ShortStack your voice — use it for content, calls, and outreach.",
    time: "5 min",
    href: "/dashboard/voice-studio",
  },
  {
    id: "social",
    label: "Schedule your first social post",
    detail: "Connect an account and queue your first post to go out automatically.",
    time: "3 min",
    href: "/dashboard/social-media",
  },
  {
    id: "integration",
    label: "Connect a tool you already use",
    detail: "Link your calendar, CRM, or communication platform to ShortStack.",
    time: "2 min",
    href: "/dashboard/integrations-hub",
  },
  {
    id: "automation",
    label: "Set up your first automation",
    detail: "Let ShortStack handle a repetitive task automatically — like payment reminders.",
    time: "3 min",
    href: "/dashboard/automations",
  },
];

const STORAGE_KEY = "shortstack_onboarding_v1";
const DISMISS_DAYS = 14;

interface StoredState {
  dismissed: boolean;
  dismissedAt?: number;
  manualChecked: string[];
}

function getStoredState(): StoredState {
  if (typeof window === "undefined") return { dismissed: false, manualChecked: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { dismissed: false, manualChecked: [] };
    const parsed = JSON.parse(raw) as StoredState;
    // Auto-expire after DISMISS_DAYS days
    if (parsed.dismissedAt && Date.now() - parsed.dismissedAt > DISMISS_DAYS * 86400_000) {
      localStorage.removeItem(STORAGE_KEY);
      return { dismissed: false, manualChecked: [] };
    }
    return parsed;
  } catch {
    return { dismissed: false, manualChecked: [] };
  }
}

function saveStoredState(state: StoredState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage can be blocked in strict privacy modes
  }
}

interface OnboardingChecklistProps {
  /** IDs of checklist items confirmed complete by real API data. */
  completedFromApi?: string[];
}

export default function OnboardingChecklist({ completedFromApi = [] }: OnboardingChecklistProps) {
  const [stored, setStored] = useState<StoredState>({ dismissed: false, manualChecked: [] });
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Hydrate from localStorage on mount (avoids SSR mismatch)
  useEffect(() => {
    const s = getStoredState();
    setStored(s);
    setMounted(true);
  }, []);

  const allCompleted = useCallback(
    (manualChecked: string[]) => {
      return ITEMS.every(
        (item) => completedFromApi.includes(item.id) || manualChecked.includes(item.id),
      );
    },
    [completedFromApi],
  );

  const dismiss = useCallback(() => {
    const next: StoredState = { ...stored, dismissed: true, dismissedAt: Date.now() };
    setStored(next);
    saveStoredState(next);
  }, [stored]);

  const toggleManual = useCallback(
    (id: string) => {
      const current = stored.manualChecked || [];
      const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
      const nextState: StoredState = { ...stored, manualChecked: next };
      setStored(nextState);
      saveStoredState(nextState);
    },
    [stored],
  );

  // Don't render until client-side hydration (avoids localStorage SSR mismatch)
  if (!mounted) return null;
  // Don't render if dismissed
  if (stored.dismissed) return null;
  // Don't render if all items are complete (hide gracefully)
  if (allCompleted(stored.manualChecked || [])) return null;

  const completedCount = ITEMS.filter(
    (item) =>
      completedFromApi.includes(item.id) || (stored.manualChecked || []).includes(item.id),
  ).length;

  const pct = Math.round((completedCount / ITEMS.length) * 100);

  return (
    <div
      className="rounded-xl border border-[rgba(0,0,0,0.08)] overflow-hidden"
      style={{ background: "rgba(255,255,255,0.88)", backdropFilter: "blur(24px) saturate(1.8)", WebkitBackdropFilter: "blur(24px) saturate(1.8)" }}
      role="region"
      aria-label="Getting started checklist"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0">
            <div className="text-xs font-medium text-[#374151]">Getting started</div>
            <div className="text-xs text-[#6B7280] mt-0.5">
              {completedCount} of {ITEMS.length} complete
            </div>
          </div>

          {/* Progress bar */}
          <div className="flex-1 min-w-[80px] max-w-[160px]">
            <div
              className="h-1.5 rounded-full bg-[rgba(0,0,0,0.08)] overflow-hidden"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${pct}% of setup complete`}
            >
              <div
                className="h-full rounded-full bg-[#D4FF00] transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="p-1.5 rounded-md text-[#6F6F7A] hover:text-[#A8A8B2] hover:bg-[rgba(0,0,0,0.04)] transition-colors"
            aria-label={collapsed ? "Expand checklist" : "Collapse checklist"}
            aria-expanded={!collapsed}
          >
            {collapsed ? (
              <CaretDown className="h-3.5 w-3.5" />
            ) : (
              <CaretUp className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            onClick={dismiss}
            className="p-1.5 rounded-md text-[#6F6F7A] hover:text-[#A8A8B2] hover:bg-[rgba(0,0,0,0.04)] transition-colors"
            aria-label="Dismiss getting started checklist"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Items */}
      {!collapsed && (
        <div className="border-t border-[rgba(0,0,0,0.07)]">
          {ITEMS.map((item, idx) => {
            const done =
              completedFromApi.includes(item.id) || (stored.manualChecked || []).includes(item.id);
            const isLast = idx === ITEMS.length - 1;

            return (
              <div
                key={item.id}
                className={`flex items-start gap-3 px-4 py-2.5 group ${
                  !isLast ? "border-b border-[rgba(0,0,0,0.05)]" : ""
                } ${done ? "opacity-50" : "hover:bg-[rgba(0,0,0,0.04)]"} transition-colors`}
              >
                {/* Checkbox — toggle manually or confirmed via API */}
                <button
                  onClick={() => toggleManual(item.id)}
                  aria-label={done ? `Mark "${item.label}" as incomplete` : `Mark "${item.label}" as complete`}
                  className="mt-0.5 flex-shrink-0 text-[#6F6F7A] hover:text-[#D4FF00] transition-colors"
                >
                  {done ? (
                    <CheckCircle className="h-4 w-4 text-[#D4FF00]" />
                  ) : (
                    <Circle className="h-4 w-4" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <Link
                    href={item.href}
                    className={`block group-hover:text-[#111827] transition-colors ${
                      done ? "text-[#6B7280] line-through" : "text-[#374151]"
                    }`}
                  >
                    <span className="text-sm font-medium">{item.label}</span>
                    {!done && (
                      <p className="text-xs text-[#6B7280] mt-0.5 line-clamp-1">{item.detail}</p>
                    )}
                  </Link>
                </div>

                {!done && (
                  <span className="flex-shrink-0 text-[10px] text-[#6B7280] font-mono mt-0.5 tabular-nums">
                    ~{item.time}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

