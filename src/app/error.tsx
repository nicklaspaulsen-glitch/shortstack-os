"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "#0b0d12" }}
    >
      <div className="text-center max-w-md">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ background: "rgba(239, 68, 68, 0.1)" }}
        >
          <svg
            className="w-8 h-8"
            style={{ color: "#EF4444" }}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
            />
          </svg>
        </div>

        <h1
          className="text-2xl font-bold mb-2"
          style={{ color: "#F9FAFB" }}
        >
          Something went wrong
        </h1>
        <p
          className="text-sm mb-2 leading-relaxed"
          style={{ color: "#9CA3AF" }}
        >
          An unexpected error occurred. Our team has been notified.
        </p>
        {error.message && (
          <p
            className="text-xs mb-8 font-mono px-4 py-2 rounded-lg inline-block"
            style={{
              color: "#EF4444",
              background: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.15)",
            }}
          >
            {error.message}
          </p>
        )}

        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={reset}
            className="px-5 py-2.5 text-sm font-medium rounded-lg transition-colors"
            style={{
              background: "#C9A84C",
              color: "#FFFFFF",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "#A8893D")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "#C9A84C")
            }
          >
            Try Again
          </button>
          <a
            href="/"
            className="px-5 py-2.5 text-sm font-medium rounded-lg transition-colors"
            style={{
              border: "1px solid #374151",
              color: "#D1D5DB",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(255,255,255,0.05)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            Go Home
          </a>
        </div>

        {error.digest && (
          <p
            className="text-xs mt-8 font-mono"
            style={{ color: "#4B5563" }}
          >
            Error ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
