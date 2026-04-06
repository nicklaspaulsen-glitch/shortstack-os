"use client";

import { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="card border-danger/15 text-center py-8">
          <AlertTriangle size={24} className="mx-auto mb-3 text-danger/50" />
          <h3 className="text-sm font-semibold mb-1">Something went wrong</h3>
          <p className="text-[10px] text-muted mb-3">
            {this.state.error?.message || "An unexpected error occurred"}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="btn-secondary text-xs flex items-center gap-1.5 mx-auto"
          >
            <RefreshCw size={12} /> Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
