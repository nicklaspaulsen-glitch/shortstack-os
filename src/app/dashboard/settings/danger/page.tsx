"use client";

/**
 * Danger Zone — irreversible account actions surface.
 *
 * Apr 28: created in response to the bug-hunt that found
 * `/dashboard/settings/danger` 404'd from the settings index card.
 * Ships as a minimal scaffold with the three action types the user
 * expects (export data, transfer ownership, delete account); the
 * actual destructive endpoints will be wired in a follow-up commit
 * — for now each action shows a "contact support" toast so the page
 * is reachable without exposing half-built destructive flows.
 */

import { useState } from "react";
import toast from "react-hot-toast";
import { AlertTriangle, Download, ArrowLeftRight, Trash2 } from "lucide-react";
import { MotionPage } from "@/components/motion/motion-page";

export default function DangerZonePage() {
  const [busy, setBusy] = useState<string | null>(null);

  async function handleExport(): Promise<void> {
    setBusy("export");
    try {
      // Stub — wire to /api/account/export when that endpoint ships.
      await new Promise((r) => setTimeout(r, 300));
      toast(
        "Data export isn't fully wired yet. Email support@shortstack.work and we'll hand-roll your export within 24h.",
        { duration: 8000 }
      );
    } finally {
      setBusy(null);
    }
  }

  async function handleTransfer(): Promise<void> {
    setBusy("transfer");
    try {
      await new Promise((r) => setTimeout(r, 300));
      toast(
        "Ownership transfer requires a verified second user. Contact support@shortstack.work to start the process.",
        { duration: 8000 }
      );
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete(): Promise<void> {
    if (
      !window.confirm(
        "This will permanently delete your workspace, every client account, all pipeline data, and every connected integration. This action cannot be undone. Are you sure?"
      )
    ) {
      return;
    }
    setBusy("delete");
    try {
      await new Promise((r) => setTimeout(r, 300));
      toast.error(
        "For your protection, account deletion runs a manual review. Email support@shortstack.work — we'll process within 1 business day.",
        { duration: 9000 }
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <MotionPage className="space-y-6 max-w-3xl">{/* -- Danger Zone command strip -- */}
    <div className="flex items-center justify-between gap-4 px-1 py-3 sm:py-4">
      <div className="min-w-0">
        <p className="font-editorial text-[11px] italic text-text-muted mb-0.5">Settings</p>
        <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-primary leading-none">Danger Zone</h1>
      </div>
    </div><section className="card">
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-surface-light p-2.5 text-text-secondary">
                  <Download size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-text-primary">Export workspace data</h3>
                  <p className="mt-1 text-[13px] text-text-secondary leading-relaxed">
                    Bundle every client, lead, deal, contract, content draft, scheduled
                    post and conversation transcript into a downloadable archive. Useful
                    before a tier change, ownership transfer, or migration.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={busy !== null}
                  className="btn-secondary text-xs disabled:opacity-50"
                >
                  {busy === "export" ? "Working..." : "Request export"}
                </button>
              </div>
            </section><section className="card">
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-surface-light p-2.5 text-text-secondary">
                  <ArrowLeftRight size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-text-primary">Transfer workspace ownership</h3>
                  <p className="mt-1 text-[13px] text-text-secondary leading-relaxed">
                    Move the workspace + active subscription onto a different verified
                    ShortStack user. Existing clients, integrations, and team members
                    keep their access; you become a regular team member afterwards.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleTransfer}
                  disabled={busy !== null}
                  className="btn-secondary text-xs disabled:opacity-50"
                >
                  {busy === "transfer" ? "Working..." : "Start transfer"}
                </button>
              </div>
            </section><section
              className="card"
              style={{
                borderColor: "rgba(242, 96, 99, 0.30)",
                background: "linear-gradient(180deg, color-mix(in srgb, #F26063 6%, transparent) 0%, transparent 60%)",
              }}
            >
              <div className="flex items-start gap-4">
                <div className="rounded-lg p-2.5 text-status-error" style={{ background: "rgba(242, 96, 99, 0.08)" }}>
                  <Trash2 size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-status-error">Delete account</h3>
                  <p className="mt-1 text-[13px] text-text-secondary leading-relaxed">
                    Permanently remove your workspace, every client account, pipeline,
                    integration, and conversation. Subscription cancels immediately,
                    with no refund for the current billing period.
                  </p>
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] text-status-error">
                    <AlertTriangle size={11} />
                    <span>This action cannot be undone.</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={busy !== null}
                  className="text-xs px-3 py-2 rounded-lg text-white font-medium disabled:opacity-50"
                  style={{ background: "rgb(var(--status-error-rgb, 242 96 99))" }}
                >
                  {busy === "delete" ? "Working..." : "Delete account"}
                </button>
              </div>
            </section></MotionPage>
  );
}
