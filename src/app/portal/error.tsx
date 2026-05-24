"use client";
import { ArrowsClockwise, House, PaperPlaneTilt, Warning } from "@phosphor-icons/react";

import { useEffect, useState } from "react";
import Link from "next/link";


/**
 * Next.js App Router error boundary for the `/portal/*` segment.
 * Catches uncaught render errors in any client portal route and renders
 * a branded fallback instead of crashing the whole app.
 */
export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);

  useEffect(() => {
    console.error("[PortalError]", error);
    if (typeof window === "undefined") return;
    fetch("/api/errors/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: error.message,
        stack: error.stack ?? null,
        digest: error.digest ?? null,
        pathname: window.location.pathname,
        userAgent: navigator.userAgent,
        section: "portal",
        manual: false,
      }),
    }).catch(() => {
      /* best-effort */
    });
  }, [error]);

  async function handleReport() {
    if (reporting || reported) return;
    setReporting(true);
    try {
      await fetch("/api/errors/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: error.message,
          stack: error.stack ?? null,
          digest: error.digest ?? null,
          pathname: window.location.pathname,
          userAgent: navigator.userAgent,
          section: "portal",
          manual: true,
        }),
      });
      setReported(true);
    } catch {
      /* ignore */
    } finally {
      setReporting(false);
    }
  }

  const isDev = process.env.NODE_ENV !== "production";

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="text-center max-w-md">
        <div className="w-14 h-14  bg-danger/10 flex items-center justify-center mx-auto mb-5">
          <Warning size={24} className="text-danger" />
        </div>

        <h2 className="text-lg font-bold text-text-primary mb-1">
          Something went wrong on this page
        </h2>
        <p className="text-xs text-text-muted mb-4">
          This page crashed — the rest of the portal is still working.
        </p>

        {isDev && error.message && (
          <p className="text-[11px] font-mono text-danger/80 bg-danger/5 border border-danger/10 rounded-lg px-3 py-2 mb-5 break-words text-left">
            {error.message}
          </p>
        )}

        <div className="flex items-center justify-center gap-2 flex-wrap">
          <button
            onClick={reset}
            className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5"
          >
            <ArrowsClockwise size={12} />
            Try again
          </button>
          <button
            onClick={() =>
              typeof window !== "undefined" && window.location.reload()
            }
            className="btn-secondary text-xs py-2 px-4 flex items-center gap-1.5"
          >
            <ArrowsClockwise size={12} />
            Reload page
          </button>
          <Link
            href="/"
            className="btn-secondary text-xs py-2 px-4 flex items-center gap-1.5"
          >
            <House size={12} />
            House
          </Link>
          <button
            onClick={handleReport}
            disabled={reporting || reported}
            className="btn-secondary text-xs py-2 px-4 flex items-center gap-1.5 disabled:opacity-50"
          >
            <PaperPlaneTilt size={12} />
            {reported ? "Reported" : reporting ? "Reporting…" : "Report bug"}
          </button>
        </div>

        {error.digest && (
          <p className="text-[10px] text-text-muted/50 font-mono mt-6">
            Error ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
