"use client";

import React from "react";
import Link from "next/link";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  /** Optional section label (e.g. "CRM", "Scraper") shown in the fallback UI. */
  section?: string;
  /** If true, fallback renders as a compact card instead of full-height block. */
  compact?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  reporting: boolean;
  reported: boolean;
}

/**
 * React error boundary for the ShortStack OS dashboard.
 *
 * - Class component (required — error boundaries must be classes).
 * - Catches render/lifecycle errors in children, shows branded fallback UI.
 * - Lets the user retry (reset state), navigate home, or report the bug.
 * - Reports errors to `/api/errors/report` which writes to `trinity_log`.
 *
 * Use around heavyweight dashboard sections so a crash in one part doesn't
 * blank the whole app. Next.js `error.tsx` files cover route-segment-level
 * errors; this component is for granular in-page wrapping.
 */
export default class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      reporting: false,
      reported: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error);
    console.error(
      "[ErrorBoundary] Component stack:",
      errorInfo.componentStack
    );
    // Fire-and-forget auto-report so errors are captured server-side even
    // if the user never clicks "Report bug". Best-effort, swallow failures.
    this.sendReport(error, errorInfo.componentStack ?? null, false).catch(() => {
      /* ignore */
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      reporting: false,
      reported: false,
    });
  };

  handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  handleReport = async () => {
    if (!this.state.error || this.state.reporting || this.state.reported) return;
    this.setState({ reporting: true });
    try {
      await this.sendReport(this.state.error, null, true);
      this.setState({ reporting: false, reported: true });
    } catch {
      this.setState({ reporting: false });
    }
  };

  private async sendReport(
    error: Error,
    componentStack: string | null,
    manual: boolean
  ): Promise<void> {
    if (typeof window === "undefined") return;
    try {
      await fetch("/api/errors/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: error.message,
          stack: error.stack ?? null,
          componentStack,
          pathname: window.location.pathname,
          userAgent: navigator.userAgent,
          section: this.props.section ?? null,
          manual,
        }),
      });
    } catch {
      // Never throw from an error boundary's reporter.
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    const isDev = process.env.NODE_ENV !== "production";
    const message =
      this.state.error?.message || "An unexpected error occurred.";
    const section = this.props.section;

    if (this.props.compact) {
      return (
        <div className="card border-danger/15 text-center py-8">
          <div className="w-10 h-10 rounded-full bg-danger/10 flex items-center justify-center mx-auto mb-3">
            <AlertIcon className="w-5 h-5 text-danger" />
          </div>
          <h3 className="text-sm font-semibold mb-1 text-foreground">
            Something went wrong{section ? ` in ${section}` : " on this page"}
          </h3>
          {isDev && (
            <p className="text-[10px] font-mono text-danger/80 bg-danger/5 border border-danger/10 rounded-lg px-3 py-2 mb-3 mx-4 break-words">
              {message}
            </p>
          )}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <button
              onClick={this.handleReset}
              className="btn-secondary text-xs px-3 py-1.5"
            >
              Try again
            </button>
            <button
              onClick={this.handleReload}
              className="btn-secondary text-xs px-3 py-1.5"
            >
              Reload page
            </button>
            <button
              onClick={this.handleReport}
              disabled={this.state.reporting || this.state.reported}
              className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50"
            >
              {this.state.reported
                ? "Reported"
                : this.state.reporting
                ? "Reporting…"
                : "Report bug"}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center min-h-[400px] p-6">
        <div className="bg-surface rounded-2xl border border-border shadow-card p-8 max-w-md w-full text-center">
          <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center mx-auto mb-4">
            <AlertIcon className="w-6 h-6 text-danger" />
          </div>

          <h2 className="text-sm font-semibold text-foreground mb-1">
            Something went wrong{section ? ` in ${section}` : " on this page"}
          </h2>
          <p className="text-xs text-muted mb-4 leading-relaxed">
            This section crashed, but the rest of the app is still running.
          </p>

          {isDev && (
            <p className="text-[11px] font-mono text-danger/80 bg-danger/5 border border-danger/10 rounded-lg px-3 py-2 mb-4 break-words text-left">
              {message}
            </p>
          )}

          <div className="flex items-center justify-center gap-2 flex-wrap">
            <button
              onClick={this.handleReset}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-gold text-black hover:bg-gold-dark transition-colors"
            >
              Try again
            </button>
            <button
              onClick={this.handleReload}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-border text-foreground hover:bg-surface-light transition-colors"
            >
              Reload page
            </button>
            <Link
              href="/dashboard"
              className="px-4 py-2 text-xs font-medium rounded-lg border border-border text-foreground hover:bg-surface-light transition-colors"
            >
              Go to dashboard home
            </Link>
            <button
              onClick={this.handleReport}
              disabled={this.state.reporting || this.state.reported}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-border text-foreground hover:bg-surface-light transition-colors disabled:opacity-50"
            >
              {this.state.reported
                ? "Reported"
                : this.state.reporting
                ? "Reporting…"
                : "Report bug"}
            </button>
          </div>
        </div>
      </div>
    );
  }
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
      />
    </svg>
  );
}
