"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[DashboardError]", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="text-center max-w-sm">
        <div className="w-14 h-14 rounded-2xl bg-error/10 flex items-center justify-center mx-auto mb-5">
          <AlertTriangle size={24} className="text-error" />
        </div>

        <h2 className="text-lg font-bold text-foreground mb-1">Something went wrong</h2>
        <p className="text-xs text-muted mb-2">
          This section encountered an error. The rest of the dashboard is still working.
        </p>

        {error.message && (
          <p className="text-[11px] font-mono text-error/80 bg-error/5 border border-error/10 rounded-lg px-3 py-2 mb-6 break-words">
            {error.message}
          </p>
        )}

        <div className="flex items-center justify-center gap-2">
          <button
            onClick={reset}
            className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5"
          >
            <RefreshCw size={12} />
            Try Again
          </button>
          <a
            href="/dashboard"
            className="btn-secondary text-xs py-2 px-4 flex items-center gap-1.5"
          >
            <Home size={12} />
            Dashboard
          </a>
        </div>

        {error.digest && (
          <p className="text-[10px] text-muted/50 font-mono mt-6">
            Error ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
