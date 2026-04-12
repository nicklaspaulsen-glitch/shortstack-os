"use client";

import React from "react";
import Link from "next/link";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error);
    console.error("[ErrorBoundary] Component stack:", errorInfo.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center min-h-[400px] p-6">
          <div className="bg-surface rounded-2xl border border-border shadow-card p-8 max-w-md w-full text-center">
            <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-6 h-6 text-danger"
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
            </div>

            <h2 className="text-sm font-semibold text-foreground mb-1">
              Something went wrong
            </h2>
            <p className="text-xs text-muted mb-6 leading-relaxed">
              {this.state.error?.message ||
                "An unexpected error occurred. Please try again."}
            </p>

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-gold text-white hover:bg-gold-dark transition-colors"
              >
                Try Again
              </button>
              <Link
                href="/dashboard"
                className="px-4 py-2 text-xs font-medium rounded-lg border border-border text-foreground hover:bg-surface-light transition-colors"
              >
                Go to Dashboard
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
