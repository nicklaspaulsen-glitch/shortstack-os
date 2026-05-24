"use client";
import { ArrowsClockwise, CalendarDots, Chat, CheckCircle, CircleNotch, Envelope, FileText, Globe, GlobeHemisphereWest, Lightning, PauseCircle, Play, PlayCircle, Receipt, Sparkle, Star, UserPlus, Warning, X } from "@phosphor-icons/react";

import type { Icon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

// Map lucide icon names (string from the action catalog) to real
// components. Anything unknown falls back to Sparkle.
const ICON_MAP: Record<string, Icon> = {
  ArrowsClockwise, Receipt, PauseCircle, Sparkle, CalendarDots, Globe, GlobeHemisphereWest,
  Star, PlayCircle, Lightning, Envelope, Chat, UserPlus, FileText, Warning,
};

interface Suggestion {
  action: string;
  label: string;
  reason: string;
  estimated_impact: string;
  one_click_payload: Record<string, unknown>;
  // Icon name from the catalog def (falls back when the API omits it).
  icon?: string;
}

interface SmartManageOverlayProps {
  clientId: string;
  clientName?: string;
  isOpen: boolean;
  onClose: () => void;
}

// Catalog icon hints duplicated client-side so we can render the right
// icon without fetching the catalog def for every suggestion.
const ACTION_ICONS: Record<string, string> = {
  refresh_social_token: "ArrowsClockwise",
  send_invoice_reminder: "Receipt",
  pause_ad_campaign: "PauseCircle",
  generate_content_batch: "Sparkle",
  book_strategy_call: "CalendarDots",
  resend_dns_records: "Globe",
  renew_domain: "GlobeHemisphereWest",
  request_review: "Star",
  send_onboarding_resume: "PlayCircle",
  trigger_workflow: "Lightning",
  add_to_sequence: "Envelope",
  send_sms_followup: "Chat",
  assign_to_team_member: "UserPlus",
  escalate_ticket: "Warning",
  create_proposal: "FileText",
};

export default function SmartManageOverlay({
  clientId,
  clientName,
  isOpen,
  onClose,
}: SmartManageOverlayProps) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState<Record<string, boolean>>({});
  const [completed, setCompleted] = useState<Record<string, "success" | "failed" | "todo">>({});

  useEffect(() => {
    if (!isOpen) return;
    setSuggestions([]);
    setError(null);
    setCompleted({});
    setLoading(true);

    fetch("/api/trinity/suggest-actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error || "Failed to fetch suggestions");
        return r.json();
      })
      .then((data) => setSuggestions(data.suggestions || []))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [isOpen, clientId]);

  // Close on Escape + scroll-lock that preserves visual scroll position.
  // (Plain overflow:hidden makes the page snap to top in some browsers.)
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);

    const scrollY = window.scrollY;
    const body = document.body;
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handler);
      body.style.position = "";
      body.style.top = "";
      body.style.left = "";
      body.style.right = "";
      body.style.overflow = "";
      window.scrollTo({ top: scrollY, behavior: "instant" });
    };
  }, [isOpen, onClose]);

  async function runAction(s: Suggestion, idx: number) {
    const key = `${idx}-${s.action}`;
    setRunning((p) => ({ ...p, [key]: true }));
    const tid = toast.loading(`Running: ${s.label}`);
    try {
      const res = await fetch("/api/smart-manage/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          action_type: s.action,
          payload: s.one_click_payload || {},
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(`Action completed: ${s.label}`, { id: tid });
        setCompleted((p) => ({ ...p, [key]: "success" }));
      } else if (res.status === 501 || data.outcome === "todo") {
        toast(`Not yet wired: ${s.label}`, { id: tid, icon: "🛠" });
        setCompleted((p) => ({ ...p, [key]: "todo" }));
      } else {
        toast.error(`Failed: ${data.message || data.error || "Unknown error"}`, { id: tid });
        setCompleted((p) => ({ ...p, [key]: "failed" }));
      }
    } catch (err) {
      toast.error(`Failed: ${err instanceof Error ? err.message : String(err)}`, { id: tid });
      setCompleted((p) => ({ ...p, [key]: "failed" }));
    } finally {
      setRunning((p) => ({ ...p, [key]: false }));
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Sheet — slides in from the right */}
      <div className="relative w-full max-w-md h-full bg-surface border-l border-border-subtle/50 shadow-2xl shadow-black/50 overflow-y-auto">
        <div className="sticky top-0 z-10 bg-surface/95 backdrop-blur-sm border-b border-border-subtle/30 px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-[rgba(212,255,0,0.08)] rounded-lg flex items-center justify-center">
              <Sparkle size={14} className="text-[#D4FF00]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Smart Manage</h2>
              <p className="text-[10px] text-text-muted">
                {clientName ? `Trinity for ${clientName}` : "Trinity suggestions"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-surface-light text-text-muted hover:text-text-primary transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {loading && (
            <>
              <div className="flex items-center gap-2 text-text-muted text-xs">
                <CircleNotch size={12} className="animate-spin" /> Trinity is analyzing this client...
              </div>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-24 rounded-xl border border-border-subtle bg-surface-light/40 animate-pulse"
                />
              ))}
            </>
          )}

          {!loading && error && (
            <div className="rounded-xl border border-danger/30 bg-danger/[0.05] p-4 text-xs text-danger">
              {error}
            </div>
          )}

          {!loading && !error && suggestions.length === 0 && (
            <div className="rounded-xl border border-border-subtle bg-surface-light/40 p-5 text-center text-xs text-text-muted">
              Nothing urgent for this client right now.
            </div>
          )}

          {!loading && suggestions.map((s, idx) => {
            const iconName = s.icon || ACTION_ICONS[s.action] || "Sparkle";
            const Icon = ICON_MAP[iconName] || Sparkle;
            const key = `${idx}-${s.action}`;
            const isRunning = !!running[key];
            const state = completed[key];
            return (
              <div
                key={key}
                className={`rounded-xl border p-3.5 transition-colors ${
                  state === "success"
                    ? "border-success/30 bg-success/[0.04]"
                    : state === "failed"
                      ? "border-danger/30 bg-danger/[0.04]"
                      : state === "todo"
                        ? "border-warning/30 bg-warning/[0.04]"
                        : "border-border-subtle bg-surface-light/40 hover:border-[rgba(212,255,0,0.25)]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[rgba(212,255,0,0.08)] flex items-center justify-center shrink-0">
                    <Icon size={14} className="text-[#D4FF00]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-text-primary leading-tight">
                      {s.label}
                    </p>
                    <p className="text-[11px] text-text-muted mt-1 leading-snug">
                      {s.reason}
                    </p>
                    {s.estimated_impact && (
                      <p className="text-[10px] text-[#D4FF00] font-semibold mt-1.5">
                        Impact: {s.estimated_impact}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3">
                  <span className="text-[9px] text-text-muted font-mono uppercase tracking-wider">
                    {s.action.replace(/_/g, " ")}
                  </span>
                  <button
                    onClick={() => runAction(s, idx)}
                    disabled={isRunning || state === "success"}
                    className={`text-[10px] px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors ${
                      state === "success"
                        ? "bg-success/10 text-success cursor-default"
                        : state === "failed"
                          ? "bg-danger/10 text-danger hover:bg-danger/15"
                          : "bg-[#D4FF00] text-[#020711] hover:bg-[#AACC00] disabled:opacity-50"
                    }`}
                  >
                    {isRunning ? (
                      <><CircleNotch size={10} className="animate-spin" /> Running...</>
                    ) : state === "success" ? (
                      <><CheckCircle size={10} /> Done</>
                    ) : state === "failed" ? (
                      <><Warning size={10} /> Retry</>
                    ) : state === "todo" ? (
                      <><Warning size={10} /> TODO</>
                    ) : (
                      <><Play size={10} /> Run</>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
